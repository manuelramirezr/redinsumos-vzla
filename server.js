import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import {
  readTable,
  writeTable,
  insertRecord,
  updateRecord,
  findRecord,
  findRecords,
  seedDatabase
} from './src/db/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'manu2026';

app.use(express.json());
app.use(express.static('public'));

// Ensure uploads dir exists
try {
  await fs.mkdir('./public/uploads', { recursive: true });
} catch (e) {}

// Multer configurations
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, './public/uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Restricted catalog of 29 items
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

// Helper to authenticate Admin
function isAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === ADMIN_PASSCODE;
}

// Helper to authenticate Operator
async function getAuthenticatedOperator(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (token === ADMIN_PASSCODE) return null;
  
  // Find verified operator by ID
  const operator = await findRecord('operators', { id: token });
  if (operator && operator.status === 'verified') {
    return operator;
  }
  return null;
}

// ==========================================
// 1. PUBLIC DASHBOARD STATS
// ==========================================
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const donations = await readTable('donations');
    const orders = await readTable('orders');
    const evidences = await readTable('evidences');

    const donationTotal = donations.reduce((sum, d) => sum + Number(d.amount), 0);
    
    // Funds in Transit: total amount of orders with status 'funds_sent' (disbursed, but no invoice uploaded yet)
    const transitTotal = orders
      .filter(o => o.status === 'funds_sent')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    // Legalised Expenses: total amount of orders with status 'received' or 'completed' (invoice uploaded)
    const legalisedTotal = orders
      .filter(o => o.status === 'received' || o.status === 'completed')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    // Completed missions for the Impact Gallery
    const completedMissions = [];
    const completedOrReceivedOrders = orders.filter(o => o.status === 'received' || o.status === 'completed');
    
    for (const order of completedOrReceivedOrders) {
      const evidence = await findRecord('evidences', { order_id: order.id });
      const operator = await findRecord('operators', { id: order.operator_id });
      if (evidence) {
        completedMissions.push({
          order_id: order.id,
          supplier_name: order.supplier_name,
          total_amount: order.total_amount,
          operator_name: operator ? operator.name : 'Operador de Campo',
          invoice_photo: evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
          delivery_photo: evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
          completedAt: evidence.uploaded_at || order.createdAt
        });
      }
    }

    res.json({
      donationTotal,
      transitTotal,
      legalisedTotal,
      donations: donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      completedMissions: completedMissions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. PRODUCT CATALOGUE
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    const products = await readTable('products');
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, supplier_name, price, stock } = req.body;
    
    if (!name || !supplier_name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    if (!ALLOWED_PRODUCTS.includes(name)) {
      return res.status(400).json({ error: `El producto '${name}' no pertenece al catálogo restringido oficial de 29 insumos.` });
    }

    // Check if product by same supplier and name already exists
    const existing = await findRecord('products', { name, supplier_name });
    if (existing) {
      const updated = await updateRecord('products', existing.id, { price: Number(price), stock: Number(stock) });
      return res.json(updated);
    }

    const newProd = await insertRecord('products', {
      name,
      supplier_name,
      price: Number(price),
      stock: Number(stock)
    });
    res.status(201).json(newProd);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. OPERATOR MANAGEMENT & AUTH
// ==========================================
app.post('/api/operators/register', async (req, res) => {
  try {
    const { name, phone, zelle_email, password } = req.body;
    
    if (!name || !phone || !zelle_email || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    // Check if operator phone already exists
    const existing = await findRecord('operators', { phone });
    if (existing) {
      return res.status(400).json({ error: 'Este número de teléfono ya está registrado.' });
    }

    const operator = await insertRecord('operators', {
      name,
      phone,
      zelle_email,
      password, // In production, hash this password
      status: 'pending' // Default starts as pending admin verification
    });

    res.status(201).json({
      id: operator.id,
      name: operator.name,
      phone: operator.phone,
      zelle_email: operator.zelle_email,
      status: operator.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/operators/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: 'Por favor, ingrese teléfono y contraseña.' });
    }

    // Handle Admin login via passkey
    if (phone === 'admin' && password === ADMIN_PASSCODE) {
      return res.json({
        role: 'admin',
        token: ADMIN_PASSCODE,
        name: 'Administrador Manu'
      });
    }

    const operator = await findRecord('operators', { phone, password });
    if (!operator) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (operator.status !== 'verified') {
      return res.status(403).json({
        error: 'Su cuenta está en espera de verificación por el Administrador.',
        status: 'pending'
      });
    }

    res.json({
      role: 'operator',
      token: operator.id,
      id: operator.id,
      name: operator.name,
      phone: operator.phone,
      zelle_email: operator.zelle_email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/operators/pending', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }
    const pending = await findRecords('operators', { status: 'pending' });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/operators/verify', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }
    const { id, status } = req.body; // status is 'verified' or 'rejected'
    if (!id || !status) {
      return res.status(400).json({ error: 'Falta ID de operador o estado.' });
    }

    const operator = await updateRecord('operators', id, { status });
    res.json({ id: operator.id, name: operator.name, status: operator.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. MISSIONS / ORDERS FLOW
// ==========================================
app.get('/api/orders', async (req, res) => {
  try {
    const adminMode = isAdmin(req);
    const operator = await getAuthenticatedOperator(req);

    if (!adminMode && !operator) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    let orders = [];
    if (adminMode) {
      orders = await readTable('orders');
    } else {
      orders = await findRecords('orders', { operator_id: operator.id });
    }

    // Attach operator info, disbursement info
    const enrichedOrders = [];
    for (const o of orders) {
      const op = await findRecord('operators', { id: o.operator_id });
      const disb = await findRecord('disbursements', { order_id: o.id });
      const evidence = await findRecord('evidences', { order_id: o.id });
      
      enrichedOrders.push({
        ...o,
        operator_name: op ? op.name : 'Desconocido',
        operator_phone: op ? op.phone : 'Desconocido',
        operator_zelle: op ? op.zelle_email : 'Desconocido',
        disbursement: disb || null,
        evidence: evidence ? {
          invoice_photo: evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
          delivery_photo: evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
          uploaded_at: evidence.uploaded_at
        } : null
      });
    }

    res.json(enrichedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const adminMode = isAdmin(req);
    const operator = await getAuthenticatedOperator(req);

    if (!adminMode && !operator) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    const order = await findRecord('orders', { id: req.params.id });
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }

    if (!adminMode && order.operator_id !== operator.id) {
      return res.status(403).json({ error: 'No tiene acceso a esta orden.' });
    }

    const op = await findRecord('operators', { id: order.operator_id });
    const items = await findRecords('order_items', { order_id: order.id });
    const disbursement = await findRecord('disbursements', { order_id: order.id });
    const evidence = await findRecord('evidences', { order_id: order.id });
    const chats = await findRecords('chats', { order_id: order.id });

    res.json({
      ...order,
      operator: op ? { name: op.name, phone: op.phone, zelle_email: op.zelle_email } : null,
      items,
      disbursement,
      evidence: evidence ? {
        invoice_photo: evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
        delivery_photo: evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
        uploaded_at: evidence.uploaded_at
      } : null,
      chats: chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Operator creates order (accepts mission) and requests Zelle funds
app.post('/api/orders', async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere operador verificado.' });
    }

    const { supplier_name, items } = req.body;
    if (!supplier_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos de orden incompletos.' });
    }

    // Validate products match official catalog
    for (const item of items) {
      if (!ALLOWED_PRODUCTS.includes(item.name)) {
        return res.status(400).json({ error: `El producto '${item.name}' no está en la lista permitida.` });
      }
    }

    // Compute total
    const total_amount = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    // Create Order
    const order = await insertRecord('orders', {
      operator_id: operator.id,
      supplier_name,
      total_amount,
      status: 'pending_funds'
    });

    // Create Items
    for (const item of items) {
      await insertRecord('order_items', {
        order_id: order.id,
        product_name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.price)
      });
    }

    // Create Disbursement request
    await insertRecord('disbursements', {
      order_id: order.id,
      operator_id: operator.id,
      amount: total_amount,
      status: 'requested',
      receipt_path: null
    });

    // Create initial system chat logs
    await insertRecord('chats', {
      order_id: order.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `Misión de compra creada por ${operator.name} por un total de $${total_amount.toFixed(2)}. Solicitando adelanto de fondos Zelle.`,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin marks funds as sent (optionally uploading bank receipt capture)
app.post('/api/orders/:id/disburse', upload.single('receipt'), async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }

    const order = await findRecord('orders', { id: req.params.id });
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }

    if (order.status !== 'pending_funds') {
      return res.status(400).json({ error: 'La orden no está en espera de fondos.' });
    }

    const disbursement = await findRecord('disbursements', { order_id: order.id });
    if (!disbursement) {
      return res.status(404).json({ error: 'Registro de desembolso no encontrado.' });
    }

    // Update disbursement
    await updateRecord('disbursements', disbursement.id, {
      status: 'sent',
      receipt_path: req.file ? req.file.path : null
    });

    // Update order status
    await updateRecord('orders', order.id, {
      status: 'funds_sent'
    });

    // Add chat message
    await insertRecord('chats', {
      order_id: order.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `Fondos Zelle enviados manualmente por el Administrador. Estado de la orden: [Fondos Enviados].`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Fondos marcados como enviados.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Operator uploads invoice photo
app.post('/api/orders/:id/invoice', upload.single('invoice'), async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere operador verificado.' });
    }

    const order = await findRecord('orders', { id: req.params.id });
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }

    if (order.operator_id !== operator.id) {
      return res.status(403).json({ error: 'No tiene permisos para modificar esta orden.' });
    }

    if (order.status !== 'funds_sent') {
      return res.status(400).json({ error: 'La orden debe tener estado [Fondos Enviados] para subir factura.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta foto de la factura comercial.' });
    }

    // Update/create evidence record
    const evidence = await findRecord('evidences', { order_id: order.id });
    if (evidence) {
      await updateRecord('evidences', evidence.id, {
        invoice_photo_path: req.file.path,
        uploaded_at: new Date().toISOString()
      });
    } else {
      await insertRecord('evidences', {
        order_id: order.id,
        invoice_photo_path: req.file.path,
        delivery_photo_path: null,
        uploaded_at: new Date().toISOString()
      });
    }

    // Update order status
    await updateRecord('orders', order.id, {
      status: 'received'
    });

    // Add chat message
    await insertRecord('chats', {
      order_id: order.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `${operator.name} ha cargado la foto de la factura del proveedor. Mercancía recibida.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Factura cargada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Operator uploads delivery photo (completing order)
app.post('/api/orders/:id/deliver', upload.single('delivery'), async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    const order = await findRecord('orders', { id: req.params.id });
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }

    if (order.operator_id !== operator.id) {
      return res.status(403).json({ error: 'No tiene permisos para modificar esta orden.' });
    }

    if (order.status !== 'received') {
      return res.status(400).json({ error: 'Debe cargar primero la factura para marcar como entregado.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta foto de entrega final.' });
    }

    // Update evidence record
    const evidence = await findRecord('evidences', { order_id: order.id });
    if (!evidence) {
      return res.status(400).json({ error: 'No se encontró la factura previa de esta orden.' });
    }

    await updateRecord('evidences', evidence.id, {
      delivery_photo_path: req.file.path,
      uploaded_at: new Date().toISOString()
    });

    // Update order status
    await updateRecord('orders', order.id, {
      status: 'completed'
    });

    // Add chat message
    await insertRecord('chats', {
      order_id: order.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `${operator.name} ha cargado la foto de entrega. Misión completada con éxito.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Foto de entrega cargada. Orden completada.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. CHAT MESSAGING
// ==========================================
app.get('/api/orders/:id/chats', async (req, res) => {
  try {
    const adminMode = isAdmin(req);
    const operator = await getAuthenticatedOperator(req);

    if (!adminMode && !operator) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    const chats = await findRecords('chats', { order_id: req.params.id });
    res.json(chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:id/chats', async (req, res) => {
  try {
    const adminMode = isAdmin(req);
    const operator = await getAuthenticatedOperator(req);

    if (!adminMode && !operator) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Mensaje vacío.' });
    }

    let sender_role = '';
    let sender_name = '';

    if (adminMode) {
      sender_role = 'admin';
      sender_name = 'Manu (Administrador)';
    } else {
      sender_role = 'operator';
      sender_name = operator.name;
    }

    const chatMsg = await insertRecord('chats', {
      order_id: req.params.id,
      sender_role,
      sender_name,
      message,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(chatMsg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. DONATIONS LOGGER
// ==========================================
app.post('/api/donations', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }

    const { amount, donor_name, date } = req.body;
    if (!amount || !donor_name) {
      return res.status(400).json({ error: 'Falta monto o nombre de donante.' });
    }

    const donation = await insertRecord('donations', {
      amount: Number(amount),
      donor_name,
      date: date || new Date().toISOString().split('T')[0]
    });

    res.status(201).json(donation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed database on startup and run server
seedDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`CUMIS Conecta server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
