export const StorageAPI = {
  /**
   * Fetches all saved quotes.
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
   * Saves a new quote to storage.
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
   * Clears all data (optional, for dashboard utilities).
   */
  async clearQuotes() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ savedQuotes: [] }, () => {
        resolve();
      });
    });
  }
};
