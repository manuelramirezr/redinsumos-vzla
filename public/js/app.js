import { STATE, ALLOWED_PRODUCTS } from './state.js';
import {
  loginOperatorApi,
  registerMissionaryApi,
  registerProviderApi,
  createMissionApi,
  registerHospitalApi,
  fundMissionApi,
  confirmReceiptApi,
  uploadInvoiceApi,
  verifyDeliveryApi,
  sendChatMessage,
  sendBotMessage
} from './api.js';
import {
  showToast,
  initializeCaptcha,
  validateCaptcha,
  switchTab,
  switchPortalRole,
  updateUserDisplay
} from './ui.js';
import {
  loadDashboardStats,
  loadAllMissions,
  loadProducts,
  loadHospitals,
  renderHospCart,
  renderMissionaryView,
  renderProviderView,
  loadProviderDashboard,
  loadMissionaryDashboard,
  loadAdminDashboard,
  verifyMissionary,
  verifyProvider,
  verifyHospital,
  claimMission,
  openOrderModal,
  fundMission,
  pollChat,
  filterProducts
} from './views.js';

// ==========================================
// DOM DOMContentLoaded INITIALIZER
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
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  document.querySelectorAll('.role-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-select-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetRole = btn.getAttribute('data-role');
      switchPortalRole(targetRole);
    });
  });
}

function initUserSession() {
  updateUserDisplay();
}

function populateDropdowns() {
  const hospBuilderSelect = document.getElementById('hosp-builder-product-select');
  if (hospBuilderSelect) {
    hospBuilderSelect.innerHTML = ALLOWED_PRODUCTS.map(prod => `<option value="${prod}">${prod}</option>`).join('');
  }
}

// ==========================================
// HANDLERS DEFINITIONS
// ==========================================

async function handleMissionaryLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('mish-login-phone').value;
  const password = document.getElementById('mish-login-password').value;

  try {
    const data = await loginOperatorApi(phone, password, 'missionary');
    STATE.user = data;
    localStorage.setItem('cumis_user', JSON.stringify(data));
    updateUserDisplay();
    showToast(`Bienvenido de nuevo, ${data.name}!`, 'success');
    renderMissionaryView();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleMissionaryRegister(e) {
  e.preventDefault();
  if (!validateCaptcha('missionary-register-form')) {
    showToast('Verificación humana incorrecta. Intente de nuevo.', 'error');
    initializeCaptcha('missionary-register-form');
    return;
  }
  const name = document.getElementById('mish-reg-name').value;
  const phone = document.getElementById('mish-reg-phone').value;
  const email = document.getElementById('mish-reg-email').value;
  const type = document.getElementById('mish-reg-type').value;
  const university = document.getElementById('mish-reg-university').value;
  const kyc_type = document.getElementById('mish-reg-kyc-type').value;
  const kyc_details = document.getElementById('mish-reg-kyc-details').value;
  const password = document.getElementById('mish-reg-password').value;

  try {
    await registerMissionaryApi({ name, phone, email, type, university, kyc_type, kyc_details, password });
    showToast('Registro enviado. Su cuenta y KYC serán verificados por el administrador.', 'success');
    e.target.reset();
    document.querySelector('#missionary-auth-container .auth-tab-btn[data-auth-mode="login"]').click();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleProviderLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('prov-login-phone').value;
  const password = document.getElementById('prov-login-password').value;

  try {
    const data = await loginOperatorApi(phone, password, 'provider');
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
  if (!validateCaptcha('provider-register-form')) {
    showToast('Verificación humana incorrecta. Intente de nuevo.', 'error');
    initializeCaptcha('provider-register-form');
    return;
  }
  const name = document.getElementById('prov-reg-name').value;
  const phone = document.getElementById('prov-reg-phone').value;
  const email = document.getElementById('prov-reg-email').value;
  const kyc_type = document.getElementById('prov-reg-kyc-type').value;
  const kyc_details = document.getElementById('prov-reg-kyc-details').value;
  const password = document.getElementById('prov-reg-password').value;

  try {
    await registerProviderApi({ name, phone, email, kyc_type, kyc_details, password });
    showToast('Registro enviado. Su cuenta comercial y KYC serán verificados por el administrador.', 'success');
    e.target.reset();
    document.querySelector('#provider-auth-container .auth-tab-btn[data-auth-mode="login"]').click();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleHospitalRegister(e) {
  e.preventDefault();
  if (!validateCaptcha('hospital-register-form')) {
    showToast('Verificación humana incorrecta. Intente de nuevo.', 'error');
    initializeCaptcha('hospital-register-form');
    return;
  }

  const name = document.getElementById('hosp-reg-name').value.trim();
  const location = document.getElementById('hosp-reg-location').value.trim();
  const phone = document.getElementById('hosp-reg-phone').value.trim();
  const manager_name = document.getElementById('hosp-reg-mgr-name').value.trim();
  const manager_email = document.getElementById('hosp-reg-mgr-email').value.trim();
  const is_whatsapp = document.getElementById('hosp-reg-whatsapp').checked;
  const rif = document.getElementById('hosp-reg-rif').value.trim();
  const image_path = document.getElementById('hosp-reg-image').value.trim();

  try {
    await registerHospitalApi({ name, location, phone, manager_name, manager_email, is_whatsapp, rif, image_path });
    showToast('Registro de hospital enviado. Su cuenta será verificada por el administrador.', 'success');
    e.target.reset();
    document.querySelector('#portal-view-hosp .auth-tab-btn[data-hosp-mode="request"]').click();
    await loadHospitals(); 
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const passcode = document.getElementById('admin-passcode').value;

  try {
    const data = await loginOperatorApi('admin', passcode, 'missionary');
    STATE.user = data;
    localStorage.setItem('cumis_user', JSON.stringify(data));
    updateUserDisplay();
    showToast('Consola de Administrador iniciada.', 'success');
    renderAdminView();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleHospitalMissionSubmit(e) {
  e.preventDefault();
  const hospital_id = document.getElementById('hosp-select').value;

  if (STATE.hospCart.length === 0) {
    showToast('Debe agregar al menos un insumo médico.', 'error');
    return;
  }

  try {
    await createMissionApi(hospital_id, STATE.hospCart);
    showToast('¡Misión humanitaria registrada con éxito! Los misioneros han sido notificados.', 'success');
    e.target.reset();
    STATE.hospCart = [];
    renderHospCart();
    loadDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('modal-chat-input');
  const message = input.value.trim();
  if (!message || !STATE.activeOrderDetails) return;

  try {
    await sendChatMessage(STATE.activeOrderDetails.id, message);
    input.value = '';
    pollChat(STATE.activeOrderDetails.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleAgentChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('agent-chat-input');
  const message = input.value.trim();
  if (!message) return;

  const select = document.getElementById('agent-sim-persona');
  const option = select.options[select.selectedIndex];
  const sender_phone = option.getAttribute('data-phone');
  const platform = document.getElementById('agent-sim-platform').value;

  appendSimMessage(message, 'user');
  input.value = '';

  try {
    const data = await sendBotMessage(platform, sender_phone, message);
    setTimeout(() => {
      appendSimMessage(data.reply, 'bot');
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
  if (!container) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = text.replace(/\n/g, '<br>');
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// ==========================================
// EVIDENCE UPLOADS SUBMITS (from dynamic actions)
// ==========================================

async function handleDonorTransferSubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('donor-proof-photo');
  const donorName = document.getElementById('donor-modal-name').value.trim() || 'Donador de CUMIS';
  const donorEmail = document.getElementById('donor-modal-email').value.trim();
  const donorPhone = document.getElementById('donor-modal-phone').value.trim();
  const isAnonymous = document.getElementById('donor-modal-anonymous').checked;
  
  if (!fileInput || fileInput.files.length === 0) {
    showToast('Seleccione un comprobante de transferencia.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('donor_name', donorName);
  formData.append('donor_email', donorEmail);
  formData.append('donor_phone', donorPhone);
  formData.append('is_anonymous', isAnonymous);
  formData.append('transfer_proof', fileInput.files[0]);

  try {
    await fundMissionApi(missionId, formData);
    showToast('¡Comprobante de envío enviado con éxito! El operador ha sido notificado.', 'success');
    openOrderModal(missionId);
    loadDashboardStats();
    if (STATE.currentTab === 'tab-portal') {
      switchPortalRole(STATE.currentPortalRole);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleMissionaryConfirmReceiptSubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('receipt-confirm-photo');
  if (!fileInput || fileInput.files.length === 0) {
    showToast('Por favor seleccione una captura de su billetera.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('receipt_proof', fileInput.files[0]);

  try {
    await confirmReceiptApi(missionId, formData);
    showToast('¡Recepción de fondos confirmada! Ya puedes realizar la compra.', 'success');
    openOrderModal(missionId);
    loadMissionaryDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleMissionaryInvoiceSubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('invoice-photo');
  if (!fileInput || fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('invoice', fileInput.files[0]);

  try {
    await uploadInvoiceApi(missionId, formData);
    showToast('Factura legalizada con éxito.', 'success');
    openOrderModal(missionId);
    loadMissionaryDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleMissionaryDeliverySubmit(e, missionId) {
  e.preventDefault();
  const fileInput = document.getElementById('delivery-photo');
  if (!fileInput || fileInput.files.length === 0) return;

  const formData = new FormData();
  formData.append('delivery', fileInput.files[0]);

  try {
    await verifyDeliveryApi(missionId, formData);
    showToast('¡Entrega del hospital registrada y verificada!', 'success');
    openOrderModal(missionId);
    loadMissionaryDashboard();
    loadDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// CART BUILDER ACTIONS
// ==========================================
function addToHospCart() {
  const prodSelect = document.getElementById('hosp-builder-product-select');
  const qtyInput = document.getElementById('hosp-builder-qty');
  if (!prodSelect || !qtyInput) return;

  const name = prodSelect.value;
  const quantity = parseInt(qtyInput.value);

  if (!name || isNaN(quantity) || quantity <= 0) {
    showToast('Ingrese una cantidad válida.', 'error');
    return;
  }

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

// ==========================================
// BIND GLOBAL TRIGGERS AND NAVIGATION LISTENERS
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

  // Missionary Register/Login tab toggles
  document.querySelectorAll('#missionary-auth-container .auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#missionary-auth-container .auth-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.getAttribute('data-auth-mode');
      document.getElementById('missionary-login-form').classList.toggle('active', mode === 'login');
      document.getElementById('missionary-register-form').classList.toggle('active', mode === 'register');
      if (mode === 'register') {
        initializeCaptcha('missionary-register-form');
      }
    });
  });

  // Missionary type select change
  const mishTypeSelect = document.getElementById('mish-reg-type');
  if (mishTypeSelect) {
    mishTypeSelect.addEventListener('change', (e) => {
      const isStudent = e.target.value === 'student';
      const container = document.getElementById('mish-reg-university-container');
      if (container) {
        container.style.display = isStudent ? 'block' : 'none';
      }
      const univInput = document.getElementById('mish-reg-university');
      if (univInput) {
        univInput.required = isStudent;
      }
    });
  }

  // Provider Register/Login tab toggles
  document.querySelectorAll('#provider-auth-container .auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#provider-auth-container .auth-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.getAttribute('data-auth-mode');
      document.getElementById('provider-login-form').classList.toggle('active', mode === 'login');
      document.getElementById('provider-register-form').classList.toggle('active', mode === 'register');
      if (mode === 'register') {
        initializeCaptcha('provider-register-form');
      }
    });
  });

  // Hospital Register/Request tab toggles
  document.querySelectorAll('#portal-view-hosp .auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#portal-view-hosp .auth-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.getAttribute('data-hosp-mode');
      document.getElementById('hosp-area-request').classList.toggle('active', mode === 'request');
      document.getElementById('hosp-area-register').classList.toggle('active', mode === 'register');
      document.getElementById('hosp-area-request').classList.toggle('hidden', mode !== 'request');
      document.getElementById('hosp-area-register').classList.toggle('hidden', mode !== 'register');
      if (mode === 'register') {
        initializeCaptcha('hospital-register-form');
      }
    });
  });

  // Event submissions
  document.getElementById('missionary-login-form').addEventListener('submit', handleMissionaryLogin);
  document.getElementById('missionary-register-form').addEventListener('submit', handleMissionaryRegister);
  document.getElementById('provider-login-form').addEventListener('submit', handleProviderLogin);
  document.getElementById('provider-register-form').addEventListener('submit', handleProviderRegister);
  document.getElementById('hospital-register-form').addEventListener('submit', handleHospitalRegister);
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
  
  // Hospital Cart Builder
  document.getElementById('hosp-add-item-btn').addEventListener('click', addToHospCart);
  document.getElementById('hospital-mission-form').addEventListener('submit', handleHospitalMissionSubmit);

  // Close Modal
  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('mission-modal').classList.add('hidden');
    if (STATE.chatIntervalId) {
      clearInterval(STATE.chatIntervalId);
      STATE.chatIntervalId = null;
    }
  });

  // Chat/Bot simulator submissions
  document.getElementById('modal-chat-form').addEventListener('submit', handleChatSubmit);
  document.getElementById('agent-chat-form').addEventListener('submit', handleAgentChatSubmit);

  document.querySelectorAll('.quick-commands-deck button').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      const input = document.getElementById('agent-chat-input');
      input.value = cmd;
      input.focus();
    });
  });

  document.getElementById('catalog-search').addEventListener('input', (e) => {
    filterProducts(e.target.value);
  });
}

// Wire functions to the window context for inline onclick triggers in view cards
window.claimMission = claimMission;
window.openOrderModal = openOrderModal;
window.fundMission = fundMission;
window.verifyMissionary = verifyMissionary;
window.verifyProvider = verifyProvider;
window.verifyHospital = verifyHospital;
window.removeCartItem = removeHospCartItem;
window.handleDonorTransferSubmit = handleDonorTransferSubmit;
window.handleMissionaryConfirmReceiptSubmit = handleMissionaryConfirmReceiptSubmit;
window.handleMissionaryInvoiceSubmit = handleMissionaryInvoiceSubmit;
window.handleMissionaryDeliverySubmit = handleMissionaryDeliverySubmit;
