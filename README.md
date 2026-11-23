# 🛒 Cargills Online Scraper, Product Search & MCP Server 🚀

> ⚡ Fast, friendly, and production-ready toolset to scrape, explore, and search all food & grocery items from **Cargills Online** (Sri Lanka) — featuring a CLI, Web Dashboard, REST API, and native **Model Context Protocol (MCP)** server for AI agents!

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![MCP Ready](https://img.shields.io/badge/MCP-Protocol%202024--11--05-blue.svg)](https://modelcontextprotocol.io/)
[![Built By](https://img.shields.io/badge/Built%20With%20%E2%9D%A4%EF%B8%8F%20By-Nimesh%20Piyumal-red.svg)](https://github.com/nimesh-piyumal)

---

## ✨ Highlights

- ⚡ **Lightning Fast Scraping**: Fetches all 25 categories (3,900+ products, 2,300+ food items) in ~50 seconds via direct API integration.
- 🥗 **Smart Food Tagging**: Automatically detects and tags food & beverage items (`isFood: true`).
- 💰 **Deep Price Intelligence**: Captures current selling prices, MRP (regular price), discounts, and percentage-off badges.
- 📦 **Complete Product Specs**: Unit sizes (kg, g, l, ml), SKU codes, real-time inventory counts, and nutrition/health descriptions.
- 🔍 **Dual-Mode Search Engine**:
  - 💾 **Offline Mode**: Blazing fast search over cached local database with category, price range, and in-stock filters.
  - 🌐 **Live Mode**: Real-time queries sent directly to Cargills Online.
- 🖥️ **Sleek Web Interface**: Modern, responsive dashboard with product modal popups, live/offline toggle, and CSV/JSON export.
- 🤖 **Native MCP Server**: Ready to plug into **Claude Desktop**, **Cursor**, **Antigravity**, **Cline**, and **Windsurf**.

---

## 🚀 Quick Start

### Option 1: Run with NPX (Zero Setup!) ⚡

```bash
# Launch the interactive Web UI directly:
npx cargills serve

# Or run the MCP Server for your AI assistants:
npx cargills-mcp
```

---

### Option 2: Install Globally via NPM 📦

```bash
npm install -g cargills-online-scraper-mcp

# Launch anywhere:
cargills serve
```

---

### Option 3: Clone & Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/nimesh-piyumal/cargills-online-scraper-mcp.git
cd cargills-online-scraper-mcp

# 2. Install dependencies
npm install

# 3. Launch Web Dashboard on http://localhost:3000
npm start
```

---

## 🛠️ Command Line Interface (CLI)

The CLI tool lets you scrape, search, and manage products right from your terminal:

```bash
# 📥 Scrape full store (all 25 categories)
npm run scrape

# 🥗 Scrape only food & grocery items
npm run scrape:food

# 🔍 Search for products (Local Offline DB)
node cli.js search "soya"
node cli.js search "pineapple"
node cli.js search "fresh milk" --category Dairy --sort price_asc
node cli.js search "chicken" --in-stock

# 🌐 Search live directly on Cargills Online
node cli.js search "apple" --live

# 📋 View all available categories
npm run categories

# 🌐 Start Web UI Server (default: port 3000)
npm run serve
```

---

## 🤖 Model Context Protocol (MCP) Server

Connect Cargills grocery data directly to your favorite AI models and agents!

### 🧰 Available MCP Tools

| Tool Name | What It Does |
|---|---|
| 🔎 `cargills_search` | Search grocery & food items with query, category, price bounds, in-stock check, and sorting. |
| 🏷️ `cargills_get_product` | Get in-depth specs by SKU, product ID, or item name (nutrition, description, images, direct links). |
| 📂 `cargills_list_categories` | Retrieve all 25 categories with food flags and total product counts. |
| 🔄 `cargills_scrape` | Trigger an on-demand background scrape to sync local data with the live website. |
| 📊 `cargills_get_stats` | Inspect dataset health (total items, food count, stock ratio, price ranges). |

### 🔌 Easy AI Assistant Setup

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "cargills": {
      "command": "node",
      "args": [
        "<path-to-project>/mcp-server.js"
      ]
    }
  }
}
```

#### Cursor & Cline
- **Server Name**: `cargills-online`
- **Transport**: `stdio`
- **Command**: `node`
- **Arguments**: `./mcp-server.js`

#### Google Antigravity / Gemini CLI (`mcp_config.json`)
```json
{
  "mcpServers": {
    "cargills-online": {
      "command": "node",
      "args": [
        "./mcp-server.js"
      ]
    }
  }
}
```

---

## 🌐 REST API Reference

The built-in Express server exposes a developer-friendly REST API:

- `GET /api/products?q=tea&category=Beverages&sortBy=price_asc` — Search and filter local products
- `GET /api/search/live?q=soya` — Real-time live search against the store
- `GET /api/categories` — List all product categories
- `GET /api/stats` — Summary metrics of the scraped catalog
- `POST /api/scrape` — Trigger an automated background scrape
- `GET /api/scrape/status` — Track real-time scraping progress
- `GET /api/export/csv` — Instant CSV download
- `GET /api/export/json` — Instant JSON download

---

## 👨‍💻 Author

Crafted with care by **Nimesh Piyumal** 🇱🇰

- GitHub: [@nimesh-piyumal](https://github.com/nimesh-piyumal)
- Project: [cargills-online-scraper-mcp](https://github.com/nimesh-piyumal/cargills-online-scraper-mcp)

---

## 📄 License

This project is licensed under the **MIT License**.
