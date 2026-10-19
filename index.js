require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'))
// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://rig_pm_pro_db_user:uO1BVQZPaT7Yvty087y7Pt4tJJqU6R6r@dpg-db9phn0m7kps73e8svrg-a.onrender.com/rig_pm_pro_db'
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const password = req.headers['x-password'] || req.body.password;
  if (password === process.env.APP_PASSWORD || password === '123456') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Initialize database tables on startup
async function initializeDatabase() {
  try {
    // Assets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        make VARCHAR(100),
        model VARCHAR(100),
        year INTEGER,
        vin VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Repairs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS repairs (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER REFERENCES assets(id),
        user_id VARCHAR(255),
        description TEXT NOT NULL,
        category VARCHAR(100),
        vendor VARCHAR(255),
        vendor_location VARCHAR(255),
        cost DECIMAL(10, 2),
        date_completed DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Maintenance logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER REFERENCES assets(id),
        user_id VARCHAR(255),
        odometer_hours INTEGER,
        date_recorded DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Initialize database on startup
initializeDatabase();

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rig PM Pro Backend is running' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.APP_PASSWORD || password === '123456') {
    res.json({
      success: true,
      token: 'authenticated',
      message: 'Login successful'
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid password'
    });
  }
});

// ASSETS ENDPOINTS
app.get('/api/assets', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM assets ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

app.post('/api/assets', authenticate, async (req, res) => {
  try {
    const { name, make, model, year, vin, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO assets (name, make, model, year, vin, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, make, model, year, vin, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating asset:', err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

app.put('/api/assets/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, make, model, year, vin, notes } = req.body;
    const result = await pool.query(
      'UPDATE assets SET name = $1, make = $2, model = $3, year = $4, vin = $5, notes = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [name, make, model, year, vin, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating asset:', err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

app.delete('/api/assets/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM assets WHERE id = $1', [id]);
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    console.error('Error deleting asset:', err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// REPAIRS ENDPOINTS
app.get('/api/repairs', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM repairs ORDER BY date_completed DESC, created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching repairs:', err);
    res.status(500).json({ error: 'Failed to fetch repairs' });
  }
});

app.post('/api/repairs', authenticate, async (req, res) => {
  try {
    const { asset_id, description, category, vendor, vendor_location, cost, date_completed, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO repairs (asset_id, description, category, vendor, vendor_location, cost, date_completed, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [asset_id, description, category, vendor, vendor_location, cost, date_completed, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating repair:', err);
    res.status(500).json({ error: 'Failed to create repair' });
  }
});

app.put('/api/repairs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { asset_id, description, category, vendor, vendor_location, cost, date_completed, notes } = req.body;
    const result = await pool.query(
      'UPDATE repairs SET asset_id = $1, description = $2, category = $3, vendor = $4, vendor_location = $5, cost = $6, date_completed = $7, notes = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
      [asset_id, description, category, vendor, vendor_location, cost, date_completed, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repair not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating repair:', err);
    res.status(500).json({ error: 'Failed to update repair' });
  }
});

app.delete('/api/repairs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM repairs WHERE id = $1', [id]);
    res.json({ message: 'Repair deleted successfully' });
  } catch (err) {
    console.error('Error deleting repair:', err);
    res.status(500).json({ error: 'Failed to delete repair' });
  }
});

// MAINTENANCE LOGS ENDPOINTS
app.get('/api/maintenance-logs', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maintenance_logs ORDER BY date_recorded DESC, created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching maintenance logs:', err);
    res.status(500).json({ error: 'Failed to fetch maintenance logs' });
  }
});

app.post('/api/maintenance-logs', authenticate, async (req, res) => {
  try {
    const { asset_id, odometer_hours, date_recorded, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO maintenance_logs (asset_id, odometer_hours, date_recorded, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [asset_id, odometer_hours, date_recorded, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating maintenance log:', err);
    res.status(500).json({ error: 'Failed to create maintenance log' });
  }
});

app.put('/api/maintenance-logs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { asset_id, odometer_hours, date_recorded, notes } = req.body;
    const result = await pool.query(
      'UPDATE maintenance_logs SET asset_id = $1, odometer_hours = $2, date_recorded = $3, notes = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [asset_id, odometer_hours, date_recorded, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance log not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating maintenance log:', err);
    res.status(500).json({ error: 'Failed to update maintenance log' });
  }
});

app.delete('/api/maintenance-logs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM maintenance_logs WHERE id = $1', [id]);
    res.json({ message: 'Maintenance log deleted successfully' });
  } catch (err) {
    console.error('Error deleting maintenance log:', err);
    res.status(500).json({ error: 'Failed to delete maintenance log' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rig PM Pro Backend running on port ${PORT}`);
});
