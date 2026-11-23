const fs = require('fs');
const path = require('path');
const { CargillsApi } = require('./api');

class CargillsSearch {
  constructor(options = {}) {
    this.api = new CargillsApi(options);
    this.dataPath = options.dataPath || path.join(__dirname, '..', 'data', 'cargills_products.json');
    this.cachedProducts = null;
    this.cacheTime = null;
  }

  // Load scraped products from local JSON file
  loadLocalProducts() {
    if (!fs.existsSync(this.dataPath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(this.dataPath, 'utf8');
      const data = JSON.parse(raw);
      this.cachedProducts = data.products || [];
      this.cacheTime = data.meta?.scrapedAt || null;
      return this.cachedProducts;
    } catch (err) {
      console.error('Error loading local dataset:', err.message);
      return null;
    }
  }

  // Search local scraped products
  searchLocal(query = '', options = {}) {
    let products = this.cachedProducts;
    if (!products) {
      products = this.loadLocalProducts();
    }
    if (!products) {
      return {
        total: 0,
        page: 1,
        limit: options.limit || 50,
        totalPages: 0,
        results: [],
        message: 'No local dataset found. Please run a scrape first.'
      };
    }

    const {
      category = null,
      foodOnly = false,
      minPrice = null,
      maxPrice = null,
      inStockOnly = false,
      hasDiscountOnly = false,
      sortBy = 'relevance',
      page = 1,
      limit = 50
    } = options;

    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    let filtered = products.filter(product => {
      // 1. Food only filter
      if (foodOnly && !product.isFood) return false;

      // 2. Category filter
      if (category && category !== 'All') {
        if (product.category.toLowerCase() !== category.toLowerCase()) return false;
      }

      // 3. Price range
      if (minPrice !== null && !isNaN(minPrice) && product.price < parseFloat(minPrice)) return false;
      if (maxPrice !== null && !isNaN(maxPrice) && product.price > parseFloat(maxPrice)) return false;

      // 4. In stock
      if (inStockOnly && !product.inStock) return false;

      // 5. Has discount
      if (hasDiscountOnly && !product.hasDiscount) return false;

      // 6. Search query matching
      if (terms.length > 0) {
        const searchable = [
          product.name,
          product.category,
          product.sku,
          product.packageSize,
          product.shortDescription,
          product.description,
          product.searchTerms
        ].join(' ').toLowerCase();

        // Every term must be present
        const matchesAll = terms.every(term => searchable.includes(term));
        if (!matchesAll) return false;
      }

      return true;
    });

    // Score & Sort
    if (sortBy === 'price_asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name_asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name_desc') {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'discount_desc') {
      filtered.sort((a, b) => b.discountPercent - a.discountPercent);
    } else {
      // Relevance sort
      if (terms.length > 0) {
        const lowerQ = query.toLowerCase().trim();
        filtered.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();

          // Exact name match
          if (aName === lowerQ && bName !== lowerQ) return -1;
          if (bName === lowerQ && aName !== lowerQ) return 1;

          // Starts with query
          if (aName.startsWith(lowerQ) && !bName.startsWith(lowerQ)) return -1;
          if (bName.startsWith(lowerQ) && !aName.startsWith(lowerQ)) return 1;

          // In-stock preference
          if (a.inStock && !b.inStock) return -1;
          if (!a.inStock && b.inStock) return 1;

          return 0;
        });
      }
    }

    const total = filtered.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedResults = filtered.slice(startIndex, startIndex + limitNum);

    return {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      results: paginatedResults
    };
  }

  // Live real-time search on cargillsonline.com
  async searchLive(query = '', options = {}) {
    const { categoryId = '', pageIndex = 1, pageSize = 100 } = options;
    const items = await this.api.liveSearch(query, pageIndex, pageSize);

    // Apply any client-side filters
    let results = items;
    if (options.minPrice !== null && !isNaN(options.minPrice)) {
      results = results.filter(p => p.price >= parseFloat(options.minPrice));
    }
    if (options.maxPrice !== null && !isNaN(options.maxPrice)) {
      results = results.filter(p => p.price <= parseFloat(options.maxPrice));
    }
    if (options.inStockOnly) {
      results = results.filter(p => p.inStock);
    }
    if (options.foodOnly) {
      results = results.filter(p => p.isFood);
    }

    if (options.sortBy === 'price_asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (options.sortBy === 'price_desc') {
      results.sort((a, b) => b.price - a.price);
    }

    return {
      total: results.length,
      page: pageIndex,
      limit: pageSize,
      results: results
    };
  }
}

module.exports = {
  CargillsSearch
};
