// Client State Management
export const STATE = {
  currentTab: 'tab-public',
  currentPortalRole: 'hosp',
  user: JSON.parse(localStorage.getItem('cumis_user')) || null,
  products: [],
  hospitals: [],
  dashboardStats: null,
  missions: [],
  pendingMissionaries: [],
  hospCart: [],
  activeOrderDetails: null,
  chatIntervalId: null
};

// Restricted 29 Catalog Products (Client Reference)
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

// Status maps
export const STATUS_MAP = {
  'created': { label: 'Disponible', badgeClass: 'badge-pending' },
  'claimed': { label: 'Tomada', badgeClass: 'badge-info' },
  'funding_sent': { label: 'Comprobante Enviado', badgeClass: 'badge-pending' },
  'funded': { label: 'Fondos Disponibles', badgeClass: 'badge-success' },
  'purchased': { label: 'Comprado', badgeClass: 'badge-info' },
  'completed': { label: 'Misión Completada', badgeClass: 'badge-success' }
};
