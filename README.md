# Cargills Online Scraper, Product Search & MCP Server

A production-grade web scraping engine, search API, web dashboard, and Model Context Protocol (MCP) server for [Cargills Online](https://cargillsonline.com) (Sri Lanka's leading online grocery platform).

Developed by **Nimesh Piyumal**.

---

## Features

- **Full Catalog Scraping**: Scrapes all 25 categories (Vegetables, Fruits, Dairy, Food Cupboard, Beverages, Bakery, Meats, Seafood, Rice, Cooking Essentials, etc.) in under 60 seconds.
- **Rich Product Metadata**:
  - Product Name & SKU Code
  - Selling Price (in LKR) & MRP (Maximum Retail Price)
  - Discounts & Percentage Off calculations
  - Packaging Size, Unit Size, and Unit of Measure (UOM)
  - Category & Food Tagging (`isFood`)
  - Stock Inventory & Availability
  - Detailed Description & Nutritional/Health benefits
  - Direct Image & Web Image URLs
  - Direct Cargills product page links
  - Multilingual search keywords
- **High-Performance Direct API Client**: Bypasses heavy browser automation by interacting directly with the site's encrypted backend services.
- **Dual Search Capabilities**:
  - **Offline Search**: Query the scraped local dataset with fuzzy search, price filters, category filters, and multiple sorting options.
  - **Live Search**: Query the live Cargills Online search endpoint in real time.
- **Interactive Web Dashboard**: Modern, responsive interface with search, category filtering, product modals, one-click scraping, and CSV/JSON export.
- **Model Context Protocol (MCP) Server**: Seamless integration with AI agents and assistants (Claude, Cursor, Antigravity, Cline, Windsurf).
- **Interactive CLI**: Command-line interface for running scrapes, searches, and launching the server.

---

## Project Structure

```
.
├── .agents/
│   └── mcp_config.json          # Agent-level MCP configuration
├── data/
│   ├── cargills_products.json   # Full dataset in JSON format
│   └── cargills_products.csv    # Full dataset in CSV format
├── public/
│   ├── index.html               # Web UI Dashboard
│   ├── style.css                # Dashboard styling
│   └── app.js                   # Client-side logic
├── src/
│   ├── api.js                   # API Client & AES encryption
│   ├── scraper.js               # Scraper & data normalizer
│   ├── search.js                # Search engine (Local & Live)
│   └── server.js                # Express Web Server & REST API
├── cli.js                       # Command-line tool
├── mcp-server.js                # MCP Server entry point
├── mcp_config.json              # Standard MCP configuration
├── package.json
└── README.md
```

---

## Installation

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Setup
```bash
git clone https://github.com/nimesh-piyumal/cargills-online-scraper-mcp.git
cd cargills-online-scraper-mcp
npm install
```

---

## Usage

### 1. Scraping Products

Run a full scrape across all 25 categories:
```bash
npm run scrape
# or
node cli.js scrape
```

Scrape only food categories:
```bash
npm run scrape:food
# or
node cli.js scrape --food-only
```

*Data is automatically saved to `data/cargills_products.json` and `data/cargills_products.csv`.*

---

### 2. Command Line Search

#### Search Local Dataset:
```bash
# Search for soya products
node cli.js search "soya"

# Search for fruits
node cli.js search "pineapple"

# Search with category filter and price sorting
node cli.js search "milk" --category Dairy --sort price_asc

# Search with stock filter
node cli.js search "chicken" --in-stock
```

#### Search Live Website:
```bash
node cli.js search "fresh milk" --live
node cli.js search "apple" --live
```

---

### 3. Web Dashboard

Launch the web interface:
```bash
npm start
# or
node cli.js serve
```

Open your browser at:
`http://localhost:3000`

The dashboard supports:
- Instant search with live/offline toggle
- Category filtering and price range sliders
- Product cards with stock badges and discount percentages
- Detailed modal views with descriptions and direct store links
- One-click scraper execution with animated progress
- One-click CSV and JSON exports

---

### 4. Model Context Protocol (MCP) Server

This project includes a native MCP server for AI coding assistants and agents.

#### Available MCP Tools

| Tool | Description |
|---|---|
| `cargills_search` | Search grocery and food items with keyword, category, price range, stock, and sorting filters. |
| `cargills_get_product` | Retrieve comprehensive product details by SKU, numeric ID, or name. |
| `cargills_list_categories` | List all available store categories with product counts and food flags. |
| `cargills_scrape` | Trigger a background scrape to refresh local data from the live store. |
| `cargills_get_stats` | Inspect dataset health metrics (total items, food count, in-stock count, price ranges). |

#### Available MCP Resources

- `cargills://categories` - Category list in JSON
- `cargills://stats` - Dataset statistics in JSON
- `cargills://products/{sku}` - Product details by SKU

#### MCP Client Configuration

Add the following to your MCP client configuration file:

**Google Antigravity / Gemini CLI (`mcp_config.json`):**
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

**Claude Desktop (`claude_desktop_config.json`):**
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

**Cursor / Cline / Windsurf:**
- **Name**: `cargills-online`
- **Transport**: `stdio`
- **Command**: `node`
- **Args**: `./mcp-server.js`

#### Run MCP Server Directly:
```bash
npm run mcp
# or
node cli.js mcp
```

---

### 5. REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products?q=query&category=Dairy` | Filtered and paginated local product search |
| `GET` | `/api/search/live?q=query` | Real-time live search against Cargills Online |
| `GET` | `/api/categories` | Complete list of categories |
| `GET` | `/api/stats` | Dataset statistics |
| `POST` | `/api/scrape` | Trigger background scraping task |
| `GET` | `/api/scrape/status` | Scraping progress and status |
| `GET` | `/api/export/csv` | Download products as CSV |
| `GET` | `/api/export/json` | Download products as JSON |

---

## License

This project is licensed under the MIT License.

Created by **Nimesh Piyumal**.
