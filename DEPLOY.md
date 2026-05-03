# Deployment Configuration - React Web Migration

## Overview
This application has been migrated from Expo Native to React Web. The deployment configuration has been updated to support the new stack.

## Stack
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python 3.11
- **Database**: MongoDB (Atlas in production)
- **Web Server**: Nginx (reverse proxy)

## Key Files

### entrypoint.sh
Main entrypoint script that:
1. Starts Nginx reverse proxy
2. Starts FastAPI backend on port 8001
3. Builds React frontend
4. Serves built frontend on port 3000

### nginx.conf
Nginx configuration that routes:
- `/` → Frontend (port 3000)
- `/api/` → Backend (port 8001)
- `/uploads/` → Backend static files
- `/health` → Health check endpoint

## Environment Variables

### Backend (.env)
Required environment variables:
- `MONGO_URL` - MongoDB connection string (will be provided by deployment system for Atlas)
- `DB_NAME` - Database name
- `JWT_SECRET` - JWT signing secret
- `ADMIN_EMAIL` - Admin email
- `ADMIN_PASSWORD` - Admin password
- `RAZORPAY_KEY_ID` - Razorpay key (optional)
- `RAZORPAY_KEY_SECRET` - Razorpay secret (optional)
- `TWILIO_ACCOUNT_SID` - Twilio SID (optional)
- `TWILIO_AUTH_TOKEN` - Twilio token (optional)
- `TWILIO_FROM_NUMBER` - Twilio phone number (optional)

### Frontend (.env)
- `VITE_API_URL` - Backend API URL (auto-configured by deployment)

## Port Configuration
- **Frontend**: 3000
- **Backend**: 8001
- **Nginx**: 80

## Health Checks
- Backend: `GET /health` → `{"status": "healthy", "app": "HANSA Agriculture"}`
- Backend API: `GET /api/` → `{"status": "ok", "app": "RKAI Customer App"}`

## Build Process
1. Backend dependencies installed from `requirements.txt`
2. Frontend dependencies installed from `package.json`
3. Frontend built with `npm run build` (output: `dist/`)
4. Frontend served as static files

## Database
- **Development**: Local MongoDB on localhost:27017
- **Production**: MongoDB Atlas (connection string provided by deployment system)
- The backend automatically runs seed data on startup

## Removed Files
The following Expo-specific files were removed to prevent EAS build triggers:
- `/app/frontend/app.json` (Expo config)
- `/app/frontend/metro.config.js` (Metro bundler config)

## Changes Made for Deployment

### 1. Removed Expo Configuration
- Deleted `app.json` and `metro.config.js` from frontend to prevent EAS detection

### 2. Created Deployment Scripts
- `entrypoint.sh` - Orchestrates all services
- `nginx.conf` - Reverse proxy configuration

### 3. Updated Frontend Build
- Added `serve` package for production serving
- Configured Vite build output to `dist/`
- Set up production build optimizations

### 4. Backend Updates
- Added `/health` endpoint for deployment health checks
- Ensured proper environment variable handling
- Removed quotes from MONGO_URL in .env

### 5. Frontend Updates
- API calls configured to use `VITE_API_URL` environment variable
- Build process optimized for production

## Deployment Flow
1. Docker image built with all dependencies
2. Backend dependencies installed via pip
3. Frontend dependencies installed via npm
4. Frontend built to static files
5. Services started via entrypoint.sh
6. Nginx routes traffic appropriately

## Testing Locally
```bash
# Build frontend
cd /app/frontend
npm install
npm run build

# Start backend
cd /app/backend
pip install -r requirements.txt
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001

# Serve frontend
cd /app/frontend
npx serve -s dist -l 3000

# Or run everything with the entrypoint
chmod +x /app/entrypoint.sh
/app/entrypoint.sh
```

## Troubleshooting

### EAS Build Error
**Error**: "No app.json, app.config.js, or app.config.ts found!"
**Solution**: This was caused by leftover Expo config files. They have been removed.

### MongoDB Connection
- In production, the `MONGO_URL` environment variable will be automatically set to Atlas connection string
- The backend reads `MONGO_URL` from environment variables
- No code changes needed for different environments

### Frontend API Calls
- All API calls use relative paths (`/api/...`)
- Nginx routes these to the backend
- No CORS issues as everything is served from same origin

## Migration Notes
This app was migrated from Expo Native to React Web on May 3, 2026. The migration:
- Preserved 100% of backend functionality
- Converted all React Native components to React web components
- Maintained all features: auth, catalog, cart, orders, admin, dealer, manager portals
- Updated deployment configuration for web hosting

For more details, see `/app/MIGRATION.md`
