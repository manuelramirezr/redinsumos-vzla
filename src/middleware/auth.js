import { findRecord, findRecords } from '../db/database.js';

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'manu2026';

// Restricted catalog of 29 items
export const ALLOWED_PRODUCTS = [
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

// Helper to authenticate Admin
export function isAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === ADMIN_PASSCODE;
}

// Helper to authenticate Missionary
export async function getAuthenticatedMissionary(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (token === ADMIN_PASSCODE) return null;
  
  // Find verified missionary by ID
  const missionary = await findRecord('missionaries', { id: token });
  if (missionary && missionary.status === 'verified') {
    return missionary;
  }
  return null;
}

// Helper to authenticate Provider
export async function getAuthenticatedProvider(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (token === ADMIN_PASSCODE) return null;
  
  const provider = await findRecord('providers', { id: token });
  if (provider && provider.status === 'verified') {
    return provider;
  }
  return null;
}

// Helper to authenticate either Missionary or Provider
export async function getAuthenticatedOperator(req) {
  const missionary = await getAuthenticatedMissionary(req);
  if (missionary) return { type: 'missionary', user: missionary };
  
  const provider = await getAuthenticatedProvider(req);
  if (provider) return { type: 'provider', user: provider };
  
  return null;
}

// Utility to calculate average rating stars for any entity
export async function getAverageRating(revieweeId) {
  const ratings = await findRecords('ratings', { reviewee_id: revieweeId });
  if (ratings.length === 0) return 5.0; // default to 5.0 stars
  const sum = ratings.reduce((acc, r) => acc + Number(r.stars), 0);
  return Number((sum / ratings.length).toFixed(2));
}
