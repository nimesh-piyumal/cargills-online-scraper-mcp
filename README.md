# 🛒 Cargills Online Scraper, Product Search & MCP Server 🚀

> ⚡ Fast, friendly, and production-ready toolset to scrape, explore, and search all food & grocery items from **Cargills Online** (Sri Lanka) — featuring an interactive CLI, Web Dashboard, REST API, and native **Model Context Protocol (MCP)** server for AI agents!

[![npm version](https://img.shields.io/npm/v/cargills-online-scraper-mcp.svg?color=cb3837)](https://www.npmjs.com/package/cargills-online-scraper-mcp)
[![npm downloads](https://img.shields.io/npm/dt/cargills-online-scraper-mcp.svg)](https://www.npmjs.com/package/cargills-online-scraper-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![MCP Ready](https://img.shields.io/badge/MCP-Protocol%202024--11--05-blue.svg)](https://modelcontextprotocol.io/)
[![Built By](https://img.shields.io/badge/Built%20With%20%E2%9D%A4%EF%B8%8F%20By-Nimesh%20Piyumal-red.svg)](https://github.com/nimesh-piyumal)

---

## ✨ Features

- ⚡ **Lightning Fast Scraping**: Fetches all 25 categories (3,900+ products, 2,300+ food items) in under 60 seconds via direct backend API communication.
- 🥗 **Smart Food Tagging**: Automatically detects and tags food & beverage items (`isFood: true`).
- 💰 **Deep Price Intelligence**: Captures current selling prices, MRP (regular price), discounts, and percentage-off savings.
- 📦 **Complete Product Specs**: Unit sizes (kg, g, l, ml), SKU codes, real-time inventory counts, and nutrition/health descriptions.
- 🔍 **Dual-Mode Search Engine**:
  - 💾 **Offline Mode**: Blazing fast search over cached local database with category, price range, and in-stock filters.
  - 🌐 **Live Mode**: Real-time queries sent directly to Cargills Online.
- 🖥️ **Sleek Web Interface**: Modern, responsive dashboard with product modal popups, live/offline toggle, and CSV/JSON export.
- 🤖 **Native MCP Server**: Ready to plug into **Claude Desktop**, **Cursor**, **Antigravity**, **Cline**, and **Windsurf**.

---

## 🚀 Quick Start

### ⚡ Option 1: Run with NPX (Zero Setup!)

No installation required! Run directly using `npx`:

```bash
# 🌐 Launch the interactive Web UI Dashboard:
npx cargills serve

# 🔍 Search products from your terminal:
npx cargills search "soya"

# 🤖 Run the Model Context Protocol (MCP) Server:
npx cargills-mcp
```

---

### 📦 Option 2: Install Globally via NPM

```bash
# Install globally
npm install -g cargills-online-scraper-mcp

# Launch anywhere
cargills serve
```

---

### 💻 Option 3: Clone & Run Locally

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
cargills scrape

# 🥗 Scrape only food & grocery items
cargills scrape --food-only

# 🔍 Search for products (Local Offline DB)
cargills search "soya"
cargills search "pineapple"
cargills search "milk" --category Dairy --sort price_asc
cargills search "chicken" --in-stock

# 🌐 Search live directly on Cargills Online
cargills search "apple" --live

# 📋 View all available categories
cargills categories

# 🌐 Start Web UI Server (default: port 3000)
cargills serve 3000
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
      "command": "npx",
      "args": [
        "-y",
        "cargills-online-scraper-mcp",
        "mcp"
      ]
    }
  }
}
```

#### Cursor & Cline
- **Server Name**: `cargills-online`
- **Transport**: `stdio`
- **Command**: `npx`
- **Arguments**: `-y cargills-online-scraper-mcp mcp`

#### Google Antigravity / Gemini CLI (`mcp_config.json`)
```json
{
  "mcpServers": {
    "cargills-online": {
      "command": "npx",
      "args": [
        "-y",
        "cargills-online-scraper-mcp",
        "mcp"
      ]
    }
  }
}
```

---

## 🌐 REST API Reference

The built-in Express server exposes a developer-friendly REST API:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products?q=tea&category=Beverages&sortBy=price_asc` | Filtered and paginated local product search |
| `GET` | `/api/search/live?q=soya` | Real-time live search against the store |
| `GET` | `/api/categories` | Complete list of categories |
| `GET` | `/api/stats` | Summary metrics of the scraped catalog |
| `POST` | `/api/scrape` | Trigger an automated background scrape |
| `GET` | `/api/scrape/status` | Track real-time scraping progress |
| `GET` | `/api/export/csv` | Download products as CSV |
| `GET` | `/api/export/json` | Download products as JSON |

---

## 📁 Project Structure

```
cargills-online-scraper-mcp/
├── data/
│   ├── cargills_products.json   # Pre-scraped offline catalog (JSON)
│   └── cargills_products.csv    # Pre-scraped offline catalog (CSV)
├── public/
│   ├── index.html               # Responsive web UI
│   ├── style.css                # Polished theme
│   └── app.js                   # Client interactions
├── src/
│   ├── api.js                   # Cargills API client & AES encryption
│   ├── scraper.js               # Category scraper & exporter
│   ├── search.js                # Dual-mode search engine
│   └── server.js                # Express REST API & static server
├── cli.js                       # CLI executable entry point
├── mcp-server.js                # Model Context Protocol server
├── mcp_config.json              # MCP configuration example
├── package.json
└── README.md
```

---

## 👨‍💻 Author

Crafted with care by **Nimesh Piyumal** 🇱🇰

- GitHub: [@nimesh-piyumal](https://github.com/nimesh-piyumal)
- NPM: [cargills-online-scraper-mcp](https://www.npmjs.com/package/cargills-online-scraper-mcp)
- Repository: [cargills-online-scraper-mcp](https://github.com/nimesh-piyumal/cargills-online-scraper-mcp)

---

## 📄 License

This project is licensed under the **MIT License**.
