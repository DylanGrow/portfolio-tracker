import { EncryptionService } from './EncryptionService.js';

export class StateManager {
  constructor() {
    this.state = {
      watchlist: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
      portfolio: [], // Encrypted in IndexedDB but plain in active memory
      settings: { currency: 'USD', locale: 'en-US' }
    };
    this.listeners = new Map();
    this.db = null;
    this.encryption = new EncryptionService();
  }

  async initialize(passphrase) {
    await this.encryption.deriveKey(passphrase);
    this.db = await this.openDatabase();
    await this.loadState();
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PortfolioTrackerDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('watchlist')) {
          db.createObjectStore('watchlist', { keyPath: 'ticker' });
        }
        
        if (!db.objectStoreNames.contains('portfolio')) {
          db.createObjectStore('portfolio', { keyPath: 'id', autoIncrement: true });
        }
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async loadState() {
    const transaction = this.db.transaction(['watchlist', 'portfolio', 'settings'], 'readonly');
    
    const dbWatchlist = await this.getAllFromStore(transaction.objectStore('watchlist'));
    if (dbWatchlist.length > 0) {
      this.state.watchlist = dbWatchlist.map(item => item.ticker);
    }
    
    const encryptedPortfolio = await this.getAllFromStore(transaction.objectStore('portfolio'));
    try {
      this.state.portfolio = await Promise.all(
        encryptedPortfolio.map(item => this.encryption.decrypt(item.data))
      );
    } catch (e) {
      console.warn("Failed to decrypt portfolio, starting fresh or wrong password.", e);
      this.state.portfolio = [];
    }

    const settingsList = await this.getAllFromStore(transaction.objectStore('settings'));
    settingsList.forEach(item => {
      this.state.settings[item.key] = item.value;
    });

    this.notifyListeners('watchlist', this.state.watchlist);
    this.notifyListeners('portfolio', this.state.portfolio);
    this.notifyListeners('settings', this.state.settings);
  }

  async saveWatchlist(tickers) {
    this.state.watchlist = tickers;
    const transaction = this.db.transaction(['watchlist'], 'readwrite');
    const store = transaction.objectStore('watchlist');
    
    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = resolve;
      clearReq.onerror = reject;
    });

    for (const ticker of tickers) {
      await new Promise((resolve, reject) => {
        const addReq = store.add({ ticker });
        addReq.onsuccess = resolve;
        addReq.onerror = reject;
      });
    }
    
    this.notifyListeners('watchlist', tickers);
  }

  async addTransaction(transactionData) {
    const encrypted = await this.encryption.encrypt(transactionData);
    const dbTransaction = this.db.transaction(['portfolio'], 'readwrite');
    const store = dbTransaction.objectStore('portfolio');
    
    await new Promise((resolve, reject) => {
      const addReq = store.add({ data: encrypted, date: transactionData.date });
      addReq.onsuccess = resolve;
      addReq.onerror = reject;
    });
    
    this.state.portfolio.push(transactionData);
    this.notifyListeners('portfolio', this.state.portfolio);
  }

  async clearPortfolio() {
    const dbTransaction = this.db.transaction(['portfolio'], 'readwrite');
    const store = dbTransaction.objectStore('portfolio');
    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = resolve;
      clearReq.onerror = reject;
    });
    this.state.portfolio = [];
    this.notifyListeners('portfolio', this.state.portfolio);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Immediate callback with current state if any
    callback(this.state[key]);
    
    return () => this.listeners.get(key).delete(callback);
  }

  notifyListeners(key, data) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error notifying listener for key ${key}:`, e);
        }
      });
    }
  }

  getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
