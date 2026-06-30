import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve('./data');

// Ensure database files and directory exist
async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Simple in-memory lock system to prevent race conditions during writes
const locks = {};
async function acquireLock(table) {
  while (locks[table]) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  locks[table] = true;
}
function releaseLock(table) {
  locks[table] = false;
}

export async function readTable(tableName) {
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function writeTable(tableName, data) {
  await ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  const tempPath = `${filePath}.tmp`;
  await acquireLock(tableName);
  try {
    // Atomic write to prevent file corruption
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  } finally {
    releaseLock(tableName);
  }
}

export async function findRecord(tableName, query) {
  const data = await readTable(tableName);
  return data.find(item => {
    return Object.entries(query).every(([key, val]) => item[key] === val);
  });
}

export async function findRecords(tableName, query = {}) {
  const data = await readTable(tableName);
  return data.filter(item => {
    return Object.entries(query).every(([key, val]) => item[key] === val);
  });
}

export async function insertRecord(tableName, record) {
  const data = await readTable(tableName);
  // Generate short numeric ID for missions to make them friendly for chat/WhatsApp bot (e.g. 101, 102)
  let customId = crypto.randomUUID();
  if (tableName === 'missions') {
    const highestId = data.reduce((max, m) => {
      const num = parseInt(m.id.replace('MIS-', ''));
      return isNaN(num) ? max : Math.max(max, num);
    }, 100);
    customId = `MIS-${highestId + 1}`;
  }

  const newRecord = {
    id: customId,
    createdAt: new Date().toISOString(),
    ...record
  };
  data.push(newRecord);
  await writeTable(tableName, data);
  return newRecord;
}

export async function updateRecord(tableName, id, updates) {
  const data = await readTable(tableName);
  const index = data.findIndex(item => item.id === id);
  if (index === -1) {
    throw new Error(`Record with id ${id} not found in table ${tableName}`);
  }
  data[index] = {
    ...data[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  await writeTable(tableName, data);
  return data[index];
}

// Seeds definitions
const PRODUCT_SEEDS = [
  { name: 'Gasas estériles', supplier_name: 'Droguería Médica Caracas', price: 1.50, stock: 1000 },
  { name: 'Povidine', supplier_name: 'FarmaOriente Mayorista', price: 4.80, stock: 200 },
  { name: 'Suturas', supplier_name: 'Insumos Médicos El Ávila', price: 2.20, stock: 500 },
  { name: 'Alcohol', supplier_name: 'Droguería Médica Caracas', price: 3.00, stock: 300 },
  { name: 'Guantes estériles y no estériles', supplier_name: 'Suministros Clínicos Mérida', price: 12.50, stock: 150 },
  { name: 'Jeringas de 5, 10 y 20 ml', supplier_name: 'Droguería Médica Caracas', price: 0.25, stock: 2000 },
  { name: 'Solución ringer lactato', supplier_name: 'Laboratorios Baxter C.A.', price: 2.10, stock: 400 },
  { name: 'Solución 0,9%', supplier_name: 'Laboratorios Baxter C.A.', price: 1.90, stock: 600 },
  { name: 'Pastillas potabilizadoras de agua', supplier_name: 'Droguería Médica Caracas', price: 0.15, stock: 5000 }
];

const HOSPITAL_SEEDS = [
  { name: 'Hospital Universitario de los Andes (IAHULA)', location: 'Mérida, Venezuela', phone: '+584122222222' },
  { name: 'Hospital Vargas de Caracas', location: 'Caracas, Venezuela', phone: '+584121111111' }
];

const DONOR_SEEDS = [
  { name: 'Asociación Médica Internacional', email: 'donor1@ami.org', phone: '+13059999999' },
  { name: 'Fundación Salud y Vida', email: 'info@saludyvida.org', phone: '+13058888888' }
];

const STUDENT_SEEDS = [
  {
    name: 'Carlos Mendoza',
    phone: '+584141234567',
    email: 'carlos@gmail.com',
    kyc_type: 'meru',
    kyc_details: '@carlos_meru',
    password: 'password123',
    status: 'verified'
  }
];

export async function seedDatabase() {
  await ensureDir(DATA_DIR);
  
  // Seed Products
  const products = await readTable('products');
  if (products.length === 0) {
    for (const prod of PRODUCT_SEEDS) {
      await insertRecord('products', prod);
    }
    console.log('Seeded products.');
  }

  // Seed Hospitals
  const hospitals = await readTable('hospitals');
  if (hospitals.length === 0) {
    for (const hosp of HOSPITAL_SEEDS) {
      await insertRecord('hospitals', hosp);
    }
    console.log('Seeded hospitals.');
  }

  // Seed Donors
  const donors = await readTable('donors');
  if (donors.length === 0) {
    for (const don of DONOR_SEEDS) {
      await insertRecord('donors', don);
    }
    console.log('Seeded donors.');
  }

  // Seed verified student Carlos Mendoza for quick testing
  const students = await readTable('students');
  if (students.length === 0) {
    for (const stud of STUDENT_SEEDS) {
      await insertRecord('students', stud);
    }
    console.log('Seeded students.');
  }

  // Create empty files for other tables if they don't exist
  const tables = ['missions', 'mission_items', 'chats', 'evidences'];
  for (const t of tables) {
    const tData = await readTable(t);
    if (tData.length === 0) {
      await writeTable(t, []);
    }
  }
}
