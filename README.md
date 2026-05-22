# 📈 Portfolio Tracker

> **Enterprise-grade, zero-login financial portfolio tracking PWA — built for privacy, speed, and precision.**

[![Deploy to GitHub Pages](https://github.com/DylanGrow/portfolio-tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/DylanGrow/portfolio-tracker/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-brightgreen)](https://dylangrow.github.io/portfolio-tracker/)

**🌐 Live App → [dylangrow.github.io/portfolio-tracker](https://dylangrow.github.io/portfolio-tracker/)**

---

## ✨ Features

- **Zero login, zero servers** — all data stays in your browser, encrypted with AES-256
- **Real-time quotes** via Finnhub API (AAPL, TSLA, MSFT, GOOGL, AMZN + any ticker)
- **Interactive charts** — candlestick, line, volume overlays powered by Lightweight Charts
- **Portfolio analytics** — P&L, allocation radar, performance metrics
- **Watchlist** — track symbols with live price changes
- **PWA-ready** — install on desktop or mobile, works offline
- **Dark mode** — premium glassmorphism design, zero eye strain
- **Privacy-first** — no telemetry, no tracking, no accounts

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Vite](https://vitejs.dev/) + Vanilla JS (ES Modules) |
| Charting | [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) |
| Data | [Finnhub API](https://finnhub.io/) |
| Encryption | Web Crypto API (AES-GCM 256-bit) |
| Hosting | GitHub Pages + GitHub Actions CI/CD |
| PWA | Custom Service Worker + Web App Manifest |
| Styling | Vanilla CSS + CSS custom properties |

---

## 🛡️ Security & Privacy

- API key stored as **GitHub Actions secret** — never exposed in source code
- All portfolio data encrypted with **AES-256-GCM** before localStorage writes
- Passphrase-derived key using **PBKDF2** (310,000 iterations, SHA-256)
- **Content Security Policy** headers enforced via `_headers`
- Zero external analytics, zero cookies, zero accounts

---

## 🏗️ Project Structure

```
portfolio-tracker/
├── .github/
│   └── workflows/
│       ├── deploy.yml          # CI/CD → GitHub Pages
│       └── lighthouse-ci.yml   # Performance auditing
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   ├── favicon.svg
│   └── _headers                # CSP + security headers
├── src/
│   ├── scripts/
│   │   ├── app.js              # App bootstrap & routing
│   │   ├── components/
│   │   │   ├── ChartView.js    # Candlestick/line chart
│   │   │   ├── PortfolioRadar.js  # Allocation radar chart
│   │   │   └── WatchlistGrid.js   # Live watchlist
│   │   ├── core/
│   │   │   ├── DataService.js      # Finnhub API client
│   │   │   ├── EncryptionService.js # AES-256 encryption
│   │   │   ├── StateManager.js     # App state
│   │   │   └── ErrorReporter.js    # Error handling
│   │   └── utils/
│   │       ├── PortfolioCalculator.js
│   │       └── formatters.js
│   └── styles/
│       └── main.css
├── index.html
├── vite.config.js
└── package.json
```

---

## 🔧 Local Development

```bash
# Clone the repo
git clone https://github.com/DylanGrow/portfolio-tracker.git
cd portfolio-tracker

# Install dependencies
npm install

# Create local env file
echo "VITE_FINNHUB_KEY=your_key_here" > .env.local

# Start dev server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

> Get a free Finnhub API key at [finnhub.io](https://finnhub.io/register)

---

## 📦 Deployment

Deployment is fully automated via GitHub Actions:

1. Push to `main` → workflow triggers
2. Vite builds with the `VITE_FINNHUB_KEY` secret injected
3. Output uploaded to GitHub Pages
4. Live at `https://dylangrow.github.io/portfolio-tracker/`

To set up your own deployment, add `VITE_FINNHUB_KEY` as a repository secret:
**Settings → Secrets and variables → Actions → New repository secret**

---

## 📄 License

[MIT](LICENSE) © 2026 Dylan Grow
