# Zeno

> **Sleek, zero-login financial portfolio tracking PWA — built for privacy, speed, and precision.**

[![Deploy](https://github.com/DylanGrow/zeno/actions/workflows/deploy.yml/badge.svg)](https://github.com/DylanGrow/zeno/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-brightgreen)](https://dylangrow.github.io/zeno/)

**🌐 Live App → [dylangrow.github.io/zeno](https://dylangrow.github.io/zeno/)**

---

## ✨ Features

- **Zero login, zero servers** — all data stays in your browser, encrypted with AES-256
- **Real-time quotes** via Finnhub API — stocks & crypto
- **Interactive charts** — candlestick, area, volume overlays
- **Portfolio analytics** — P&L, allocation radar, performance metrics
- **Watchlist** — track any symbol with live price changes
- **PWA-ready** — install on desktop or mobile, works offline
- **Dark mode** — premium glassmorphism design
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
- **Content Security Policy** headers enforced
- Zero external analytics, zero cookies, zero accounts

---

## 🏗️ Project Structure

```
zeno/
├── .github/workflows/
│   ├── deploy.yml          # CI/CD → GitHub Pages
│   └── lighthouse-ci.yml   # Performance auditing
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   └── favicon.svg
├── src/
│   ├── scripts/
│   │   ├── app.js
│   │   ├── components/
│   │   │   ├── ChartView.js
│   │   │   ├── PortfolioRadar.js
│   │   │   └── WatchlistGrid.js
│   │   ├── core/
│   │   │   ├── DataService.js
│   │   │   ├── EncryptionService.js
│   │   │   ├── StateManager.js
│   │   │   └── ErrorReporter.js
│   │   └── utils/
│   │       ├── PortfolioCalculator.js
│   │       └── formatters.js
│   └── styles/main.css
├── index.html
└── vite.config.js
```

---

## 🔧 Local Development

```bash
git clone https://github.com/DylanGrow/zeno.git
cd zeno
npm install
echo "VITE_FINNHUB_KEY=your_key_here" > .env.local
npm run dev
```

> Get a free Finnhub API key at [finnhub.io](https://finnhub.io/register)

---

## 📄 License

[MIT](LICENSE) © 2026 Dylan Grow
