import { formatCurrency, formatPercent } from '../utils/formatters.js';

export class WatchlistGrid {
  constructor(container, dataService, onSelectTicker, onRemoveTicker) {
    this.container = container;
    this.dataService = dataService;
    this.onSelectTicker = onSelectTicker;
    this.onRemoveTicker = onRemoveTicker;
    this.updateInterval = null;
    this.tickers = [];
  }

  async render(tickers) {
    this.tickers = tickers;
    this.container.innerHTML = '';

    const gridHeader = document.createElement('div');
    gridHeader.className = 'watchlist-grid-header';
    gridHeader.innerHTML = `
      <div>Ticker</div>
      <div>Price</div>
      <div>Change</div>
      <div>Trend (7D)</div>
    `;
    this.container.appendChild(gridHeader);

    const gridBody = document.createElement('div');
    gridBody.className = 'watchlist-grid-body';
    this.container.appendChild(gridBody);

    const fragment = document.createDocumentFragment();
    
    for (const ticker of tickers) {
      const data = await this.dataService.getQuote(ticker);
      const row = this.createRow(ticker, data);
      fragment.appendChild(row);
    }
    
    gridBody.appendChild(fragment);
    this.startAutoRefresh();
  }

  createRow(ticker, data) {
    const row = document.createElement('div');
    row.className = 'watchlist-row';
    row.setAttribute('data-ticker', ticker);
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Select ${ticker}. Current price is ${formatCurrency(data.price)}. Change is ${formatPercent(data.changePercent)}.`);
    
    const tickerCell = document.createElement('div');
    tickerCell.className = 'watchlist-cell watchlist-ticker';
    tickerCell.textContent = ticker;
    
    const priceCell = document.createElement('div');
    priceCell.className = 'watchlist-cell watchlist-price';
    priceCell.textContent = formatCurrency(data.price);
    
    const changeCell = document.createElement('div');
    const isPositive = data.changePercent >= 0;
    changeCell.className = `watchlist-cell watchlist-change ${isPositive ? 'positive' : 'negative'}`;
    changeCell.innerHTML = `
      <span aria-hidden="true">${isPositive ? '▲' : '▼'}</span>
      <span>${formatPercent(data.changePercent)}</span>
    `;
    
    const sparklineCell = document.createElement('div');
    sparklineCell.className = 'watchlist-cell watchlist-sparkline';
    sparklineCell.appendChild(this.createSparkline(data.history, isPositive));
    
    row.append(tickerCell, priceCell, changeCell, sparklineCell);

    // Event listeners
    row.addEventListener('click', () => {
      if (this.onSelectTicker) this.onSelectTicker(ticker);
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.onSelectTicker) this.onSelectTicker(ticker);
      }
    });

    return row;
  }

  createSparkline(dataPoints, isPositive) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 24');
    svg.setAttribute('preserveAspectRatio', 'none');
    
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const range = max - min || 1;
    
    const points = dataPoints.map((value, index) => {
      const x = (index / (dataPoints.length - 1)) * 100;
      const y = 22 - ((value - min) / range) * 20; // 2px margin top/bottom
      return `${x},${y}`;
    }).join(' ');
    
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', isPositive ? 'var(--color-positive)' : 'var(--color-negative)');
    polyline.setAttribute('stroke-width', '2');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    
    svg.appendChild(polyline);
    return svg;
  }

  async refreshData() {
    const gridBody = this.container.querySelector('.watchlist-grid-body');
    if (!gridBody) return;

    for (const ticker of this.tickers) {
      const data = await this.dataService.getQuote(ticker);
      const row = gridBody.querySelector(`[data-ticker="${ticker}"]`);
      if (row) {
        const priceCell = row.querySelector('.watchlist-price');
        const changeCell = row.querySelector('.watchlist-change');
        const sparklineCell = row.querySelector('.watchlist-sparkline');

        if (priceCell) priceCell.textContent = formatCurrency(data.price);
        if (changeCell) {
          const isPositive = data.changePercent >= 0;
          changeCell.className = `watchlist-cell watchlist-change ${isPositive ? 'positive' : 'negative'}`;
          changeCell.innerHTML = `
            <span aria-hidden="true">${isPositive ? '▲' : '▼'}</span>
            <span>${formatPercent(data.changePercent)}</span>
          `;
        }
        if (sparklineCell) {
          sparklineCell.innerHTML = '';
          sparklineCell.appendChild(this.createSparkline(data.history, data.changePercent >= 0));
        }
      }
    }
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    // 15 seconds polling interval during market hours
    this.updateInterval = setInterval(() => this.refreshData(), 15000);
  }

  stopAutoRefresh() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  destroy() {
    this.stopAutoRefresh();
  }
}
