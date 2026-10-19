require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from root directory
app.use(express.static('.'));

// Routes for HTML pages
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/lpv8.html');
});

app.get('/app.html', (req, res) => {
  res.sendFile(__dirname + '/fabv22.html');
});

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
        type VARCHAR(50),
        make VARCHAR(100),
        model VARCHAR(100),
        year INTEGER,
        vin VARCHAR(50),
        unitNumber VARCHAR(50),
        engineType VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns if they don't exist (for migration)
    await pool.query(`
      ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS type VARCHAR(50)
    `);
    await pool.query(`
      ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS unitNumber VARCHAR(50)
    `);
    await pool.query(`
      ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS engineType VARCHAR(100)
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

// GET /api/assets - Get all assets
app.get('/api/assets', authenticate, async (req, res) => {
  console.log('GET /api/assets - Fetching all assets');
  try {
    const result = await pool.query('SELECT * FROM assets ORDER BY created_at DESC');
    console.log(`Retrieved ${result.rows.length} assets`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).json({ error: 'Failed to fetch assets', details: err.message });
  }
});

// GET /api/assets/:assetId - Get single asset by ID
app.get('/api/assets/:assetId', authenticate, async (req, res) => {
  console.log(`GET /api/assets/${req.params.assetId} - Fetching single asset`);
  try {
    const { assetId } = req.params;

    // Validate assetId is a number
    if (!Number.isInteger(parseInt(assetId))) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const result = await pool.query('SELECT * FROM assets WHERE id = $1', [assetId]);

    if (result.rows.length === 0) {
      console.log(`Asset ${assetId} not found`);
      return res.status(404).json({ error: 'Asset not found' });
    }

    console.log(`Asset ${assetId} retrieved successfully`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`Error fetching asset ${req.params.assetId}:`, err);
    res.status(500).json({ error: 'Failed to fetch asset', details: err.message });
  }
});

// POST /api/assets - Create new asset
app.post('/api/assets', authenticate, async (req, res) => {
  console.log('POST /api/assets - Creating new asset');
  try {
    const { type, make, model, year, vin, unitNumber, engineType, notes } = req.body;

    // Validate required fields
    if (!type || !make || !model) {
      console.warn('Missing required fields:', { type, make, model });
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['type', 'make', 'model']
      });
    }

    const result = await pool.query(
      'INSERT INTO assets (type, make, model, year, vin, unitNumber, engineType, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [type, make, model, year, vin, unitNumber, engineType, notes]
    );

    console.log(`Asset created with ID: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating asset:', err);
    res.status(500).json({ error: 'Failed to create asset', details: err.message });
  }
});

// PUT /api/assets/:assetId - Update asset
app.put('/api/assets/:assetId', authenticate, async (req, res) => {
  console.log(`PUT /api/assets/${req.params.assetId} - Updating asset`);
  try {
    const { assetId } = req.params;
    const { type, make, model, year, vin, unitNumber, engineType, notes } = req.body;

    // Validate assetId is a number
    if (!Number.isInteger(parseInt(assetId))) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    // Validate required fields
    if (!type || !make || !model) {
      console.warn(`Missing required fields for asset ${assetId}:`, { type, make, model });
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['type', 'make', 'model']
      });
    }

    const result = await pool.query(
      'UPDATE assets SET type = $1, make = $2, model = $3, year = $4, vin = $5, unitNumber = $6, engineType = $7, notes = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
      [type, make, model, year, vin, unitNumber, engineType, notes, assetId]
    );

    if (result.rows.length === 0) {
      console.log(`Asset ${assetId} not found for update`);
      return res.status(404).json({ error: 'Asset not found' });
    }

    console.log(`Asset ${assetId} updated successfully`);
    res.json({ success: true, updatedAsset: result.rows[0] });
  } catch (err) {
    console.error(`Error updating asset ${req.params.assetId}:`, err);
    res.status(500).json({ error: 'Failed to update asset', details: err.message });
  }
});

// DELETE /api/assets/:assetId - Delete asset
app.delete('/api/assets/:assetId', authenticate, async (req, res) => {
  console.log(`DELETE /api/assets/${req.params.assetId} - Deleting asset`);
  try {
    const { assetId } = req.params;

    // Validate assetId is a number
    if (!Number.isInteger(parseInt(assetId))) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING id', [assetId]);

    if (result.rows.length === 0) {
      console.log(`Asset ${assetId} not found for deletion`);
      return res.status(404).json({ error: 'Asset not found' });
    }

    console.log(`Asset ${assetId} deleted successfully`);
    res.json({ success: true, message: 'Asset deleted' });
  } catch (err) {
    console.error(`Error deleting asset ${req.params.assetId}:`, err);
    res.status(500).json({ error: 'Failed to delete asset', details: err.message });
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
