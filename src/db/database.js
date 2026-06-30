import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.resolve('./data');
const DB_TYPE = process.env.DB_TYPE || 'json';

// Simple in-memory lock system to prevent race conditions during JSON writes
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

// Ensure database directory exists
async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// ==========================================
// SQLITE CONNECTOR & TABLES INITIALIZATION
// ==========================================
let sqliteDbInstance = null;
async function getSqliteDb() {
  if (sqliteDbInstance) return sqliteDbInstance;
  await ensureDir(DATA_DIR);
  const dbPath = path.join(DATA_DIR, 'database.sqlite');
  
  sqliteDbInstance = new sqlite3.Database(dbPath);
  
  // Promisify SQLite methods
  sqliteDbInstance.runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDbInstance.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };
  
  sqliteDbInstance.getAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDbInstance.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };
  
  sqliteDbInstance.allAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sqliteDbInstance.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  await initSqliteTables(sqliteDbInstance);
  return sqliteDbInstance;
}

async function initSqliteTables(db) {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      supplier_name TEXT,
      price REAL,
      stock INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT,
      location TEXT,
      phone TEXT,
      manager_name TEXT,
      manager_email TEXT,
      is_whatsapp INTEGER,
      rif TEXT,
      image_path TEXT,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS donors (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      kyc_type TEXT,
      kyc_details TEXT,
      password TEXT,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      kyc_type TEXT,
      kyc_details TEXT,
      password TEXT,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      mission_id TEXT,
      reviewer_id TEXT,
      reviewer_role TEXT,
      reviewee_id TEXT,
      reviewee_role TEXT,
      stars INTEGER,
      comment TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      hospital_name TEXT,
      student_id TEXT,
      student_name TEXT,
      provider_id TEXT,
      provider_name TEXT,
      donor_id TEXT,
      donor_name TEXT,
      total_amount REAL,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS mission_items (
      id TEXT PRIMARY KEY,
      mission_id TEXT,
      product_name TEXT,
      quantity INTEGER,
      price REAL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      mission_id TEXT,
      sender_role TEXT,
      sender_name TEXT,
      message TEXT,
      timestamp TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS evidences (
      id TEXT PRIMARY KEY,
      mission_id TEXT,
      donor_transfer_path TEXT,
      student_receipt_path TEXT,
      invoice_photo_path TEXT,
      delivery_photo_path TEXT,
      uploaded_at TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
}

function buildSqlQuery(query) {
  const entries = Object.entries(query).filter(([_, val]) => val !== undefined);
  if (entries.length === 0) return { whereStr: '', params: [] };
  const whereStr = 'WHERE ' + entries.map(([key, _]) => `${key} = ?`).join(' AND ');
  const params = entries.map(([_, val]) => val);
  return { whereStr, params };
}

// ==========================================
// MONGODB CONNECTOR
// ==========================================
let mongoClientInstance = null;
let mongoDbInstance = null;
async function getMongoDb() {
  if (mongoDbInstance) return mongoDbInstance;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cumis_conecta';
  mongoClientInstance = new MongoClient(uri);
  await mongoClientInstance.connect();
  mongoDbInstance = mongoClientInstance.db();
  return mongoDbInstance;
}

// ==========================================
// UNIFIED ABSTRACT DATABASE API METHODS
// ==========================================

export async function readTable(tableName) {
  if (DB_TYPE === 'sqlite') {
    const db = await getSqliteDb();
    const rows = await db.allAsync(`SELECT * FROM ${tableName}`);
    return rows;
  } else if (DB_TYPE === 'mongodb') {
    const db = await getMongoDb();
    const rows = await db.collection(tableName).find({}).toArray();
    return rows.map(r => {
      delete r._id;
      return r;
    });
  } else {
    // Default JSON fallback
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
}

export async function writeTable(tableName, data) {
  if (DB_TYPE === 'sqlite') {
    const db = await getSqliteDb();
    await db.runAsync(`DELETE FROM ${tableName}`);
    for (const record of data) {
      const keys = Object.keys(record);
      const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
      await db.runAsync(sql, keys.map(k => record[k]));
    }
  } else if (DB_TYPE === 'mongodb') {
    const db = await getMongoDb();
    await db.collection(tableName).deleteMany({});
    if (data.length > 0) {
      await db.collection(tableName).insertMany(data.map(d => ({ ...d })));
    }
  } else {
    await ensureDir(DATA_DIR);
    const filePath = path.join(DATA_DIR, `${tableName}.json`);
    const tempPath = `${filePath}.tmp`;
    await acquireLock(tableName);
    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);
    } finally {
      releaseLock(tableName);
    }
  }
}

export async function findRecord(tableName, query) {
  if (DB_TYPE === 'sqlite') {
    const db = await getSqliteDb();
    const { whereStr, params } = buildSqlQuery(query);
    const row = await db.getAsync(`SELECT * FROM ${tableName} ${whereStr} LIMIT 1`, params);
    return row || null;
  } else if (DB_TYPE === 'mongodb') {
    const db = await getMongoDb();
    const row = await db.collection(tableName).findOne(query);
    if (row) delete row._id;
    return row || null;
  } else {
    const data = await readTable(tableName);
    return data.find(item => {
      return Object.entries(query).every(([key, val]) => item[key] === val);
    });
  }
}

export async function findRecords(tableName, query = {}) {
  if (DB_TYPE === 'sqlite') {
    const db = await getSqliteDb();
    const { whereStr, params } = buildSqlQuery(query);
    const rows = await db.allAsync(`SELECT * FROM ${tableName} ${whereStr}`, params);
    return rows;
  } else if (DB_TYPE === 'mongodb') {
    const db = await getMongoDb();
    const rows = await db.collection(tableName).find(query).toArray();
    return rows.map(r => {
      delete r._id;
      return r;
    });
  } else {
    const data = await readTable(tableName);
    return data.filter(item => {
      return Object.entries(query).every(([key, val]) => item[key] === val);
    });
  }
}

export async function insertRecord(tableName, record) {
  let customId = crypto.randomUUID();
  if (tableName === 'missions') {
    let highestId = 100;
    if (DB_TYPE === 'sqlite') {
      const db = await getSqliteDb();
      const row = await db.getAsync("SELECT id FROM missions ORDER BY rowid DESC LIMIT 1");
      if (row && row.id) {
        const num = parseInt(row.id.replace('MIS-', ''));
        if (!isNaN(num)) highestId = num;
      }
    } else if (DB_TYPE === 'mongodb') {
      const db = await getMongoDb();
      const row = await db.collection('missions').find().sort({ createdAt: -1 }).limit(1).next();
      if (row && row.id) {
        const num = parseInt(row.id.replace('MIS-', ''));
        if (!isNaN(num)) highestId = num;
      }
    } else {
      const data = await readTable(tableName);
      highestId = data.reduce((max, m) => {
        const num = parseInt(m.id.replace('MIS-', ''));
        return isNaN(num) ? max : Math.max(max, num);
      }, 100);
    }
    customId = `MIS-${highestId + 1}`;
  }

  const newRecord = {
    id: customId,
    createdAt: new Date().toISOString(),
    ...record
  };

  if (DB_TYPE === 'sqlite') {
    const db = await getSqliteDb();
    const keys = Object.keys(newRecord);
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    await db.runAsync(sql, keys.map(k => newRecord[k]));
  } else if (DB_TYPE === 'mongodb') {
    const db = await getMongoDb();
    await db.collection(tableName).insertOne({ ...newRecord });
  } else {
    const data = await readTable(tableName);
    data.push(newRecord);
    await writeTable(tableName, data);
  }

  return newRecord;
}

export async function updateRecord(tableName, id, updates) {
  if (DB_TYPE === 'sqlite') {
    const db = await getSqliteDb();
    const existing = await findRecord(tableName, { id });
    if (!existing) {
      throw new Error(`Record with id ${id} not found in table ${tableName}`);
    }
    const updatedRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    const keys = Object.keys(updatedRecord);
    const sql = `UPDATE ${tableName} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
    await db.runAsync(sql, [...keys.map(k => updatedRecord[k]), id]);
    return updatedRecord;
  } else if (DB_TYPE === 'mongodb') {
    const db = await getMongoDb();
    const updatedAt = new Date().toISOString();
    await db.collection(tableName).updateOne(
      { id },
      { $set: { ...updates, updatedAt } }
    );
    const result = await db.collection(tableName).findOne({ id });
    if (!result) {
      throw new Error(`Record with id ${id} not found in table ${tableName}`);
    }
    delete result._id;
    return result;
  } else {
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
}

// ==========================================
// SEEDS DEFINITIONS
// ==========================================
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
  {
    name: 'Hospital Universitario de los Andes (IAHULA)',
    location: 'Mérida, Venezuela',
    phone: '+584122222222',
    manager_name: 'Dr. Gerardo Albarrán',
    manager_email: 'director@iahula.org',
    is_whatsapp: 1,
    rif: 'G-20001234-9',
    image_path: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&q=80&w=400',
    status: 'verified'
  },
  {
    name: 'Hospital Vargas de Caracas',
    location: 'Caracas, Venezuela',
    phone: '+584121111111',
    manager_name: 'Dra. María Elena Rivas',
    manager_email: 'direccion@hospitalvargas.gov.ve',
    is_whatsapp: 1,
    rif: 'G-20005678-0',
    image_path: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=400',
    status: 'verified'
  }
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

const PROVIDER_SEEDS = [
  {
    name: 'Droguería Mérida C.A.',
    phone: '+584167777777',
    email: 'contacto@drogueriamerida.com',
    kyc_type: 'meru',
    kyc_details: '@merida_drogueria',
    password: 'password123',
    status: 'verified'
  }
];

export async function seedDatabase() {
  if (DB_TYPE === 'sqlite') {
    await getSqliteDb();
  }
  
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

  // Seed verified provider for quick testing
  const providers = await readTable('providers');
  if (providers.length === 0) {
    for (const prov of PROVIDER_SEEDS) {
      await insertRecord('providers', prov);
    }
    console.log('Seeded providers.');
  }

  // Seed baseline ratings
  const ratings = await readTable('ratings');
  if (ratings.length === 0) {
    const vargas = await findRecord('hospitals', { name: 'Hospital Vargas de Caracas' });
    const iahula = await findRecord('hospitals', { name: 'Hospital Universitario de los Andes (IAHULA)' });
    const carlos = await findRecord('students', { name: 'Carlos Mendoza' });
    const drogueria = await findRecord('providers', { name: 'Droguería Mérida C.A.' });
    
    if (vargas) {
      await insertRecord('ratings', { mission_id: 'MIS-INIT-1', reviewer_role: 'donor', reviewer_id: 'seed', reviewee_role: 'hospital', reviewee_id: vargas.id, stars: 5, comment: 'Excelente comunicación.' });
      await insertRecord('ratings', { mission_id: 'MIS-INIT-2', reviewer_role: 'student', reviewer_id: 'seed', reviewee_role: 'hospital', reviewee_id: vargas.id, stars: 4, comment: 'Entrega coordinada a tiempo.' });
    }
    if (iahula) {
      await insertRecord('ratings', { mission_id: 'MIS-INIT-3', reviewer_role: 'donor', reviewer_id: 'seed', reviewee_role: 'hospital', reviewee_id: iahula.id, stars: 5, comment: 'Hospital muy organizado.' });
    }
    if (carlos) {
      await insertRecord('ratings', { mission_id: 'MIS-INIT-4', reviewer_role: 'hospital', reviewer_id: 'seed', reviewee_role: 'student', reviewee_id: carlos.id, stars: 5, comment: 'Logística impecable.' });
      await insertRecord('ratings', { mission_id: 'MIS-INIT-5', reviewer_role: 'donor', reviewer_id: 'seed', reviewee_role: 'student', reviewee_id: carlos.id, stars: 4, comment: 'Buena comunicación de facturas.' });
    }
    if (drogueria) {
      await insertRecord('ratings', { mission_id: 'MIS-INIT-6', reviewer_role: 'hospital', reviewer_id: 'seed', reviewee_role: 'provider', reviewee_id: drogueria.id, stars: 5, comment: 'Entrega directa rápida.' });
    }
    console.log('Seeded baseline ratings.');
  }

  // Create empty files/tables if they don't exist
  if (DB_TYPE === 'json') {
    const tables = ['missions', 'mission_items', 'chats', 'evidences', 'providers', 'ratings'];
    for (const t of tables) {
      const tData = await readTable(t);
      if (tData.length === 0) {
        await writeTable(t, []);
      }
    }
  }
}
