#!/usr/bin/env node

const { CargillsScraper } = require('./src/scraper');
const { CargillsSearch } = require('./src/search');
const { CargillsApi } = require('./src/api');
const { startServer } = require('./src/server');

const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : 'help';

function printHelp() {
  console.log(`
=============================================================
 🛒 Cargills Online Scraper & Search CLI (Node.js)
=============================================================

Usage:
  node cli.js <command> [options]

Commands:
  scrape                 Scrape products from cargillsonline.com
    Options:
      --food-only        Scrape only food categories (Vegetables, Fruits, Dairy, etc.)
      --pin <location>   Delivery pincode / city (Default: "Colombo")
      --delay <ms>       Delay in ms between categories (Default: 300)

  search <query>         Search food & grocery items
    Options:
      --live             Search live on cargillsonline.com directly
      --category <name>  Filter by category (e.g. "Fruits", "Dairy")
      --food-only        Filter to show food items only
      --sort <type>      Sort: "price_asc", "price_desc", "name_asc", "discount_desc"
      --min <price>      Minimum price
      --max <price>      Maximum price
      --in-stock         Only show in-stock products

  categories             List all categories and whether they are food items

  serve [port]           Start the Web Search UI & REST API dashboard (Default port: 3000)

  mcp                    Start the Model Context Protocol (MCP) server on stdio

Examples:
  node cli.js scrape
  node cli.js scrape --food-only
  node cli.js search "soya"
  node cli.js search "fresh milk" --live
  node cli.js search "banana" --category Fruits --sort price_asc
  node cli.js serve 3000
=============================================================
`);
}

async function handleScrape() {
  const foodOnly = args.includes('--food-only');
  const pinIdx = args.indexOf('--pin');
  const pinCode = pinIdx !== -1 && args[pinIdx + 1] ? args[pinIdx + 1] : 'Colombo';
  const delayIdx = args.indexOf('--delay');
  const delayMs = delayIdx !== -1 && args[delayIdx + 1] ? parseInt(args[delayIdx + 1], 10) : 300;

  console.log(`\n🚀 Starting Cargills Online Scraper`);
  console.log(`📍 Delivery Location: ${pinCode}`);
  console.log(`🥗 Food Categories Only: ${foodOnly ? 'Yes' : 'No (Full Site)'}`);
  console.log(`⏱️ Category Delay: ${delayMs}ms\n`);

  const scraper = new CargillsScraper({
    foodOnly,
    pinCode,
    delayMs
  });

  const res = await scraper.scrape((p) => {
    if (p.phase === 'init') {
      console.log(`[INIT] ${p.message}`);
    } else if (p.phase === 'categories_ready') {
      console.log(`[READY] ${p.message}`);
    } else if (p.phase === 'category_start') {
      process.stdout.write(`[CAT] ${p.message} `);
    } else if (p.phase === 'category_done') {
      console.log(`-> Found ${p.productsFound} items (Total Unique: ${p.totalUniqueSoFar})`);
    } else if (p.phase === 'category_error') {
      console.log(`-> Error: ${p.error}`);
    } else if (p.phase === 'complete') {
      console.log(`\n✅ ${p.message}`);
      console.log(`📁 JSON saved to: ${p.jsonPath}`);
      console.log(`📁 CSV saved to:  ${p.csvPath}\n`);
    }
  });

  return res;
}

async function handleSearch() {
  const query = args[1] && !args[1].startsWith('--') ? args[1] : '';
  const isLive = args.includes('--live');
  const foodOnly = args.includes('--food-only');
  const inStockOnly = args.includes('--in-stock');

  const catIdx = args.indexOf('--category');
  const category = catIdx !== -1 && args[catIdx + 1] ? args[catIdx + 1] : null;

  const sortIdx = args.indexOf('--sort');
  const sortBy = sortIdx !== -1 && args[sortIdx + 1] ? args[sortIdx + 1] : 'relevance';

  const minIdx = args.indexOf('--min');
  const minPrice = minIdx !== -1 && args[minIdx + 1] ? parseFloat(args[minIdx + 1]) : null;

  const maxIdx = args.indexOf('--max');
  const maxPrice = maxIdx !== -1 && args[maxIdx + 1] ? parseFloat(args[maxIdx + 1]) : null;

  const searcher = new CargillsSearch();

  console.log(`\n🔍 Searching for: "${query || '*'}" [Mode: ${isLive ? 'LIVE API' : 'OFFLINE DATASET'}]`);

  let searchResults;
  if (isLive) {
    searchResults = await searcher.searchLive(query, {
      foodOnly,
      inStockOnly,
      sortBy,
      minPrice,
      maxPrice
    });
  } else {
    searchResults = searcher.searchLocal(query, {
      category,
      foodOnly,
      inStockOnly,
      sortBy,
      minPrice,
      maxPrice,
      limit: 30
    });
  }

  if (!searchResults.results || searchResults.results.length === 0) {
    console.log(`❌ No products found matching your criteria.\n`);
    if (!isLive && searchResults.message) {
      console.log(`💡 ${searchResults.message}`);
    }
    return;
  }

  console.log(`\n📦 Found ${searchResults.total} product(s) (Showing up to ${searchResults.results.length}):\n`);
  console.log('----------------------------------------------------------------------------------------------------------');
  console.log(
    '#'.padEnd(4) +
    'Product Name'.padEnd(38) +
    'Category'.padEnd(20) +
    'Size'.padEnd(12) +
    'Price'.padEnd(14) +
    'Stock'
  );
  console.log('----------------------------------------------------------------------------------------------------------');

  searchResults.results.forEach((p, idx) => {
    const num = String(idx + 1).padEnd(4);
    const name = (p.name.length > 35 ? p.name.substring(0, 32) + '...' : p.name).padEnd(38);
    const cat = (p.category.length > 18 ? p.category.substring(0, 15) + '...' : p.category).padEnd(20);
    const size = (p.packageSize || '-').padEnd(12);
    const price = (p.priceFormatted || `Rs. ${p.price}`).padEnd(14);
    const stock = p.inStock ? 'In Stock' : 'Out of Stock';

    console.log(`${num}${name}${cat}${size}${price}${stock}`);
  });

  console.log('----------------------------------------------------------------------------------------------------------\n');
}

async function handleCategories() {
  const api = new CargillsApi();
  console.log('\nFetching categories from cargillsonline.com...\n');
  const cats = await api.getCategories();
  console.log(`Total Categories: ${cats.length}\n`);
  console.log('#'.padEnd(4) + 'Category Name'.padEnd(30) + 'Type'.padEnd(10) + 'Code');
  console.log('------------------------------------------------------------');
  cats.forEach((c, idx) => {
    const num = String(idx + 1).padEnd(4);
    const name = c.name.padEnd(30);
    const type = (c.isFood ? 'Food' : 'General').padEnd(10);
    console.log(`${num}${name}${type}${c.abbreviation || '-'}`);
  });
  console.log('------------------------------------------------------------\n');
}

async function main() {
  try {
    switch (command) {
      case 'scrape':
        await handleScrape();
        break;
      case 'search':
        await handleSearch();
        break;
      case 'categories':
        await handleCategories();
        break;
      case 'serve':
      case 'server':
        const port = args[1] ? parseInt(args[1], 10) : 3000;
        startServer(port);
        break;
      case 'mcp':
        require('./mcp-server');
        break;
      case 'help':
      default:
        printHelp();
        break;
    }
  } catch (err) {
    console.error('Fatal Error:', err);
    process.exit(1);
  }
}

main();
