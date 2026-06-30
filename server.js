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

// Helper to authenticate Student
async function getAuthenticatedStudent(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (token === ADMIN_PASSCODE) return null;
  
  // Find verified student by ID
  const student = await findRecord('students', { id: token });
  if (student && student.status === 'verified') {
    return student;
  }
  return null;
}

// Helper to authenticate Provider
async function getAuthenticatedProvider(req) {
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

// Helper to authenticate either Student or Provider
async function getAuthenticatedOperator(req) {
  const student = await getAuthenticatedStudent(req);
  if (student) return { type: 'student', user: student };
  
  const provider = await getAuthenticatedProvider(req);
  if (provider) return { type: 'provider', user: provider };
  
  return null;
}

// Utility to calculate average rating stars for any entity
async function getAverageRating(revieweeId) {
  const ratings = await findRecords('ratings', { reviewee_id: revieweeId });
  if (ratings.length === 0) return 5.0; // default to 5.0 stars
  const sum = ratings.reduce((acc, r) => acc + Number(r.stars), 0);
  return Number((sum / ratings.length).toFixed(2));
}

// ==========================================
// 1. PUBLIC DASHBOARD STATS
// ==========================================
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const missions = await readTable('missions');
    const evidences = await readTable('evidences');

    // Donation Total: sum of funded, purchased, completed, or funding_sent missions
    const donationTotal = missions
      .filter(m => ['funding_sent', 'funded', 'purchased', 'completed'].includes(m.status))
      .reduce((sum, m) => sum + Number(m.total_amount), 0);
    
    // Funds in Transit: total amount of funding_sent, funded, or purchased missions
    const transitTotal = missions
      .filter(m => ['funding_sent', 'funded', 'purchased'].includes(m.status))
      .reduce((sum, m) => sum + Number(m.total_amount), 0);

    // Legalised Expenses: completed missions
    const legalisedTotal = missions
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + Number(m.total_amount), 0);

    // Enriched list for Impact Gallery
    const completedMissions = [];
    const completedOrders = missions.filter(m => m.status === 'completed');
    
    for (const mission of completedOrders) {
      const evidence = await findRecord('evidences', { mission_id: mission.id });
      completedMissions.push({
        order_id: mission.id,
        supplier_name: mission.hospital_name,
        total_amount: mission.total_amount,
        operator_name: mission.student_name || mission.provider_name || 'Operador CUMIS',
        invoice_photo: evidence && evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
        delivery_photo: evidence && evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
        completedAt: (evidence && evidence.uploaded_at) || mission.updatedAt || mission.createdAt
      });
    }

    res.json({
      donationTotal,
      transitTotal,
      legalisedTotal,
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

// ==========================================
// 3. HOSPITALS ENDPOINTS
// ==========================================
app.get('/api/hospitals', async (req, res) => {
  try {
    const hospitals = await readTable('hospitals');
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. STUDENT MANAGEMENT & AUTH
// ==========================================
app.post('/api/students/register', async (req, res) => {
  try {
    const { name, phone, email, kyc_type, kyc_details, password } = req.body;
    
    if (!name || !phone || !email || !kyc_type || !kyc_details || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    if (!['zelle', 'meru'].includes(kyc_type)) {
      return res.status(400).json({ error: 'Método KYC inválido. Elija Zelle o Meru.' });
    }

    const existing = await findRecord('students', { phone });
    if (existing) {
      return res.status(400).json({ error: 'Este número de teléfono ya está registrado.' });
    }

    const student = await insertRecord('students', {
      name,
      phone,
      email,
      kyc_type,
      kyc_details,
      password,
      status: 'pending' // pending manual admin verification
    });

    res.status(201).json({
      id: student.id,
      name: student.name,
      phone: student.phone,
      kyc_type: student.kyc_type,
      kyc_details: student.kyc_details,
      status: student.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: 'Por favor, ingrese teléfono y contraseña.' });
    }

    // Admin login override
    if (phone === 'admin' && password === ADMIN_PASSCODE) {
      return res.json({
        role: 'admin',
        token: ADMIN_PASSCODE,
        name: 'Administrador Manu'
      });
    }

    const student = await findRecord('students', { phone, password });
    if (!student) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (student.status !== 'verified') {
      return res.status(403).json({
        error: 'Su cuenta de estudiante está en espera de verificación KYC por el Administrador.',
        status: 'pending'
      });
    }

    res.json({
      role: 'student',
      token: student.id,
      id: student.id,
      name: student.name,
      phone: student.phone,
      kyc_type: student.kyc_type,
      kyc_details: student.kyc_details
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/pending', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }
    const pending = await findRecords('students', { status: 'pending' });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students/verify', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const { id, status } = req.body; // status is 'verified'
    if (!id || !status) {
      return res.status(400).json({ error: 'Falta ID de estudiante o estado.' });
    }

    const student = await updateRecord('students', id, { status });
    res.json({ id: student.id, name: student.name, status: student.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4.5 PROVIDER MANAGEMENT & AUTH
// ==========================================
app.post('/api/providers/register', async (req, res) => {
  try {
    const { name, phone, email, kyc_type, kyc_details, password } = req.body;
    
    if (!name || !phone || !email || !kyc_type || !kyc_details || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    if (!['zelle', 'meru'].includes(kyc_type)) {
      return res.status(400).json({ error: 'Método KYC inválido. Elija Zelle o Meru.' });
    }

    const existing = await findRecord('providers', { phone });
    if (existing) {
      return res.status(400).json({ error: 'Este número de teléfono ya está registrado como proveedor.' });
    }

    const provider = await insertRecord('providers', {
      name,
      phone,
      email,
      kyc_type,
      kyc_details,
      password,
      status: 'pending' // pending manual admin verification
    });

    res.status(201).json({
      id: provider.id,
      name: provider.name,
      phone: provider.phone,
      kyc_type: provider.kyc_type,
      kyc_details: provider.kyc_details,
      status: provider.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/providers/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: 'Por favor, ingrese teléfono y contraseña.' });
    }

    const provider = await findRecord('providers', { phone, password });
    if (!provider) {
      return res.status(401).json({ error: 'Credenciales inválidas para proveedor.' });
    }

    if (provider.status !== 'verified') {
      return res.status(403).json({
        error: 'Su cuenta de proveedor está en espera de verificación KYC por el Administrador.',
        status: 'pending'
      });
    }

    res.json({
      role: 'provider',
      token: provider.id,
      id: provider.id,
      name: provider.name,
      phone: provider.phone,
      kyc_type: provider.kyc_type,
      kyc_details: provider.kyc_details
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/providers/pending', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }
    const pending = await findRecords('providers', { status: 'pending' });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/providers/verify', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Falta ID de proveedor o estado.' });
    }

    const provider = await updateRecord('providers', id, { status });
    res.json({ id: provider.id, name: provider.name, status: provider.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. MISSIONS / ORDERS FLOW
// ==========================================
app.get('/api/missions', async (req, res) => {
  try {
    const missions = await readTable('missions');
    const enriched = [];

    for (const m of missions) {
      const items = await findRecords('mission_items', { mission_id: m.id });
      const evidence = await findRecord('evidences', { mission_id: m.id });
      const stud = m.student_id ? await findRecord('students', { id: m.student_id }) : null;
      const prov = m.provider_id ? await findRecord('providers', { id: m.provider_id }) : null;
      
      const hospRating = await getAverageRating(m.hospital_id);
      const studRating = stud ? await getAverageRating(stud.id) : null;
      const provRating = prov ? await getAverageRating(prov.id) : null;
      
      enriched.push({
        ...m,
        items,
        hospital_rating: hospRating,
        student_rating: studRating,
        provider_rating: provRating,
        student_kyc_type: stud ? stud.kyc_type : null,
        student_kyc_details: stud ? stud.kyc_details : null,
        provider_kyc_type: prov ? prov.kyc_type : null,
        provider_kyc_details: prov ? prov.kyc_details : null,
        evidence: evidence ? {
          donor_transfer_photo: evidence.donor_transfer_path ? `/uploads/${path.basename(evidence.donor_transfer_path)}` : null,
          student_receipt_photo: evidence.student_receipt_path ? `/uploads/${path.basename(evidence.student_receipt_path)}` : null,
          invoice_photo: evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
          delivery_photo: evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
          uploaded_at: evidence.uploaded_at
        } : null
      });
    }

    // Sort available (created) missions first, ordered by hospital_rating descending
    // then other missions sorted by creation date descending
    enriched.sort((a, b) => {
      if (a.status === 'created' && b.status !== 'created') return -1;
      if (a.status !== 'created' && b.status === 'created') return 1;
      if (a.status === 'created' && b.status === 'created') {
        return b.hospital_rating - a.hospital_rating;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/missions/:id', async (req, res) => {
  try {
    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    const items = await findRecords('mission_items', { mission_id: mission.id });
    const evidence = await findRecord('evidences', { mission_id: mission.id });
    const chats = await findRecords('chats', { mission_id: mission.id });
    
    const stud = mission.student_id ? await findRecord('students', { id: mission.student_id }) : null;
    const prov = mission.provider_id ? await findRecord('providers', { id: mission.provider_id }) : null;
    
    const hospRating = await getAverageRating(mission.hospital_id);
    const studRating = stud ? await getAverageRating(stud.id) : null;
    const provRating = prov ? await getAverageRating(prov.id) : null;
    const donorRating = mission.donor_name ? 5.0 : null; // simplified baseline donor rating

    res.json({
      ...mission,
      items,
      hospital_rating: hospRating,
      student_rating: studRating,
      provider_rating: provRating,
      donor_rating: donorRating,
      evidence: evidence ? {
        donor_transfer_photo: evidence.donor_transfer_path ? `/uploads/${path.basename(evidence.donor_transfer_path)}` : null,
        student_receipt_photo: evidence.student_receipt_path ? `/uploads/${path.basename(evidence.student_receipt_path)}` : null,
        invoice_photo: evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
        delivery_photo: evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
        uploaded_at: evidence.uploaded_at
      } : null,
      student_kyc_type: stud ? stud.kyc_type : null,
      student_kyc_details: stud ? stud.kyc_details : null,
      provider_kyc_type: prov ? prov.kyc_type : null,
      provider_kyc_details: prov ? prov.kyc_details : null,
      chats: chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hospital creates a mission
app.post('/api/missions', async (req, res) => {
  try {
    const { hospital_id, items } = req.body;
    
    if (!hospital_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Falta información de la misión.' });
    }

    const hospital = await findRecord('hospitals', { id: hospital_id });
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital no registrado.' });
    }

    // Validate products match official catalog
    for (const item of items) {
      if (!ALLOWED_PRODUCTS.includes(item.name)) {
        return res.status(400).json({ error: `El producto '${item.name}' no está en la lista autorizada.` });
      }
    }

    // Compute total
    const total_amount = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    // Create Mission
    const mission = await insertRecord('missions', {
      hospital_id: hospital.id,
      hospital_name: hospital.name,
      student_id: null,
      student_name: null,
      donor_id: null,
      donor_name: null,
      total_amount,
      status: 'created'
    });

    // Create Items
    for (const item of items) {
      await insertRecord('mission_items', {
        mission_id: mission.id,
        product_name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.price)
      });
    }

    // Chat log initialization
    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `Nueva misión solicitada por ${hospital.name} por un total de $${total_amount.toFixed(2)}. Insumos requeridos: ${items.map(i => `${i.quantity}x ${i.name}`).join(', ')}.`,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(mission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student or Provider claims a mission
app.post('/api/missions/:id/claim', async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere estudiante o proveedor verificado KYC.' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.status !== 'created') {
      return res.status(400).json({ error: 'La misión ya ha sido tomada.' });
    }

    // Rating matching constraints: missions > $100 require operator rating >= 4.0 stars
    const operatorRating = await getAverageRating(operator.user.id);
    if (Number(mission.total_amount) > 100.00 && operatorRating < 4.0) {
      return res.status(400).json({
        error: `Esta misión requiere un fondeo alto ($${Number(mission.total_amount).toFixed(2)}). Para tomarla necesitas una valoración mínima de 4.0 estrellas (Tu promedio actual es ${operatorRating}).`
      });
    }

    // Update mission based on operator type
    const claimData = { status: 'claimed' };
    if (operator.type === 'student') {
      claimData.student_id = operator.user.id;
      claimData.student_name = operator.user.name;
      claimData.provider_id = null;
      claimData.provider_name = null;
    } else {
      claimData.provider_id = operator.user.id;
      claimData.provider_name = operator.user.name;
      claimData.student_id = null;
      claimData.student_name = null;
    }

    const updated = await updateRecord('missions', mission.id, claimData);

    // Log chat message
    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `Misión tomada por el operador ${operator.user.name} (${operator.type === 'student' ? 'Estudiante' : 'Proveedor'}). KYC asociado: [${operator.user.kyc_type.toUpperCase()}] ${operator.user.kyc_details}. Solicitud de fondos enviada a los donadores del mundo.`,
      timestamp: new Date().toISOString()
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Donor funds a mission and uploads screenshot proof of transfer
app.post('/api/missions/:id/fund', upload.single('transfer_proof'), async (req, res) => {
  try {
    const { donor_name } = req.body;
    if (!donor_name) {
      return res.status(400).json({ error: 'Por favor, ingrese su nombre de donador.' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.status !== 'claimed') {
      return res.status(400).json({ error: 'La misión debe estar en estado [Tomada] para poder financiarse.' });
    }

    // Update mission status to funding_sent (waiting for student confirmation)
    const updated = await updateRecord('missions', mission.id, {
      donor_name,
      status: 'funding_sent'
    });

    // Update/create evidence record with transfer proof
    const evidence = await findRecord('evidences', { mission_id: mission.id });
    if (evidence) {
      await updateRecord('evidences', evidence.id, {
        donor_transfer_path: req.file ? req.file.path : null,
        uploaded_at: new Date().toISOString()
      });
    } else {
      await insertRecord('evidences', {
        mission_id: mission.id,
        donor_transfer_path: req.file ? req.file.path : null,
        student_receipt_path: null,
        invoice_photo_path: null,
        delivery_photo_path: null,
        uploaded_at: new Date().toISOString()
      });
    }

    // Log chat message
    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `El donador ${donor_name} ha enviado los fondos (comprobante cargado). Estado: [Comprobante Enviado]. Esperando verificación del operador.`,
      timestamp: new Date().toISOString()
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student or Provider confirms receipt of funds in Meru/Zelle and uploads wallet screenshot
app.post('/api/missions/:id/confirm-receipt', upload.single('receipt_proof'), async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere operador verificado.' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.student_id !== operator.user.id && mission.provider_id !== operator.user.id) {
      return res.status(403).json({ error: 'No tiene permisos para confirmar recepción en esta misión.' });
    }

    if (mission.status !== 'funding_sent') {
      return res.status(400).json({ error: 'La misión no tiene comprobante de pago enviado para confirmar.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta capture de pantalla de recepción en billetera.' });
    }

    // Update mission status to funded (funds fully available)
    const updated = await updateRecord('missions', mission.id, {
      status: 'funded'
    });

    // Update evidence record
    const evidence = await findRecord('evidences', { mission_id: mission.id });
    if (evidence) {
      await updateRecord('evidences', evidence.id, {
        student_receipt_path: req.file.path,
        uploaded_at: new Date().toISOString()
      });
    } else {
      await insertRecord('evidences', {
        mission_id: mission.id,
        donor_transfer_path: null,
        student_receipt_path: req.file.path,
        invoice_photo_path: null,
        delivery_photo_path: null,
        uploaded_at: new Date().toISOString()
      });
    }

    // Log chat message
    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `El operador ${operator.user.name} ha verificado y confirmado la recepción de los fondos. Estado: [Fondos Disponibles]. Listo para compra/despacho.`,
      timestamp: new Date().toISOString()
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student or Provider uploads merchant invoice
app.post('/api/missions/:id/invoice', upload.single('invoice'), async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere operador verificado.' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.student_id !== operator.user.id && mission.provider_id !== operator.user.id) {
      return res.status(403).json({ error: 'No tiene permisos para modificar esta misión.' });
    }

    if (mission.status !== 'funded') {
      return res.status(400).json({ error: 'La misión debe tener fondos disponibles para cargar factura.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta foto de la factura.' });
    }

    // Update/create evidence
    const evidence = await findRecord('evidences', { mission_id: mission.id });
    if (evidence) {
      await updateRecord('evidences', evidence.id, {
        invoice_photo_path: req.file.path,
        uploaded_at: new Date().toISOString()
      });
    } else {
      await insertRecord('evidences', {
        mission_id: mission.id,
        invoice_photo_path: req.file.path,
        delivery_photo_path: null,
        uploaded_at: new Date().toISOString()
      });
    }

    // Update mission status
    await updateRecord('missions', mission.id, {
      status: 'purchased'
    });

    // Log chat message
    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `El operador ${operator.user.name} ha comprado los suministros y cargado la factura. Listos para despacho a destino.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Factura cargada.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hospital validates delivery and uploads confirmation photo
app.post('/api/missions/:id/verify-delivery', upload.single('delivery'), async (req, res) => {
  try {
    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.status !== 'purchased') {
      return res.status(400).json({ error: 'Debe cargar primero la factura antes de verificar la entrega.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta foto de la entrega en el centro médico.' });
    }

    // Update evidence record
    const evidence = await findRecord('evidences', { mission_id: mission.id });
    if (!evidence) {
      return res.status(400).json({ error: 'No se encontró registro de factura previo para esta misión.' });
    }

    await updateRecord('evidences', evidence.id, {
      delivery_photo_path: req.file.path,
      uploaded_at: new Date().toISOString()
    });

    // Update mission status
    await updateRecord('missions', mission.id, {
      status: 'completed'
    });

    // Log chat message
    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `Entrega validada y completada. El hospital receptor ha confirmado y cargado la foto final de impacto. ¡Gracias a los donadores!`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Misión completada con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit a review / rating for a participant of a completed mission
app.post('/api/missions/:id/ratings', async (req, res) => {
  try {
    const { stars, comment, reviewee_id, reviewee_role } = req.body;
    if (!stars || !reviewee_id || !reviewee_role) {
      return res.status(400).json({ error: 'Faltan datos de valoración (estrellas, reviewee_id, reviewee_role).' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    // Determine reviewer details
    let reviewer_id = 'guest';
    let reviewer_role = 'donor';
    
    const student = await getAuthenticatedStudent(req);
    const provider = await getAuthenticatedProvider(req);
    if (student) {
      reviewer_id = student.id;
      reviewer_role = 'student';
    } else if (provider) {
      reviewer_id = provider.id;
      reviewer_role = 'provider';
    } else if (isAdmin(req)) {
      reviewer_id = 'admin';
      reviewer_role = 'admin';
    } else {
      // Check if donor or hospital was submitted via body
      reviewer_role = req.body.reviewer_role || 'donor';
      reviewer_id = req.body.reviewer_id || 'donor';
    }

    const rating = await insertRecord('ratings', {
      mission_id: mission.id,
      reviewer_id,
      reviewer_role,
      reviewee_id,
      reviewee_role,
      stars: Number(stars),
      comment: comment || ''
    });

    // Log chat message
    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `Nueva valoración registrada para [${reviewee_role.toUpperCase()}] con ${stars} estrellas: "${comment || ''}" (de ${reviewer_role.toUpperCase()}).`,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(rating);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. CHAT MESSAGES
// ==========================================
app.get('/api/missions/:id/chats', async (req, res) => {
  try {
    const chats = await findRecords('chats', { mission_id: req.params.id });
    res.json(chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/missions/:id/chats', async (req, res) => {
  try {
    const adminMode = isAdmin(req);
    const student = await getAuthenticatedStudent(req);

    const { message, sender_name, sender_role } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Mensaje vacío.' });
    }

    let role = sender_role || 'guest';
    let name = sender_name || 'Usuario';

    if (adminMode) {
      role = 'admin';
      name = 'Manu (Administrador)';
    } else if (student) {
      role = 'student';
      name = student.name;
    }

    const chatMsg = await insertRecord('chats', {
      mission_id: req.params.id,
      sender_role: role,
      sender_name: name,
      message,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(chatMsg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. OMNICHANNEL CHATBOT AGENT WEBHOOK (WhatsApp / Instagram)
// ==========================================
app.post('/api/webhooks/agent', async (req, res) => {
  try {
    const { platform, sender_phone, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Falta mensaje.' });
    }

    const text = message.toLowerCase().trim();

    // 1. HOSPITAL CREATE MISSION COMMAND
    // format: "crear mision vargas 50 gasas, 20 alcohol"
    if (text.startsWith('crear mision') || text.startsWith('crear misión')) {
      const hospitals = await readTable('hospitals');
      let hospital = null;

      // Match hospital by location/name
      for (const h of hospitals) {
        if (text.includes(h.name.toLowerCase()) || text.includes(h.name.split(' ')[1]?.toLowerCase())) {
          hospital = h;
          break;
        }
      }
      if (!hospital) {
        hospital = hospitals[0]; // fallback to first seeded hospital
      }

      // Parse items: looking for "<number> <item>"
      const items = [];
      for (const prodName of ALLOWED_PRODUCTS) {
        // match variations like "gasas", "solucion"
        const keyword = prodName.split(' ')[0].toLowerCase();
        const regex = new RegExp(`(\\d+)\\s*${keyword}`, 'i');
        const match = text.match(regex);
        if (match) {
          // Find standard pricing from products
          const prodData = await findRecord('products', { name: prodName });
          const price = prodData ? prodData.price : 1.50; // fallback default
          items.push({
            name: prodName,
            quantity: parseInt(match[1]),
            price: price
          });
        }
      }

      if (items.length === 0) {
        return res.json({
          reply: `⚠️ Lo siento, no logré identificar insumos válidos en tu mensaje. Por favor especifica insumos del catálogo oficial (ej: 50 gasas, 10 alcohol).`
        });
      }

      // Compute total
      const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create Mission
      const mission = await insertRecord('missions', {
        hospital_id: hospital.id,
        hospital_name: hospital.name,
        student_id: null,
        student_name: null,
        donor_id: null,
        donor_name: null,
        total_amount,
        status: 'created'
      });

      for (const item of items) {
        await insertRecord('mission_items', {
          mission_id: mission.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price
        });
      }

      await insertRecord('chats', {
        mission_id: mission.id,
        sender_role: 'system',
        sender_name: 'WhatsApp Bot',
        message: `Misión creada vía WhatsApp por el Hospital ${hospital.name}. Monto: $${total_amount.toFixed(2)}.`,
        timestamp: new Date().toISOString()
      });

      return res.json({
        reply: `🩺 ¡Misión creada con éxito! El identificador es: *${mission.id}* por un total de *$${total_amount.toFixed(2)}* para *${hospital.name}*.\n\nHemos notificado a los estudiantes en Mérida para que reclamen la misión.`
      });
    }

    // 2. STUDENT OR PROVIDER CLAIM MISSION COMMAND
    // format: "tomar mision mis-101"
    if (text.startsWith('tomar mision') || text.startsWith('tomar misión')) {
      const match = text.match(/mis-\d+/);
      if (!match) {
        return res.json({ reply: '⚠️ Por favor indique el código de la misión (ej: "tomar mision MIS-101").' });
      }
      const missionId = match[0].toUpperCase();

      // Look up who is claimant (student vs provider) by sender_phone
      const student = await findRecord('students', { phone: sender_phone });
      const provider = await findRecord('providers', { phone: sender_phone });

      if (!student && !provider) {
        return res.json({
          reply: `⚠️ Tu número ${sender_phone} no está registrado como estudiante o proveedor verificado. Regístrate en el Portal Web con tu KYC de Meru o Zelle primero.`
        });
      }

      const operator = student
        ? { type: 'student', user: student }
        : { type: 'provider', user: provider };

      if (operator.user.status !== 'verified') {
        return res.json({ reply: '⚠️ Tu cuenta está en espera de aprobación KYC por el administrador.' });
      }

      const mission = await findRecord('missions', { id: missionId });
      if (!mission) {
        return res.json({ reply: `⚠️ La misión ${missionId} no existe.` });
      }

      if (mission.status !== 'created') {
        return res.json({ reply: `⚠️ La misión ${missionId} ya tiene otro estado o fue reclamada.` });
      }

      // Rating matching constraints: missions > $100 require operator rating >= 4.0
      const operatorRating = await getAverageRating(operator.user.id);
      if (Number(mission.total_amount) > 100.00 && operatorRating < 4.0) {
        return res.json({
          reply: `⚠️ Misión de alto fondeo ($${Number(mission.total_amount).toFixed(2)}). Para tomarla necesitas una valoración mínima de 4.0 estrellas (Tu promedio actual es ${operatorRating}).`
        });
      }

      // Claim mission
      const claimData = { status: 'claimed' };
      if (operator.type === 'student') {
        claimData.student_id = operator.user.id;
        claimData.student_name = operator.user.name;
        claimData.provider_id = null;
        claimData.provider_name = null;
      } else {
        claimData.provider_id = operator.user.id;
        claimData.provider_name = operator.user.name;
        claimData.student_id = null;
        claimData.student_name = null;
      }

      await updateRecord('missions', mission.id, claimData);

      await insertRecord('chats', {
        mission_id: mission.id,
        sender_role: 'system',
        sender_name: 'WhatsApp Bot',
        message: `Misión tomada vía WhatsApp por el operador ${operator.user.name} (${operator.type === 'student' ? 'Estudiante' : 'Proveedor'}).`,
        timestamp: new Date().toISOString()
      });

      return res.json({
        reply: `🚚 ¡Misión *${missionId}* asignada a ti! Tu billetera *[${operator.user.kyc_type.toUpperCase()}] ${operator.user.kyc_details}* ha sido vinculada.\n\nHemos notificado a los donadores internacionales para el fondeo de $${Number(mission.total_amount).toFixed(2)}.`
      });
    }

    // 3. DONOR FUND COMMAND
    // format: "donar a la mision mis-101"
    if (text.startsWith('donar')) {
      const match = text.match(/mis-\d+/);
      if (!match) {
        return res.json({ reply: '⚠️ Por favor indique el código de la misión a fondeard (ej: "donar a la mision MIS-101").' });
      }
      const missionId = match[0].toUpperCase();

      const mission = await findRecord('missions', { id: missionId });
      if (!mission) {
        return res.json({ reply: `⚠️ La misión ${missionId} no existe.` });
      }

      if (mission.status !== 'claimed') {
        return res.json({ reply: `⚠️ La misión ${missionId} debe estar tomada por un operador para poder ser financiada.` });
      }

      // Look up operator details (student vs provider)
      let operator_name = mission.student_name || mission.provider_name;
      let kyc_type = 'N/A';
      let kyc_details = 'N/A';
      
      if (mission.student_id) {
        const student = await findRecord('students', { id: mission.student_id });
        if (student) {
          kyc_type = student.kyc_type;
          kyc_details = student.kyc_details;
        }
      } else if (mission.provider_id) {
        const provider = await findRecord('providers', { id: mission.provider_id });
        if (provider) {
          kyc_type = provider.kyc_type;
          kyc_details = provider.kyc_details;
        }
      }

      // Fund mission (transition to funding_sent)
      await updateRecord('missions', mission.id, {
        donor_name: 'Donador Omnicanal',
        status: 'funding_sent'
      });

      // Save mock donor transfer proof
      const evidence = await findRecord('evidences', { mission_id: mission.id });
      if (evidence) {
        await updateRecord('evidences', evidence.id, {
          donor_transfer_path: 'public/uploads/donor-transfer-mock.jpg',
          uploaded_at: new Date().toISOString()
        });
      } else {
        await insertRecord('evidences', {
          mission_id: mission.id,
          donor_transfer_path: 'public/uploads/donor-transfer-mock.jpg',
          student_receipt_path: null,
          invoice_photo_path: null,
          delivery_photo_path: null,
          uploaded_at: new Date().toISOString()
        });
      }

      await insertRecord('chats', {
        mission_id: mission.id,
        sender_role: 'system',
        sender_name: 'WhatsApp Bot',
        message: `Misión financiada por un donador vía WhatsApp/Instagram (capture de envío simulado cargado).`,
        timestamp: new Date().toISOString()
      });

      return res.json({
        reply: `💰 ¡Muchísimas gracias por tu apoyo! Has enviado los fondos para la misión *${missionId}* (comprobante registrado).\n\nOperador *${operator_name}*, por favor revisa tu cuenta *${kyc_type.toUpperCase()}: ${kyc_details}* y confirma la recepción escribiendo: *'confirmar fondos ${missionId}'*.`
      });
    }

    // 3.5 OPERATOR CONFIRM FUNDS COMMAND
    // format: "confirmar fondos mis-101"
    if (text.startsWith('confirmar fondos')) {
      const match = text.match(/mis-\d+/);
      if (!match) {
        return res.json({ reply: '⚠️ Por favor indique el código de la misión a confirmar (ej: "confirmar fondos MIS-101").' });
      }
      const missionId = match[0].toUpperCase();

      const student = await findRecord('students', { phone: sender_phone });
      const provider = await findRecord('providers', { phone: sender_phone });

      if ((!student || student.status !== 'verified') && (!provider || provider.status !== 'verified')) {
        return res.json({ reply: '⚠️ No autorizado. Debe ser un estudiante o proveedor de insumos verificado en el sistema.' });
      }

      const operator = student ? student : provider;

      const mission = await findRecord('missions', { id: missionId });
      if (!mission) {
        return res.json({ reply: `⚠️ La misión ${missionId} no existe.` });
      }

      if (mission.student_id !== operator.id && mission.provider_id !== operator.id) {
        return res.json({ reply: `⚠️ No tienes asignada la misión ${missionId}.` });
      }

      if (mission.status !== 'funding_sent') {
        return res.json({ reply: `⚠️ La misión ${missionId} debe estar en estado [Comprobante Enviado] para verificar recepción.` });
      }

      // Update status to funded
      await updateRecord('missions', mission.id, {
        status: 'funded'
      });

      // Save mock student receipt confirmation
      const evidence = await findRecord('evidences', { mission_id: mission.id });
      if (evidence) {
        await updateRecord('evidences', evidence.id, {
          student_receipt_path: 'public/uploads/student-receipt-mock.jpg',
          uploaded_at: new Date().toISOString()
        });
      }

      await insertRecord('chats', {
        mission_id: mission.id,
        sender_role: 'system',
        sender_name: 'WhatsApp Bot',
        message: `El operador ${operator.name} ha confirmado la recepción de los fondos vía WhatsApp/Instagram (comprobante guardado).`,
        timestamp: new Date().toISOString()
      });

      return res.json({
        reply: `✅ ¡Fondos confirmados para la misión *${missionId}*! Los fondos están marcados como recibidos y disponibles en Mérida. Puedes proceder a realizar el despacho y subir la factura comercial.`
      });
    }

    // 3.8 RATING REVIEW COMMAND
    // format: "valorar mis-101 con 5 estrellas" or "valorar mis-101 con 5 estrellas: comentario"
    if (text.startsWith('valorar')) {
      const matchId = text.match(/mis-\d+/);
      const matchStars = text.match(/con\s+([1-5])\s+estrella/i);

      if (!matchId || !matchStars) {
        return res.json({ reply: '⚠️ Comando inválido. Use el formato: "valorar MIS-101 con 5 estrellas" (opcional: ": comentario").' });
      }
      const missionId = matchId[0].toUpperCase();
      const stars = parseInt(matchStars[1]);

      // Parse optional comment after ":"
      let comment = '';
      const parts = text.split(':');
      if (parts.length > 1) {
        comment = parts.slice(1).join(':').trim();
      }

      const mission = await findRecord('missions', { id: missionId });
      if (!mission) {
        return res.json({ reply: `⚠️ La misión ${missionId} no existe.` });
      }

      // Resolve reviewee and reviewer based on sender_phone
      let reviewer_id = 'guest';
      let reviewer_role = 'donor';
      let reviewee_id = null;
      let reviewee_role = null;

      // Check sender phone against roles
      const hospital = await findRecord('hospitals', { phone: sender_phone });
      const student = await findRecord('students', { phone: sender_phone });
      const provider = await findRecord('providers', { phone: sender_phone });
      const donor = await findRecord('donors', { phone: sender_phone });

      if (hospital) {
        reviewer_id = hospital.id;
        reviewer_role = 'hospital';
        reviewee_id = mission.student_id || mission.provider_id;
        reviewee_role = mission.student_id ? 'student' : 'provider';
      } else if (student) {
        reviewer_id = student.id;
        reviewer_role = 'student';
        reviewee_id = 'donor-seed'; // rate donor
        reviewee_role = 'donor';
      } else if (provider) {
        reviewer_id = provider.id;
        reviewer_role = 'provider';
        reviewee_id = 'donor-seed';
        reviewee_role = 'donor';
      } else if (donor) {
        reviewer_id = donor.id;
        reviewer_role = 'donor';
        reviewee_id = mission.student_id || mission.provider_id;
        reviewee_role = mission.student_id ? 'student' : 'provider';
      } else {
        // Fallback: donor rates student
        reviewer_id = 'donor-seed';
        reviewer_role = 'donor';
        reviewee_id = mission.student_id || mission.provider_id;
        reviewee_role = mission.student_id ? 'student' : 'provider';
      }

      if (!reviewee_id) {
        return res.json({ reply: '⚠️ La misión no tiene operador asignado para poder ser valorado.' });
      }

      await insertRecord('ratings', {
        mission_id: mission.id,
        reviewer_id,
        reviewer_role,
        reviewee_id,
        reviewee_role,
        stars,
        comment
      });

      await insertRecord('chats', {
        mission_id: mission.id,
        sender_role: 'system',
        sender_name: 'WhatsApp Bot',
        message: `Misión valorada vía WhatsApp con ${stars} estrellas (por ${reviewer_role}).`,
        timestamp: new Date().toISOString()
      });

      return res.json({
        reply: `⭐️ ¡Muchísimas gracias! Has valorado al *[${reviewee_role.toUpperCase()}]* de esta misión con *${stars} estrellas* y comentario: "${comment || 'Sin comentario'}"`
      });
    }

    // 4. HOSPITAL CONFIRM DELIVERY
    // format: "confirmar entrega mis-101"
    if (text.startsWith('confirmar')) {
      const match = text.match(/mis-\d+/);
      if (!match) {
        return res.json({ reply: '⚠️ Indique el código de misión a confirmar (ej: "confirmar entrega MIS-101").' });
      }
      const missionId = match[0].toUpperCase();

      const mission = await findRecord('missions', { id: missionId });
      if (!mission) {
        return res.json({ reply: `⚠️ La misión ${missionId} no existe.` });
      }

      if (mission.status !== 'purchased') {
        return res.json({ reply: `⚠️ La misión ${missionId} debe estar en estado [Comprado] (con factura cargada) para certificar entrega.` });
      }

      // Complete mission
      await updateRecord('missions', mission.id, {
        status: 'completed'
      });

      // Save a mock delivery photo entry in evidences
      const evidence = await findRecord('evidences', { mission_id: mission.id });
      if (evidence) {
        await updateRecord('evidences', evidence.id, {
          delivery_photo_path: 'public/uploads/delivery-mock.jpg',
          uploaded_at: new Date().toISOString()
        });
      }

      await insertRecord('chats', {
        mission_id: mission.id,
        sender_role: 'system',
        sender_name: 'WhatsApp Bot',
        message: `Entrega confirmada vía WhatsApp por el Hospital receptor.`,
        timestamp: new Date().toISOString()
      });

      return res.json({
        reply: `🏥 ¡Entrega confirmada para la misión *${missionId}*! Los insumos están en el hospital.\n\nHemos cargado la verificación al Dashboard Público de Transparencia y notificado al donador. ¡Gracias por participar!`
      });
    }

    // DEFAULT AGENT MENU HELPER
    return res.json({
      reply: `🤖 *Agente IA - CUMIS Conecta* 🩺\n\n¿Cómo puedo ayudarte? Prueba con estos comandos en español:\n\n` +
             `🏥 *Hospital*: "Crear mision Vargas con 50 gasas y 20 alcohol"\n` +
             `🚚 *Operador*: "Tomar mision MIS-101"\n` +
             `💰 *Donante*: "Donar a la mision MIS-101"\n` +
             `🎓 *Operador*: "Confirmar fondos MIS-101"\n` +
             `🏥 *Hospital*: "Confirmar entrega MIS-101"\n` +
             `⭐️ *Valorar*: "Valorar MIS-101 con 5 estrellas: Excelente servicio"`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed database on startup and run server
seedDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`CUMIS Conecta API server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
