export class EncryptionService {
  constructor() {
    this.key = null;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  async deriveKey(passphrase) {
    let saltString = localStorage.getItem('encryption-salt');
    let salt;
    if (saltString) {
      salt = new Uint8Array(saltString.split(',').map(Number));
    } else {
      salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      localStorage.setItem('encryption-salt', Array.from(salt).join(','));
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    this.key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data) {
    if (!this.key) throw new Error('Encryption key not initialized');
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = this.encoder.encode(JSON.stringify(data));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.key,
      encodedData
    );
    
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    };
  }

  async decrypt(encryptedObj) {
    if (!this.key) throw new Error('Encryption key not initialized');
    
    const iv = new Uint8Array(encryptedObj.iv);
    const data = new Uint8Array(encryptedObj.data);
    
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        this.key,
        data
      );
      
      return JSON.parse(this.decoder.decode(decrypted));
    } catch (e) {
      console.error('Decryption failed:', e);
      throw new Error('Decryption failed - incorrect passphrase');
    }
  }
}
