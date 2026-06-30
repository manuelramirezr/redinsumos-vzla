import { STATE } from './state.js';
import {
  loadDashboardStats,
  loadProducts,
  renderAdminView,
  renderMissionaryView,
  renderProviderView,
  loadDonorMissions
} from './views.js';

export function showToast(message, type = 'info') {
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

const captchaAnswers = {};

export function initializeCaptcha(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  captchaAnswers[formId] = num1 + num2;
  
  const label = form.querySelector('.captcha-label');
  if (label) {
    label.textContent = `Verificación humana: ¿Cuánto es ${num1} + ${num2}?`;
  }
  const input = form.querySelector('.captcha-input');
  if (input) {
    input.value = '';
  }
}

export function validateCaptcha(formId) {
  const form = document.getElementById(formId);
  if (!form) return false;
  const input = form.querySelector('.captcha-input');
  if (!input) return false;
  const answer = parseInt(input.value.trim());
  return answer === captchaAnswers[formId];
}

export function switchTab(tabId) {
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

export function switchPortalRole(role) {
  STATE.currentPortalRole = role;
  
  document.getElementById('portal-view-hosp').classList.toggle('active', role === 'hosp');
  document.getElementById('portal-view-mish').classList.toggle('active', role === 'mish');
  document.getElementById('portal-view-prov').classList.toggle('active', role === 'prov');
  document.getElementById('portal-view-donor').classList.toggle('active', role === 'donor');

  if (role === 'mish') {
    renderMissionaryView();
  } else if (role === 'prov') {
    renderProviderView();
  } else if (role === 'donor') {
    loadDonorMissions();
  }
}

export function updateUserDisplay() {
  const display = document.getElementById('user-display');
  const logoutBtn = document.getElementById('logout-btn');

  if (STATE.user) {
    let roleLabel = 'Usuario';
    if (STATE.user.role === 'admin') roleLabel = '🔑 Admin';
    if (STATE.user.role === 'missionary') roleLabel = '🎓 Misionero';
    if (STATE.user.role === 'provider') roleLabel = '🏭 Proveedor';
    
    display.textContent = `${roleLabel}: ${STATE.user.name}`;
    logoutBtn.classList.remove('hidden');
  } else {
    display.textContent = 'Invitado';
    logoutBtn.classList.add('hidden');
  }
}
