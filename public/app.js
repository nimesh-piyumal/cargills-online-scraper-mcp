// State
const state = {
  query: '',
  category: 'All',
  foodOnly: true,
  inStockOnly: false,
  hasDiscountOnly: false,
  minPrice: null,
  maxPrice: null,
  sortBy: 'relevance',
  page: 1,
  limit: 24,
  totalPages: 1,
  total: 0,
  isLive: false,
  scrapePollingInterval: null
};

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const liveSearchToggle = document.getElementById('liveSearchToggle');
const toggleText = document.getElementById('toggleText');
const scrapeBtn = document.getElementById('scrapeBtn');
const scrapeBanner = document.getElementById('scrapeBanner');
const scrapeProgressBar = document.getElementById('scrapeProgressBar');
const scrapeProgressPercent = document.getElementById('scrapeProgressPercent');
const scrapeStatusTitle = document.getElementById('scrapeStatusTitle');
const scrapeStatusMsg = document.getElementById('scrapeStatusMsg');

const foodOnlyFilter = document.getElementById('foodOnlyFilter');
const inStockFilter = document.getElementById('inStockFilter');
const discountFilter = document.getElementById('discountFilter');
const minPriceInput = document.getElementById('minPriceInput');
const maxPriceInput = document.getElementById('maxPriceInput');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const categoryList = document.getElementById('categoryList');

const resultsCount = document.getElementById('resultsCount');
const activeFilterTag = document.getElementById('activeFilterTag');
const sortSelect = document.getElementById('sortSelect');
const productsGrid = document.getElementById('productsGrid');
const emptyState = document.getElementById('emptyState');
const emptyStateText = document.getElementById('emptyStateText');
const emptyStateScrapeBtn = document.getElementById('emptyStateScrapeBtn');
const loadingState = document.getElementById('loadingState');

const paginationWrapper = document.getElementById('paginationWrapper');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');

const statTotal = document.getElementById('statTotal');
const statFood = document.getElementById('statFood');
const statUpdated = document.getElementById('statUpdated');

const productModal = document.getElementById('productModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalBody = document.getElementById('modalBody');

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 1. Fetch Categories
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (!data.success) return;

    const categories = data.categories || [];
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-pill';
      btn.dataset.category = cat.name;
      btn.textContent = `${cat.name} ${cat.isFood ? '🥗' : ''}`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.category = cat.name;
        state.page = 1;
        fetchProducts();
      });
      categoryList.appendChild(btn);
    });
  } catch (err) {
    console.warn('Could not load categories:', err);
  }
}

// 2. Fetch Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.scraped) {
      statTotal.textContent = data.totalProducts.toLocaleString();
      statFood.textContent = data.totalFoodProducts.toLocaleString();
      if (data.lastScraped) {
        const d = new Date(data.lastScraped);
        statUpdated.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } else {
      statTotal.textContent = 'Not Scraped';
      statFood.textContent = '-';
      statUpdated.textContent = 'Run Scrape';
    }
  } catch (err) {
    console.warn('Could not load stats:', err);
  }
}

// 3. Fetch Products
async function fetchProducts() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  productsGrid.innerHTML = '';

  const params = new URLSearchParams();
  if (state.query) params.append('q', state.query);
  if (state.category && state.category !== 'All') params.append('category', state.category);
  if (state.foodOnly) params.append('foodOnly', 'true');
  if (state.inStockOnly) params.append('inStockOnly', 'true');
  if (state.hasDiscountOnly) params.append('hasDiscountOnly', 'true');
  if (state.minPrice !== null && state.minPrice !== '') params.append('minPrice', state.minPrice);
  if (state.maxPrice !== null && state.maxPrice !== '') params.append('maxPrice', state.maxPrice);
  params.append('sortBy', state.sortBy);
  params.append('page', state.page);
  params.append('limit', state.limit);

  const endpoint = state.isLive ? `/api/search/live?${params}` : `/api/products?${params}`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    loadingState.classList.add('hidden');

    if (!data.success || !data.results || data.results.length === 0) {
      showEmptyState(data.message || 'No products found matching your search.');
      return;
    }

    state.total = data.total || 0;
    state.totalPages = data.totalPages || 1;

    updateToolbar();
    renderProducts(data.results);
    updatePagination();
  } catch (err) {
    loadingState.classList.add('hidden');
    showEmptyState(`Error loading products: ${err.message}`);
  }
}

function showEmptyState(msg) {
  resultsCount.textContent = '0 products found';
  emptyStateText.textContent = msg;
  emptyState.classList.remove('hidden');
  paginationWrapper.classList.add('hidden');
}

function updateToolbar() {
  resultsCount.textContent = `${state.total.toLocaleString()} product${state.total === 1 ? '' : 's'} found`;
  if (state.category !== 'All') {
    activeFilterTag.textContent = state.category;
    activeFilterTag.classList.remove('hidden');
  } else {
    activeFilterTag.classList.add('hidden');
  }
}

function updatePagination() {
  if (state.totalPages <= 1) {
    paginationWrapper.classList.add('hidden');
    return;
  }
  paginationWrapper.classList.remove('hidden');
  pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
  prevPageBtn.disabled = state.page <= 1;
  nextPageBtn.disabled = state.page >= state.totalPages;
}

// 4. Render Product Cards
function renderProducts(products) {
  productsGrid.innerHTML = '';

  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';

    const fallbackImg = '/Assets/Web/img/loading_img1.png';
    const imgSrc = p.image || p.webImage || fallbackImg;

    card.innerHTML = `
      <div class="card-img-wrap">
        <img class="card-img" src="${imgSrc}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/200x200?text=Cargills';">
        ${p.hasDiscount ? `<span class="badge-discount">-${p.discountPercent}% OFF</span>` : ''}
        ${p.isFood ? `<span class="badge-food">Food</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-cat">${escapeHtml(p.category)}</div>
        <div class="card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="card-size">${escapeHtml(p.packageSize || '-')}</div>
        <div class="card-price-row">
          <span class="card-price">${escapeHtml(p.priceFormatted || `Rs. ${p.price}`)}</span>
          ${p.mrpFormatted && p.mrp > p.price ? `<span class="card-mrp">${escapeHtml(p.mrpFormatted)}</span>` : ''}
        </div>
        <div class="card-footer">
          <span class="stock-status ${p.inStock ? 'stock-in' : 'stock-out'}">
            ${p.inStock ? '● In Stock' : '○ Out of Stock'}
          </span>
          <button class="card-btn">Details</button>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openModal(p));
    productsGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 5. Product Modal
function openModal(p) {
  const fallbackImg = 'https://placehold.co/300x300?text=Cargills';
  const imgSrc = p.webImage || p.image || fallbackImg;

  modalBody.innerHTML = `
    <div class="modal-detail-grid">
      <div class="modal-img-wrap">
        <img src="${imgSrc}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='https://placehold.co/300x300?text=Cargills';">
      </div>
      <div class="modal-info">
        <h2>${escapeHtml(p.name)}</h2>
        <span class="card-cat">${escapeHtml(p.category)} ${p.isFood ? '🥗' : ''}</span>
        
        <div class="modal-price-box">
          <span class="modal-price">${escapeHtml(p.priceFormatted || `Rs. ${p.price}`)}</span>
          ${p.mrpFormatted && p.mrp > p.price ? `<span class="card-mrp" style="font-size: 1.1rem;">${escapeHtml(p.mrpFormatted)}</span>` : ''}
          ${p.hasDiscount ? `<span class="badge-discount" style="position:static;">Save Rs. ${p.discountAmount} (-${p.discountPercent}%)</span>` : ''}
        </div>

        <table class="modal-meta-table">
          <tr><td>Package Size:</td><td><strong>${escapeHtml(p.packageSize || '-')}</strong></td></tr>
          <tr><td>SKU Code:</td><td><code>${escapeHtml(p.sku || '-')}</code></td></tr>
          <tr><td>Stock Availability:</td><td><strong class="${p.inStock ? 'stock-in' : 'stock-out'}">${p.inStock ? `Available (${p.inventory} in stock)` : 'Out of Stock'}</strong></td></tr>
          ${p.searchTerms ? `<tr><td>Keywords:</td><td><small>${escapeHtml(p.searchTerms)}</small></td></tr>` : ''}
        </table>

        ${p.description || p.shortDescription ? `
          <div class="modal-desc-box">
            <h4>About this product:</h4>
            <p>${escapeHtml(p.description || p.shortDescription)}</p>
          </div>
        ` : ''}

        <div class="modal-action-row">
          ${p.productUrl ? `
            <a href="${p.productUrl}" target="_blank" class="btn btn-primary" rel="noopener noreferrer">
              View on Cargills Online ↗
            </a>
          ` : ''}
          <button class="btn btn-outline" id="modalCloseActionBtn">Close</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalCloseActionBtn').addEventListener('click', closeModal);
  productModal.classList.remove('hidden');
}

function closeModal() {
  productModal.classList.add('hidden');
}

modalOverlay.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// 6. Scraper Trigger & Progress Polling
scrapeBtn.addEventListener('click', triggerScrape);
emptyStateScrapeBtn.addEventListener('click', triggerScrape);

async function triggerScrape() {
  if (confirm('Start full site scrape of Cargills Online? This will refresh all food & grocery items in the local database.')) {
    try {
      scrapeBtn.disabled = true;
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodOnly: false, pinCode: 'Colombo' })
      });
      const data = await res.json();
      if (data.success) {
        startScrapePolling();
      } else {
        alert(data.message || 'Scrape already running');
      }
    } catch (err) {
      alert(`Scrape error: ${err.message}`);
      scrapeBtn.disabled = false;
    }
  }
}

function startScrapePolling() {
  scrapeBanner.classList.remove('hidden');
  if (state.scrapePollingInterval) clearInterval(state.scrapePollingInterval);

  state.scrapePollingInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/scrape/status');
      const data = await res.json();
      const status = data.status;

      if (status.isRunning) {
        scrapeStatusTitle.textContent = `Scraping: ${status.currentCategory || 'Starting...'}`;
        scrapeStatusMsg.textContent = status.message || `Found ${status.productsFound} items...`;
        scrapeProgressBar.style.width = `${status.progressPercent}%`;
        scrapeProgressPercent.textContent = `${status.progressPercent}%`;
      } else {
        clearInterval(state.scrapePollingInterval);
        state.scrapePollingInterval = null;
        scrapeBtn.disabled = false;

        scrapeProgressBar.style.width = '100%';
        scrapeProgressPercent.textContent = '100%';
        scrapeStatusTitle.textContent = 'Scraping Complete!';
        scrapeStatusMsg.textContent = `Successfully updated local dataset with ${status.productsFound} products.`;

        setTimeout(() => {
          scrapeBanner.classList.add('hidden');
        }, 3000);

        loadStats();
        fetchProducts();
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 1000);
}

// 7. Event Listeners
const debouncedFetch = debounce(() => {
  state.page = 1;
  fetchProducts();
}, 300);

searchInput.addEventListener('input', (e) => {
  state.query = e.target.value.trim();
  debouncedFetch();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.query = '';
  fetchProducts();
});

liveSearchToggle.addEventListener('change', (e) => {
  state.isLive = e.target.checked;
  toggleText.textContent = state.isLive ? 'Live API' : 'Offline DB';
  state.page = 1;
  fetchProducts();
});

foodOnlyFilter.addEventListener('change', (e) => {
  state.foodOnly = e.target.checked;
  state.page = 1;
  fetchProducts();
});

inStockFilter.addEventListener('change', (e) => {
  state.inStockOnly = e.target.checked;
  state.page = 1;
  fetchProducts();
});

discountFilter.addEventListener('change', (e) => {
  state.hasDiscountOnly = e.target.checked;
  state.page = 1;
  fetchProducts();
});

minPriceInput.addEventListener('input', (e) => {
  state.minPrice = e.target.value ? parseFloat(e.target.value) : null;
  debouncedFetch();
});

maxPriceInput.addEventListener('input', (e) => {
  state.maxPrice = e.target.value ? parseFloat(e.target.value) : null;
  debouncedFetch();
});

sortSelect.addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  state.page = 1;
  fetchProducts();
});

resetFiltersBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.query = '';
  state.category = 'All';
  state.foodOnly = true;
  state.inStockOnly = false;
  state.hasDiscountOnly = false;
  state.minPrice = null;
  state.maxPrice = null;
  state.sortBy = 'relevance';
  state.page = 1;

  foodOnlyFilter.checked = true;
  inStockFilter.checked = false;
  discountFilter.checked = false;
  minPriceInput.value = '';
  maxPriceInput.value = '';
  sortSelect.value = 'relevance';

  document.querySelectorAll('.cat-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.category === 'All');
  });

  fetchProducts();
});

prevPageBtn.addEventListener('click', () => {
  if (state.page > 1) {
    state.page--;
    fetchProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

nextPageBtn.addEventListener('click', () => {
  if (state.page < state.totalPages) {
    state.page++;
    fetchProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// Category 'All' click
document.querySelector('[data-category="All"]').addEventListener('click', function() {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  this.classList.add('active');
  state.category = 'All';
  state.page = 1;
  fetchProducts();
});

// Initialize
loadCategories();
loadStats();
fetchProducts();
