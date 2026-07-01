import { STATE, STATUS_MAP, ALLOWED_PRODUCTS } from './state.js';
import {
  fetchDashboardStats as fetchStatsCall,
  fetchMissions as fetchMissionsCall,
  fetchProducts as fetchProductsCall,
  fetchHospitals as fetchHospitalsCall,
  claimMissionApi,
  fetchPendingMissionaries,
  fetchPendingProviders,
  fetchPendingHospitals,
  verifyMissionaryApi,
  verifyProviderApi,
  verifyHospitalApi,
  fetchMissionDetails,
  submitRatingApi,
  fetchChats
} from './api.js';
import {
  showToast,
  updateUserDisplay,
  switchPortalRole,
  getAuthHeaders
} from './ui.js';

export async function loadDashboardStats() {
  try {
    const data = await fetchStatsCall();
    STATE.dashboardStats = data;
    renderDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export async function loadAllMissions() {
  try {
    const data = await fetchMissionsCall();
    STATE.missions = data;
    renderPublicMissions();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export async function loadProducts() {
  try {
    const data = await fetchProductsCall();
    STATE.products = data;
    renderProducts(data);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export async function loadHospitals() {
  try {
    const data = await fetchHospitalsCall();
    STATE.hospitals = data;
    
    const hospSelect = document.getElementById('hosp-select');
    if (hospSelect) {
      hospSelect.innerHTML = data.map(h => `<option value="${h.id}">${h.name} (${h.location})</option>`).join('');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export function renderHospCart() {
  const container = document.getElementById('hosp-cart-list');
  if (!container) return;
  if (STATE.hospCart.length === 0) {
    container.innerHTML = '<li class="empty-state">El carrito está vacío.</li>';
    return;
  }

  container.innerHTML = STATE.hospCart.map((item, idx) => `
    <li>
      <span>${item.name} x ${item.quantity}</span>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
        <button type="button" class="btn btn-sm btn-outline" style="color:var(--accent-coral);" onclick="window.removeCartItem(${idx})">&times;</button>
      </div>
    </li>
  `).join('');
}

export function renderMissionaryView() {
  const authBox = document.getElementById('missionary-auth-container');
  const dashboard = document.getElementById('missionary-dashboard');
  if (!authBox || !dashboard) return;

  if (STATE.user && STATE.user.role === 'missionary') {
    authBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadMissionaryDashboard();
  } else {
    authBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

export function renderProviderView() {
  const authBox = document.getElementById('provider-auth-container');
  const dashboard = document.getElementById('provider-dashboard');
  if (!authBox || !dashboard) return;

  if (STATE.user && STATE.user.role === 'provider') {
    authBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadProviderDashboard();
  } else {
    authBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

export async function loadProviderDashboard() {
  if (!STATE.user) return;

  document.getElementById('provider-profile-name').textContent = STATE.user.name;
  document.getElementById('provider-profile-kyc-type').textContent = STATE.user.kyc_type;
  document.getElementById('provider-profile-kyc-details').textContent = STATE.user.kyc_details;
  document.getElementById('provider-profile-phone').textContent = STATE.user.phone;

  await loadAllMissions();
  renderProviderMissions();
}

export function renderProviderMissions() {
  const availableList = document.getElementById('provider-available-missions');
  const myMissionsList = document.getElementById('provider-my-missions');
  if (!availableList || !myMissionsList) return;

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

export async function loadMissionaryDashboard() {
  if (!STATE.user) return;

  document.getElementById('missionary-profile-name').textContent = STATE.user.name;
  document.getElementById('missionary-profile-kyc-type').textContent = STATE.user.kyc_type;
  document.getElementById('missionary-profile-kyc-details').textContent = STATE.user.kyc_details;
  document.getElementById('missionary-profile-phone').textContent = STATE.user.phone;
  
  document.getElementById('missionary-profile-type').textContent = STATE.user.type === 'student' ? 'Estudiante' : 'Sociedad Civil';
  const univRow = document.getElementById('missionary-profile-university-row');
  if (STATE.user.type === 'student') {
    univRow.classList.remove('hidden');
    document.getElementById('missionary-profile-university').textContent = STATE.user.university || '-';
  } else {
    univRow.classList.add('hidden');
  }

  await loadAllMissions();
  renderMissionaryMissions();
}

export function renderMissionaryMissions() {
  const availableList = document.getElementById('missionary-available-missions');
  const myMissionsList = document.getElementById('missionary-my-missions');
  if (!availableList || !myMissionsList) return;

  const available = STATE.missions.filter(m => m.status === 'created');
  const mine = STATE.missions.filter(m => m.missionary_id === STATE.user.id);

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
}

export async function claimMission(missionId) {
  const direct_donation = confirm("¿Desea tomar esta misión como Donación Directa (cuenta ya con los insumos y desea omitir la fase de fondeo)?");

  try {
    await claimMissionApi(missionId, direct_donation);

    if (direct_donation) {
      showToast('¡Misión tomada como Donación Directa! Insumos listos para despacho/factura.', 'success');
    } else {
      showToast('¡Misión tomada! Vinculando billetera KYC.', 'success');
    }

    if (STATE.user && STATE.user.role === 'provider') {
      loadProviderDashboard();
    } else {
      loadMissionaryDashboard();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export async function loadDonorMissions() {
  try {
    await loadAllMissions();
    const list = document.getElementById('donor-missions-list');
    if (!list) return;
    
    const pendingFondeo = STATE.missions.filter(m => m.status === 'claimed');

    if (pendingFondeo.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay misiones reclamadas esperando fondeo en este momento.</div>';
      return;
    }

    list.innerHTML = pendingFondeo.map(m => {
      const operator_name = m.missionary_name || m.provider_name;
      const operator_kyc_type = m.missionary_kyc_type || m.provider_kyc_type || 'N/A';
      const operator_kyc_details = m.missionary_kyc_details || m.provider_kyc_details || 'N/A';
      const operator_label = m.missionary_id ? 'Misionero' : 'Proveedor';
      const operator_rating = m.missionary_id ? m.missionary_rating : m.provider_rating;
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
  } catch (e) {}
}

export async function fundMission(missionId, amount) {
  openOrderModal(missionId);
}

export function renderAdminView() {
  const authBox = document.getElementById('admin-auth-container');
  const dashboard = document.getElementById('admin-dashboard');
  if (!authBox || !dashboard) return;

  if (STATE.user && STATE.user.role === 'admin') {
    authBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadAdminDashboard();
  } else {
    authBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

export async function loadAdminDashboard() {
  try {
    const data = await fetchPendingMissionaries();
    STATE.pendingMissionaries = data;
    renderPendingMissionaries();
  } catch (e) {}

  try {
    const data = await fetchPendingProviders();
    STATE.pendingProviders = data;
    renderPendingProviders();
  } catch (e) {}

  try {
    const data = await fetchPendingHospitals();
    STATE.pendingHospitals = data;
    renderPendingHospitals();
  } catch (e) {}

  try {
    await loadAllMissions();
    renderAdminMissionsList();
  } catch (e) {}
}

export function renderPendingMissionaries() {
  const tbody = document.getElementById('admin-pending-missionaries-body');
  if (!tbody) return;
  if (STATE.pendingMissionaries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay misioneros en espera de verificación KYC.</td></tr>';
    return;
  }

  tbody.innerHTML = STATE.pendingMissionaries.map(mish => `
    <tr>
      <td><strong>${mish.name}</strong></td>
      <td>${mish.phone}</td>
      <td>${mish.email}</td>
      <td>${mish.type === 'student' ? `Estudiante (${mish.university})` : 'Sociedad Civil'}</td>
      <td><span class="badge badge-info" style="text-transform:uppercase;">${mish.kyc_type}</span></td>
      <td><code>${mish.kyc_details}</code></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="window.verifyMissionary('${mish.id}')">Verificar KYC</button>
      </td>
    </tr>
  `).join('');
}

export function renderPendingProviders() {
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
}

export function renderPendingHospitals() {
  const tbody = document.getElementById('admin-pending-hospitals-body');
  if (!tbody) return;
  if (!STATE.pendingHospitals || STATE.pendingHospitals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay centros de salud en espera de verificación.</td></tr>';
    return;
  }

  tbody.innerHTML = STATE.pendingHospitals.map(h => `
    <tr>
      <td>
        <strong>${h.name}</strong>
        ${h.image_path ? `<br/><a href="${h.image_path}" target="_blank" style="font-size:0.75rem;color:var(--accent-cyan)">Ver foto de fachada</a>` : ''}
      </td>
      <td>${h.location}</td>
      <td>${h.manager_name}<br/><span style="font-size:0.75rem;color:var(--text-muted);">${h.manager_email}</span></td>
      <td>${h.phone} ${h.is_whatsapp ? '<span class="badge badge-success">WA</span>' : ''}</td>
      <td><code>${h.rif || '-'}</code></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="window.verifyHospital('${h.id}')">Verificar</button>
      </td>
    </tr>
  `).join('');
}

export async function verifyMissionary(id) {
  try {
    const data = await verifyMissionaryApi(id, 'verified');
    showToast(`KYC del misionero ${data.name} verificado.`, 'success');
    loadAdminDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export async function verifyProvider(id) {
  try {
    const data = await verifyProviderApi(id, 'verified');
    showToast(`KYC del proveedor ${data.name} verificado.`, 'success');
    loadAdminDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export async function verifyHospital(id) {
  try {
    const data = await verifyHospitalApi(id, 'verified');
    showToast(`Centro de salud/Hospital ${data.name} verificado con éxito.`, 'success');
    loadAdminDashboard();
    await loadHospitals();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export function renderAdminMissionsList() {
  const container = document.getElementById('admin-missions-list');
  if (!container) return;
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
            <span>Operador: ${m.missionary_name || m.provider_name || 'Sin asignar'}</span>
            ${m.missionary_kyc_details || m.provider_kyc_details ? `<span>KYC: <code>${m.missionary_kyc_details || m.provider_kyc_details}</code></span>` : ''}
            <span>Fecha: ${new Date(m.createdAt).toLocaleDateString('es-VE')}</span>
            <span class="badge ${status.badgeClass}">${status.label}</span>
          </div>
        </div>
        <div class="order-card-amount">$${Number(m.total_amount).toFixed(2)}</div>
      </div>
    `;
  }).join('');
}

export function renderDashboard() {
  if (!STATE.dashboardStats) return;
  const stats = STATE.dashboardStats;

  document.getElementById('stat-donations').textContent = `$${stats.donationTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('stat-transit').textContent = `$${stats.transitTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('stat-legalised').textContent = `$${stats.legalisedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const gallery = document.getElementById('impact-gallery');
  if (!gallery) return;
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

export function renderPublicMissions() {
  const list = document.getElementById('public-missions-list');
  if (!list) return;
  if (STATE.missions.length === 0) {
    list.innerHTML = '<div class="empty-state">No hay misiones activas en este momento.</div>';
    return;
  }

  list.innerHTML = STATE.missions.map(m => {
    const status = STATUS_MAP[m.status] || { label: m.status, badgeClass: 'badge-info' };
    const operator_name = m.missionary_name || m.provider_name || 'Buscando operador';
    const operator_rating = m.missionary_id ? m.missionary_rating : m.provider_rating;
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

export function renderProducts(products) {
  const container = document.getElementById('catalog-products-container');
  if (!container) return;
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

export function filterProducts(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderProducts(STATE.products);
    return;
  }
  renderProducts(STATE.products.filter(p => p.name.toLowerCase().includes(q)));
}

export async function openOrderModal(missionId) {
  try {
    const mission = await fetchMissionDetails(missionId);
    STATE.activeOrderDetails = mission;

    document.getElementById('modal-mission-title').textContent = `Misión: ${mission.id}`;
    document.getElementById('modal-hospital-name').textContent = mission.hospital_name;
    document.getElementById('modal-hospital-stars').textContent = mission.hospital_rating ? `⭐ ${mission.hospital_rating.toFixed(1)}` : '⭐ 5.0';
    document.getElementById('modal-missionary-name').textContent = mission.missionary_name || 'Sin asignar';
    document.getElementById('modal-missionary-stars').textContent = mission.missionary_name && mission.missionary_rating ? `⭐ ${mission.missionary_rating.toFixed(1)}` : '';
    document.getElementById('modal-provider-name').textContent = mission.provider_name || 'Sin asignar';
    document.getElementById('modal-provider-stars').textContent = mission.provider_name && mission.provider_rating ? `⭐ ${mission.provider_rating.toFixed(1)}` : '';
    document.getElementById('modal-kyc-type').textContent = (mission.missionary_kyc_type || mission.provider_kyc_type || 'N/A').toUpperCase();
    document.getElementById('modal-kyc-details').textContent = mission.missionary_kyc_details || mission.provider_kyc_details || 'N/A';
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

export function renderModalActions(mission) {
  const container = document.getElementById('modal-actions-area');
  const role = STATE.user ? STATE.user.role : 'guest';

  container.innerHTML = '';

  const isOperator = (role === 'missionary' && mission.missionary_id === STATE.user.id) || (role === 'provider' && mission.provider_id === STATE.user.id);

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
        <form id="receipt-confirm-submit-form" onsubmit="window.handleMissionaryConfirmReceiptSubmit(event, '${mission.id}')" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="receipt-confirm-photo" accept="image/*" required>
          <button type="submit" class="btn btn-primary btn-sm">Confirmar Fondos Recibidos</button>
        </form>
      `;
    } else if (mission.status === 'funded') {
      container.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-cyan)">Legalizar Compra / Despacho</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">Fondos disponibles en Mérida. Adquiera/Despache los insumos y cargue la factura comercial:</p>
        <form id="invoice-submit-form" onsubmit="window.handleMissionaryInvoiceSubmit(event, '${mission.id}')" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="invoice-photo" accept="image/*" required>
          <button type="submit" class="btn btn-success btn-sm">Cargar Factura</button>
        </form>
      `;
    } else if (mission.status === 'purchased') {
      container.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-emerald)">Completar Despacho en Hospital</h4>
        <p style="font-size:0.85rem;color:var(--text-muted)">Haga la entrega física en el centro de salud y suba la foto de entrega firmada:</p>
        <form id="delivery-submit-form" onsubmit="window.handleMissionaryDeliverySubmit(event, '${mission.id}')" style="display:flex;flex-direction:column;gap:0.75rem;">
          <input type="file" id="delivery-photo" accept="image/*" required>
          <button type="submit" class="btn btn-primary btn-sm">Completar Entrega</button>
        </form>
      `;
    } else {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);">Misión en estado: <strong>${mission.status.toUpperCase()}</strong>. Esperando fondeo de donadores.</div>`;
    }
  } else if (role === 'admin') {
    container.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);">Auditoría Administrativa. Misión en estado: <strong>${mission.status.toUpperCase()}</strong>.</div>`;
  } else {
    if (mission.status === 'created') {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--accent-amber);">Esperando que un misionero o proveedor verificado KYC asuma esta misión.</div>`;
    } else if (mission.status === 'claimed') {
      const operator_kyc_type = mission.missionary_kyc_type || mission.provider_kyc_type;
      const operator_kyc_details = mission.missionary_kyc_details || mission.provider_kyc_details;
      const operator_name = mission.missionary_name || mission.provider_name;
      container.innerHTML = `
        <h4 style="font-size:0.8rem;text-transform:uppercase;color:var(--accent-amber);">Fondeo Humanitario Directo</h4>
        <p style="font-size:0.85rem;color:var(--text-muted);">Transfiera <strong>$${Number(mission.total_amount).toFixed(2)}</strong> a la cuenta del operador (${operator_name}):</p>
        <div style="background-color:rgba(0,0,0,0.2);padding:0.5rem;border-radius:6px;font-size:0.85rem;margin-bottom:0.5rem;">
          <div>Billetera: <strong style="text-transform:uppercase;">${operator_kyc_type}</strong></div>
          <div>Cuenta: <code>${operator_kyc_details}</code></div>
        </div>
        <form id="donor-transfer-form" onsubmit="window.handleDonorTransferSubmit(event, '${mission.id}')" style="display:flex;flex-direction:column;gap:0.75rem;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.75rem;">Su Nombre / Organización</label>
            <input type="text" id="donor-modal-name" placeholder="Ej: Donante Miami" required>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.75rem;">Su Correo Electrónico</label>
            <input type="email" id="donor-modal-email" placeholder="ejemplo@donante.com" required>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.75rem;">Su Teléfono Móvil</label>
            <input type="text" id="donor-modal-phone" placeholder="Ej: +13059999999" required>
          </div>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <input type="checkbox" id="donor-modal-anonymous" style="width:auto;cursor:pointer;">
            <label for="donor-modal-anonymous" style="margin:0;font-size:0.75rem;color:var(--accent-cyan);cursor:pointer;user-select:none;">Donar de forma anónima (ocultar nombre al público)</label>
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:0.75rem;">Comprobante de Transferencia (Capture)</label>
            <input type="file" id="donor-proof-photo" accept="image/*" required>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Marcar Fondos Enviados</button>
        </form>
      `;
    } else if (mission.status === 'funding_sent') {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--accent-amber);font-style:italic;">✓ Comprobante enviado por el donador. Esperando confirmación de recepción de fondos del operador.</div>`;
    } else {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--accent-emerald);font-style:italic;">✓ Misión financiada y en proceso de logística de campo.</div>`;
    }
  }
}

export async function submitRating(mission) {
  const stars = document.getElementById('rating-stars').value;
  const comment = document.getElementById('rating-comment').value;

  let reviewee_role = 'missionary';
  let reviewee_id = mission.missionary_id || mission.provider_id;
  if (mission.missionary_id) {
    reviewee_role = 'missionary';
  } else if (mission.provider_id) {
    reviewee_role = 'provider';
  }

  const role = STATE.user ? STATE.user.role : 'guest';
  if (role === 'missionary' || role === 'provider') {
    reviewee_role = 'donor';
    reviewee_id = 'donor-seed';
  }

  try {
    await submitRatingApi(mission.id, { stars, comment, reviewee_id, reviewee_role });
    showToast('¡Gracias por tu valoración!', 'success');
    openOrderModal(mission.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export async function pollChat(missionId) {
  try {
    const chats = await fetchChats(missionId);
    if (!STATE.activeOrderDetails || STATE.activeOrderDetails.chats.length !== chats.length) {
      STATE.activeOrderDetails.chats = chats;
      renderChatMessages(chats);
    }
  } catch (e) {}
}

export function renderChatMessages(chats) {
  const container = document.getElementById('modal-chat-messages');
  if (!container) return;
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
