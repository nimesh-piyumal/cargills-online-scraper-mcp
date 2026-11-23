const https = require('https');
const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://cargillsonline.com';
const ENC_KEY_IV = '8080808080808080';

// Food categories list for tagging
const FOOD_CATEGORIES = new Set([
  'Vegetables',
  'Fruits',
  'Dairy',
  'Beverages',
  'Food Cupboard',
  'Cooking Essentials',
  'Bakery',
  'Frozen Food',
  'Meats',
  'Seafood',
  'Snacks & Confectionery',
  'Rice',
  'Seeds & Spices',
  'Desserts & Ingredients',
  'Tea & Coffee',
  'Christmas Hampers'
]);

class CargillsApi {
  constructor(options = {}) {
    this.baseURL = options.baseURL || BASE_URL;
    this.pinCode = options.pinCode || 'Colombo';
    this.cookieJar = {};

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      family: 4
    });

    this.client = axios.create({
      baseURL: this.baseURL,
      httpsAgent: this.httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 20000
    });

    // Capture cookies from responses
    this.client.interceptors.response.use(res => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        setCookie.forEach(c => {
          const parts = c.split(';')[0].split('=');
          if (parts[0]) this.cookieJar[parts[0].trim()] = parts.slice(1).join('=');
        });
      }
      return res;
    });

    // Attach cookies to requests
    this.client.interceptors.request.use(config => {
      const cookieStr = Object.entries(this.cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookieStr) config.headers['Cookie'] = cookieStr;
      return config;
    });

    this.initialized = false;
  }

  // Encrypt string with AES-128-CBC for API payload
  encrypt(text = '') {
    const key = Buffer.from(ENC_KEY_IV, 'utf8');
    const iv = Buffer.from(ENC_KEY_IV, 'utf8');
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  // Initialize session and set delivery location
  async initSession(pinCode = null) {
    if (pinCode) this.pinCode = pinCode;

    try {
      // 1. Visit homepage
      await this.client.get('/');

      // 2. Set Delivery Option / Pincode
      const res = await this.client.post('/Web/CheckDeliveryOptionV1', { PinCode: this.pinCode });
      this.initialized = true;
      return res.data;
    } catch (err) {
      console.warn(`[CargillsApi] Session init warning: ${err.message}. Retrying directly...`);
      const res = await this.client.post('/Web/CheckDeliveryOptionV1', { PinCode: this.pinCode });
      this.initialized = true;
      return res.data;
    }
  }

  async ensureSession() {
    if (!this.initialized) {
      await this.initSession();
    }
  }

  // Get all categories
  async getCategories() {
    await this.ensureSession();
    const res = await this.client.post('/Web/GetCategoriesV1', {});
    return (res.data || []).map(cat => ({
      id: cat.Id,
      name: cat.MenuCategoryName ? cat.MenuCategoryName.trim() : '',
      enId: cat.EnId,
      enName: cat.EnMenuCategoryName,
      abbreviation: cat.Abbreviation,
      image: cat.Image ? (cat.Image.startsWith('http') ? cat.Image : `${this.baseURL}${cat.Image}`) : '',
      isFood: FOOD_CATEGORIES.has(cat.MenuCategoryName ? cat.MenuCategoryName.trim() : '')
    }));
  }

  // Query products for a category or search query
  async getProductsPage({ categoryId = '', search = '', filter = '', pageIndex = 1, pageSize = 1000 }) {
    await this.ensureSession();

    const payload = {
      CategoryId: categoryId,
      Search: search,
      Filter: this.encrypt(filter),
      PageIndex: pageIndex,
      PageSize: pageSize,
      BannerId: '',
      SectionId: '',
      CollectionId: '',
      SectionType: '',
      DataType: '',
      SubCatId: '',
      PromoId: ''
    };

    const res = await this.client.post('/Web/GetMenuCategoryItemsPagingV3/', payload);
    const rawItems = res.data || [];

    // Filter out dummy "No Products Found" placeholder
    if (rawItems.length === 1 && (rawItems[0].Id === 0 || rawItems[0].ItemName === 'No Products Found')) {
      return [];
    }

    return rawItems;
  }

  // Real-time quick search bar (GetSearchBarProductsV1)
  async quickSearch(searchTerm) {
    await this.ensureSession();
    const res = await this.client.post('/Web/GetSearchBarProductsV1', { Search: searchTerm });
    const items = res.data || [];
    if (items.length === 1 && items[0].Id === 0) return [];
    return items.map(item => this.normalizeProduct(item));
  }

  // Live full search with pagination
  async liveSearch(searchTerm, pageIndex = 1, pageSize = 200) {
    const rawItems = await this.getProductsPage({
      search: searchTerm,
      pageIndex,
      pageSize
    });
    return rawItems.map(item => this.normalizeProduct(item));
  }

  // Normalize a raw API product into a clean standard structure
  normalizeProduct(item, categoryHint = '') {
    const priceNum = parseFloat(String(item.Price || item.Inventory || '0').replace(/[^0-9.]/g, '')) || 0;
    const mrpNum = parseFloat(String(item.Mrp || '0').replace(/[^0-9.]/g, '')) || 0;
    const discountAmount = mrpNum > priceNum ? parseFloat((mrpNum - priceNum).toFixed(2)) : 0;
    const discountPercent = mrpNum > priceNum && mrpNum > 0 ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;

    const categoryName = item.MenuCategoryName || categoryHint || 'Other';
    const itemName = (item.ItemName || '').trim();
    const unitSize = item.UnitSize || '';
    const uom = (item.UOM || item.Uom || '').trim();
    const packageSize = unitSize && uom ? `${unitSize} ${uom}` : (unitSize || uom || '');

    const makeUrl = (path) => {
      if (!path) return '';
      return path.startsWith('http') ? path : `${this.baseURL}${path}`;
    };

    const safeSlug = (str) => encodeURIComponent(String(str || '').replace(/[ &/\\]+/g, '-'));
    const enId = item.EnId || '';
    const productUrl = enId
      ? `${this.baseURL}/ProductDetails/${safeSlug(categoryName)}/${safeSlug(itemName)}?ID=${encodeURIComponent(enId)}`
      : '';

    return {
      id: item.Id || null,
      sku: item.SKUCODE || '',
      name: itemName,
      category: categoryName,
      categoryCode: item.CategoryCode || '',
      isFood: FOOD_CATEGORIES.has(categoryName),
      price: priceNum,
      priceFormatted: `Rs. ${priceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      mrp: mrpNum,
      mrpFormatted: mrpNum > 0 ? `Rs. ${mrpNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      discountAmount,
      discountPercent,
      hasDiscount: discountPercent > 0,
      unitSize: item.UnitSize || null,
      uom: uom,
      packageSize: packageSize,
      inventory: typeof item.Inventory === 'number' ? item.Inventory : (parseInt(item.Inventory, 10) || 0),
      inStock: (item.IsSaleable === 'True' || item.IsSaleable === true) && (item.Inventory == null || item.Inventory > 0),
      isSaleable: item.IsSaleable === 'True' || item.IsSaleable === true,
      shortDescription: (item.ShortDescription || '').trim(),
      description: (item.Description || '').trim(),
      image: makeUrl(item.ItemImage),
      webImage: makeUrl(item.WebImage),
      productUrl: productUrl,
      searchTerms: item.SearchTerm || '',
      enId: enId,
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  CargillsApi,
  FOOD_CATEGORIES
};
