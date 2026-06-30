import { STATE } from './state.js';

export function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (STATE.user && STATE.user.token) {
    headers['Authorization'] = `Bearer ${STATE.user.token}`;
  }
  return headers;
}

export async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard-stats');
  if (!res.ok) throw new Error('Error al cargar métricas.');
  return res.json();
}

export async function fetchMissions() {
  const res = await fetch('/api/missions', {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Error al cargar misiones.');
  return res.json();
}

export async function fetchProducts() {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Error al cargar catálogo de productos.');
  return res.json();
}

export async function fetchHospitals() {
  const res = await fetch('/api/hospitals');
  if (!res.ok) throw new Error('Error al cargar centros de salud.');
  return res.json();
}

export async function createMissionApi(hospital_id, items) {
  const res = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hospital_id, items })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrar misión.');
  return data;
}

export async function loginOperatorApi(phone, password, type) {
  const url = type === 'missionary' ? '/api/missionaries/login' : '/api/providers/login';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Autenticación fallida.');
  return data;
}

export async function registerMissionaryApi(payload) {
  const res = await fetch('/api/missionaries/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrar misionero.');
  return data;
}

export async function registerProviderApi(payload) {
  const res = await fetch('/api/providers/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrar proveedor.');
  return data;
}

export async function claimMissionApi(missionId, direct_donation) {
  const res = await fetch(`/api/missions/${missionId}/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ direct_donation })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al tomar la misión.');
  return data;
}

export async function fetchPendingMissionaries() {
  const res = await fetch('/api/missionaries/pending', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('No autorizado.');
  return res.json();
}

export async function fetchPendingProviders() {
  const res = await fetch('/api/providers/pending', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('No autorizado.');
  return res.json();
}

export async function fetchPendingHospitals() {
  const res = await fetch('/api/hospitals/pending', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('No autorizado.');
  return res.json();
}

export async function verifyMissionaryApi(id, status) {
  const res = await fetch('/api/missionaries/verify', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al verificar.');
  return data;
}

export async function verifyProviderApi(id, status) {
  const res = await fetch('/api/providers/verify', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al verificar.');
  return data;
}

export async function verifyHospitalApi(id, status) {
  const res = await fetch('/api/hospitals/verify', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al verificar.');
  return data;
}

export async function fetchMissionDetails(missionId) {
  const res = await fetch(`/api/missions/${missionId}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al cargar detalles de la misión.');
  return res.json();
}

export async function submitRatingApi(missionId, payload) {
  const res = await fetch(`/api/missions/${missionId}/ratings`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al enviar valoración.');
  return data;
}

export async function fundMissionApi(missionId, formData) {
  const res = await fetch(`/api/missions/${missionId}/fund`, {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al procesar donación.');
  return data;
}

export async function confirmReceiptApi(missionId, formData) {
  const res = await fetch(`/api/missions/${missionId}/confirm-receipt`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${STATE.user.token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al confirmar recepción.');
  return data;
}

export async function uploadInvoiceApi(missionId, formData) {
  const res = await fetch(`/api/missions/${missionId}/invoice`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${STATE.user.token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al subir factura.');
  return data;
}

export async function verifyDeliveryApi(missionId, formData) {
  const res = await fetch(`/api/missions/${missionId}/verify-delivery`, {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al verificar entrega.');
  return data;
}

export async function fetchChats(missionId) {
  const res = await fetch(`/api/missions/${missionId}/chats`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al cargar chat.');
  return res.json();
}

export async function sendChatMessage(missionId, message) {
  const res = await fetch(`/api/missions/${missionId}/chats`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al enviar mensaje.');
  return data;
}

export async function sendBotMessage(platform, sender_phone, message) {
  const res = await fetch('/api/webhooks/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, sender_phone, message })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en comunicación con Bot.');
  return data;
}

export async function registerHospitalApi(payload) {
  const res = await fetch('/api/hospitals/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrar hospital.');
  return data;
}
