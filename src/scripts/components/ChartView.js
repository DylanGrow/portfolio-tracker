import Chart from 'chart.js/auto';
import { formatCurrency } from '../utils/formatters.js';

export class ChartView {
  constructor(container, dataService) {
    this.container = container;
    this.dataService = dataService;
    this.chart = null;
    this.currentTicker = 'AAPL';
    this.currentTimeframe = '1M';
  }

  async render(ticker, timeframe = '1M') {
    this.currentTicker = ticker;
    this.currentTimeframe = timeframe;

    // Create wrapper layout if not exists
    this.container.innerHTML = `
      <div class="chart-header">
        <div>
          <h3 id="chart-title" style="font-size:1.25rem; font-weight:700;">${ticker} Technical Chart</h3>
          <p id="chart-sub" style="font-size:0.85rem; color:var(--color-text-secondary);">Loading historical trends...</p>
        </div>
        <div class="timeframe-controls" role="group" aria-label="Chart Timeframe Selection">
          <button class="timeframe-btn ${timeframe === '1D' ? 'active' : ''}" data-tf="1D">1D</button>
          <button class="timeframe-btn ${timeframe === '1W' ? 'active' : ''}" data-tf="1W">1W</button>
          <button class="timeframe-btn ${timeframe === '1M' ? 'active' : ''}" data-tf="1M">1M</button>
          <button class="timeframe-btn ${timeframe === '3M' ? 'active' : ''}" data-tf="3M">3M</button>
          <button class="timeframe-btn ${timeframe === '1Y' ? 'active' : ''}" data-tf="1Y">1Y</button>
        </div>
      </div>
      <div class="chart-canvas-container">
        <canvas id="main-technical-canvas" role="img" aria-label="Stock price chart for ${ticker}"></canvas>
      </div>
    `;

    // Bind controls
    const buttons = this.container.querySelectorAll('.timeframe-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tf = e.target.getAttribute('data-tf');
        this.render(this.currentTicker, tf);
      });
    });

    const canvas = this.container.querySelector('#main-technical-canvas');
    if (!canvas) return;

    try {
      const historicalData = await this.dataService.getHistoricalData(ticker, timeframe);
      const quote = await this.dataService.getQuote(ticker);
      
      const priceText = formatCurrency(quote.price);
      const isPositive = quote.changePercent >= 0;
      const pctText = `${isPositive ? '+' : ''}${quote.changePercent.toFixed(2)}%`;
      
      const subEl = this.container.querySelector('#chart-sub');
      if (subEl) {
        subEl.innerHTML = `<span style="font-size:1rem; font-weight:700; color:#fff; margin-right:0.5rem;">${priceText}</span> <span class="${isPositive ? 'positive' : 'negative'}" style="font-weight:600;">${pctText}</span>`;
      }

      if (this.chart) {
        this.chart.destroy();
      }

      // Check if we are in high-contrast mode
      const isHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
      const lineColor = isHighContrast ? '#ffffff' : (isPositive ? '#10b981' : '#ef4444');
      const gradientColor = isHighContrast ? 'rgba(255,255,255,0.05)' : (isPositive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)');

      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, gradientColor);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: historicalData.dates,
          datasets: [{
            label: ticker,
            data: historicalData.prices,
            borderColor: lineColor,
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: lineColor,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 1.5,
            tension: 0.15,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              titleColor: '#f3f4f6',
              bodyColor: '#f3f4f6',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              padding: 10,
              bodyFont: { family: 'Inter', weight: '600' },
              titleFont: { family: 'Inter', weight: '700' },
              callbacks: {
                label: (context) => {
                  return ` Price: ${formatCurrency(context.parsed.y)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: {
                color: '#9ca3af',
                font: { family: 'Inter', size: 10 },
                callback: (value) => formatCurrency(value)
              }
            }
          }
        }
      });
    } catch (e) {
      console.error("Chart render error:", e);
    }
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
