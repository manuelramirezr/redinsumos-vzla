// Client State Management
const STATE = {
  currentTab: 'tab-public',
  user: JSON.parse(localStorage.getItem('cumis_user')) || null,
  products: [],
  dashboardStats: null,
  activeMissions: [],
  pendingOperators: [],
  cart: [],
  activeOrderDetails: null,
  chatIntervalId: null
};

// Restricted 29 Catalog Products
const ALLOWED_PRODUCTS = [
  "Gasas estériles",
  "Povidine",
  "Suturas",
  "Vendas",
  "Alcohol",
  "Guantes estériles y no estériles",
  "Sondas",
  "Anestésicos locales",
  "Jeringas de 5, 10 y 20 ml",
  "Solución ringer lactato",
  "Solución 0,9%",
  "Bisturí",
  "Macrogoteros",
  "Analgésicos",
  "SRO (Suero de Rehidratación Oral)",
  "Antibióticos EV (Endovenosos)",
  "Adhesivo",
  "Gel de eco",
  "Venda de yeso",
  "Guata",
  "Vendas elásticas",
  "Adhesivos",
  "Compresas",
  "Guantes de trabajo",
  "Lentes",
  "Tapabocas",
  "Antihipertensivos",
  "Pastillas potabilizadoras de agua",
  "Insumos médicos generales"
];

// Map order state names to friendly labels & badges
const STATUS_MAP = {
  'pending_funds': { label: 'Esperando Fondos Zelle', badgeClass: 'badge-pending' },
  'funds_sent': { label: 'Fondos Enviados', badgeClass: 'badge-info' },
  'received': { label: 'Factura Recibida', badgeClass: 'badge-success' },
  'completed': { label: 'Misión Completada', badgeClass: 'badge-success' }
};

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:transparent;border:none;color:inherit;margin-left:10px;cursor:pointer;">&times;</button>
  `;
  container.appendChild(toast);
  
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  setTimeout(() => toast.remove(), 4000);
}

// ==========================================
// NAVIGATION & BOOTSTRAP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initUserSession();
  loadDashboardStats();
  populateDropdowns();
  setupEventListeners();
});

function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  // Clear any active chat interval when moving away from a modal (or tab)
  if (STATE.chatIntervalId) {
    clearInterval(STATE.chatIntervalId);
    STATE.chatIntervalId = null;
  }

  // Update nav buttons active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  STATE.currentTab = tabId;

  // Trigger loads
  if (tabId === 'tab-public') {
    loadDashboardStats();
  } else if (tabId === 'tab-catalog') {
    loadProducts();
  } else if (tabId === 'tab-operator') {
    renderOperatorView();
  } else if (tabId === 'tab-admin') {
    renderAdminView();
  }
}

function initUserSession() {
  updateUserDisplay();
}

function updateUserDisplay() {
  const display = document.getElementById('user-display');
  const logoutBtn = document.getElementById('logout-btn');
  const registerProdBtn = document.getElementById('add-catalog-item-btn');

  if (STATE.user) {
    display.textContent = `${STATE.user.role === 'admin' ? '🔑 Admin' : '🚚 Logística'}: ${STATE.user.name}`;
    logoutBtn.classList.remove('hidden');
    registerProdBtn.classList.remove('hidden');
  } else {
    display.textContent = 'Invitado';
    logoutBtn.classList.add('hidden');
    registerProdBtn.classList.add('hidden');
  }
}

// Populate product builder drop downs
function populateDropdowns() {
  const builderSelect = document.getElementById('builder-product-select');
  const modalSelect = document.getElementById('prod-select-name');
  
  const options = ALLOWED_PRODUCTS.map(prod => `<option value="${prod}">${prod}</option>`).join('');
  
  if (builderSelect) builderSelect.innerHTML = options;
  if (modalSelect) modalSelect.innerHTML = options;
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  // Logout Button
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('cumis_user');
    STATE.user = null;
    updateUserDisplay();
    STATE.cart = [];
    renderCart();
    showToast('Sesión cerrada.', 'info');
    switchTab('tab-public');
  });

  // Supplier modal toggle
  const registerProdBtn = document.getElementById('add-catalog-item-btn');
  const prodModal = document.getElementById('product-modal');
  const closeProdModalBtn = document.getElementById('close-product-modal-btn');
  
  registerProdBtn.addEventListener('click', () => prodModal.classList.remove('hidden'));
  closeProdModalBtn.addEventListener('click', () => prodModal.classList.add('hidden'));

  // Supplier product submission form
  document.getElementById('product-registration-form').addEventListener('submit', handleProductRegistration);

  // Operator Auth Forms Toggle
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.getAttribute('data-auth-mode');
      if (mode === 'login') {
        document.getElementById('operator-login-form').classList.add('active');
        document.getElementById('operator-register-form').classList.remove('active');
      } else {
        document.getElementById('operator-login-form').classList.remove('active');
        document.getElementById('operator-register-form').classList.add('active');
      }
    });
  });

  // Operator Login Form Submit
  document.getElementById('operator-login-form').addEventListener('submit', handleOperatorLogin);

  // Operator Register Form Submit
  document.getElementById('operator-register-form').addEventListener('submit', handleOperatorRegister);

  // Admin Login Form Submit
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);

  // Admin Donation Form Submit
  document.getElementById('admin-donation-form').addEventListener('submit', handleDonationSubmit);

  // Shopping Cart items drafting
  document.getElementById('add-builder-item-btn').addEventListener('click', addToCart);

  // Order submit
  document.getElementById('order-builder-form').addEventListener('submit', handleOrderSubmit);

  // Modal closing
  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('mission-modal').classList.add('hidden');
    if (STATE.chatIntervalId) {
      clearInterval(STATE.chatIntervalId);
      STATE.chatIntervalId = null;
    }
  });

  // Chat message submit
  document.getElementById('modal-chat-form').addEventListener('submit', handleChatSubmit);

  // Search filter
  document.getElementById('catalog-search').addEventListener('input', (e) => {
    filterProducts(e.target.value);
  });
}

// ==========================================
// API CLIENT CALLS
// ==========================================

// Get headers based on user auth token
function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (STATE.user && STATE.user.token) {
    headers['Authorization'] = `Bearer ${STATE.user.token}`;
  }
  return headers;
}

// Public dashboard loader
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard-stats');
    if (!res.ok) throw new Error('Error al cargar estadísticas.');
    const data = await res.json();
    STATE.dashboardStats = data;
    renderDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Product catalog loader
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Error al cargar el inventario.');
    const data = await res.json();
    STATE.products = data;
    renderProducts(data);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// AUTH HANDLERS
// ==========================================
async function handleOperatorLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/operators/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fallo de autenticación.');

    STATE.user = data;
    localStorage.setItem('cumis_user', JSON.stringify(data));
    updateUserDisplay();
    showToast(`Bienvenido de nuevo, ${data.name}!`, 'success');
    renderOperatorView();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleOperatorRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const phone = document.getElementById('reg-phone').value;
  const zelle_email = document.getElementById('reg-zelle').value;
  const password = document.getElementById('reg-password').value;

  try {
    const res = await fetch('/api/operators/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, zelle_email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar.');

    showToast('Registro solicitado. Espere a que el administrador Manu verifique su cuenta.', 'success');
    e.target.reset();
    
    // Switch auth tabs back to login
    document.querySelector('.auth-tab-btn[data-auth-mode="login"]').click();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const passcode = document.getElementById('admin-passcode').value;

  try {
    const res = await fetch('/api/operators/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin', password: passcode })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Código incorrecto.');

    STATE.user = data;
    localStorage.setItem('cumis_user', JSON.stringify(data));
    updateUserDisplay();
    showToast('Sesión administrativa iniciada.', 'success');
    renderAdminView();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// DONATION HANDLER
// ==========================================
async function handleDonationSubmit(e) {
  e.preventDefault();
  const amount = document.getElementById('don-amount').value;
  const donor_name = document.getElementById('don-donor').value;

  try {
    const res = await fetch('/api/donations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount, donor_name })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar donación.');

    showToast('Donación registrada exitosamente.', 'success');
    e.target.reset();
    loadDashboardStats(); // Refresh donation totals
    loadAdminDashboard(); // Refresh operator verification and orders
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// SUPPLIER PRODUCT CATALOG REGISTRATION
// ==========================================
async function handleProductRegistration(e) {
  e.preventDefault();
  const name = document.getElementById('prod-select-name').value;
  const supplier_name = document.getElementById('prod-supplier').value;
  const price = document.getElementById('prod-price').value;
  const stock = document.getElementById('prod-stock').value;

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, supplier_name, price, stock })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar insumo.');

    showToast('Producto del proveedor registrado en el catálogo.', 'success');
    document.getElementById('product-modal').classList.add('hidden');
    e.target.reset();
    loadProducts();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// RENDER VIEWS
// ==========================================

// 1. Render Public Dashboard
function renderDashboard() {
  if (!STATE.dashboardStats) return;
  const stats = STATE.dashboardStats;

  document.getElementById('stat-donations').textContent = `$${stats.donationTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('stat-transit').textContent = `$${stats.transitTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('stat-legalised').textContent = `$${stats.legalisedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  // Render Donations Log List
  const donationList = document.getElementById('donation-list');
  if (stats.donations && stats.donations.length > 0) {
    donationList.innerHTML = stats.donations.map(don => `
      <li class="timeline-item">
        <div class="timeline-item-header">
          <span>${don.date}</span>
        </div>
        <div class="timeline-item-body">+$${Number(don.amount).toFixed(2)}</div>
        <div class="timeline-item-donor">${don.donor_name}</div>
      </li>
    `).join('');
  } else {
    donationList.innerHTML = '<li class="empty-state">No se han registrado donaciones aún.</li>';
  }

  // Render Impact Gallery
  const gallery = document.getElementById('impact-gallery');
  if (stats.completedMissions && stats.completedMissions.length > 0) {
    gallery.innerHTML = stats.completedMissions.map(m => `
      <div class="gallery-card">
        <div class="gallery-media">
          <img src="${m.delivery_photo || m.invoice_photo || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80'}" alt="Entrega final CUMIS" class="gallery-img">
          <span class="gallery-badge" style="background-color: var(--accent-emerald)">✓ ENTREGADO</span>
        </div>
        <div class="gallery-content">
          <h4>${m.supplier_name}</h4>
          <div class="gallery-meta">
            <div>Logística: <strong>${m.operator_name}</strong></div>
            <div>Monto Legalizado: <strong style="color:var(--accent-cyan)">$${Number(m.total_amount).toFixed(2)}</strong></div>
          </div>
          <div class="btn-group-row">
            ${m.invoice_photo ? `<button class="btn btn-sm btn-outline btn-block" onclick="window.open('${m.invoice_photo}')">Ver Factura</button>` : ''}
            ${m.delivery_photo ? `<button class="btn btn-sm btn-success btn-block" onclick="window.open('${m.delivery_photo}')">Ver Entrega</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } else {
    gallery.innerHTML = '<div class="empty-state">No hay evidencias de entrega cargadas todavía.</div>';
  }
}

// 2. Render Products Catalog
function renderProducts(products) {
  const container = document.getElementById('catalog-products-container');
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1">No hay productos en inventario.</div>';
    return;
  }

  container.innerHTML = products.map(prod => `
    <div class="catalog-card">
      <div class="catalog-card-header">
        <div>
          <h4 class="catalog-item-name">${prod.name}</h4>
          <span class="catalog-supplier">Por: ${prod.supplier_name}</span>
        </div>
        <span class="badge badge-info">Catálogo</span>
      </div>
      <div class="catalog-stats">
        <div>
          <label>Precio Mayorista</label>
          <div class="catalog-price-val">$${Number(prod.price).toFixed(2)}</div>
        </div>
        <div style="text-align: right">
          <label>Stock Disponible</label>
          <div class="catalog-stock-val" style="color: ${prod.stock > 100 ? 'var(--text-main)' : 'var(--accent-amber)'}">${prod.stock} unids</div>
        </div>
      </div>
    </div>
  `).join('');
}

function filterProducts(query) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    renderProducts(STATE.products);
    return;
  }
  const filtered = STATE.products.filter(p => 
    p.name.toLowerCase().includes(normalizedQuery) || 
    p.supplier_name.toLowerCase().includes(normalizedQuery)
  );
  renderProducts(filtered);
}

// ==========================================
// OPERATOR PORTAL CORE LOGIC
// ==========================================
function renderOperatorView() {
  const authBox = document.getElementById('operator-auth-container');
  const dashboard = document.getElementById('operator-dashboard');

  if (STATE.user && STATE.user.role === 'operator') {
    authBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadOperatorDashboard();
  } else {
    authBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

async function loadOperatorDashboard() {
  if (!STATE.user) return;
  
  // Set profile info
  document.getElementById('operator-profile-name').textContent = STATE.user.name;
  document.getElementById('operator-profile-zelle').textContent = STATE.user.zelle_email;
  document.getElementById('operator-profile-phone').textContent = STATE.user.phone;

  // Load operator's own active/completed missions
  try {
    const res = await fetch('/api/orders', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error al cargar órdenes.');
    const data = await res.json();
    STATE.activeMissions = data;
    renderOperatorMissions();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Operator dynamic cart builder
function addToCart() {
  const prodSelect = document.getElementById('builder-product-select');
  const qtyInput = document.getElementById('builder-qty');
  const priceInput = document.getElementById('builder-price');

  const name = prodSelect.value;
  const quantity = parseInt(qtyInput.value);
  const price = parseFloat(priceInput.value);

  if (!name || isNaN(quantity) || quantity <= 0 || isNaN(price) || price <= 0) {
    showToast('Ingrese cantidad y precio válidos.', 'error');
    return;
  }

  // Add or update quantity in cart draft
  const existing = STATE.cart.find(c => c.name === name);
  if (existing) {
    existing.quantity += quantity;
    existing.price = price; // update with latest price input
  } else {
    STATE.cart.push({ name, quantity, price });
  }

  // Clear inputs
  qtyInput.value = '';
  priceInput.value = '';

  renderCart();
}

function removeFromCart(index) {
  STATE.cart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const table = document.getElementById('order-cart-table');
  const tbody = document.getElementById('order-cart-body');
  const totalArea = document.getElementById('order-total-area');
  const totalVal = document.getElementById('order-total-value');
  const submitBtn = document.getElementById('submit-order-btn');

  if (STATE.cart.length === 0) {
    table.classList.add('hidden');
    totalArea.classList.add('hidden');
    submitBtn.classList.add('hidden');
    return;
  }

  table.classList.remove('hidden');
  totalArea.classList.remove('hidden');
  submitBtn.classList.remove('hidden');

  tbody.innerHTML = STATE.cart.map((c, idx) => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.quantity}</td>
      <td>$${(c.price * c.quantity).toFixed(2)}</td>
      <td><button type="button" class="btn btn-icon btn-sm" onclick="window.removeCartItem(${idx})">🗑️</button></td>
    </tr>
  `).join('');

  // Attach global shortcut for deletions
  window.removeCartItem = removeFromCart;

  const total = STATE.cart.reduce((sum, c) => sum + (c.price * c.quantity), 0);
  totalVal.textContent = `$${total.toFixed(2)}`;
}

async function handleOrderSubmit(e) {
  e.preventDefault();
  const supplier_name = document.getElementById('order-supplier').value;

  if (STATE.cart.length === 0) {
    showToast('Debe agregar al menos un insumo médico.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ supplier_name, items: STATE.cart })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar orden.');

    showToast('Solicitud de adelanto de fondos enviada exitosamente!', 'success');
    
    // Clear draft form & cart
    e.target.reset();
    STATE.cart = [];
    renderCart();
    
    // Refresh log list
    loadOperatorDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Render missions in the Operator's list view
function renderOperatorMissions() {
  const list = document.getElementById('operator-missions-list');
  if (STATE.activeMissions.length === 0) {
    list.innerHTML = '<div class="empty-state">No tiene misiones registradas. ¡Planifique una a la izquierda!</div>';
    return;
  }

  list.innerHTML = STATE.activeMissions.map(m => {
    const status = STATUS_MAP[m.status] || { label: m.status, badgeClass: 'badge-info' };
    const date = new Date(m.createdAt).toLocaleDateString('es-VE');
    return `
      <div class="order-list-card" onclick="window.openOrderModal('${m.id}')">
        <div class="order-card-info">
          <h4>Misión a: ${m.supplier_name}</h4>
          <div class="order-card-meta">
            <span>Fecha: ${date}</span>
            <span class="badge ${status.badgeClass}">${status.label}</span>
          </div>
        </div>
        <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
      </div>
    `;
  }).join('');
  
  window.openOrderModal = openOrderModal;
}

// ==========================================
// ADMIN CONSOLE CORE LOGIC
// ==========================================
function renderAdminView() {
  const authBox = document.getElementById('admin-auth-container');
  const dashboard = document.getElementById('admin-dashboard');

  if (STATE.user && STATE.user.role === 'admin') {
    authBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadAdminDashboard();
  } else {
    authBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

async function loadAdminDashboard() {
  // Load Pending verification operators
  try {
    const res = await fetch('/api/operators/pending', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error al cargar operadores pendientes.');
    const data = await res.json();
    STATE.pendingOperators = data;
    renderPendingOperators();
  } catch (error) {
    showToast(error.message, 'error');
  }

  // Load All Active orders
  try {
    const res = await fetch('/api/orders', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error al cargar órdenes.');
    const data = await res.json();
    renderAdminOrders(data);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderPendingOperators() {
  const tbody = document.getElementById('admin-pending-operators-body');
  if (STATE.pendingOperators.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay operadores en espera.</td></tr>';
    return;
  }

  tbody.innerHTML = STATE.pendingOperators.map(op => `
    <tr>
      <td><strong>${op.name}</strong></td>
      <td>${op.cedula || 'N/A'}</td>
      <td>${op.phone}</td>
      <td><code>${op.zelle_email}</code></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="window.verifyOperator('${op.id}', 'verified')">Validar</button>
      </td>
    </tr>
  `).join('');

  window.verifyOperator = verifyOperator;
}

async function verifyOperator(id, status) {
  try {
    const res = await fetch('/api/operators/verify', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, status })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al validar operador.');

    showToast(`Operador ${data.name} validado exitosamente.`, 'success');
    loadAdminDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderAdminOrders(orders) {
  const container = document.getElementById('admin-orders-list');
  if (orders.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay registros de compras/misiones en el sistema.</div>';
    return;
  }

  container.innerHTML = orders.map(m => {
    const status = STATUS_MAP[m.status] || { label: m.status, badgeClass: 'badge-info' };
    const date = new Date(m.createdAt).toLocaleDateString('es-VE');
    return `
      <div class="order-list-card" onclick="window.openOrderModal('${m.id}')">
        <div class="order-card-info">
          <h4>Misión a: ${m.supplier_name} (Operador: ${m.operator_name})</h4>
          <div class="order-card-meta">
            <span>Fecha: ${date}</span>
            <span>Tel: ${m.operator_phone}</span>
            <span>Zelle: <code>${m.operator_zelle}</code></span>
            <span class="badge ${status.badgeClass}">${status.label}</span>
          </div>
        </div>
        <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
      </div>
    `;
  }).join('');
}

// ==========================================
// DETAILS MODAL & LIVE CHAT VISTA
// ==========================================
async function openOrderModal(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error al cargar detalle de misión.');
    const order = await res.json();
    STATE.activeOrderDetails = order;

    // Load static values
    document.getElementById('modal-mission-title').textContent = `Misión a: ${order.supplier_name}`;
    document.getElementById('modal-supplier').textContent = order.supplier_name;
    document.getElementById('modal-operator').textContent = order.operator ? order.operator.name : 'N/A';
    document.getElementById('modal-zelle').textContent = order.operator ? order.operator.zelle_email : 'N/A';
    document.getElementById('modal-phone').textContent = order.operator ? order.operator.phone : 'N/A';
    document.getElementById('modal-total-val').textContent = `$${Number(order.total_amount).toFixed(2)}`;

    // Render badge
    const status = STATUS_MAP[order.status] || { label: order.status, badgeClass: 'badge-info' };
    const badge = document.getElementById('modal-status-badge');
    badge.textContent = status.label;
    badge.className = `badge ${status.badgeClass}`;

    // Render items list
    const itemsList = document.getElementById('modal-items-list');
    itemsList.innerHTML = order.items.map(item => `
      <li>
        <span>${item.product_name} x ${item.quantity}</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      </li>
    `).join('');

    // Dynamic actions box based on role and status
    renderModalActions(order);

    // Initial render of chat and start polling
    renderChatMessages(order.chats);
    
    // Clear old interval
    if (STATE.chatIntervalId) clearInterval(STATE.chatIntervalId);
    
    // Start polling every 3.5s
    STATE.chatIntervalId = setInterval(() => pollChat(order.id), 3500);

    // Show modal
    document.getElementById('mission-modal').classList.remove('hidden');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderModalActions(order) {
  const actionsArea = document.getElementById('modal-actions-area');
  const role = STATE.user ? STATE.user.role : 'guest';

  // Clear container
  actionsArea.innerHTML = '';

  if (role === 'admin') {
    if (order.status === 'pending_funds') {
      actionsArea.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-amber)">Panel de Pago Externa (Admin)</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">Haga la transferencia Zelle de <strong>$${Number(order.total_amount).toFixed(2)}</strong> a <code>${order.operator.zelle_email}</code> en su banco. Luego regístrelo aquí:</p>
        <form id="disburse-submit-form" style="display:flex;flex-direction:column;gap:0.75rem;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.75rem;">Comprobante de Pago (Opcional Capture)</label>
            <input type="file" id="disburse-capture" accept="image/*">
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Marcar Fondos Enviados</button>
        </form>
      `;
      // Attach form listener
      document.getElementById('disburse-submit-form').addEventListener('submit', (e) => handleAdminDisburse(e, order.id));
    } else if (order.status === 'funds_sent') {
      actionsArea.innerHTML = `<div style="font-size:0.85rem;font-style:italic;color:var(--accent-amber)">✓ Fondos transferidos. Esperando que el operador recoja y cargue factura del proveedor.</div>`;
    } else if (order.status === 'received') {
      actionsArea.innerHTML = `<div style="font-size:0.85rem;font-style:italic;color:var(--accent-cyan)">✓ Factura verificada. Esperando que el operador entregue los insumos en el centro médico.</div>`;
    } else if (order.status === 'completed') {
      actionsArea.innerHTML = `<div style="font-size:0.85rem;font-style:italic;color:var(--accent-emerald)">✓ Misión completada con éxito. Gastos legalizados.</div>`;
    }
  } else if (role === 'operator') {
    if (order.status === 'pending_funds') {
      actionsArea.innerHTML = `<div style="font-size:0.85rem;font-style:italic;color:var(--accent-amber)">Aguardando por la transferencia Zelle del Administrador...</div>`;
    } else if (order.status === 'funds_sent') {
      actionsArea.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-cyan)">Legalizar Compra</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">Una vez que retires los insumos y le pagues al proveedor, **toma foto a la factura comercial** y súbela aquí:</p>
        <form id="invoice-submit-form" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="invoice-photo" accept="image/*" required>
          <button type="submit" class="btn btn-success btn-sm">Cargar Factura Comercial</button>
        </form>
      `;
      document.getElementById('invoice-submit-form').addEventListener('submit', (e) => handleOperatorInvoice(e, order.id));
    } else if (order.status === 'received') {
      actionsArea.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-emerald)">Finalizar Entrega</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">Para completar la misión, sube la foto de la entrega física de los insumos en Mérida:</p>
        <form id="delivery-submit-form" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="delivery-photo" accept="image/*" required>
          <button type="submit" class="btn btn-primary btn-sm">Completar Entrega</button>
        </form>
      `;
      document.getElementById('delivery-submit-form').addEventListener('submit', (e) => handleOperatorDelivery(e, order.id));
    } else if (order.status === 'completed') {
      actionsArea.innerHTML = `<div style="font-size:0.85rem;font-style:italic;color:var(--accent-emerald)">✓ Misión finalizada con éxito. Gracias por el apoyo.</div>`;
    }
  } else {
    actionsArea.innerHTML = `<div style="font-size:0.85rem;color:var(--text-dim)">Entre en su portal para ver sus opciones.</div>`;
  }
}

// ------------------------------------------
// MODAL ACTIONS HANDLERS (ADMIN / OPERATOR FILE POSTS)
// ------------------------------------------
async function handleAdminDisburse(e, orderId) {
  e.preventDefault();
  const fileInput = document.getElementById('disburse-capture');
  const formData = new FormData();
  
  if (fileInput.files.length > 0) {
    formData.append('receipt', fileInput.files[0]);
  }

  try {
    const res = await fetch(`/api/orders/${orderId}/disburse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STATE.user.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al autorizar desembolso.');

    showToast('Fondos marcados como enviados.', 'success');
    openOrderModal(orderId); // Refresh modal view
    loadAdminDashboard(); // Refresh background
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleOperatorInvoice(e, orderId) {
  e.preventDefault();
  const fileInput = document.getElementById('invoice-photo');
  if (fileInput.files.length === 0) {
    showToast('Seleccione una foto de factura.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('invoice', fileInput.files[0]);

  try {
    const res = await fetch(`/api/orders/${orderId}/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STATE.user.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar factura.');

    showToast('Factura cargada correctamente. Estado actualizado.', 'success');
    openOrderModal(orderId);
    loadOperatorDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleOperatorDelivery(e, orderId) {
  e.preventDefault();
  const fileInput = document.getElementById('delivery-photo');
  if (fileInput.files.length === 0) {
    showToast('Seleccione una foto de entrega.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('delivery', fileInput.files[0]);

  try {
    const res = await fetch(`/api/orders/${orderId}/deliver`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STATE.user.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar entrega.');

    showToast('Evidencia de entrega guardada. ¡Misión completada!', 'success');
    openOrderModal(orderId);
    loadOperatorDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// CHAT SERVICES
// ==========================================
async function pollChat(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/chats`, { headers: getAuthHeaders() });
    if (!res.ok) return; // fail silently during polling
    const chats = await res.json();
    
    // Check if new message added to avoid unnecessary scrolls
    if (!STATE.activeOrderDetails || STATE.activeOrderDetails.chats.length !== chats.length) {
      STATE.activeOrderDetails.chats = chats;
      renderChatMessages(chats);
    }
  } catch (e) {}
}

function renderChatMessages(chats) {
  const chatBox = document.getElementById('modal-chat-messages');
  if (!chats || chats.length === 0) {
    chatBox.innerHTML = '<div style="font-size:0.85rem;color:var(--text-dim);text-align:center;font-style:italic;margin-top:2rem;">Canal de comunicación seguro iniciado. Escriba un mensaje a continuación para coordinar.</div>';
    return;
  }

  chatBox.innerHTML = chats.map(c => {
    const time = new Date(c.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    let roleClass = 'chat-msg-operator';
    if (c.sender_role === 'admin') roleClass = 'chat-msg-admin';
    if (c.sender_role === 'system') roleClass = 'chat-msg-system';

    return `
      <div class="chat-msg ${roleClass}">
        ${c.sender_role !== 'system' ? `<div class="chat-msg-sender">${c.sender_name}</div>` : ''}
        <div>${c.message}</div>
        <div class="chat-msg-meta">${time}</div>
      </div>
    `;
  }).join('');

  // Auto scroll to bottom
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('modal-chat-input');
  const message = input.value.trim();
  if (!message || !STATE.activeOrderDetails) return;

  try {
    const res = await fetch(`/api/orders/${STATE.activeOrderDetails.id}/chats`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar mensaje.');

    input.value = '';
    // Instantly poll to append
    pollChat(STATE.activeOrderDetails.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
}
