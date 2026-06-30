import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  readTable,
  insertRecord,
  updateRecord,
  findRecord,
  findRecords
} from '../db/database.js';
import {
  isAdmin,
  getAuthenticatedOperator,
  getAuthenticatedMissionary,
  getAuthenticatedProvider,
  getAverageRating,
  ALLOWED_PRODUCTS
} from '../middleware/auth.js';

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'manu2026';
const router = express.Router();

// Multer configurations
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './public/uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// ==========================================
// 1. PUBLIC DASHBOARD STATS
// ==========================================
router.get('/dashboard-stats', async (req, res) => {
  try {
    const missions = await readTable('missions');
    const donationTotal = missions
      .filter(m => ['funding_sent', 'funded', 'purchased', 'completed'].includes(m.status))
      .reduce((sum, m) => sum + Number(m.total_amount), 0);
    
    const transitTotal = missions
      .filter(m => ['funding_sent', 'funded', 'purchased'].includes(m.status))
      .reduce((sum, m) => sum + Number(m.total_amount), 0);

    const legalisedTotal = missions
      .filter(m => m.status === 'completed')
      .reduce((sum, m) => sum + Number(m.total_amount), 0);

    const completedMissions = [];
    const completedOrders = missions.filter(m => m.status === 'completed');
    
    for (const mission of completedOrders) {
      const evidence = await findRecord('evidences', { mission_id: mission.id });
      completedMissions.push({
        order_id: mission.id,
        supplier_name: mission.hospital_name,
        total_amount: mission.total_amount,
        operator_name: mission.missionary_name || mission.provider_name || 'Operador CUMIS',
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
router.get('/products', async (req, res) => {
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
router.get('/hospitals', async (req, res) => {
  try {
    const hospitals = await findRecords('hospitals', { status: 'verified' });
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. MISSIONARY MANAGEMENT & AUTH
// ==========================================
router.post('/missionaries/register', async (req, res) => {
  try {
    const { name, phone, email, kyc_type, kyc_details, password, type, university } = req.body;
    
    if (!name || !phone || !email || !kyc_type || !kyc_details || !password || !type) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    if (!['zelle', 'meru'].includes(kyc_type)) {
      return res.status(400).json({ error: 'Método KYC inválido. Elija Zelle o Meru.' });
    }

    if (!['student', 'civil'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de misionero inválido. Elija Estudiante o Sociedad Civil.' });
    }

    if (type === 'student' && !university) {
      return res.status(400).json({ error: 'La universidad es obligatoria para misioneros estudiantes.' });
    }

    const existing = await findRecord('missionaries', { phone });
    if (existing) {
      return res.status(400).json({ error: 'Este número de teléfono ya está registrado como misionero.' });
    }

    const missionary = await insertRecord('missionaries', {
      name,
      phone,
      email,
      kyc_type,
      kyc_details,
      password,
      type,
      university: type === 'student' ? university : null,
      status: 'pending'
    });

    res.status(201).json({
      id: missionary.id,
      name: missionary.name,
      phone: missionary.phone,
      kyc_type: missionary.kyc_type,
      kyc_details: missionary.kyc_details,
      status: missionary.status,
      type: missionary.type,
      university: missionary.university
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/missionaries/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: 'Por favor, ingrese teléfono y contraseña.' });
    }

    if (phone === 'admin' && password === ADMIN_PASSCODE) {
      return res.json({
        role: 'admin',
        token: ADMIN_PASSCODE,
        name: 'Administrador Manu'
      });
    }

    const missionary = await findRecord('missionaries', { phone, password });
    if (!missionary) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (missionary.status !== 'verified') {
      return res.status(403).json({
        error: 'Su cuenta de misionero está en espera de verificación KYC por el Administrador.',
        status: 'pending'
      });
    }

    res.json({
      role: 'missionary',
      token: missionary.id,
      id: missionary.id,
      name: missionary.name,
      phone: missionary.phone,
      kyc_type: missionary.kyc_type,
      kyc_details: missionary.kyc_details,
      type: missionary.type,
      university: missionary.university
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/missionaries/pending', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }
    const pending = await findRecords('missionaries', { status: 'pending' });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/missionaries/verify', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Falta ID de misionero o estado.' });
    }

    const missionary = await updateRecord('missionaries', id, { status });
    res.json({ id: missionary.id, name: missionary.name, status: missionary.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. PROVIDER MANAGEMENT & AUTH
// ==========================================
router.post('/providers/register', async (req, res) => {
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
      status: 'pending'
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

router.post('/providers/login', async (req, res) => {
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

router.get('/providers/pending', async (req, res) => {
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

router.post('/providers/verify', async (req, res) => {
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
// 6. HOSPITAL KYC & PROFILE SIGNUP
// ==========================================
router.post('/hospitals/register', async (req, res) => {
  try {
    const { name, location, phone, manager_name, manager_email, is_whatsapp, rif, image_path } = req.body;
    
    if (!name || !location || !phone || !manager_name || !manager_email) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para el registro.' });
    }

    const existing = await findRecord('hospitals', { phone });
    if (existing) {
      return res.status(400).json({ error: 'Este número de teléfono ya está registrado como centro de salud/hospital.' });
    }

    const hospital = await insertRecord('hospitals', {
      name,
      location,
      phone,
      manager_name,
      manager_email,
      is_whatsapp: is_whatsapp ? 1 : 0,
      rif: rif || null,
      image_path: image_path || null,
      status: 'pending'
    });

    res.status(201).json(hospital);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/hospitals/pending', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado. Permisos de administrador requeridos.' });
    }
    const pending = await findRecords('hospitals', { status: 'pending' });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/hospitals/verify', async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Falta ID de hospital o estado.' });
    }

    const hospital = await updateRecord('hospitals', id, { status });
    res.json({ id: hospital.id, name: hospital.name, status: hospital.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. MISSIONS FLOW
// ==========================================
router.get('/missions', async (req, res) => {
  try {
    const missions = await readTable('missions');
    const enriched = [];

    let requesterOperatorId = null;
    const operator = await getAuthenticatedOperator(req);
    if (operator) requesterOperatorId = operator.user.id;
    const isRequesterAdmin = isAdmin(req);

    for (const m of missions) {
      const items = await findRecords('mission_items', { mission_id: m.id });
      const evidence = await findRecord('evidences', { mission_id: m.id });
      const mish = m.missionary_id ? await findRecord('missionaries', { id: m.missionary_id }) : null;
      const prov = m.provider_id ? await findRecord('providers', { id: m.provider_id }) : null;
      
      const hospRating = await getAverageRating(m.hospital_id);
      const mishRating = mish ? await getAverageRating(mish.id) : null;
      const provRating = prov ? await getAverageRating(prov.id) : null;
      
      const canSeeRealDonor = isRequesterAdmin || (requesterOperatorId && (requesterOperatorId === m.missionary_id || requesterOperatorId === m.provider_id));
      const displayDonorName = (m.is_anonymous === 1 && !canSeeRealDonor) ? 'Donante Anónimo' : m.donor_name;

      enriched.push({
        ...m,
        donor_name: displayDonorName,
        items,
        hospital_rating: hospRating,
        missionary_rating: mishRating,
        provider_rating: provRating,
        missionary_kyc_type: mish ? mish.kyc_type : null,
        missionary_kyc_details: mish ? mish.kyc_details : null,
        provider_kyc_type: prov ? prov.kyc_type : null,
        provider_kyc_details: prov ? prov.kyc_details : null,
        evidence: evidence ? {
          donor_transfer_photo: (canSeeRealDonor && evidence.donor_transfer_path) ? `/uploads/${path.basename(evidence.donor_transfer_path)}` : null,
          missionary_receipt_photo: (canSeeRealDonor && evidence.missionary_receipt_path) ? `/uploads/${path.basename(evidence.missionary_receipt_path)}` : null,
          invoice_photo: evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
          delivery_photo: evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
          uploaded_at: evidence.uploaded_at
        } : null
      });
    }

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

router.get('/missions/:id', async (req, res) => {
  try {
    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    const items = await findRecords('mission_items', { mission_id: mission.id });
    const evidence = await findRecord('evidences', { mission_id: mission.id });
    const chats = await findRecords('chats', { mission_id: mission.id });
    
    const mish = mission.missionary_id ? await findRecord('missionaries', { id: mission.missionary_id }) : null;
    const prov = mission.provider_id ? await findRecord('providers', { id: mission.provider_id }) : null;
    
    const hospRating = await getAverageRating(mission.hospital_id);
    const mishRating = mish ? await getAverageRating(mish.id) : null;
    const provRating = prov ? await getAverageRating(prov.id) : null;
    const donorRating = mission.donor_name ? 5.0 : null;

    let requesterOperatorId = null;
    const operator = await getAuthenticatedOperator(req);
    if (operator) requesterOperatorId = operator.user.id;
    const isRequesterAdmin = isAdmin(req);

    const canSeeRealDonor = isRequesterAdmin || (requesterOperatorId && (requesterOperatorId === mission.missionary_id || requesterOperatorId === mission.provider_id));
    const displayDonorName = (mission.is_anonymous === 1 && !canSeeRealDonor) ? 'Donante Anónimo' : mission.donor_name;

    res.json({
      ...mission,
      donor_name: displayDonorName,
      items,
      hospital_rating: hospRating,
      missionary_rating: mishRating,
      provider_rating: provRating,
      donor_rating: donorRating,
      evidence: evidence ? {
        donor_transfer_photo: (canSeeRealDonor && evidence.donor_transfer_path) ? `/uploads/${path.basename(evidence.donor_transfer_path)}` : null,
        missionary_receipt_photo: (canSeeRealDonor && evidence.missionary_receipt_path) ? `/uploads/${path.basename(evidence.missionary_receipt_path)}` : null,
        invoice_photo: evidence.invoice_photo_path ? `/uploads/${path.basename(evidence.invoice_photo_path)}` : null,
        delivery_photo: evidence.delivery_photo_path ? `/uploads/${path.basename(evidence.delivery_photo_path)}` : null,
        uploaded_at: evidence.uploaded_at
      } : null,
      missionary_kyc_type: mish ? mish.kyc_type : null,
      missionary_kyc_details: mish ? mish.kyc_details : null,
      provider_kyc_type: prov ? prov.kyc_type : null,
      provider_kyc_details: prov ? prov.kyc_details : null,
      chats: chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/missions', async (req, res) => {
  try {
    const { hospital_id, items } = req.body;
    
    if (!hospital_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Falta información de la misión.' });
    }

    const hospital = await findRecord('hospitals', { id: hospital_id });
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital no registrado.' });
    }
    if (hospital.status !== 'verified') {
      return res.status(400).json({ error: 'El centro de salud/hospital aún no ha sido verificado KYC por el administrador.' });
    }

    for (const item of items) {
      if (!ALLOWED_PRODUCTS.includes(item.name)) {
        return res.status(400).json({ error: `El producto '${item.name}' no está en la lista autorizada.` });
      }
    }

    const total_amount = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    const mission = await insertRecord('missions', {
      hospital_id: hospital.id,
      hospital_name: hospital.name,
      missionary_id: null,
      missionary_name: null,
      provider_id: null,
      provider_name: null,
      donor_id: null,
      donor_name: null,
      total_amount,
      status: 'created'
    });

    for (const item of items) {
      await insertRecord('mission_items', {
        mission_id: mission.id,
        product_name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.price)
      });
    }

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

router.post('/missions/:id/claim', async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere misionero o proveedor verificado KYC.' });
    }

    const { direct_donation } = req.body;
    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.status !== 'created') {
      return res.status(400).json({ error: 'La misión ya ha sido tomada.' });
    }

    const operatorRating = await getAverageRating(operator.user.id);
    if (Number(mission.total_amount) > 100.00 && operatorRating < 4.0) {
      return res.status(400).json({
        error: `Esta misión requiere un fondeo alto ($${Number(mission.total_amount).toFixed(2)}). Para tomarla necesitas una valoración mínima de 4.0 estrellas (Tu promedio actual es ${operatorRating}).`
      });
    }

    const claimData = {};
    if (direct_donation) {
      claimData.status = 'funded';
      claimData.donor_name = `${operator.user.name} (Directo)`;
    } else {
      claimData.status = 'claimed';
    }

    if (operator.type === 'missionary') {
      claimData.missionary_id = operator.user.id;
      claimData.missionary_name = operator.user.name;
      claimData.provider_id = null;
      claimData.provider_name = null;
    } else {
      claimData.provider_id = operator.user.id;
      claimData.provider_name = operator.user.name;
      claimData.missionary_id = null;
      claimData.missionary_name = null;
    }

    const updated = await updateRecord('missions', mission.id, claimData);

    if (direct_donation) {
      await insertRecord('evidences', {
        mission_id: mission.id,
        donor_transfer_path: 'direct-donation',
        missionary_receipt_path: 'direct-donation',
        invoice_photo_path: null,
        delivery_photo_path: null,
        uploaded_at: new Date().toISOString()
      });
    }

    const logMsg = direct_donation
      ? `Misión tomada por el operador ${operator.user.name} (${operator.type === 'missionary' ? 'Misionero' : 'Proveedor'}) como DONACIÓN DIRECTA. Se han omitido los pasos de fondeo ya que cuenta con los insumos y procederá a la entrega.`
      : `Misión tomada por el operador ${operator.user.name} (${operator.type === 'missionary' ? 'Misionero' : 'Proveedor'}). KYC asociado: [${operator.user.kyc_type.toUpperCase()}] ${operator.user.kyc_details}. Solicitud de fondos enviada a los donadores del mundo.`;

    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: logMsg,
      timestamp: new Date().toISOString()
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/missions/:id/fund', upload.single('transfer_proof'), async (req, res) => {
  try {
    const { donor_name, donor_email, donor_phone } = req.body;
    const is_anonymous = (req.body.is_anonymous === 'true' || req.body.is_anonymous === true || req.body.is_anonymous === 'on') ? 1 : 0;
    
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

    let donor = null;
    if (donor_email) donor = await findRecord('donors', { email: donor_email });
    if (!donor && donor_phone) donor = await findRecord('donors', { phone: donor_phone });
    if (!donor) {
      donor = await insertRecord('donors', {
        name: donor_name,
        email: donor_email || '',
        phone: donor_phone || ''
      });
    }

    const updated = await updateRecord('missions', mission.id, {
      donor_id: donor.id,
      donor_name,
      is_anonymous,
      status: 'funding_sent'
    });

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
        missionary_receipt_path: null,
        invoice_photo_path: null,
        delivery_photo_path: null,
        uploaded_at: new Date().toISOString()
      });
    }

    const displayLogName = is_anonymous ? 'Donante Anónimo' : donor_name;

    await insertRecord('chats', {
      mission_id: mission.id,
      sender_role: 'system',
      sender_name: 'Sistema',
      message: `El donador ${displayLogName} ha enviado los fondos (comprobante cargado). Estado: [Comprobante Enviado]. Esperando verificación del operador.`,
      timestamp: new Date().toISOString()
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/missions/:id/confirm-receipt', upload.single('receipt_proof'), async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere operador verificado.' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.missionary_id !== operator.user.id && mission.provider_id !== operator.user.id) {
      return res.status(403).json({ error: 'No tiene permisos para confirmar recepción en esta misión.' });
    }

    if (mission.status !== 'funding_sent') {
      return res.status(400).json({ error: 'La misión no tiene comprobante de pago enviado para confirmar.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta capture de pantalla de recepción en billetera.' });
    }

    const updated = await updateRecord('missions', mission.id, {
      status: 'funded'
    });

    const evidence = await findRecord('evidences', { mission_id: mission.id });
    if (evidence) {
      await updateRecord('evidences', evidence.id, {
        missionary_receipt_path: req.file.path,
        uploaded_at: new Date().toISOString()
      });
    } else {
      await insertRecord('evidences', {
        mission_id: mission.id,
        donor_transfer_path: null,
        missionary_receipt_path: req.file.path,
        invoice_photo_path: null,
        delivery_photo_path: null,
        uploaded_at: new Date().toISOString()
      });
    }

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

router.post('/missions/:id/invoice', upload.single('invoice'), async (req, res) => {
  try {
    const operator = await getAuthenticatedOperator(req);
    if (!operator) {
      return res.status(401).json({ error: 'No autorizado. Requiere operador verificado.' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    if (mission.missionary_id !== operator.user.id && mission.provider_id !== operator.user.id) {
      return res.status(403).json({ error: 'No tiene permisos para modificar esta misión.' });
    }

    if (mission.status !== 'funded') {
      return res.status(400).json({ error: 'La misión debe tener fondos disponibles para cargar factura.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta foto de la factura.' });
    }

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

    await updateRecord('missions', mission.id, {
      status: 'purchased'
    });

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

router.post('/missions/:id/verify-delivery', upload.single('delivery'), async (req, res) => {
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

    const evidence = await findRecord('evidences', { mission_id: mission.id });
    if (!evidence) {
      return res.status(400).json({ error: 'No se encontró registro de factura previo para esta misión.' });
    }

    await updateRecord('evidences', evidence.id, {
      delivery_photo_path: req.file.path,
      uploaded_at: new Date().toISOString()
    });

    await updateRecord('missions', mission.id, {
      status: 'completed'
    });

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

router.post('/missions/:id/ratings', async (req, res) => {
  try {
    const { stars, comment, reviewee_id, reviewee_role } = req.body;
    if (!stars || !reviewee_id || !reviewee_role) {
      return res.status(400).json({ error: 'Faltan datos de valoración (estrellas, reviewee_id, reviewee_role).' });
    }

    const mission = await findRecord('missions', { id: req.params.id });
    if (!mission) {
      return res.status(404).json({ error: 'Misión no encontrada.' });
    }

    let reviewer_id = 'guest';
    let reviewer_role = 'donor';
    
    const missionary = await getAuthenticatedMissionary(req);
    const provider = await getAuthenticatedProvider(req);
    if (missionary) {
      reviewer_id = missionary.id;
      reviewer_role = 'missionary';
    } else if (provider) {
      reviewer_id = provider.id;
      reviewer_role = 'provider';
    } else if (isAdmin(req)) {
      reviewer_id = 'admin';
      reviewer_role = 'admin';
    } else {
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
// 8. CHAT MESSAGES
// ==========================================
router.get('/missions/:id/chats', async (req, res) => {
  try {
    const chats = await findRecords('chats', { mission_id: req.params.id });
    res.json(chats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/missions/:id/chats', async (req, res) => {
  try {
    const adminMode = isAdmin(req);
    const missionary = await getAuthenticatedMissionary(req);

    const { message, sender_name, sender_role } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Mensaje vacío.' });
    }

    let role = sender_role || 'guest';
    let name = sender_name || 'Usuario';

    if (adminMode) {
      role = 'admin';
      name = 'Manu (Administrador)';
    } else if (missionary) {
      role = 'missionary';
      name = missionary.name;
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
// 9. OMNICHANNEL CHATBOT AGENT WEBHOOK (WhatsApp / Instagram)
// ==========================================
router.post('/webhooks/agent', async (req, res) => {
  try {
    const { platform, sender_phone, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Falta mensaje.' });
    }

    const text = message.toLowerCase().trim();

    if (text.startsWith('crear mision') || text.startsWith('crear misión')) {
      let hospital = await findRecord('hospitals', { phone: sender_phone });
      if (!hospital) {
        const hospitals = await readTable('hospitals');
        for (const h of hospitals) {
          if (text.includes(h.name.toLowerCase()) || text.includes(h.name.split(' ')[1]?.toLowerCase())) {
            hospital = h;
            break;
          }
        }
      }

      if (!hospital) {
        return res.json({
          reply: `⚠️ Tu número ${sender_phone} no está registrado como centro de salud/hospital en CUMIS Conecta. Por favor regístrate en el Portal Web primero.`
        });
      }

      if (hospital.status !== 'verified') {
        return res.json({
          reply: `⚠️ El centro de salud *${hospital.name}* está registrado pero su KYC aún no ha sido verificado por el administrador.`
        });
      }

      const items = [];
      for (const prodName of ALLOWED_PRODUCTS) {
        const keyword = prodName.split(' ')[0].toLowerCase();
        const regex = new RegExp(`(\\d+)\\s*${keyword}`, 'i');
        const match = text.match(regex);
        if (match) {
          const prodData = await findRecord('products', { name: prodName });
          const price = prodData ? prodData.price : 1.50;
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

      const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const mission = await insertRecord('missions', {
        hospital_id: hospital.id,
        hospital_name: hospital.name,
        missionary_id: null,
        missionary_name: null,
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
        reply: `🩺 ¡Misión creada con éxito! El identificador es: *${mission.id}* por un total de *$${total_amount.toFixed(2)}* para *${hospital.name}*.\n\nHemos notificado a los misioneros en Mérida para que reclamen la misión.`
      });
    }

    if (text.startsWith('tomar mision') || text.startsWith('tomar misión')) {
      const match = text.match(/mis-\d+/);
      if (!match) {
        return res.json({ reply: '⚠️ Por favor indique el código de la misión (ej: "tomar mision MIS-101").' });
      }
      const missionId = match[0].toUpperCase();

      const missionary = await findRecord('missionaries', { phone: sender_phone });
      const provider = await findRecord('providers', { phone: sender_phone });

      if (!missionary && !provider) {
        return res.json({
          reply: `⚠️ Tu número ${sender_phone} no está registrado como misionero o proveedor verificado. Regístrate en el Portal Web con tu KYC de Meru o Zelle primero.`
        });
      }

      const operator = missionary
        ? { type: 'missionary', user: missionary }
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

      const operatorRating = await getAverageRating(operator.user.id);
      if (Number(mission.total_amount) > 100.00 && operatorRating < 4.0) {
        return res.json({
          reply: `⚠️ Misión de alto fondeo ($${Number(mission.total_amount).toFixed(2)}). Para tomarla necesitas una valoración mínima de 4.0 estrellas (Tu promedio actual es ${operatorRating}).`
        });
      }

      const isDirect = text.includes('donacion') || text.includes('donación') || text.includes('directo');
      const claimData = {};
      
      if (isDirect) {
        claimData.status = 'funded';
        claimData.donor_name = `${operator.user.name} (Directo)`;
      } else {
        claimData.status = 'claimed';
      }

      if (operator.type === 'missionary') {
        claimData.missionary_id = operator.user.id;
        claimData.missionary_name = operator.user.name;
        claimData.provider_id = null;
        claimData.provider_name = null;
      } else {
        claimData.provider_id = operator.user.id;
        claimData.provider_name = operator.user.name;
        claimData.missionary_id = null;
        claimData.missionary_name = null;
      }

      await updateRecord('missions', mission.id, claimData);

      if (isDirect) {
        await insertRecord('evidences', {
          mission_id: mission.id,
          donor_transfer_path: 'direct-donation',
          missionary_receipt_path: 'direct-donation',
          invoice_photo_path: null,
          delivery_photo_path: null,
          uploaded_at: new Date().toISOString()
        });
      }

      await insertRecord('chats', {
        mission_id: mission.id,
        sender_role: 'system',
        sender_name: 'WhatsApp Bot',
        message: isDirect
          ? `Misión tomada vía WhatsApp por el operador ${operator.user.name} (${operator.type === 'missionary' ? 'Misionero' : 'Proveedor'}) como DONACIÓN DIRECTA.`
          : `Misión tomada vía WhatsApp por el operador ${operator.user.name} (${operator.type === 'missionary' ? 'Misionero' : 'Proveedor'}).`,
        timestamp: new Date().toISOString()
      });

      if (isDirect) {
        return res.json({
          reply: `🚚 ¡Misión *${missionId}* asignada a ti como *Donación Directa* (insumos disponibles)!\n\nSe han omitido los pasos de fondeo. Puedes proceder directamente a despachar/comprar los insumos y subir la factura comercial.`
        });
      }

      return res.json({
        reply: `🚚 ¡Misión *${missionId}* asignada a ti! Tu billetera *[${operator.user.kyc_type.toUpperCase()}] ${operator.user.kyc_details}* ha sido vinculada.\n\nHemos notificado a los donadores internacionales para el fondeo de $${Number(mission.total_amount).toFixed(2)}.`
      });
    }

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

      let operator_name = mission.missionary_name || mission.provider_name;
      let kyc_type = 'N/A';
      let kyc_details = 'N/A';
      
      if (mission.missionary_id) {
        const missionary = await findRecord('missionaries', { id: mission.missionary_id });
        if (missionary) {
          kyc_type = missionary.kyc_type;
          kyc_details = missionary.kyc_details;
        }
      } else if (mission.provider_id) {
        const provider = await findRecord('providers', { id: mission.provider_id });
        if (provider) {
          kyc_type = provider.kyc_type;
          kyc_details = provider.kyc_details;
        }
      }

      await updateRecord('missions', mission.id, {
        donor_name: 'Donador Omnicanal',
        status: 'funding_sent'
      });

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
          missionary_receipt_path: null,
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

    if (text.startsWith('confirmar fondos')) {
      const match = text.match(/mis-\d+/);
      if (!match) {
        return res.json({ reply: '⚠️ Por favor indique el código de la misión a confirmar (ej: "confirmar fondos MIS-101").' });
      }
      const missionId = match[0].toUpperCase();

      const missionary = await findRecord('missionaries', { phone: sender_phone });
      const provider = await findRecord('providers', { phone: sender_phone });

      if ((!missionary || missionary.status !== 'verified') && (!provider || provider.status !== 'verified')) {
        return res.json({ reply: '⚠️ No autorizado. Debe ser un misionero o proveedor de insumos verificado en el sistema.' });
      }

      const operator = missionary ? missionary : provider;

      const mission = await findRecord('missions', { id: missionId });
      if (!mission) {
        return res.json({ reply: `⚠️ La misión ${missionId} no existe.` });
      }

      if (mission.missionary_id !== operator.id && mission.provider_id !== operator.id) {
        return res.json({ reply: `⚠️ No tienes asignada la misión ${missionId}.` });
      }

      if (mission.status !== 'funding_sent') {
        return res.json({ reply: `⚠️ La misión ${missionId} debe estar en estado [Comprobante Enviado] para verificar recepción.` });
      }

      await updateRecord('missions', mission.id, {
        status: 'funded'
      });

      const evidence = await findRecord('evidences', { mission_id: mission.id });
      if (evidence) {
        await updateRecord('evidences', evidence.id, {
          missionary_receipt_path: 'public/uploads/missionary-receipt-mock.jpg',
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
        reply: `` +
               `✅ ¡Fondos confirmados para la misión *${missionId}*! Los fondos están marcados como recibidos y disponibles en Mérida. Puedes proceder a realizar el despacho y subir la factura comercial.`
      });
    }

    if (text.startsWith('valorar')) {
      const matchId = text.match(/mis-\d+/);
      const matchStars = text.match(/con\s+([1-5])\s+estrella/i);

      if (!matchId || !matchStars) {
        return res.json({ reply: '⚠️ Comando inválido. Use el formato: "valorar MIS-101 con 5 estrellas" (opcional: ": comentario").' });
      }
      const missionId = matchId[0].toUpperCase();
      const stars = parseInt(matchStars[1]);

      let comment = '';
      const parts = text.split(':');
      if (parts.length > 1) {
        comment = parts.slice(1).join(':').trim();
      }

      const mission = await findRecord('missions', { id: missionId });
      if (!mission) {
        return res.json({ reply: `⚠️ La misión ${missionId} no existe.` });
      }

      let reviewer_id = 'guest';
      let reviewer_role = 'donor';
      let reviewee_id = null;
      let reviewee_role = null;

      const hospital = await findRecord('hospitals', { phone: sender_phone });
      const missionary = await findRecord('missionaries', { phone: sender_phone });
      const provider = await findRecord('providers', { phone: sender_phone });
      const donor = await findRecord('donors', { phone: sender_phone });

      if (hospital) {
        reviewer_id = hospital.id;
        reviewer_role = 'hospital';
        reviewee_id = mission.missionary_id || mission.provider_id;
        reviewee_role = mission.missionary_id ? 'missionary' : 'provider';
      } else if (missionary) {
        reviewer_id = missionary.id;
        reviewer_role = 'missionary';
        reviewee_id = 'donor-seed';
        reviewee_role = 'donor';
      } else if (provider) {
        reviewer_id = provider.id;
        reviewer_role = 'provider';
        reviewee_id = 'donor-seed';
        reviewee_role = 'donor';
      } else if (donor) {
        reviewer_id = donor.id;
        reviewer_role = 'donor';
        reviewee_id = mission.missionary_id || mission.provider_id;
        reviewee_role = mission.missionary_id ? 'missionary' : 'provider';
      } else {
        reviewer_id = 'donor-seed';
        reviewer_role = 'donor';
        reviewee_id = mission.missionary_id || mission.provider_id;
        reviewee_role = mission.missionary_id ? 'missionary' : 'provider';
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

      await updateRecord('missions', mission.id, {
        status: 'completed'
      });

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
        reply: `` +
               `🏥 ¡Entrega confirmada para la misión *${missionId}*! Los insumos están en el hospital.\n\nHemos cargado la verificación al Dashboard Público de Transparencia y notificado al donador. ¡Gracias por participar!`
      });
    }

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

export default router;
