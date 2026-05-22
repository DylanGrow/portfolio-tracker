export class DataService {
  constructor() {
    // API key injected at build time via VITE_FINNHUB_KEY GitHub Actions secret
    this.proxyUrl = 'https://api.finnhub.io/api/v1';
    this.demoToken = import.meta.env.VITE_FINNHUB_KEY || '';
    this.useMock = false;
    this.cache = new Map();
    this.failureCount = 0;
    this.circuitBroken = false;
    this.circuitBreakerTime = 0;

    // Crypto symbol map: short name → Finnhub exchange:pair format
    this.cryptoMap = {
      'BTC':  'BINANCE:BTCUSDT',
      'ETH':  'BINANCE:ETHUSDT',
      'SOL':  'BINANCE:SOLUSDT',
      'BNB':  'BINANCE:BNBUSDT',
      'DOGE': 'BINANCE:DOGEUSDT',
      'XRP':  'BINANCE:XRPUSDT',
      'ADA':  'BINANCE:ADAUSDT',
      'AVAX': 'BINANCE:AVAXUSDT',
      'MATIC':'BINANCE:MATICUSDT',
      'LINK': 'BINANCE:LINKUSDT',
      'DOT':  'BINANCE:DOTUSDT',
      'LTC':  'BINANCE:LTCUSDT',
    };
  }

  // Returns true if symbol is a known crypto ticker
  isCrypto(symbol) {
    return symbol.toUpperCase() in this.cryptoMap;
  }

  // Converts short crypto symbol to Finnhub exchange pair
  toCryptoSymbol(symbol) {
    return this.cryptoMap[symbol.toUpperCase()] || `BINANCE:${symbol.toUpperCase()}USDT`;
  }

  async getQuote(ticker) {
    const sym = ticker.toUpperCase();
    const cacheKey = `quote_${sym}`;
    const cached = this.checkCache(cacheKey, 15000);
    if (cached) return cached;

    if (this.circuitBroken) {
      if (Date.now() > this.circuitBreakerTime) {
        this.circuitBroken = false;
        this.failureCount = 0;
      } else {
        return this.getMockQuote(sym);
      }
    }

    try {
      let url;
      if (this.isCrypto(sym)) {
        // Crypto quote uses /crypto/candle for latest OHLCV
        const finnhubSym = this.toCryptoSymbol(sym);
        const to = Math.floor(Date.now() / 1000);
        const from = to - 3600; // last hour
        url = `${this.proxyUrl}/crypto/candle?symbol=${finnhubSym}&resolution=1&from=${from}&to=${to}&token=${this.demoToken}`;
      } else {
        url = `${this.proxyUrl}/quote?symbol=${sym}&token=${this.demoToken}`;
      }

      const response = await this.fetchWithRetry(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      let formattedData;
      if (this.isCrypto(sym)) {
        if (data.s !== 'ok' || !data.c || data.c.length === 0) {
          throw new Error('Empty crypto response');
        }
        const price = data.c[data.c.length - 1];
        const open  = data.o[0];
        const high  = Math.max(...data.h);
        const low   = Math.min(...data.l);
        const change = price - open;
        const changePercent = ((change / open) * 100);
        formattedData = {
          price, change, changePercent, high, low,
          open, previousClose: open,
          isCrypto: true,
          history: this.generateSparklineData(price, open)
        };
      } else {
        if (data.c === 0 && data.h === 0) throw new Error('Empty response / limit reached');
        formattedData = {
          price: data.c,
          change: data.d,
          changePercent: data.dp,
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc,
          isCrypto: false,
          history: this.generateSparklineData(data.c, data.pc)
        };
      }

      this.cache.set(cacheKey, { timestamp: Date.now(), data: formattedData });
      this.failureCount = 0;
      return formattedData;
    } catch (e) {
      console.warn(`API failed for ${sym}, using mock. Error:`, e);
      this.handleFailure();
      return this.getMockQuote(sym);
    }
  }

  async getHistoricalData(ticker, timeframe = '1M') {
    const sym = ticker.toUpperCase();
    const cacheKey = `history_${sym}_${timeframe}`;
    const cached = this.checkCache(cacheKey, 300000);
    if (cached) return cached;

    if (this.circuitBroken) return this.getMockHistory(sym, timeframe);

    const { resolution, from, to } = this.getTimeframeInterval(timeframe);

    try {
      let url;
      if (this.isCrypto(sym)) {
        const finnhubSym = this.toCryptoSymbol(sym);
        url = `${this.proxyUrl}/crypto/candle?symbol=${finnhubSym}&resolution=${resolution}&from=${from}&to=${to}&token=${this.demoToken}`;
      } else {
        url = `${this.proxyUrl}/stock/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${this.demoToken}`;
      }

      const response = await this.fetchWithRetry(url);
      if (!response.ok) throw new Error(`HTTP history error! status: ${response.status}`);
      const data = await response.json();
      if (data.s !== 'ok') throw new Error('Finnhub history response status not OK');

      const formattedData = {
        dates: data.t.map(ts => {
          const date = new Date(ts * 1000);
          return timeframe === '1D'
            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }),
        prices: data.c,
        opens:  data.o,
        highs:  data.h,
        lows:   data.l,
        volumes: data.v
      };

      this.cache.set(cacheKey, { timestamp: Date.now(), data: formattedData });
      return formattedData;
    } catch (e) {
      console.warn(`History API failed for ${sym}, using mock. Error:`, e);
      this.handleFailure();
      return this.getMockHistory(sym, timeframe);
    }
  }

  async fetchWithRetry(url, retries = 2, delay = 1000) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay * 2));
        return this.fetchWithRetry(url, retries - 1, delay * 2);
      }
      return res;
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, retries - 1, delay * 1.5);
      }
      throw err;
    }
  }

  handleFailure() {
    this.failureCount++;
    if (this.failureCount >= 3) {
      this.circuitBroken = true;
      this.circuitBreakerTime = Date.now() + 60000;
      console.warn('Circuit breaker activated. Falling back to client-side mocks.');
    }
  }

  checkCache(key, maxAge) {
    if (this.cache.has(key)) {
      const cachedItem = this.cache.get(key);
      if (Date.now() - cachedItem.timestamp < maxAge) return cachedItem.data;
    }
    return null;
  }

  getTimeframeInterval(timeframe) {
    const to = Math.floor(Date.now() / 1000);
    let from, resolution;
    switch (timeframe) {
      case '1D': from = to - 86400;       resolution = '15'; break;
      case '1W': from = to - 86400 * 7;   resolution = '60'; break;
      case '1M': from = to - 86400 * 30;  resolution = 'D';  break;
      case '3M': from = to - 86400 * 90;  resolution = 'D';  break;
      case '1Y': from = to - 86400 * 365; resolution = 'W';  break;
      default:   from = to - 86400 * 30;  resolution = 'D';
    }
    return { resolution, from, to };
  }

  generateSparklineData(current, prevClose) {
    const points = [];
    const step = (current - prevClose) / 6;
    for (let i = 0; i < 7; i++) {
      points.push(prevClose + step * i + (Math.random() - 0.5) * (current * 0.005));
    }
    points[6] = current;
    return points;
  }

  getMockQuote(ticker) {
    const isCrypto = this.isCrypto(ticker);
    const charCodeSum = ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const basePrice = isCrypto
      ? (charCodeSum % 5000) + 100   // crypto prices higher range
      : (charCodeSum % 350) + 50;
    const changePercent = ((charCodeSum % 20) - 10) / 2 + Math.random() - 0.5;
    const price = basePrice * (1 + changePercent / 100);
    const change = price - basePrice;
    return {
      price, change, changePercent,
      high: price * 1.02,
      low: price * 0.98,
      open: basePrice,
      previousClose: basePrice,
      isCrypto,
      history: this.generateSparklineData(price, basePrice)
    };
  }

  getMockHistory(ticker, timeframe) {
    const mockQuote = this.getMockQuote(ticker);
    const basePrice = mockQuote.price;
    const points = timeframe === '1D' ? 24 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : 52;
    const prices = [], dates = [], volumes = [], opens = [], highs = [], lows = [];
    let current = basePrice * 0.9;
    const date = new Date();
    for (let i = points; i >= 0; i--) {
      const stepDate = new Date(date.getTime());
      if (timeframe === '1D') {
        stepDate.setHours(date.getHours() - i);
        dates.push(stepDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        stepDate.setDate(date.getDate() - i);
        dates.push(stepDate.toLocaleDateString([], { month: 'short', day: 'numeric' }));
      }
      const open = current;
      current = current * (1 + (Math.random() - 0.49) * 0.03);
      opens.push(open);
      prices.push(current);
      highs.push(Math.max(open, current) * (1 + Math.random() * 0.01));
      lows.push(Math.min(open, current) * (1 - Math.random() * 0.01));
      volumes.push(Math.floor(Math.random() * 1000000) + 50000);
    }
    return { dates, prices, opens, highs, lows, volumes };
  }
}
