const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { CargillsScraper } = require('./scraper');
const { CargillsSearch } = require('./search');
const { CargillsApi } = require('./api');

function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const searcher = new CargillsSearch();
  const api = new CargillsApi();

  let activeScrape = null;
  let scrapeProgress = {
    isRunning: false,
    phase: 'idle',
    message: 'No scrape in progress',
    currentCategory: '',
    progressPercent: 0,
    totalCategories: 0,
    currentCategoryIndex: 0,
    productsFound: 0,
    startedAt: null,
    finishedAt: null,
    error: null
  };

  // 1. Get Categories
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await api.getCategories();
      res.json({ success: true, categories });
    } catch (err) {
      // Fallback to local categories if offline
      const local = searcher.loadLocalProducts();
      if (local && local.length > 0) {
        const catSet = new Set(local.map(p => p.category));
        const list = Array.from(catSet).map(c => ({
          name: c,
          isFood: true
        }));
        return res.json({ success: true, categories: list, source: 'cached' });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Search Local Products
  app.get('/api/products', (req, res) => {
    try {
      const {
        q = '',
        category,
        foodOnly,
        minPrice,
        maxPrice,
        inStockOnly,
        hasDiscountOnly,
        sortBy,
        page = 1,
        limit = 30
      } = req.query;

      const results = searcher.searchLocal(q, {
        category,
        foodOnly: foodOnly === 'true' || foodOnly === '1',
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        inStockOnly: inStockOnly === 'true' || inStockOnly === '1',
        hasDiscountOnly: hasDiscountOnly === 'true' || hasDiscountOnly === '1',
        sortBy,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 30
      });

      res.json({ success: true, ...results });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Search Live via Cargills API
  app.get('/api/search/live', async (req, res) => {
    try {
      const { q = '', minPrice, maxPrice, inStockOnly, foodOnly, sortBy, page = 1, limit = 50 } = req.query;
      const results = await searcher.searchLive(q, {
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        inStockOnly: inStockOnly === 'true' || inStockOnly === '1',
        foodOnly: foodOnly === 'true' || foodOnly === '1',
        sortBy,
        pageIndex: parseInt(page, 10) || 1,
        pageSize: parseInt(limit, 10) || 50
      });
      res.json({ success: true, ...results });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Dataset Stats
  app.get('/api/stats', (req, res) => {
    const products = searcher.loadLocalProducts();
    if (!products) {
      return res.json({
        success: true,
        scraped: false,
        totalProducts: 0,
        totalFoodProducts: 0,
        lastScraped: null
      });
    }

    const foodProducts = products.filter(p => p.isFood);
    const inStock = products.filter(p => p.inStock);
    const discounted = products.filter(p => p.hasDiscount);
    const categories = new Set(products.map(p => p.category));

    res.json({
      success: true,
      scraped: true,
      totalProducts: products.length,
      totalFoodProducts: foodProducts.length,
      inStockCount: inStock.length,
      discountedCount: discounted.length,
      categoryCount: categories.size,
      lastScraped: searcher.cacheTime
    });
  });

  // 5. Trigger Scrape
  app.post('/api/scrape', (req, res) => {
    if (scrapeProgress.isRunning) {
      return res.status(409).json({ success: false, message: 'Scrape already running' });
    }

    const { foodOnly = false, pinCode = 'Colombo' } = req.body || {};

    const scraper = new CargillsScraper({
      foodOnly,
      pinCode,
      delayMs: 250
    });

    scrapeProgress = {
      isRunning: true,
      phase: 'starting',
      message: 'Starting scraper...',
      currentCategory: '',
      progressPercent: 0,
      totalCategories: 0,
      currentCategoryIndex: 0,
      productsFound: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null
    };

    res.json({ success: true, message: 'Scrape started in background' });

    // Run in background
    scraper.scrape((p) => {
      scrapeProgress.phase = p.phase;
      if (p.message) scrapeProgress.message = p.message;
      if (p.categoryName) scrapeProgress.currentCategory = p.categoryName;
      if (p.totalCategories) scrapeProgress.totalCategories = p.totalCategories;
      if (p.categoryIndex) {
        scrapeProgress.currentCategoryIndex = p.categoryIndex;
        scrapeProgress.progressPercent = Math.round((p.categoryIndex / (scrapeProgress.totalCategories || 1)) * 100);
      }
      if (p.totalUniqueSoFar) scrapeProgress.productsFound = p.totalUniqueSoFar;
      if (p.phase === 'complete') {
        scrapeProgress.isRunning = false;
        scrapeProgress.progressPercent = 100;
        scrapeProgress.finishedAt = new Date().toISOString();
        searcher.loadLocalProducts(); // Refresh in-memory cache
      } else if (p.phase === 'category_error') {
        scrapeProgress.error = p.error;
      }
    }).catch(err => {
      scrapeProgress.isRunning = false;
      scrapeProgress.error = err.message;
      scrapeProgress.message = `Failed: ${err.message}`;
    });
  });

  // 6. Scrape Status
  app.get('/api/scrape/status', (req, res) => {
    res.json({ success: true, status: scrapeProgress });
  });

  // 7. Export CSV
  app.get('/api/export/csv', (req, res) => {
    const csvPath = path.join(__dirname, '..', 'data', 'cargills_products.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(404).send('CSV file not generated yet. Please scrape first.');
    }
    res.download(csvPath, 'cargills_products.csv');
  });

  // 8. Export JSON
  app.get('/api/export/json', (req, res) => {
    const jsonPath = path.join(__dirname, '..', 'data', 'cargills_products.json');
    if (!fs.existsSync(jsonPath)) {
      return res.status(404).send('JSON file not generated yet. Please scrape first.');
    }
    res.download(jsonPath, 'cargills_products.json');
  });

  return app;
}

function startServer(port = 3000) {
  const app = createServer();
  const server = app.listen(port, () => {
    console.log(`\n🌐 Cargills Web App & API running at: http://localhost:${port}`);
    console.log(`📡 REST API endpoints:`);
    console.log(`   - GET  /api/products?q=milk&category=Dairy&sortBy=price_asc`);
    console.log(`   - GET  /api/search/live?q=soya`);
    console.log(`   - GET  /api/categories`);
    console.log(`   - POST /api/scrape`);
    console.log(`   - GET  /api/stats`);
    console.log(`   - GET  /api/export/csv | /api/export/json\n`);
  });
  return server;
}

module.exports = {
  createServer,
  startServer
};

if (require.main === module) {
  const port = process.env.PORT || 3000;
  startServer(port);
}
