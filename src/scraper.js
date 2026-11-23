const fs = require('fs');
const path = require('path');
const { CargillsApi, FOOD_CATEGORIES } = require('./api');

class CargillsScraper {
  constructor(options = {}) {
    this.api = new CargillsApi(options);
    this.outputDir = options.outputDir || path.join(__dirname, '..', 'data');
    this.foodOnly = options.foodOnly ?? false; // default false to scrape full site, but tag food
    this.pinCode = options.pinCode || 'Colombo';
    this.delayBetweenCategories = options.delayMs || 300; // polite delay
    this.isScraping = false;
    this.stats = {
      totalProducts: 0,
      totalFoodProducts: 0,
      categoriesCount: 0,
      startedAt: null,
      finishedAt: null,
      durationSeconds: 0
    };
  }

  // Helper delay
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convert array of product objects to CSV string
  toCSV(products) {
    if (!products || products.length === 0) return '';

    const headers = [
      'id',
      'sku',
      'name',
      'category',
      'isFood',
      'price',
      'priceFormatted',
      'mrp',
      'discountAmount',
      'discountPercent',
      'packageSize',
      'unitSize',
      'uom',
      'inventory',
      'inStock',
      'shortDescription',
      'description',
      'image',
      'productUrl'
    ];

    const escapeField = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${str}"`;
    };

    const headerLine = headers.join(',');
    const dataLines = products.map(p => {
      return headers.map(h => escapeField(p[h])).join(',');
    });

    return [headerLine, ...dataLines].join('\n');
  }

  // Main scrape function
  async scrape(onProgress = null) {
    this.isScraping = true;
    const startTime = Date.now();
    this.stats.startedAt = new Date().toISOString();

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    if (onProgress) onProgress({ phase: 'init', message: `Initializing session with delivery area '${this.pinCode}'...` });
    await this.api.initSession(this.pinCode);

    if (onProgress) onProgress({ phase: 'categories', message: 'Fetching category tree...' });
    const allCategories = await this.api.getCategories();

    let targetCategories = allCategories;
    if (this.foodOnly) {
      targetCategories = allCategories.filter(c => c.isFood);
    }

    if (onProgress) {
      onProgress({
        phase: 'categories_ready',
        message: `Found ${allCategories.length} categories (${targetCategories.length} target categories).`,
        totalCategories: targetCategories.length
      });
    }

    const productMap = new Map(); // deduplication by id/sku
    let catIndex = 0;

    for (const cat of targetCategories) {
      catIndex++;
      if (onProgress) {
        onProgress({
          phase: 'category_start',
          categoryIndex: catIndex,
          totalCategories: targetCategories.length,
          categoryName: cat.name,
          message: `[${catIndex}/${targetCategories.length}] Scraping "${cat.name}"...`
        });
      }

      try {
        let page = 1;
        let hasMore = true;
        let catProductsCount = 0;

        while (hasMore) {
          const rawItems = await this.api.getProductsPage({
            categoryId: cat.enId,
            pageIndex: page,
            pageSize: 1000
          });

          if (!rawItems || rawItems.length === 0) {
            hasMore = false;
            break;
          }

          for (const raw of rawItems) {
            if (raw.Id === 0 || raw.ItemName === 'No Products Found') continue;
            const norm = this.api.normalizeProduct(raw, cat.name);
            const key = norm.sku || norm.id || `${norm.name}_${norm.packageSize}`;

            if (!productMap.has(key)) {
              productMap.set(key, norm);
              catProductsCount++;
            }
          }

          // If returned items count is less than 1000, we've gotten all
          if (rawItems.length < 1000) {
            hasMore = false;
          } else {
            page++;
          }
        }

        if (onProgress) {
          onProgress({
            phase: 'category_done',
            categoryIndex: catIndex,
            totalCategories: targetCategories.length,
            categoryName: cat.name,
            productsFound: catProductsCount,
            totalUniqueSoFar: productMap.size
          });
        }
      } catch (err) {
        console.error(`Error scraping category ${cat.name}:`, err.message);
        if (onProgress) {
          onProgress({
            phase: 'category_error',
            categoryName: cat.name,
            error: err.message
          });
        }
      }

      if (this.delayBetweenCategories > 0) {
        await this.sleep(this.delayBetweenCategories);
      }
    }

    const productList = Array.from(productMap.values());
    const foodProducts = productList.filter(p => p.isFood);

    this.stats.totalProducts = productList.length;
    this.stats.totalFoodProducts = foodProducts.length;
    this.stats.categoriesCount = targetCategories.length;
    this.stats.finishedAt = new Date().toISOString();
    this.stats.durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Save JSON
    const jsonPath = path.join(this.outputDir, 'cargills_products.json');
    const jsonPayload = {
      meta: {
        site: 'cargillsonline.com',
        location: this.pinCode,
        scrapedAt: this.stats.finishedAt,
        totalProducts: productList.length,
        totalFoodProducts: foodProducts.length,
        durationSeconds: this.stats.durationSeconds
      },
      categories: targetCategories.map(c => ({ id: c.id, name: c.name, isFood: c.isFood })),
      products: productList
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), 'utf8');

    // Save CSV
    const csvPath = path.join(this.outputDir, 'cargills_products.csv');
    const csvData = this.toCSV(productList);
    fs.writeFileSync(csvPath, csvData, 'utf8');

    this.isScraping = false;

    if (onProgress) {
      onProgress({
        phase: 'complete',
        message: `Scrape finished in ${this.stats.durationSeconds}s. Found ${productList.length} products (${foodProducts.length} food items).`,
        jsonPath,
        csvPath,
        stats: this.stats
      });
    }

    return {
      stats: this.stats,
      jsonPath,
      csvPath,
      products: productList
    };
  }
}

module.exports = {
  CargillsScraper
};
