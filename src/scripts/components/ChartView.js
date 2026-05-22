import Chart from 'chart.js/auto';
import { formatCurrency } from '../utils/formatters.js';

export class ChartView {
  constructor(container, dataService) {
    this.container = container;
    this.dataService = dataService;
    this.priceChart = null;
    this.volumeChart = null;
    this.currentTicker = 'AAPL';
    this.currentTimeframe = '1M';
    this.chartMode = 'area'; // 'area' | 'candle'
    this.assetType = 'stocks'; // 'stocks' | 'crypto'
  }

  async render(ticker, timeframe = '1M') {
    this.currentTicker = ticker;
    this.currentTimeframe = timeframe;

    const isCrypto = this.dataService.isCrypto(ticker);
    const badge = isCrypto ? '<span class="crypto-badge">₿ CRYPTO</span>' : '';

    this.container.innerHTML = `
      <div class="chart-header">
        <div class="chart-title-group">
          <h3 id="chart-title">${ticker} ${badge}</h3>
          <div id="chart-price-display" class="chart-price-display">
            <span id="chart-price" class="chart-price-value">—</span>
            <span id="chart-change" class="chart-change-badge">—</span>
          </div>
          <div id="chart-ohlc" class="chart-ohlc-row"></div>
        </div>
        <div class="chart-controls-group">
          <div class="chart-mode-toggle" role="group" aria-label="Chart type">
            <button class="mode-btn ${this.chartMode === 'area' ? 'active' : ''}" data-mode="area">
              <svg viewBox="0 0 20 14" fill="none" width="16" height="11"><polyline points="0,12 5,6 10,9 15,3 20,6" stroke="currentColor" stroke-width="2" fill="none"/><polygon points="0,12 5,6 10,9 15,3 20,6 20,14 0,14" fill="currentColor" opacity="0.15"/></svg>
              Area
            </button>
            <button class="mode-btn ${this.chartMode === 'candle' ? 'active' : ''}" data-mode="candle">
              <svg viewBox="0 0 20 16" fill="none" width="14" height="12">
                <rect x="2" y="4" width="4" height="8" rx="0.5" fill="currentColor"/>
                <line x1="4" y1="1" x2="4" y2="4" stroke="currentColor" stroke-width="1.5"/>
                <line x1="4" y1="12" x2="4" y2="15" stroke="currentColor" stroke-width="1.5"/>
                <rect x="8" y="6" width="4" height="6" rx="0.5" fill="#ef4444"/>
                <line x1="10" y1="2" x2="10" y2="6" stroke="#ef4444" stroke-width="1.5"/>
                <line x1="10" y1="12" x2="10" y2="15" stroke="#ef4444" stroke-width="1.5"/>
                <rect x="14" y="3" width="4" height="9" rx="0.5" fill="currentColor"/>
                <line x1="16" y1="0" x2="16" y2="3" stroke="currentColor" stroke-width="1.5"/>
                <line x1="16" y1="12" x2="16" y2="15" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              Candle
            </button>
          </div>
          <div class="timeframe-controls" role="group" aria-label="Chart Timeframe">
            ${['1D','1W','1M','3M','1Y'].map(tf =>
              `<button class="timeframe-btn ${timeframe === tf ? 'active' : ''}" data-tf="${tf}">${tf}</button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="chart-panels-wrapper">
        <div class="chart-panel chart-panel-price">
          <canvas id="price-canvas" role="img" aria-label="Price chart for ${ticker}"></canvas>
        </div>
        <div class="chart-panel chart-panel-volume">
          <div class="volume-label">VOL</div>
          <canvas id="volume-canvas" role="img" aria-label="Volume chart for ${ticker}"></canvas>
        </div>
      </div>
    `;

    // Bind timeframe buttons
    this.container.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', e => this.render(this.currentTicker, e.target.getAttribute('data-tf')));
    });

    // Bind mode toggle buttons
    this.container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        this.chartMode = e.currentTarget.getAttribute('data-mode');
        this.render(this.currentTicker, this.currentTimeframe);
      });
    });

    try {
      const [historicalData, quote] = await Promise.all([
        this.dataService.getHistoricalData(ticker, timeframe),
        this.dataService.getQuote(ticker)
      ]);

      // Update price display
      const isPositive = quote.changePercent >= 0;
      const priceEl = this.container.querySelector('#chart-price');
      const changeEl = this.container.querySelector('#chart-change');
      const ohlcEl = this.container.querySelector('#chart-ohlc');

      if (priceEl) {
        const formatted = isCrypto && quote.price < 1
          ? `$${quote.price.toFixed(6)}`
          : formatCurrency(quote.price);
        priceEl.textContent = formatted;
        priceEl.classList.add('price-flash', isPositive ? 'flash-green' : 'flash-red');
        setTimeout(() => priceEl.classList.remove('price-flash', 'flash-green', 'flash-red'), 600);
      }
      if (changeEl) {
        const pct = `${isPositive ? '+' : ''}${quote.changePercent.toFixed(2)}%`;
        changeEl.textContent = pct;
        changeEl.className = `chart-change-badge ${isPositive ? 'positive' : 'negative'}`;
      }
      if (ohlcEl && historicalData.highs) {
        const h = historicalData.highs;
        const l = historicalData.lows;
        const periodHigh = Math.max(...h).toFixed(2);
        const periodLow  = Math.min(...l).toFixed(2);
        ohlcEl.innerHTML = `
          <span class="ohlc-item">H <strong>$${periodHigh}</strong></span>
          <span class="ohlc-item">L <strong>$${periodLow}</strong></span>
          <span class="ohlc-item">O <strong>$${quote.open?.toFixed(2) || '—'}</strong></span>
        `;
      }

      // Destroy previous charts
      if (this.priceChart)  { this.priceChart.destroy();  this.priceChart  = null; }
      if (this.volumeChart) { this.volumeChart.destroy(); this.volumeChart = null; }

      const priceCanvas  = this.container.querySelector('#price-canvas');
      const volumeCanvas = this.container.querySelector('#volume-canvas');
      if (!priceCanvas || !volumeCanvas) return;

      const upColor   = '#10b981';
      const downColor = '#ef4444';
      const lineColor = isPositive ? upColor : downColor;

      // ── Price chart ──────────────────────────────────────────────
      const pCtx = priceCanvas.getContext('2d');

      if (this.chartMode === 'candle' && historicalData.opens) {
        // Candlestick via floating bar chart trick
        const candleData = historicalData.prices.map((close, i) => {
          const open  = historicalData.opens[i]  ?? close;
          const high  = historicalData.highs[i]  ?? close;
          const low   = historicalData.lows[i]   ?? close;
          const isUp  = close >= open;
          return { open, close, high, low, isUp };
        });

        this.priceChart = new Chart(pCtx, {
          type: 'bar',
          data: {
            labels: historicalData.dates,
            datasets: [
              // Wicks (high-low range)
              {
                label: 'Wick',
                data: candleData.map(d => [d.low, d.high]),
                backgroundColor: candleData.map(d => d.isUp ? upColor : downColor),
                barThickness: 1,
                order: 2
              },
              // Bodies (open-close range)
              {
                label: 'Body',
                data: candleData.map(d => [Math.min(d.open, d.close), Math.max(d.open, d.close)]),
                backgroundColor: candleData.map(d => d.isUp ? upColor + 'cc' : downColor + 'cc'),
                borderColor:     candleData.map(d => d.isUp ? upColor : downColor),
                borderWidth: 1,
                barPercentage: 0.6,
                order: 1
              }
            ]
          },
          options: this._chartOptions(formatCurrency, true)
        });
      } else {
        // Area chart with gradient glow
        const gradient = pCtx.createLinearGradient(0, 0, 0, priceCanvas.offsetHeight || 320);
        gradient.addColorStop(0, lineColor + '55');
        gradient.addColorStop(0.5, lineColor + '18');
        gradient.addColorStop(1, lineColor + '00');

        this.priceChart = new Chart(pCtx, {
          type: 'line',
          data: {
            labels: historicalData.dates,
            datasets: [{
              label: ticker,
              data: historicalData.prices,
              borderColor: lineColor,
              borderWidth: 2.5,
              backgroundColor: gradient,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointHoverBackgroundColor: lineColor,
              pointHoverBorderColor: '#fff',
              pointHoverBorderWidth: 2,
              tension: 0.3,
              fill: true
            }]
          },
          options: this._chartOptions(formatCurrency, false)
        });
      }

      // ── Volume chart ─────────────────────────────────────────────
      if (historicalData.volumes && historicalData.volumes.length) {
        const vCtx = volumeCanvas.getContext('2d');
        const volColors = historicalData.prices.map((p, i) => {
          const prev = i > 0 ? historicalData.prices[i - 1] : p;
          return p >= prev ? upColor + 'aa' : downColor + 'aa';
        });

        this.volumeChart = new Chart(vCtx, {
          type: 'bar',
          data: {
            labels: historicalData.dates,
            datasets: [{
              label: 'Volume',
              data: historicalData.volumes,
              backgroundColor: volColors,
              borderWidth: 0,
              barPercentage: 0.8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: { legend: { display: false }, tooltip: {
              callbacks: { label: ctx => ` Vol: ${(ctx.parsed.y / 1e6).toFixed(2)}M` }
            }},
            scales: {
              x: { display: false },
              y: {
                grid: { color: 'rgba(255,255,255,0.03)' },
                ticks: { color: '#6b7280', font: { size: 9 },
                  callback: v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`
                }
              }
            }
          }
        });
      }

    } catch (e) {
      console.error('Chart render error:', e);
    }
  }

  _chartOptions(formatCurrency, isCandle) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.97)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          bodyFont: { family: 'Inter', weight: '600', size: 13 },
          titleFont: { family: 'Inter', weight: '700', size: 12 },
          callbacks: {
            label: ctx => isCandle
              ? ` ${ctx.dataset.label === 'Body' ? 'Range' : 'Wick'}: $${ctx.parsed._custom?.barStart?.toFixed(2) ?? ''} → $${ctx.parsed._custom?.barEnd?.toFixed(2) ?? ''}`
              : ` ${formatCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: { color: '#6b7280', font: { family: 'Inter', size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#6b7280',
            font: { family: 'Inter', size: 10 },
            callback: v => formatCurrency(v)
          }
        }
      }
    };
  }

  destroy() {
    if (this.priceChart)  { this.priceChart.destroy();  this.priceChart  = null; }
    if (this.volumeChart) { this.volumeChart.destroy(); this.volumeChart = null; }
  }
}
