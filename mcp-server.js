#!/usr/bin/env node

/**
 * Cargills Online MCP Server
 * Model Context Protocol (MCP) server for querying Sri Lankan grocery products,
 * food items, prices, and stock from cargillsonline.com.
 */

const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const path = require('path');
const fs = require('fs');

const { CargillsSearch } = require('./src/search');
const { CargillsScraper } = require('./src/scraper');
const { CargillsApi, FOOD_CATEGORIES } = require('./src/api');

const searcher = new CargillsSearch();
const api = new CargillsApi();

// Create the MCP server instance
const server = new McpServer({
  name: 'cargills-online',
  version: '1.0.0'
});

// -----------------------------------------------------------------------------
// TOOL 1: cargills_search
// -----------------------------------------------------------------------------
server.tool(
  'cargills_search',
  'Search grocery, food, and household products from Cargills Online (Sri Lanka). Supports keyword search, category filtering, food-only filter, price range (min/max in LKR), stock status, and sorting.',
  {
    query: z.string().optional().default('').describe('Search keyword (e.g., "soya", "fresh milk", "pineapple", "keeri samba", "chicken", "tea")'),
    category: z.string().optional().describe('Category filter (e.g. "Fruits", "Vegetables", "Dairy", "Food Cupboard", "Beverages", "Cooking Essentials", "Bakery", "Frozen Food", "Meats", "Seafood", "Rice", "Seeds & Spices", "Snacks & Confectionery")'),
    food_only: z.boolean().optional().default(true).describe('Filter to only food and grocery items (excludes household, auto care, stationery, etc.)'),
    in_stock_only: z.boolean().optional().default(false).describe('Only return items that are currently in stock'),
    has_discount_only: z.boolean().optional().default(false).describe('Only return items with an active discount (% off)'),
    min_price: z.number().optional().describe('Minimum price in LKR (Rs.)'),
    max_price: z.number().optional().describe('Maximum price in LKR (Rs.)'),
    sort_by: z.enum(['relevance', 'price_asc', 'price_desc', 'discount_desc', 'name_asc']).optional().default('relevance').describe('Sort order: "relevance", "price_asc" (cheapest first), "price_desc" (priciest first), "discount_desc" (highest % discount), "name_asc" (A-Z)'),
    limit: z.number().min(1).max(50).optional().default(15).describe('Number of results to return (default: 15, max: 50)'),
    page: z.number().min(1).optional().default(1).describe('Page number for pagination (default: 1)'),
    mode: z.enum(['offline', 'live']).optional().default('offline').describe('"offline" uses the fast local database (recommended). "live" queries cargillsonline.com directly in real time.')
  },
  async ({ query, category, food_only, in_stock_only, has_discount_only, min_price, max_price, sort_by, limit, page, mode }) => {
    try {
      let results;

      if (mode === 'live') {
        results = await searcher.searchLive(query, {
          foodOnly: food_only,
          inStockOnly: in_stock_only,
          minPrice: min_price,
          maxPrice: max_price,
          sortBy: sort_by,
          pageIndex: page,
          pageSize: limit
        });
      } else {
        results = searcher.searchLocal(query, {
          category,
          foodOnly: food_only,
          inStockOnly: in_stock_only,
          hasDiscountOnly: has_discount_only,
          minPrice: min_price,
          maxPrice: max_price,
          sortBy: sort_by,
          page,
          limit
        });
      }

      if (!results.results || results.results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No Cargills products found matching query "${query}" with the specified filters.` +
                (mode === 'offline' && results.message ? `\nNote: ${results.message}` : '')
            }
          ]
        };
      }

      const formattedItems = results.results.map((p, idx) => {
        const lines = [
          `**${idx + 1}. ${p.name}**`,
          `   - **Price**: ${p.priceFormatted || `Rs. ${p.price}`}` + (p.hasDiscount ? ` ~~(MRP: ${p.mrpFormatted})~~ **[-${p.discountPercent}% OFF]**` : ''),
          `   - **Size / Unit**: ${p.packageSize || 'N/A'}`,
          `   - **Category**: ${p.category} ${p.isFood ? '🥗' : ''}`,
          `   - **Status**: ${p.inStock ? `In Stock (${p.inventory} available)` : 'Out of Stock'}`,
          `   - **SKU**: \`${p.sku}\``
        ];
        if (p.shortDescription && p.shortDescription !== p.name) {
          lines.push(`   - **Description**: ${p.shortDescription}`);
        }
        if (p.productUrl) {
          lines.push(`   - **Link**: [View on Cargills Online](${p.productUrl})`);
        }
        return lines.join('\n');
      }).join('\n\n');

      const summaryHeader = `Found **${results.total}** product(s) (Showing ${results.results.length} on page ${results.page} of ${results.totalPages || 1}) [Mode: ${mode.toUpperCase()}]:\n\n`;

      return {
        content: [
          {
            type: 'text',
            text: summaryHeader + formattedItems
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing search: ${err.message}`
          }
        ]
      };
    }
  }
);

// -----------------------------------------------------------------------------
// TOOL 2: cargills_get_product
// -----------------------------------------------------------------------------
server.tool(
  'cargills_get_product',
  'Get comprehensive details for a specific Cargills Online product by SKU code, product ID, or exact name. Returns prices, discounts, unit size, inventory, full description, nutritional highlights, image URLs, and direct web links.',
  {
    identifier: z.string().describe('Product SKU code (e.g. "FTE0040", "CFE0128"), numeric ID (e.g. "653"), or product name')
  },
  async ({ identifier }) => {
    try {
      let products = searcher.loadLocalProducts();
      if (!products) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Local product dataset not loaded. Please run cargills_scrape first.' }]
        };
      }

      const cleanId = identifier.trim().toLowerCase();

      // Find exact or closest match
      let product = products.find(p =>
        (p.sku && p.sku.toLowerCase() === cleanId) ||
        (p.id && String(p.id) === cleanId) ||
        (p.name && p.name.toLowerCase() === cleanId)
      );

      if (!product) {
        // Fallback to substring match
        product = products.find(p =>
          (p.sku && p.sku.toLowerCase().includes(cleanId)) ||
          (p.name && p.name.toLowerCase().includes(cleanId))
        );
      }

      if (!product) {
        return {
          content: [{ type: 'text', text: `Product not found for identifier "${identifier}".` }]
        };
      }

      const details = {
        name: product.name,
        sku: product.sku,
        id: product.id,
        category: product.category,
        isFood: product.isFood,
        sellingPrice: product.priceFormatted,
        numericPriceLKR: product.price,
        mrp: product.mrpFormatted || 'N/A',
        discount: product.hasDiscount ? `${product.discountPercent}% OFF (Save Rs. ${product.discountAmount})` : 'No discount',
        packageSize: product.packageSize,
        unitSize: product.unitSize,
        uom: product.uom,
        inventory: product.inventory,
        inStock: product.inStock,
        description: product.description || product.shortDescription || 'No description provided.',
        keywords: product.searchTerms,
        productUrl: product.productUrl,
        imageUrl: product.image || product.webImage
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(details, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error fetching product details: ${err.message}` }]
      };
    }
  }
);

// -----------------------------------------------------------------------------
// TOOL 3: cargills_list_categories
// -----------------------------------------------------------------------------
server.tool(
  'cargills_list_categories',
  'List all categories available on Cargills Online with their food tags and product counts.',
  {
    food_only: z.boolean().optional().default(false).describe('If true, only returns food & beverage categories.')
  },
  async ({ food_only }) => {
    try {
      const categories = await api.getCategories();
      const localProducts = searcher.loadLocalProducts() || [];

      // Calculate count per category
      const countMap = {};
      localProducts.forEach(p => {
        countMap[p.category] = (countMap[p.category] || 0) + 1;
      });

      let filtered = categories;
      if (food_only) {
        filtered = categories.filter(c => c.isFood);
      }

      const list = filtered.map(c => ({
        name: c.name,
        code: c.abbreviation || '',
        isFood: c.isFood,
        productCount: countMap[c.name] || 0
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Available Cargills Categories (${list.length} total):\n\n` +
              list.map(c => `- **${c.name}** [${c.isFood ? 'Food 🥗' : 'General'}] - ${c.productCount} products in database`).join('\n')
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error listing categories: ${err.message}` }]
      };
    }
  }
);

// -----------------------------------------------------------------------------
// TOOL 4: cargills_scrape
// -----------------------------------------------------------------------------
server.tool(
  'cargills_scrape',
  'Scrape or refresh all product data directly from cargillsonline.com and save to the local JSON and CSV dataset.',
  {
    food_only: z.boolean().optional().default(false).describe('If true, scrape only the 16 food categories; if false, scrape the entire site (all 25 categories).'),
    pin_code: z.string().optional().default('Colombo').describe('Delivery location / pin code (e.g., "Colombo")')
  },
  async ({ food_only, pin_code }) => {
    try {
      console.error(`[MCP] Starting Cargills scrape (foodOnly=${food_only}, pinCode=${pin_code})...`);
      const scraper = new CargillsScraper({
        foodOnly: food_only,
        pinCode: pin_code,
        delayMs: 250
      });

      const res = await scraper.scrape((p) => {
        if (p.phase === 'category_done') {
          console.error(`[MCP Scraper] ${p.categoryName} -> ${p.productsFound} items (Total Unique: ${p.totalUniqueSoFar})`);
        }
      });

      // Refresh search cache
      searcher.loadLocalProducts();

      return {
        content: [
          {
            type: 'text',
            text: `✅ Cargills scrape completed in ${res.stats.durationSeconds}s!\n\n` +
              `- **Total Products Scraped**: ${res.stats.totalProducts}\n` +
              `- **Total Food Items**: ${res.stats.totalFoodProducts}\n` +
              `- **Categories Scraped**: ${res.stats.categoriesCount}\n` +
              `- **Saved JSON**: \`${res.jsonPath}\`\n` +
              `- **Saved CSV**: \`${res.csvPath}\``
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Scraping failed: ${err.message}` }]
      };
    }
  }
);

// -----------------------------------------------------------------------------
// TOOL 5: cargills_get_stats
// -----------------------------------------------------------------------------
server.tool(
  'cargills_get_stats',
  'Get statistics and health metrics for the local Cargills Online product database.',
  {},
  async () => {
    try {
      const products = searcher.loadLocalProducts();
      if (!products) {
        return {
          content: [{ type: 'text', text: 'No local Cargills dataset found. Please run cargills_scrape first.' }]
        };
      }

      const foodItems = products.filter(p => p.isFood);
      const inStock = products.filter(p => p.inStock);
      const discounted = products.filter(p => p.hasDiscount);
      const categories = Array.from(new Set(products.map(p => p.category)));

      // Calculate price ranges
      const foodPrices = foodItems.map(p => p.price).filter(p => p > 0);
      const minPrice = foodPrices.length ? Math.min(...foodPrices) : 0;
      const maxPrice = foodPrices.length ? Math.max(...foodPrices) : 0;
      const avgPrice = foodPrices.length ? Math.round(foodPrices.reduce((a, b) => a + b, 0) / foodPrices.length) : 0;

      const stats = {
        totalProducts: products.length,
        totalFoodProducts: foodItems.length,
        inStockCount: inStock.length,
        discountedItemsCount: discounted.length,
        categoriesCount: categories.length,
        categories: categories,
        foodPriceRangeLKR: {
          min: minPrice,
          max: maxPrice,
          average: avgPrice
        },
        lastScraped: searcher.cacheTime || 'Unknown'
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error fetching stats: ${err.message}` }]
      };
    }
  }
);

// -----------------------------------------------------------------------------
// MCP RESOURCES
// -----------------------------------------------------------------------------

// Resource 1: Dataset stats
server.resource(
  'cargills-stats',
  'cargills://stats',
  async (uri) => {
    const products = searcher.loadLocalProducts() || [];
    const foodItems = products.filter(p => p.isFood);
    const inStock = products.filter(p => p.inStock);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          totalProducts: products.length,
          totalFoodProducts: foodItems.length,
          inStock: inStock.length,
          lastUpdated: searcher.cacheTime
        }, null, 2)
      }]
    };
  }
);

// Resource 2: Categories
server.resource(
  'cargills-categories',
  'cargills://categories',
  async (uri) => {
    const categories = await api.getCategories();
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(categories, null, 2)
      }]
    };
  }
);

// Resource 3: Product by SKU template
server.resource(
  'cargills-product',
  new ResourceTemplate('cargills://products/{sku}', { list: undefined }),
  async (uri, { sku }) => {
    const products = searcher.loadLocalProducts() || [];
    const p = products.find(item => item.sku && item.sku.toLowerCase() === String(sku).toLowerCase());
    if (!p) {
      throw new Error(`Product with SKU ${sku} not found`);
    }
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(p, null, 2)
      }]
    };
  }
);

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🛒 Cargills Online MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting Cargills MCP server:', err);
  process.exit(1);
});
