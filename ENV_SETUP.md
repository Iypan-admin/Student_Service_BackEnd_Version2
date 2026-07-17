# Environment Variables Setup - Student Service Backend

## 📋 Required Environment Variables

Create a `.env` file in the root directory (`Student_Service_Backend-main/.env`) with the following variables:

```env
# Server Port
PORT=3006

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# JWT Secret for token generation
JWT_SECRET=your_jwt_secret_here

# Environment
NODE_ENV=production

# CORS Origins (comma-separated for multiple origins)
CORS_ORIGINS=https://ismlstudents.iypan.com,http://localhost:5173
```

## 🔧 Setup Instructions

1. **Create `.env` file:**
   ```bash
   cd Student_Service_Backend-main
   touch .env
   ```

2. **Get Supabase Credentials:**
   - Go to your Supabase project dashboard
   - Settings → API
   - Copy:
     - Project URL → `SUPABASE_URL`
     - anon/public key → `SUPABASE_KEY`
     - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Set JWT Secret:**
   - Generate a secure random string
   - Use for signing JWT tokens
   - Example: `openssl rand -base64 32`

4. **Configure CORS:**
   - Add all frontend URLs that will access this API
   - Separate multiple URLs with commas
   - Example: `CORS_ORIGINS=https://ismlstudents.iypan.com,http://localhost:5173`

5. **Start the server:**
   ```bash
   npm start
   # or
   node index.js
   ```

## 📍 Current Configuration

### **Port Configuration** (`index.js` line 65):
```javascript
const PORT = process.env.PORT || 3006;
```

### **Supabase Client** (`config/supabaseClient.js`):
```javascript
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_KEY
);

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);
```

### **CORS Configuration** (`index.js`):
```javascript
const corsOptions = {
    origin: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
        : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
```

## ⚠️ Important Notes

- **Never commit `.env` file** to version control (it should be in `.gitignore`)
- **Use different credentials** for development and production
- **Restart server** after changing environment variables
- **CORS_ORIGINS** should include all frontend URLs that will access the API

## 🔍 Verification

After setting up, verify:
1. Server starts without errors
2. Check console for: `🚀 Server running on port 3006`
3. Test API endpoint: `curl http://localhost:3006/api/health`
4. Check CORS headers in browser network tab

## 🐛 Troubleshooting

### **Port Already in Use:**
```bash
# Change PORT in .env or kill the process using port 3006
lsof -ti:3006 | xargs kill -9
```

### **Supabase Connection Error:**
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check Supabase project is active
- Verify network connectivity

### **CORS Errors:**
- Ensure frontend URL is in `CORS_ORIGINS`
- Check for trailing slashes in URLs
- Verify CORS_ORIGINS format: `origin1,origin2` (no spaces except after comma)



