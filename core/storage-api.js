// core/storage-api.js

export const StorageAPI = {
  /**
   * Mengambil semua kutipan yang tersimpan.
   * @returns {Promise<Array>} Array of saved items
   */
  async getQuotes() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ savedQuotes: [] }, (result) => {
        resolve(result.savedQuotes);
      });
    });
  },

  /**
   * Menyimpan kutipan baru ke dalam storage.
   * @param {Object} quoteData - { text, url, timestamp }
   * @returns {Promise<void>}
   */
  async saveQuote(quoteData) {
    const quotes = await this.getQuotes();
    quotes.push(quoteData);
    return new Promise((resolve) => {
      chrome.storage.local.set({ savedQuotes: quotes }, () => {
        resolve();
      });
    });
  },

  /**
   * Menghapus semua data (opsional, untuk utilitas dasbor).
   */
  async clearQuotes() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ savedQuotes: [] }, () => {
        resolve();
      });
    });
  }
};
