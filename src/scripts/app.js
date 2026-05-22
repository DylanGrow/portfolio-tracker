import { StateManager } from './core/StateManager.js';
import { DataService } from './core/DataService.js';
import { ErrorReporter } from './core/ErrorReporter.js';
import { WatchlistGrid } from './components/WatchlistGrid.js';
import { ChartView } from './components/ChartView.js';
import { PortfolioRadar } from './components/PortfolioRadar.js';
import { PortfolioCalculator } from './utils/PortfolioCalculator.js';
import { formatCurrency, formatPercent, formatDate } from './utils/formatters.js';

class App {
  constructor() {
    this.stateManager = new StateManager();
    this.dataService = new DataService();
    this.errorReporter = new ErrorReporter();
    
    this.activeView = 'dashboard';
    this.selectedTicker = 'AAPL';
    this.prices = {}; // Local quote cache
    
    this.watchlistGrid = null;
    this.chartView = null;
    this.portfolioRadar = null;
    
    this.initElements();
    this.bindGlobalEvents();
  }

  initElements() {
    this.authModal = document.getElementById('auth-modal');
    this.authForm = document.getElementById('auth-form');
    this.passphraseInput = document.getElementById('passphrase-input');
    this.appRoot = document.getElementById('app-root');
    this.navLinks = document.querySelectorAll('.nav-link');
    
    // Default show password modal
    this.authModal.classList.add('active');
  }

  bindGlobalEvents() {
    // Auth submission
    this.authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const passphrase = this.passphraseInput.value.trim();
      if (passphrase.length < 8) return;

      const submitBtn = this.authForm.querySelector('button');
      submitBtn.textContent = 'Decrypting...';
      submitBtn.disabled = true;

      try {
        await this.stateManager.initialize(passphrase);
        this.authModal.classList.remove('active');
        this.initAppFlow();
      } catch (err) {
        console.error("Auth initialization failed:", err);
        submitBtn.textContent = 'Decrypt Portfolio';
        submitBtn.disabled = false;
        alert("Incorrect passphrase or decryption failed. Try again.");
      }
    });

    // Hash router
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.substring(1) || 'dashboard';
      if (['dashboard', 'watchlist', 'portfolio', 'charts', 'settings', 'privacy', 'terms'].includes(hash)) {
        this.switchView(hash);
      }
    });
  }

  async initAppFlow() {
    // Initial fetch of quotes for all watchlist tickers
    await this.refreshAllPrices();

    // Subscribe to state updates
    this.stateManager.subscribe('watchlist', (list) => {
      this.watchlist = list;
      this.refreshAllPrices().then(() => this.updateCurrentView());
    });

    this.stateManager.subscribe('portfolio', (portfolio) => {
      this.portfolio = portfolio;
      this.updateCurrentView();
    });

    // Check routing
    const initialHash = window.location.hash.substring(1) || 'dashboard';
    this.switchView(initialHash);
  }

  async refreshAllPrices() {
    const list = this.stateManager.state.watchlist;
    const fetchPromises = list.map(async (ticker) => {
      try {
        const quote = await this.dataService.getQuote(ticker);
        this.prices[ticker] = quote;
      } catch (e) {
        console.warn(`Price refresh failed for ${ticker}:`, e);
      }
    });
    await Promise.all(fetchPromises);
  }

  switchView(viewName) {
    this.activeView = viewName;
    
    // Update navigation active states
    this.navLinks.forEach(link => {
      const tab = link.getAttribute('data-tab');
      if (tab === viewName) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    this.updateCurrentView();
  }

  updateCurrentView() {
    // Do not render anything if not authenticated yet
    if (!this.stateManager.db) return;

    if (this.watchlistGrid) this.watchlistGrid.destroy();
    if (this.chartView) this.chartView.destroy();

    const calc = new PortfolioCalculator(this.portfolio, this.prices);

    switch (this.activeView) {
      case 'dashboard':
        this.renderDashboard(calc);
        break;
      case 'watchlist':
        this.renderWatchlist();
        break;
      case 'portfolio':
        this.renderPortfolio(calc);
        break;
      case 'charts':
        this.renderCharts();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'privacy':
        this.renderStaticPage('Privacy Policy', `
          <p>We are fully committed to your absolute data privacy.</p>
          <p>Key security features include:</p>
          <ul>
            <li>No remote databases, login accounts, or cloud storage</li>
            <li>All holding data is encrypted 100% locally with AES-256-GCM</li>
            <li>No analytics trackers, pixels, cookies, or telemetry pipelines</li>
          </ul>
        `);
        break;
      case 'terms':
        this.renderStaticPage('Terms of Service', `
          <p>Standard enterprise utility terms apply.</p>
          <p>All pricing services are mock values or demo-tier public quotes. Do not use for execution advice.</p>
        `);
        break;
    }
  }

  renderDashboard(calc) {
    const totalValue = calc.getTotalValue();
    const totalCost = calc.getTotalCost();
    const { gain, percent } = calc.getUnrealizedGain();
    const radarMetrics = calc.getSimplyWallStMetrics();
    const sectorAllocations = calc.getSectorAllocations();

    this.appRoot.innerHTML = `
      <div class="dashboard-hero">
        <div class="metric-card glass">
          <span class="metric-title">Portfolio Value</span>
          <span class="metric-value">${formatCurrency(totalValue)}</span>
        </div>
        <div class="metric-card glass">
          <span class="metric-title">Cost Basis</span>
          <span class="metric-value" style="color:var(--color-text-secondary);">${formatCurrency(totalCost)}</span>
        </div>
        <div class="metric-card glass">
          <span class="metric-title">Unrealized returns</span>
          <span class="metric-value ${gain >= 0 ? 'positive' : 'negative'}">${formatCurrency(gain)}</span>
          <span class="metric-change ${gain >= 0 ? 'positive' : 'negative'}">
            ${gain >= 0 ? '▲' : '▼'} ${formatPercent(percent)}
          </span>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="watchlist-container glass" style="padding:1.5rem;">
          <div class="section-header">
            <h2 style="font-size:1.15rem; font-weight:700;">Market Watchlist</h2>
            <a href="#watchlist" class="btn btn-primary" style="width:auto; padding:0.35rem 0.85rem; font-size:0.8rem;">Manage</a>
          </div>
          <div id="dashboard-watchlist-grid"></div>
        </div>

        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          <div class="visualization-card glass">
            <h2 style="font-size:1.15rem; font-weight:700; width:100%; text-align:left;">Simply Wall St Analytics</h2>
            <div class="radar-container" id="dashboard-radar"></div>
          </div>
          
          <div class="visualization-card glass" style="align-items:stretch;">
            <h2 style="font-size:1.15rem; font-weight:700;">Sector Allocations</h2>
            <div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.6rem;">
              ${sectorAllocations.length === 0 ? '<p style="color:var(--color-text-secondary);font-size:0.9rem;">No holdings allocated.</p>' : ''}
              ${sectorAllocations.map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.875rem; font-weight:600;">
                  <span>${s.sector}</span>
                  <div style="display:flex; align-items:center; gap:0.75rem; flex: 1; margin:0 1rem; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="width:${s.percent}%; height:100%; background:var(--color-primary); border-radius:4px;"></div>
                  </div>
                  <span style="font-variant-numeric:tabular-nums; color:var(--color-text-secondary);">${s.percent.toFixed(1)}%</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Watchlist Grid inside dashboard
    const wlEl = document.getElementById('dashboard-watchlist-grid');
    if (wlEl) {
      this.watchlistGrid = new WatchlistGrid(wlEl, this.dataService, (ticker) => {
        this.selectedTicker = ticker;
        window.location.hash = '#charts';
      });
      this.watchlistGrid.render(this.watchlist);
    }

    // Render Radar visualizer
    const radarEl = document.getElementById('dashboard-radar');
    if (radarEl) {
      this.portfolioRadar = new PortfolioRadar(radarEl);
      this.portfolioRadar.render(radarMetrics);
    }
  }

  renderWatchlist() {
    this.appRoot.innerHTML = `
      <div class="glass" style="padding:2rem; max-width:800px; margin:0 auto;">
        <div class="section-header" style="margin-bottom:2rem;">
          <h2 style="font-size:1.5rem; font-weight:800;">Manage Watchlist</h2>
          <form id="add-ticker-form" class="add-ticker-form">
            <input type="text" id="new-ticker-input" placeholder="e.g. AAPL or BTC" required maxlength="10" style="text-transform:uppercase;">
            <button type="submit" class="btn btn-primary" style="width:auto;">Add Ticker</button>
          </form>
        </div>

        <div id="full-watchlist-grid"></div>
      </div>
    `;

    const wlEl = document.getElementById('full-watchlist-grid');
    if (wlEl) {
      this.watchlistGrid = new WatchlistGrid(wlEl, this.dataService, (ticker) => {
        this.selectedTicker = ticker;
        window.location.hash = '#charts';
      });
      this.watchlistGrid.render(this.watchlist);
    }

    // Ticker add submission
    const form = document.getElementById('add-ticker-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('new-ticker-input');
      const ticker = input.value.trim().toUpperCase();
      if (!ticker || this.watchlist.includes(ticker)) return;

      const btn = form.querySelector('button');
      btn.textContent = 'Verifying...';
      btn.disabled = true;

      try {
        // Validate ticker with active quote check
        const quote = await this.dataService.getQuote(ticker);
        if (quote.price === 0) throw new Error('Invalid quote pricing');

        const newList = [...this.watchlist, ticker];
        await this.stateManager.saveWatchlist(newList);
        input.value = '';
      } catch (err) {
        alert(`Could not verify ticker "${ticker}". Double check if symbol is valid.`);
      } finally {
        btn.textContent = 'Add Ticker';
        btn.disabled = false;
      }
    });
  }

  renderPortfolio(calc) {
    const holdings = calc.getHoldings();

    this.appRoot.innerHTML = `
      <div class="portfolio-card glass">
        <div class="section-header">
          <h2 style="font-size:1.5rem; font-weight:800;">Transaction Ledger</h2>
          <div style="display:flex; gap:0.75rem;">
            <button id="export-btn" class="btn" style="width:auto; background:rgba(255,255,255,0.05); border:1px solid var(--color-card-border);">Export Encrypted JSON</button>
            <button id="import-btn" class="btn" style="width:auto; background:rgba(255,255,255,0.05); border:1px solid var(--color-card-border);">Import JSON Backup</button>
            <input type="file" id="import-file-picker" style="display:none;" accept=".json">
            <button id="clear-all-btn" class="btn" style="width:auto; background:var(--color-negative-bg); border:1px solid var(--color-negative); color:var(--color-negative);">Purge Ledger</button>
          </div>
        </div>

        <form id="ledger-add-form" class="form-grid">
          <div class="input-group" style="margin:0;">
            <label for="ledger-type" style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:0.4rem; display:block;">Action</label>
            <select id="ledger-type">
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div class="input-group" style="margin:0;">
            <label for="ledger-ticker" style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:0.4rem; display:block;">Ticker</label>
            <input type="text" id="ledger-ticker" placeholder="e.g. AAPL" required style="text-transform:uppercase;">
          </div>
          <div class="input-group" style="margin:0;">
            <label for="ledger-shares" style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:0.4rem; display:block;">Shares</label>
            <input type="number" id="ledger-shares" placeholder="0" min="0.0001" step="any" required>
          </div>
          <div class="input-group" style="margin:0;">
            <label for="ledger-price" style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:0.4rem; display:block;">Price ($)</label>
            <input type="number" id="ledger-price" placeholder="0.00" min="0.01" step="any" required>
          </div>
          <div class="input-group" style="margin:0;">
            <label for="ledger-date" style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:0.4rem; display:block;">Date</label>
            <input type="date" id="ledger-date" required>
          </div>
          <button type="submit" class="btn btn-primary" style="align-self:flex-end; height:46px;">Add Trade</button>
        </form>

        <table class="portfolio-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Shares</th>
              <th>Avg Cost</th>
              <th>Cost Basis</th>
              <th>Market Price</th>
              <th>Market Value</th>
              <th>Allocation</th>
              <th>Total Return</th>
            </tr>
          </thead>
          <tbody>
            ${holdings.length === 0 ? '<tr><td colspan="8" style="text-align:center; color:var(--color-text-secondary); padding:3rem;">No holdings in ledger yet. Add trades using the form above.</td></tr>' : ''}
            ${holdings.map(h => `
              <tr>
                <td style="font-weight:700; color:#fff;">${h.ticker} <span style="font-size:0.75rem; font-weight:500; color:var(--color-text-secondary); display:block;">${h.sector}</span></td>
                <td style="font-variant-numeric:tabular-nums;">${h.shares.toFixed(4).replace(/\\.0000$/, '')}</td>
                <td style="font-variant-numeric:tabular-nums;">${formatCurrency(h.avgCost)}</td>
                <td style="font-variant-numeric:tabular-nums;">${formatCurrency(h.totalCost)}</td>
                <td style="font-variant-numeric:tabular-nums;">${formatCurrency(h.currentPrice)}</td>
                <td style="font-variant-numeric:tabular-nums; color:#fff;">${formatCurrency(h.currentValue)}</td>
                <td style="font-variant-numeric:tabular-nums;">${h.allocation.toFixed(2)}%</td>
                <td style="font-variant-numeric:tabular-nums;" class="${h.totalGain >= 0 ? 'positive' : 'negative'}">
                  ${formatCurrency(h.totalGain)}
                  <span style="font-size:0.75rem; display:block; font-weight:700;">${formatPercent(h.totalGainPercent)}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Bind date input standard value
    const dateInput = document.getElementById('ledger-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Bind trade submission
    const form = document.getElementById('ledger-add-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('ledger-type').value;
      const ticker = document.getElementById('ledger-ticker').value.trim().toUpperCase();
      const shares = parseFloat(document.getElementById('ledger-shares').value);
      const price = parseFloat(document.getElementById('ledger-price').value);
      const date = document.getElementById('ledger-date').value;

      if (!ticker || isNaN(shares) || isNaN(price) || !date) return;

      const tx = { type, ticker, shares, price, date };
      
      // Auto-append ticker to watchlist if not already there
      if (!this.watchlist.includes(ticker)) {
        await this.stateManager.saveWatchlist([...this.watchlist, ticker]);
      }

      await this.stateManager.addTransaction(tx);
    });

    // Clear Portfolio Purge
    document.getElementById('clear-all-btn').addEventListener('click', async () => {
      if (confirm('CAUTION: Are you absolutely sure you want to clear your local ledger? This action is irreversible.')) {
        await this.stateManager.clearPortfolio();
      }
    });

    // Local file export
    document.getElementById('export-btn').addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.portfolio));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Local file import triggers
    const picker = document.getElementById('import-file-picker');
    document.getElementById('import-btn').addEventListener('click', () => picker.click());
    picker.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (!Array.isArray(parsed)) throw new Error('Root element must be array of transactions');
          
          await this.stateManager.clearPortfolio();
          
          const watchlistTickers = new Set(this.watchlist);
          for (const tx of parsed) {
            watchlistTickers.add(tx.ticker);
            await this.stateManager.addTransaction(tx);
          }
          await this.stateManager.saveWatchlist([...watchlistTickers]);
          alert("Backup successfully restored into secure IndexedDB!");
        } catch (err) {
          alert("Restore failed. Check if backup JSON matches expected layout.");
        }
      };
      reader.readAsText(file);
    });
  }

  renderCharts() {
    this.appRoot.innerHTML = `
      <div class="chart-card glass" id="technical-chart-container"></div>
    `;
    const chartContainer = document.getElementById('technical-chart-container');
    if (chartContainer) {
      this.chartView = new ChartView(chartContainer, this.dataService);
      this.chartView.render(this.selectedTicker);
    }
  }

  renderSettings() {
    this.appRoot.innerHTML = `
      <div class="glass" style="padding:2rem; max-width:600px; margin:0 auto;">
        <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:1.5rem;">System Configuration</h2>
        <div class="input-group">
          <label style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:0.4rem; display:block;">API Proxy URL</label>
          <input type="text" value="https://api.finnhub.io/api/v1" disabled>
          <span style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:0.4rem; display:block;">Proxy endpoint validated by CSP strict configs.</span>
        </div>
        <div class="input-group">
          <label style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:0.4rem; display:block;">Secure Storage</label>
          <p style="font-size:0.95rem; font-weight:600;">Encrypted IndexedDB (AES-256-GCM)</p>
        </div>
        <div style="background-color:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.15); padding:1rem; border-radius:0.5rem; color:var(--color-positive); font-size:0.85rem; font-weight:600;">
          ✔ Client-side Zero-Knowledge Architecture active.
        </div>
      </div>
    `;
  }

  renderStaticPage(title, htmlContent) {
    this.appRoot.innerHTML = `
      <div class="glass" style="padding:2.5rem; max-width:800px; margin:0 auto; line-height:1.75;">
        <h2 style="font-size:1.75rem; font-weight:800; margin-bottom:1.5rem; border-bottom:1px solid var(--color-card-border); padding-bottom:1rem;">${title}</h2>
        ${htmlContent}
      </div>
    `;
  }
}

// Instantiate application entry
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
