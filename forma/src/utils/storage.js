// Storage abstraction: works in Claude artifacts (window.storage) and locally (localStorage)
export const storage = {
  async set(key, value) {
    try {
      if (window.storage?.set) { await window.storage.set(key, value); return; }
    } catch (e) {}
    try { localStorage.setItem(key, value); } catch (e) {}
  },
  async get(key) {
    try {
      if (window.storage?.get) { const r = await window.storage.get(key); return r?.value || null; }
    } catch (e) {}
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  async delete(key) {
    try {
      if (window.storage?.delete) { await window.storage.delete(key); return; }
    } catch (e) {}
    try { localStorage.removeItem(key); } catch (e) {}
  },
  async list(prefix) {
    try {
      if (window.storage?.list) {
        const r = await window.storage.list(prefix);
        return r?.keys || [];
      }
    } catch (e) {}
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return keys;
    } catch (e) { return []; }
  },
};