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
  const newRecord = {
    id: crypto.randomUUID(),
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

// Initial catalog products (subset of the 29 allowed items)
const CATALOG_SEEDS = [
  { name: 'Gasas estériles', supplier_name: 'Droguería Médica Caracas', price: 1.50, stock: 1500 },
  { name: 'Povidine', supplier_name: 'FarmaOriente Mayorista', price: 4.80, stock: 300 },
  { name: 'Suturas', supplier_name: 'Insumos Médicos El Ávila', price: 2.20, stock: 800 },
  { name: 'Vendas', supplier_name: 'Insumos Médicos El Ávila', price: 0.90, stock: 1200 },
  { name: 'Alcohol', supplier_name: 'Droguería Médica Caracas', price: 3.00, stock: 450 },
  { name: 'Guantes estériles y no estériles', supplier_name: 'Suministros Clínicos Mérida', price: 12.50, stock: 200 },
  { name: 'Jeringas de 5, 10 y 20 ml', supplier_name: 'Droguería Médica Caracas', price: 0.25, stock: 5000 },
  { name: 'Solución ringer lactato', supplier_name: 'Laboratorios Baxter C.A.', price: 2.10, stock: 600 },
  { name: 'Solución 0,9%', supplier_name: 'Laboratorios Baxter C.A.', price: 1.90, stock: 1000 },
  { name: 'Anestésicos locales', supplier_name: 'FarmaOriente Mayorista', price: 8.50, stock: 150 },
  { name: 'Macrogoteros', supplier_name: 'Suministros Clínicos Mérida', price: 1.10, stock: 1100 },
  { name: 'Antibióticos EV (Endovenosos)', supplier_name: 'Laboratorios Baxter C.A.', price: 14.00, stock: 350 },
  { name: 'Pastillas potabilizadoras de agua', supplier_name: 'Droguería Médica Caracas', price: 0.15, stock: 10000 }
];

const DONATION_SEEDS = [
  { amount: 1500, donor_name: 'Asociación Médica Internacional', date: '2026-06-15' },
  { amount: 850, donor_name: 'Fundación Salud y Vida', date: '2026-06-20' },
  { amount: 3200, donor_name: 'Donantes Anónimos CUMIS', date: '2026-06-25' }
];

export async function seedDatabase() {
  await ensureDir(DATA_DIR);
  
  // Seed Products
  const products = await readTable('products');
  if (products.length === 0) {
    for (const prod of CATALOG_SEEDS) {
      await insertRecord('products', prod);
    }
    console.log('Seeded products.');
  }

  // Seed Donations
  const donations = await readTable('donations');
  if (donations.length === 0) {
    for (const don of DONATION_SEEDS) {
      await insertRecord('donations', don);
    }
    console.log('Seeded donations.');
  }

  // Create empty files for other tables if they don't exist
  const tables = ['operators', 'orders', 'order_items', 'disbursements', 'chats', 'evidences'];
  for (const t of tables) {
    const tData = await readTable(t);
    if (tData.length === 0) {
      await writeTable(t, []);
    }
  }
}
