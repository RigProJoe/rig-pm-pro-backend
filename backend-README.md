# Rig PM Pro Backend

Node.js/Express backend for Rig PM Pro preventive maintenance tracker for owner-operator truck drivers.

## Features

- ✅ Password-protected login (password: 123456)
- ✅ PostgreSQL database integration
- ✅ RESTful API for Assets, Repairs, and Maintenance Logs
- ✅ CORS enabled for frontend integration
- ✅ Auto-initialization of database tables

## API Endpoints

### Authentication
- `POST /api/login` - Login with password
  - Body: `{ "password": "123456" }`

### Health Check
- `GET /api/health` - Check backend status

### Assets
- `GET /api/assets` - Get all assets
- `POST /api/assets` - Create new asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset

### Repairs
- `GET /api/repairs` - Get all repairs
- `POST /api/repairs` - Log a repair
- `PUT /api/repairs/:id` - Update repair
- `DELETE /api/repairs/:id` - Delete repair

### Maintenance Logs
- `GET /api/maintenance-logs` - Get all logs
- `POST /api/maintenance-logs` - Create maintenance log
- `PUT /api/maintenance-logs/:id` - Update log
- `DELETE /api/maintenance-logs/:id` - Delete log

## Authentication

All endpoints (except `/api/login` and `/api/health`) require authentication. Send the password in the request header:
```
X-Password: 123456
```

Or in the request body:
```json
{
  "password": "123456"
}
```

## Deployment to Render

### Step 1: Create Web Service on Render
1. Go to https://dashboard.render.com
2. Click "New Web Service"
3. Connect your GitHub repository (or use the files directly)
4. Name: `rig-pm-pro-api`
5. Runtime: Node
6. Build Command: `npm install`
7. Start Command: `npm start`

### Step 2: Set Environment Variables
In the Render dashboard for your service, add:
```
DATABASE_URL=postgresql://rig_pm_pro_db_user:uO1BVQZPaT7Yvty087y7Pt4tJJqU6R6r@dpg-db9phn0m7kps73e8svrg-a.onrender.com/rig_pm_pro_db
APP_PASSWORD=123456
NODE_ENV=production
```

### Step 3: Connect Domain
1. Add custom domain: `api.demo.rigpmpro.com`
2. Update DNS records at your domain provider

### Step 4: Deploy
Push to your repository and Render will auto-deploy.

## Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Create `.env` file with your database credentials

3. Start the server:
   ```
   npm run dev
   ```

4. Server runs on http://localhost:3000

## Testing the API

```bash
# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"123456"}'

# Get assets (with authentication)
curl -X GET http://localhost:3000/api/assets \
  -H "X-Password: 123456"

# Create asset
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -H "X-Password: 123456" \
  -d '{
    "name": "Freightliner Cascada",
    "make": "Freightliner",
    "model": "Cascada",
    "year": 2020,
    "vin": "1FUSC4DY3PE226519",
    "notes": "Main truck"
  }'
```

## Database Schema

### Assets
- id (int, primary key)
- name (varchar)
- make (varchar)
- model (varchar)
- year (int)
- vin (varchar)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

### Repairs
- id (int, primary key)
- asset_id (int, foreign key)
- description (text)
- category (varchar)
- vendor (varchar)
- vendor_location (varchar)
- cost (decimal)
- date_completed (date)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

### Maintenance Logs
- id (int, primary key)
- asset_id (int, foreign key)
- odometer_hours (int)
- date_recorded (date)
- notes (text)
- created_at (timestamp)
- updated_at (timestamp)

## License

Proprietary - Rig PM Pro
