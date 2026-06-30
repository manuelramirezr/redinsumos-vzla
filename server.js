import express from 'express';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { seedDatabase } from './src/db/database.js';
import router from './src/routes/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Ensure uploads dir exists
try {
  await fs.mkdir('./public/uploads', { recursive: true });
} catch (e) {}

// Mount all REST API and chatbot agent webhooks
app.use(router);

// Seed database on startup and run server
seedDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`CUMIS Conecta API server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
