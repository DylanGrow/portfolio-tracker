export class DataService {
  constructor() {
    // Default Finnhub free tier / demo token or Cloudflare proxy url
    this.proxyUrl = 'https://api.finnhub.io/api/v1';
    this.demoToken = 'd885vv9r01qq4341og9gd885vv9r01qq4341oga0'; // Active Finnhub token
    this.useMock = false;
    this.cache = new Map();
    this.failureCount = 0;
    this.circuitBroken = false;
    this.circuitBreakerTime = 0;
  }

  async getQuote(ticker) {
    const cached = this.checkCache(`quote_${ticker}`, 15000); // 15s cache
    if (cached) return cached;

    if (this.circuitBroken) {
      if (Date.now() > this.circuitBreakerTime) {
        this.circuitBroken = false;
        this.failureCount = 0;
      } else {
        return this.getMockQuote(ticker);
      }
    }

    try {
      const response = await this.fetchWithRetry(
        `${this.proxyUrl}/quote?symbol=${ticker}&token=${this.demoToken}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // If Finnhub returns null or empty values (free tier limits / invalid ticker)
      if (data.c === 0 && data.h === 0) {
        throw new Error('Empty response / limit reached');
      }

      // Convert Finnhub response fields
      const formattedData = {
        price: data.c, // current price
        change: data.d, // change
        changePercent: data.dp, // change percent
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        history: this.generateSparklineData(data.c, data.pc)
      };

      this.cache.set(`quote_${ticker}`, {
        timestamp: Date.now(),
        data: formattedData
      });

      this.failureCount = 0;
      return formattedData;
    } catch (e) {
      console.warn(`API failed for ${ticker}, using mock. Error:`, e);
      this.handleFailure();
      return this.getMockQuote(ticker);
    }
  }

  async getHistoricalData(ticker, timeframe = '1M') {
    const cached = this.checkCache(`history_${ticker}_${timeframe}`, 300000); // 5 min cache
    if (cached) return cached;

    if (this.circuitBroken) {
      return this.getMockHistory(ticker, timeframe);
    }

    const { resolution, from, to } = this.getTimeframeInterval(timeframe);

    try {
      const response = await this.fetchWithRetry(
        `${this.proxyUrl}/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${from}&to=${to}&token=${this.demoToken}`
      );

      if (!response.ok) throw new Error(`HTTP history error! status: ${response.status}`);

      const data = await response.json();

      if (data.s !== 'ok') {
        throw new Error('Finnhub history response status not OK');
      }

      const formattedData = {
        dates: data.t.map(ts => {
          const date = new Date(ts * 1000);
          return timeframe === '1D' 
            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }),
        prices: data.c,
        volumes: data.v
      };

      this.cache.set(`history_${ticker}_${timeframe}`, {
        timestamp: Date.now(),
        data: formattedData
      });

      return formattedData;
    } catch (e) {
      console.warn(`History API failed for ${ticker}, using mock. Error:`, e);
      this.handleFailure();
      return this.getMockHistory(ticker, timeframe);
    }
  }

  async fetchWithRetry(url, retries = 2, delay = 1000) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && retries > 0) { // Rate limit
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
      this.circuitBreakerTime = Date.now() + 60000; // Break for 1 minute
      console.warn('Circuit breaker activated. Falling back to client-side mocks.');
    }
  }

  checkCache(key, maxAge) {
    if (this.cache.has(key)) {
      const cachedItem = this.cache.get(key);
      if (Date.now() - cachedItem.timestamp < maxAge) {
        return cachedItem.data;
      }
    }
    return null;
  }

  getTimeframeInterval(timeframe) {
    const to = Math.floor(Date.now() / 1000);
    let from;
    let resolution;

    switch (timeframe) {
      case '1D':
        from = to - 86400;
        resolution = '15';
        break;
      case '1W':
        from = to - 86400 * 7;
        resolution = '60';
        break;
      case '1M':
        from = to - 86400 * 30;
        resolution = 'D';
        break;
      case '3M':
        from = to - 86400 * 90;
        resolution = 'D';
        break;
      case '1Y':
        from = to - 86400 * 365;
        resolution = 'W';
        break;
      default:
        from = to - 86400 * 30;
        resolution = 'D';
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
    // Generate deterministic values based on symbol chars
    const charCodeSum = ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const basePrice = (charCodeSum % 350) + 50;
    const changePercent = ((charCodeSum % 20) - 10) / 2 + Math.random() - 0.5;
    const price = basePrice * (1 + changePercent / 100);
    const change = price - basePrice;
    
    return {
      price: price,
      change: change,
      changePercent: changePercent,
      high: price * 1.02,
      low: price * 0.98,
      open: basePrice,
      previousClose: basePrice,
      history: this.generateSparklineData(price, basePrice)
    };
  }

  getMockHistory(ticker, timeframe) {
    const mockQuote = this.getMockQuote(ticker);
    const basePrice = mockQuote.price;
    const points = timeframe === '1D' ? 24 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : 52;
    
    const prices = [];
    const dates = [];
    const volumes = [];
    
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
      
      current = current * (1 + (Math.random() - 0.49) * 0.03);
      prices.push(current);
      volumes.push(Math.floor(Math.random() * 1000000) + 50000);
    }
    
    return { dates, prices, volumes };
  }
}
