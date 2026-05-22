export class ErrorReporter {
  constructor() {
    this.logsStoreName = 'error-logs';
    this.db = null;
    this.initDatabase();
    this.setupGlobalListeners();
  }

  async initDatabase() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('ErrorReporterDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('errors')) {
            db.createObjectStore('errors', { keyPath: 'id', autoIncrement: true });
          }
        };
      });
    } catch (e) {
      console.warn("Failed to initialize Error DB:", e);
    }
  }

  setupGlobalListeners() {
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString()
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        type: 'unhandled-promise-rejection',
        timestamp: new Date().toISOString()
      });
    });
  }

  async reportError(errorData) {
    console.error('[Telemetry Mocked - Security Isolation]', errorData);
    
    if (this.db) {
      try {
        const transaction = this.db.transaction(['errors'], 'readwrite');
        const store = transaction.objectStore('errors');
        store.add(errorData);
      } catch (e) {
        console.warn("Could not save error to IndexedDB:", e);
      }
    }
  }

  async getStoredErrors() {
    if (!this.db) return [];
    return new Promise((resolve) => {
      const transaction = this.db.transaction(['errors'], 'readonly');
      const store = transaction.objectStore('errors');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }

  async clearStoredErrors() {
    if (!this.db) return;
    return new Promise((resolve) => {
      const transaction = this.db.transaction(['errors'], 'readwrite');
      const store = transaction.objectStore('errors');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }
}
