// Client State Management
const STATE = {
  currentTab: 'tab-public',
  currentPortalRole: 'hosp',
  user: JSON.parse(localStorage.getItem('cumis_user')) || null,
  products: [],
  hospitals: [],
  dashboardStats: null,
  missions: [],
  pendingStudents: [],
  hospCart: [],
  activeOrderDetails: null,
  chatIntervalId: null
};

// Restricted 29 Catalog Products (Client Reference)
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

// Status maps
const STATUS_MAP = {
  'created': { label: 'Disponible', badgeClass: 'badge-pending' },
  'claimed': { label: 'Tomada', badgeClass: 'badge-info' },
  'funding_sent': { label: 'Comprobante Enviado', badgeClass: 'badge-pending' },
  'funded': { label: 'Fondos Disponibles', badgeClass: 'badge-success' },
  'purchased': { label: 'Comprado', badgeClass: 'badge-info' },
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
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initUserSession();
  loadDashboardStats();
  loadHospitals();
  loadProducts();
  populateDropdowns();
  setupEventListeners();
});

function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Sub-role selector in Portal
  const roleButtons = document.querySelectorAll('.role-select-btn');
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetRole = btn.getAttribute('data-role');
      switchPortalRole(targetRole);
    });
  });
}

function switchTab(tabId) {
  if (STATE.chatIntervalId) {
    clearInterval(STATE.chatIntervalId);
    STATE.chatIntervalId = null;
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  STATE.currentTab = tabId;

  if (tabId === 'tab-public') {
    loadDashboardStats();
  } else if (tabId === 'tab-catalog') {
    loadProducts();
  } else if (tabId === 'tab-portal') {
    switchPortalRole(STATE.currentPortalRole);
  } else if (tabId === 'tab-admin') {
    renderAdminView();
  }
}

function switchPortalRole(role) {
  STATE.currentPortalRole = role;
  
  // Toggle subviews
  document.getElementById('portal-view-hosp').classList.toggle('active', role === 'hosp');
  document.getElementById('portal-view-stud').classList.toggle('active', role === 'stud');
  document.getElementById('portal-view-prov').classList.toggle('active', role === 'prov');
  document.getElementById('portal-view-donor').classList.toggle('active', role === 'donor');

  if (role === 'stud') {
    renderStudentView();
  } else if (role === 'prov') {
    renderProviderView();
  } else if (role === 'donor') {
    loadDonorMissions();
  }
}

function initUserSession() {
  updateUserDisplay();
}

function updateUserDisplay() {
  const display = document.getElementById('user-display');
  const logoutBtn = document.getElementById('logout-btn');

  if (STATE.user) {
    let roleLabel = 'Usuario';
    if (STATE.user.role === 'admin') roleLabel = '🔑 Admin';
    if (STATE.user.role === 'student') roleLabel = '🎓 Estudiante';
    if (STATE.user.role === 'provider') roleLabel = '🏭 Proveedor';
    
    display.textContent = `${roleLabel}: ${STATE.user.name}`;
    logoutBtn.classList.remove('hidden');
  } else {
    display.textContent = 'Invitado';
    logoutBtn.classList.add('hidden');
  }
}

function populateDropdowns() {
  const hospBuilderSelect = document.getElementById('hosp-builder-product-select');
  const options = ALLOWED_PRODUCTS.map(prod => `<option value="${prod}">${prod}</option>`).join('');
  if (hospBuilderSelect) hospBuilderSelect.innerHTML = options;
}

// ==========================================
// API CLIENT LOADER CALLS
// ==========================================
function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (STATE.user && STATE.user.token) {
    headers['Authorization'] = `Bearer ${STATE.user.token}`;
  }
  return headers;
}

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard-stats');
    if (!res.ok) throw new Error('Error al cargar métricas.');
    const data = await res.json();
    STATE.dashboardStats = data;
    renderDashboard();
    
    // Also load all missions in background to keep list fresh
    await loadAllMissions();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadAllMissions() {
  try {
    const res = await fetch('/api/missions');
    if (!res.ok) throw new Error('Error al cargar misiones.');
    const data = await res.json();
    STATE.missions = data;
    renderPublicMissions();
  } catch (e) {}
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Error al cargar inventario.');
    const data = await res.json();
    STATE.products = data;
    renderProducts(data);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadHospitals() {
  try {
    const res = await fetch('/api/hospitals');
    if (!res.ok) throw new Error('Error al cargar hospitales.');
    const data = await res.json();
    STATE.hospitals = data;
    
    const hospSelect = document.getElementById('hosp-select');
    if (hospSelect) {
      hospSelect.innerHTML = data.map(h => `<option value="${h.id}">${h.name} (${h.location})</option>`).join('');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  // Global Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('cumis_user');
    STATE.user = null;
    updateUserDisplay();
    STATE.hospCart = [];
    renderHospCart();
    showToast('Sesión cerrada.', 'info');
    switchTab('tab-public');
  });

  // Student Register/Login tab toggles
  document.querySelectorAll('#student-auth-container .auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#student-auth-container .auth-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.getAttribute('data-auth-mode');
      document.getElementById('student-login-form').classList.toggle('active', mode === 'login');
      document.getElementById('student-register-form').classList.toggle('active', mode === 'register');
    });
  });

  // Provider Register/Login tab toggles
  document.querySelectorAll('#provider-auth-container .auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#provider-auth-container .auth-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.getAttribute('data-auth-mode');
      document.getElementById('provider-login-form').classList.toggle('active', mode === 'login');
      document.getElementById('provider-register-form').classList.toggle('active', mode === 'register');
    });
  });

  // Student auth submissions
  document.getElementById('student-login-form').addEventListener('submit', handleStudentLogin);
  document.getElementById('student-register-form').addEventListener('submit', handleStudentRegister);

  // Provider auth submissions
  document.getElementById('provider-login-form').addEventListener('submit', handleProviderLogin);
  document.getElementById('provider-register-form').addEventListener('submit', handleProviderRegister);

  // Admin auth and donations submissions
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
  document.getElementById('admin-donation-form').addEventListener('submit', handleDonationSubmit);

  // Hospital Cart Builder Actions
  document.getElementById('hosp-add-item-btn').addEventListener('click', addToHospCart);
  document.getElementById('hospital-mission-form').addEventListener('submit', handleHospitalMissionSubmit);

  // Close Detail Modal
  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('mission-modal').classList.add('hidden');
    if (STATE.chatIntervalId) {
      clearInterval(STATE.chatIntervalId);
      STATE.chatIntervalId = null;
    }
  });

  // Chat message send
  document.getElementById('modal-chat-form').addEventListener('submit', handleChatSubmit);

  // Smartphone agent chatbot submit
  document.getElementById('agent-chat-form').addEventListener('submit', handleAgentChatSubmit);

  // Quick commands triggers inside simulator panel
  document.querySelectorAll('.quick-commands-deck button').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      const input = document.getElementById('agent-chat-input');
      input.value = cmd;
      input.focus();
    });
  });

  // Search filter
  document.getElementById('catalog-search').addEventListener('input', (e) => {
    filterProducts(e.target.value);
  });
}

// ==========================================
// HOSPITAL CART DRAFT SERVICES
// ==========================================
function addToHospCart() {
  const prodSelect = document.getElementById('hosp-builder-product-select');
  const qtyInput = document.getElementById('hosp-builder-qty');

  const name = prodSelect.value;
  const quantity = parseInt(qtyInput.value);

  if (!name || isNaN(quantity) || quantity <= 0) {
    showToast('Ingrese una cantidad válida.', 'error');
    return;
  }

  // Lookup reference price from seeded items or default to 1.50
  const prod = STATE.products.find(p => p.name === name);
  const price = prod ? prod.price : 1.50;

  const existing = STATE.hospCart.find(c => c.name === name);
  if (existing) {
    existing.quantity += quantity;
  } else {
    STATE.hospCart.push({ name, quantity, price });
  }

  qtyInput.value = '';
  renderHospCart();
}

function removeHospCartItem(index) {
  STATE.hospCart.splice(index, 1);
  renderHospCart();
}

function renderHospCart() {
  const table = document.getElementById('hosp-cart-table');
  const tbody = document.getElementById('hosp-cart-body');
  const totalArea = document.getElementById('hosp-total-area');
  const totalVal = document.getElementById('hosp-total-value');
  const submitBtn = document.getElementById('hosp-submit-mission-btn');

  if (STATE.hospCart.length === 0) {
    table.classList.add('hidden');
    totalArea.classList.add('hidden');
    submitBtn.classList.add('hidden');
    return;
  }

  table.classList.remove('hidden');
  totalArea.classList.remove('hidden');
  submitBtn.classList.remove('hidden');

  tbody.innerHTML = STATE.hospCart.map((c, idx) => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.quantity}</td>
      <td>$${(c.price * c.quantity).toFixed(2)}</td>
      <td><button type="button" class="btn btn-icon btn-sm" onclick="window.removeHospItem(${idx})">🗑️</button></td>
    </tr>
  `).join('');

  window.removeHospItem = removeHospCartItem;

  const total = STATE.hospCart.reduce((sum, c) => sum + (c.price * c.quantity), 0);
  totalVal.textContent = `$${total.toFixed(2)}`;
}

async function handleHospitalMissionSubmit(e) {
  e.preventDefault();
  const hospital_id = document.getElementById('hosp-select').value;

  if (STATE.hospCart.length === 0) {
    showToast('Debe agregar al menos un insumo médico.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hospital_id, items: STATE.hospCart })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear la misión.');

    showToast('¡Misión humanitaria registrada con éxito! Los estudiantes han sido notificados.', 'success');
    e.target.reset();
    STATE.hospCart = [];
    renderHospCart();
    
    // Refresh lists
    loadDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// STUDENT VIEW CONTROLLERS
// ==========================================
function renderStudentView() {
  const authBox = document.getElementById('student-auth-container');
  const dashboard = document.getElementById('student-dashboard');

  if (STATE.user && STATE.user.role === 'student') {
    authBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadStudentDashboard();
  } else {
    authBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

async function handleStudentLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('stud-login-phone').value;
  const password = document.getElementById('stud-login-password').value;

  try {
    const res = await fetch('/api/students/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Autenticación fallida.');

    STATE.user = data;
    localStorage.setItem('cumis_user', JSON.stringify(data));
    updateUserDisplay();
    showToast(`Bienvenido de nuevo, ${data.name}!`, 'success');
    renderStudentView();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStudentRegister(e) {
  e.preventDefault();
  const name = document.getElementById('stud-reg-name').value;
  const phone = document.getElementById('stud-reg-phone').value;
  const email = document.getElementById('stud-reg-email').value;
  const kyc_type = document.getElementById('stud-reg-kyc-type').value;
  const kyc_details = document.getElementById('stud-reg-kyc-details').value;
  const password = document.getElementById('stud-reg-password').value;

  try {
    const res = await fetch('/api/students/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, kyc_type, kyc_details, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar.');

    showToast('Registro enviado. Su cuenta y KYC serán verificados por el administrador.', 'success');
    e.target.reset();
    document.querySelector('#student-auth-container .auth-tab-btn[data-auth-mode="login"]').click();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// PROVIDER VIEW CONTROLLERS
// ==========================================
function renderProviderView() {
  const authBox = document.getElementById('provider-auth-container');
  const dashboard = document.getElementById('provider-dashboard');

  if (STATE.user && STATE.user.role === 'provider') {
    authBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadProviderDashboard();
  } else {
    authBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

async function handleProviderLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('prov-login-phone').value;
  const password = document.getElementById('prov-login-password').value;

  try {
    const res = await fetch('/api/providers/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Autenticación fallida.');

    STATE.user = data;
    localStorage.setItem('cumis_user', JSON.stringify(data));
    updateUserDisplay();
    showToast(`Bienvenido de nuevo, ${data.name}!`, 'success');
    renderProviderView();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleProviderRegister(e) {
  e.preventDefault();
  const name = document.getElementById('prov-reg-name').value;
  const phone = document.getElementById('prov-reg-phone').value;
  const email = document.getElementById('prov-reg-email').value;
  const kyc_type = document.getElementById('prov-reg-kyc-type').value;
  const kyc_details = document.getElementById('prov-reg-kyc-details').value;
  const password = document.getElementById('prov-reg-password').value;

  try {
    const res = await fetch('/api/providers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, kyc_type, kyc_details, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar.');

    showToast('Registro enviado. Su cuenta comercial y KYC serán verificados por el administrador.', 'success');
    e.target.reset();
    document.querySelector('#provider-auth-container .auth-tab-btn[data-auth-mode="login"]').click();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadProviderDashboard() {
  if (!STATE.user) return;

  document.getElementById('provider-profile-name').textContent = STATE.user.name;
  document.getElementById('provider-profile-kyc-type').textContent = STATE.user.kyc_type;
  document.getElementById('provider-profile-kyc-details').textContent = STATE.user.kyc_details;
  document.getElementById('provider-profile-phone').textContent = STATE.user.phone;

  await loadAllMissions();
  renderProviderMissions();
}

function renderProviderMissions() {
  const availableList = document.getElementById('provider-available-missions');
  const myMissionsList = document.getElementById('provider-my-missions');

  const available = STATE.missions.filter(m => m.status === 'created');
  const mine = STATE.missions.filter(m => m.provider_id === STATE.user.id);

  if (available.length === 0) {
    availableList.innerHTML = '<div class="empty-state">No hay misiones disponibles para despachar.</div>';
  } else {
    availableList.innerHTML = available.map(m => `
      <div class="order-list-card" style="cursor:default;">
        <div class="order-card-info" style="flex:1;">
          <h4>Hospital Solicitante: ${m.hospital_name} (⭐ ${m.hospital_rating || '5.0'})</h4>
          <div class="order-card-meta">
            <span>Insumos: ${m.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}</span>
            <span>Fecha: ${new Date(m.createdAt).toLocaleDateString('es-VE')}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:1rem;">
          <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
          <button class="btn btn-sm btn-primary" onclick="window.claimMission('${m.id}')">Tomar Despacho</button>
        </div>
      </div>
    `).join('');
  }

  if (mine.length === 0) {
    myMissionsList.innerHTML = '<div class="empty-state">No tiene despachos activos asignados aún.</div>';
  } else {
    myMissionsList.innerHTML = mine.map(m => {
      const status = STATUS_MAP[m.status] || { label: m.status, badgeClass: 'badge-info' };
      return `
        <div class="order-list-card" onclick="window.openOrderModal('${m.id}')">
          <div class="order-card-info">
            <h4>Misión de Despacho: ${m.hospital_name}</h4>
            <div class="order-card-meta">
              <span>Fecha: ${new Date(m.createdAt).toLocaleDateString('es-VE')}</span>
              <span class="badge ${status.badgeClass}">${status.label}</span>
            </div>
          </div>
          <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
        </div>
      `;
    }).join('');
  }
}

async function loadStudentDashboard() {
  if (!STATE.user) return;

  document.getElementById('student-profile-name').textContent = STATE.user.name;
  document.getElementById('student-profile-kyc-type').textContent = STATE.user.kyc_type;
  document.getElementById('student-profile-kyc-details').textContent = STATE.user.kyc_details;
  document.getElementById('student-profile-phone').textContent = STATE.user.phone;

  // Refresh missions
  await loadAllMissions();
  renderStudentMissions();
}

function renderStudentMissions() {
  const availableList = document.getElementById('student-available-missions');
  const myMissionsList = document.getElementById('student-my-missions');

  const available = STATE.missions.filter(m => m.status === 'created');
  const mine = STATE.missions.filter(m => m.student_id === STATE.user.id);

  // 1. Render Available
  if (available.length === 0) {
    availableList.innerHTML = '<div class="empty-state">No hay misiones disponibles. ¡Buen trabajo!</div>';
  } else {
    availableList.innerHTML = available.map(m => `
      <div class="order-list-card" style="cursor:default;">
        <div class="order-card-info" style="flex:1;">
          <h4>Solicitado por: ${m.hospital_name}</h4>
          <div class="order-card-meta">
            <span>Insumos: ${m.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}</span>
            <span>Fecha: ${new Date(m.createdAt).toLocaleDateString('es-VE')}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:1rem;">
          <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
          <button class="btn btn-sm btn-primary" onclick="window.claimMission('${m.id}')">Tomar Misión</button>
        </div>
      </div>
    `).join('');
  }

  // 2. Render Mine
  if (mine.length === 0) {
    myMissionsList.innerHTML = '<div class="empty-state">No tiene misiones asignadas aún. ¡Tome una de arriba!</div>';
  } else {
    myMissionsList.innerHTML = mine.map(m => {
      const status = STATUS_MAP[m.status] || { label: m.status, badgeClass: 'badge-info' };
      return `
        <div class="order-list-card" onclick="window.openOrderModal('${m.id}')">
          <div class="order-card-info">
            <h4>Misión: ${m.hospital_name}</h4>
            <div class="order-card-meta">
              <span>Fecha: ${new Date(m.createdAt).toLocaleDateString('es-VE')}</span>
              <span class="badge ${status.badgeClass}">${status.label}</span>
            </div>
          </div>
          <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
        </div>
      `;
    }).join('');
  }

  window.claimMission = claimMission;
  window.openOrderModal = openOrderModal;
}

async function claimMission(missionId) {
  try {
    const res = await fetch(`/api/missions/${missionId}/claim`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al tomar la misión.');

    showToast('¡Misión tomada! Vinculando billetera KYC.', 'success');
    if (STATE.user && STATE.user.role === 'provider') {
      loadProviderDashboard();
    } else {
      loadStudentDashboard();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// DONOR PORTAL CONTROLLERS
// ==========================================
async function loadDonorMissions() {
  try {
    await loadAllMissions();
    const list = document.getElementById('donor-missions-list');
    
    // Filter missions that are claimed (assigned to student but not funded yet)
    const pendingFondeo = STATE.missions.filter(m => m.status === 'claimed');

    if (pendingFondeo.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay misiones reclamadas esperando fondeo en este momento.</div>';
      return;
    }

    list.innerHTML = pendingFondeo.map(m => {
      const operator_name = m.student_name || m.provider_name;
      const operator_kyc_type = m.student_kyc_type || m.provider_kyc_type || 'N/A';
      const operator_kyc_details = m.student_kyc_details || m.provider_kyc_details || 'N/A';
      const operator_label = m.student_id ? 'Estudiante' : 'Proveedor';
      const operator_rating = m.student_id ? m.student_rating : m.provider_rating;
      const rating_text = operator_rating ? `⭐ ${operator_rating.toFixed(1)}` : '⭐ 5.0';

      return `
        <div class="order-list-card" style="cursor:default;">
          <div class="order-card-info" style="flex:1;">
            <h4>Misión para: ${m.hospital_name}</h4>
            <div class="order-card-meta">
              <span>${operator_label}: <strong>${operator_name}</strong> (${rating_text})</span>
              <span>Billetera KYC: <strong style="text-transform:uppercase;color:var(--accent-cyan)">[${operator_kyc_type}]</strong> <code>${operator_kyc_details}</code></span>
              <span>Fecha: ${new Date(m.createdAt).toLocaleDateString('es-VE')}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:1.5rem;">
            <div class="order-card-amount" style="color:var(--accent-amber)">$${Number(m.total_amount).toFixed(2)}</div>
            <button class="btn btn-sm btn-primary" onclick="window.fundMission('${m.id}', ${m.total_amount})">Donar Fondos</button>
          </div>
        </div>
      `;
    }).join('');

    window.fundMission = fundMission;
  } catch (e) {}
}

async function fundMission(missionId, amount) {
  openOrderModal(missionId);
}

// ==========================================
// ADMIN CONSOLE CONTROLLERS
// ==========================================
async function handleAdminLogin(e) {
  e.preventDefault();
  const passcode = document.getElementById('admin-passcode').value;

  try {
    const res = await fetch('/api/students/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin', password: passcode })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Código incorrecto.');

    STATE.user = data;
    localStorage.setItem('cumis_user', JSON.stringify(data));
    updateUserDisplay();
    showToast('Consola de Administrador iniciada.', 'success');
    renderAdminView();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleDonationSubmit(e) {
  e.preventDefault();
  const amount = document.getElementById('don-amount').value;
  const donor_name = document.getElementById('don-donor').value;

  try {
    // Legacy support or direct donation logs to keep dashboard metrics populated
    const res = await fetch('/api/donations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount, donor_name })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error.');

    showToast('Donación registrada.', 'success');
    e.target.reset();
    loadDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

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
  // Load pending students KYC
  try {
    const res = await fetch('/api/students/pending', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error.');
    const data = await res.json();
    STATE.pendingStudents = data;
    renderPendingStudents();
  } catch (e) {}

  // Load pending providers KYC
  try {
    const res = await fetch('/api/providers/pending', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error.');
    const data = await res.json();
    STATE.pendingProviders = data;
    renderPendingProviders();
  } catch (e) {}

  // Load all missions
  try {
    await loadAllMissions();
    renderAdminMissionsList();
  } catch (e) {}
}

function renderPendingStudents() {
  const tbody = document.getElementById('admin-pending-students-body');
  if (STATE.pendingStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay estudiantes en espera de verificación KYC.</td></tr>';
    return;
  }

  tbody.innerHTML = STATE.pendingStudents.map(stud => `
    <tr>
      <td><strong>${stud.name}</strong></td>
      <td>${stud.phone}</td>
      <td>${stud.email}</td>
      <td><span class="badge badge-info" style="text-transform:uppercase;">${stud.kyc_type}</span></td>
      <td><code>${stud.kyc_details}</code></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="window.verifyStudent('${stud.id}')">Verificar KYC</button>
      </td>
    </tr>
  `).join('');

  window.verifyStudent = verifyStudent;
}

function renderPendingProviders() {
  const tbody = document.getElementById('admin-pending-providers-body');
  if (!tbody) return;
  if (!STATE.pendingProviders || STATE.pendingProviders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay proveedores en espera de verificación KYC.</td></tr>';
    return;
  }

  tbody.innerHTML = STATE.pendingProviders.map(prov => `
    <tr>
      <td><strong>${prov.name}</strong></td>
      <td>${prov.phone}</td>
      <td>${prov.email}</td>
      <td><span class="badge badge-info" style="text-transform:uppercase;">${prov.kyc_type}</span></td>
      <td><code>${prov.kyc_details}</code></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="window.verifyProvider('${prov.id}')">Verificar KYC</button>
      </td>
    </tr>
  `).join('');

  window.verifyProvider = verifyProvider;
}

async function verifyStudent(id) {
  try {
    const res = await fetch('/api/students/verify', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, status: 'verified' })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error.');

    showToast(`KYC del estudiante ${data.name} verificado.`, 'success');
    loadAdminDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function verifyProvider(id) {
  try {
    const res = await fetch('/api/providers/verify', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, status: 'verified' })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error.');

    showToast(`KYC del proveedor ${data.name} verificado.`, 'success');
    loadAdminDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderAdminMissionsList() {
  const container = document.getElementById('admin-missions-list');
  if (STATE.missions.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay misiones registradas.</div>';
    return;
  }

  container.innerHTML = STATE.missions.map(m => {
    const status = STATUS_MAP[m.status] || { label: m.status, badgeClass: 'badge-info' };
    return `
      <div class="order-list-card" onclick="window.openOrderModal('${m.id}')">
        <div class="order-card-info">
          <h4>Misión a: ${m.hospital_name}</h4>
          <div class="order-card-meta">
            <span>Operador: ${m.student_name || m.provider_name || 'Sin asignar'}</span>
            ${m.student_kyc_details || m.provider_kyc_details ? `<span>KYC: <code>${m.student_kyc_details || m.provider_kyc_details}</code></span>` : ''}
            <span>Fecha: ${new Date(m.createdAt).toLocaleDateString('es-VE')}</span>
            <span class="badge ${status.badgeClass}">${status.label}</span>
          </div>
        </div>
        <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
      </div>
    `;
  }).join('');
}

// ==========================================
// RENDER GENERAL VIEWS
// ==========================================
function renderDashboard() {
  if (!STATE.dashboardStats) return;
  const stats = STATE.dashboardStats;

  document.getElementById('stat-donations').textContent = `$${stats.donationTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('stat-transit').textContent = `$${stats.transitTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('stat-legalised').textContent = `$${stats.legalisedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const gallery = document.getElementById('impact-gallery');
  if (stats.completedMissions && stats.completedMissions.length > 0) {
    gallery.innerHTML = stats.completedMissions.map(m => `
      <div class="gallery-card">
        <div class="gallery-media">
          <img src="${m.delivery_photo || m.invoice_photo || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80'}" alt="Entrega CUMIS" class="gallery-img">
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

function renderPublicMissions() {
  const list = document.getElementById('public-missions-list');
  if (STATE.missions.length === 0) {
    list.innerHTML = '<div class="empty-state">No hay misiones activas en este momento.</div>';
    return;
  }

  list.innerHTML = STATE.missions.map(m => {
    const status = STATUS_MAP[m.status] || { label: m.status, badgeClass: 'badge-info' };
    const operator_name = m.student_name || m.provider_name || 'Buscando operador';
    const operator_rating = m.student_id ? m.student_rating : m.provider_rating;
    const operator_stars = operator_rating ? ` (⭐ ${operator_rating.toFixed(1)})` : '';
    const hospital_stars = m.hospital_rating ? ` (⭐ ${m.hospital_rating.toFixed(1)})` : ' (⭐ 5.0)';

    return `
      <div class="order-list-card" onclick="window.openOrderModal('${m.id}')">
        <div class="order-card-info">
          <h4>Misión: ${m.hospital_name}${hospital_stars}</h4>
          <div class="order-card-meta">
            <span>Monto: $${Number(m.total_amount).toFixed(2)}</span>
            <span>Operador: ${operator_name}${operator_stars}</span>
            <span class="badge ${status.badgeClass}">${status.label}</span>
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-dim);">${new Date(m.createdAt).toLocaleDateString('es-VE')}</div>
      </div>
    `;
  }).join('');
}

function renderProducts(products) {
  const container = document.getElementById('catalog-products-container');
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1">No hay productos en catálogo.</div>';
    return;
  }

  container.innerHTML = products.map(prod => `
    <div class="catalog-card">
      <div class="catalog-card-header">
        <div>
          <h4 class="catalog-item-name">${prod.name}</h4>
          <span class="catalog-supplier">Referencia: ${prod.supplier_name}</span>
        </div>
      </div>
      <div class="catalog-stats">
        <div>
          <label>Costo Unitario</label>
          <div class="catalog-price-val">$${Number(prod.price).toFixed(2)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function filterProducts(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderProducts(STATE.products);
    return;
  }
  renderProducts(STATE.products.filter(p => p.name.toLowerCase().includes(q)));
}

// ==========================================
// DETAIL MODAL & DYNAMIC ACTIONS
// ==========================================
async function openOrderModal(missionId) {
  try {
    const res = await fetch(`/api/missions/${missionId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error.');
    const mission = await res.json();
    STATE.activeOrderDetails = mission;

    document.getElementById('modal-mission-title').textContent = `Misión: ${mission.id}`;
    document.getElementById('modal-hospital-name').textContent = mission.hospital_name;
    document.getElementById('modal-hospital-stars').textContent = mission.hospital_rating ? `⭐ ${mission.hospital_rating.toFixed(1)}` : '⭐ 5.0';
    document.getElementById('modal-student-name').textContent = mission.student_name || 'Sin asignar';
    document.getElementById('modal-student-stars').textContent = mission.student_name && mission.student_rating ? `⭐ ${mission.student_rating.toFixed(1)}` : '';
    document.getElementById('modal-provider-name').textContent = mission.provider_name || 'Sin asignar';
    document.getElementById('modal-provider-stars').textContent = mission.provider_name && mission.provider_rating ? `⭐ ${mission.provider_rating.toFixed(1)}` : '';
    document.getElementById('modal-kyc-type').textContent = (mission.student_kyc_type || mission.provider_kyc_type || 'N/A').toUpperCase();
    document.getElementById('modal-kyc-details').textContent = mission.student_kyc_details || mission.provider_kyc_details || 'N/A';
    document.getElementById('modal-donor-name').textContent = mission.donor_name || 'Sin asignar';
    document.getElementById('modal-donor-stars').textContent = mission.donor_name && mission.donor_rating ? `⭐ ${mission.donor_rating.toFixed(1)}` : '';
    document.getElementById('modal-total-val').textContent = `$${Number(mission.total_amount).toFixed(2)}`;

    const status = STATUS_MAP[mission.status] || { label: mission.status, badgeClass: 'badge-info' };
    const badge = document.getElementById('modal-status-badge');
    badge.textContent = status.label;
    badge.className = `badge ${status.badgeClass}`;

    document.getElementById('modal-items-list').innerHTML = mission.items.map(item => `
      <li>
        <span>${item.product_name} x ${item.quantity}</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      </li>
    `).join('');

    renderModalActions(mission);
    renderChatMessages(mission.chats);

    if (STATE.chatIntervalId) clearInterval(STATE.chatIntervalId);
    STATE.chatIntervalId = setInterval(() => pollChat(mission.id), 3500);

    document.getElementById('mission-modal').classList.remove('hidden');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderModalActions(mission) {
  const container = document.getElementById('modal-actions-area');
  const role = STATE.user ? STATE.user.role : 'guest';

  container.innerHTML = '';

  const isOperator = (role === 'student' && mission.student_id === STATE.user.id) || (role === 'provider' && mission.provider_id === STATE.user.id);

  if (mission.status === 'completed') {
    container.innerHTML = `
      <div style="color:var(--accent-emerald);font-style:italic;font-size:0.85rem;margin-bottom:0.75rem;">✓ Misión completada con éxito.</div>
      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:0.75rem;margin-top:0.5rem;">
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-amber)">Calificar Misión Humanitaria</h4>
        <form id="rating-submit-form" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;">
            <label>Estrellas:</label>
            <select id="rating-stars" style="padding:2px 5px;background:#2a2f3b;border:1px solid #444;" required>
              <option value="5">⭐⭐⭐⭐⭐ (5)</option>
              <option value="4">⭐⭐⭐⭐ (4)</option>
              <option value="3">⭐⭐⭐ (3)</option>
              <option value="2">⭐⭐ (2)</option>
              <option value="1">⭐ (1)</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <input type="text" id="rating-comment" placeholder="Comentario de valoración..." style="padding:0.4rem;font-size:0.85rem;width:100%;" required>
          </div>
          <button type="submit" class="btn btn-sm btn-outline btn-block" style="margin-top:0.25rem;">Enviar Calificación</button>
        </form>
      </div>
    `;
    setTimeout(() => {
      const form = document.getElementById('rating-submit-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          submitRating(mission);
        });
      }
    }, 50);
    return;
  }

  if (isOperator) {
    if (mission.status === 'funding_sent') {
      container.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-amber)">Confirmar Recepción de Fondos</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">El donador indica que ha enviado los fondos. Por favor, revise su cuenta y suba capture del recibo:</p>
        <form id="receipt-confirm-submit-form" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="receipt-confirm-photo" accept="image/*" required>
          <button type="submit" class="btn btn-primary btn-sm">Confirmar Fondos Recibidos</button>
        </form>
      `;
      document.getElementById('receipt-confirm-submit-form').addEventListener('submit', (e) => handleStudentConfirmReceiptSubmit(e, mission.id));
    } else if (mission.status === 'funded') {
      container.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-cyan)">Legalizar Compra / Despacho</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">Fondos disponibles en Mérida. Adquiera/Despache los insumos y cargue la factura comercial:</p>
        <form id="invoice-submit-form" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="invoice-photo" accept="image/*" required>
          <button type="submit" class="btn btn-success btn-sm">Cargar Factura</button>
        </form>
      `;
      document.getElementById('invoice-submit-form').addEventListener('submit', (e) => handleStudentInvoiceSubmit(e, mission.id));
    } else if (mission.status === 'purchased') {
      container.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-emerald)">Completar Despacho en Hospital</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">Haga la entrega física en el centro de salud y suba la foto de entrega firmada:</p>
        <form id="delivery-submit-form" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="delivery-photo" accept="image/*" required>
          <button type="submit" class="btn btn-primary btn-sm">Completar Entrega</button>
        </form>
      `;
      document.getElementById('delivery-submit-form').addEventListener('submit', (e) => handleStudentDeliverySubmit(e, mission.id));
    } else {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);">Misión en estado: <strong>${mission.status.toUpperCase()}</strong>. Esperando fondeo de donadores.</div>`;
    }
  } else if (role === 'admin') {
    container.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);">Auditoría Administrativa. Misión en estado: <strong>${mission.status.toUpperCase()}</strong>.</div>`;
  } else {
    // Guest or Donor view inside modal
    if (mission.status === 'created') {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--accent-amber);">Esperando que un estudiante o proveedor verificado KYC asuma esta misión.</div>`;
    } else if (mission.status === 'claimed') {
      const operator_kyc_type = mission.student_kyc_type || mission.provider_kyc_type;
      const operator_kyc_details = mission.student_kyc_details || mission.provider_kyc_details;
      const operator_name = mission.student_name || mission.provider_name;
      container.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-amber);">Fondeo Humanitario Directo</h4>
        <p style="font-size:0.85rem;color:var(--text-muted);">Transfiera <strong>$${Number(mission.total_amount).toFixed(2)}</strong> a la cuenta del operador (${operator_name}):</p>
        <div style="background-color:rgba(0,0,0,0.2);padding:0.5rem;border-radius:6px;font-size:0.85rem;margin-bottom:0.5rem;">
          <div>Billetera: <strong style="text-transform:uppercase;">${operator_kyc_type}</strong></div>
          <div>Cuenta: <code>${operator_kyc_details}</code></div>
        </div>
        <form id="donor-transfer-form" style="display:flex;flex-direction:column;gap:0.75rem;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.75rem;">Su Nombre / Organización</label>
            <input type="text" id="donor-modal-name" placeholder="Ej: Donante Anónimo" required>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.75rem;">Comprobante de Transferencia (Capture)</label>
            <input type="file" id="donor-proof-photo" accept="image/*" required>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Marcar Fondos Enviados</button>
        </form>
      `;
      setTimeout(() => {
        const form = document.getElementById('donor-transfer-form');
        if (form) {
          form.addEventListener('submit', (e) => handleDonorTransferSubmit(e, mission.id));
        }
      }, 50);
    } else if (mission.status === 'funding_sent') {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--accent-amber);font-style:italic;">✓ Comprobante enviado por el donador. Esperando confirmación de recepción de fondos del operador.</div>`;
    } else {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--accent-emerald);font-style:italic;">✓ Misión financiada y en proceso de logística de campo.</div>`;
    }
  }
}

async function submitRating(mission) {
  const stars = document.getElementById('rating-stars').value;
  const comment = document.getElementById('rating-comment').value;

  let reviewee_role = 'student';
  let reviewee_id = mission.student_id || mission.provider_id;
  if (mission.student_id) {
    reviewee_role = 'student';
  } else if (mission.provider_id) {
    reviewee_role = 'provider';
  }

  const role = STATE.user ? STATE.user.role : 'guest';
  if (role === 'student' || role === 'provider') {
    reviewee_role = 'donor';
    reviewee_id = 'donor-seed'; // rate donor by default
  }

  try {
    const res = await fetch(`/api/missions/${mission.id}/ratings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ stars, comment, reviewee_id, reviewee_role })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error al calificar.');
    }

    showToast('¡Gracias por tu valoración!', 'success');
    openOrderModal(mission.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleDonorTransferSubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('donor-proof-photo');
  const donorName = document.getElementById('donor-modal-name').value.trim() || 'Donador de CUMIS';
  
  if (fileInput.files.length === 0) {
    showToast('Seleccione un comprobante de transferencia.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('donor_name', donorName);
  formData.append('transfer_proof', fileInput.files[0]);

  try {
    const res = await fetch(`/api/missions/${missionId}/fund`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al procesar donación.');

    showToast('¡Comprobante de envío enviado con éxito! El estudiante ha sido notificado.', 'success');
    openOrderModal(missionId);
    loadDashboardStats();
    if (STATE.currentTab === 'tab-portal') {
      switchPortalRole(STATE.currentPortalRole);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStudentConfirmReceiptSubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('receipt-confirm-photo');
  if (fileInput.files.length === 0) {
    showToast('Por favor seleccione una captura de su billetera.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('receipt_proof', fileInput.files[0]);

  try {
    const res = await fetch(`/api/missions/${missionId}/confirm-receipt`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STATE.user.token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error.');

    showToast('¡Recepción de fondos confirmada! Ya puedes realizar la compra.', 'success');
    openOrderModal(missionId);
    loadStudentDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStudentInvoiceSubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('invoice-photo');
  if (fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('invoice', fileInput.files[0]);

  try {
    const res = await fetch(`/api/missions/${missionId}/invoice`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STATE.user.token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error.');

    showToast('Factura legalizada.', 'success');
    openOrderModal(missionId);
    loadStudentDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStudentDeliverySubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('delivery-photo');
  if (fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('delivery', fileInput.files[0]);

  try {
    const res = await fetch(`/api/missions/${missionId}/verify-delivery`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STATE.user.token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error.');

    showToast('¡Entrega del hospital registrada y verificada!', 'success');
    openOrderModal(missionId);
    loadStudentDashboard();
    loadDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// CHAT ROOMS POLLING
// ==========================================
async function pollChat(missionId) {
  try {
    const res = await fetch(`/api/missions/${missionId}/chats`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const chats = await res.json();
    if (!STATE.activeOrderDetails || STATE.activeOrderDetails.chats.length !== chats.length) {
      STATE.activeOrderDetails.chats = chats;
      renderChatMessages(chats);
    }
  } catch (e) {}
}

function renderChatMessages(chats) {
  const container = document.getElementById('modal-chat-messages');
  if (!chats || chats.length === 0) {
    container.innerHTML = '<div style="font-size:0.8rem;font-style:italic;color:var(--text-dim);text-align:center;margin-top:2rem;">Canal seguro de coordinación. Envíe un mensaje abajo para acordar detalles.</div>';
    return;
  }

  container.innerHTML = chats.map(c => {
    let roleClass = 'chat-msg-operator';
    if (c.sender_role === 'admin') roleClass = 'chat-msg-admin';
    if (c.sender_role === 'system') roleClass = 'chat-msg-system';
    
    const time = new Date(c.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="chat-msg ${roleClass}">
        ${c.sender_role !== 'system' ? `<div class="chat-msg-sender">${c.sender_name}</div>` : ''}
        <div>${c.message}</div>
        <div class="chat-msg-meta">${time}</div>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('modal-chat-input');
  const message = input.value.trim();
  if (!message || !STATE.activeOrderDetails) return;

  try {
    const res = await fetch(`/api/missions/${STATE.activeOrderDetails.id}/chats`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        sender_role: STATE.user ? STATE.user.role : 'guest',
        sender_name: STATE.user ? STATE.user.name : 'Usuario Web'
      })
    });

    if (!res.ok) throw new Error('Error al enviar.');
    input.value = '';
    pollChat(STATE.activeOrderDetails.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// SMARTPHONE BOT SIMULATOR
// ==========================================
async function handleAgentChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('agent-chat-input');
  const message = input.value.trim();
  if (!message) return;

  const select = document.getElementById('agent-sim-persona');
  const option = select.options[select.selectedIndex];
  const sender_phone = option.getAttribute('data-phone');
  const platform = document.getElementById('agent-sim-platform').value;

  // Render User Message
  appendSimMessage(message, 'user');
  input.value = '';

  try {
    const res = await fetch('/api/webhooks/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, sender_phone, message })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del Agente.');

    // Render Bot Message
    setTimeout(() => {
      appendSimMessage(data.reply, 'bot');
      
      // Reload stats and active views in background immediately!
      loadDashboardStats();
      if (STATE.currentTab === 'tab-portal') {
        switchPortalRole(STATE.currentPortalRole);
      }
    }, 500);

  } catch (error) {
    showToast(error.message, 'error');
  }
}

function appendSimMessage(text, sender) {
  const container = document.getElementById('agent-chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = text.replace(/\n/g, '<br>');
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}
