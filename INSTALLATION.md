# Installation & Setup Guide

Complete step-by-step guide to get your AI Assistant Backend up and running.

## System Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (or yarn)
- **Operating System**: macOS, Linux, or Windows
- **Memory**: Minimum 4GB RAM
- **Disk Space**: 500MB for dependencies + storage for documents

## Step 1: Get Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key (you'll need it in Step 4)

## Step 2: Clone/Download Project

If you're starting fresh:

```bash
cd /Library/WebServer/Documents/ai-learning/new_ai_pr
```

## Step 3: Install Dependencies

```bash
npm install --legacy-peer-deps
```

> **Note**: The `--legacy-peer-deps` flag is required due to peer dependency conflicts between LangChain packages.

This will install:
- NestJS framework
- Google Gemini AI SDK
- LangChain for document processing
- ChromaDB for vector storage
- All other dependencies (~200MB)

Expected time: 2-5 minutes depending on your internet speed.

## Step 4: Configure Environment

Create your environment file:

```bash
cp .env.example .env
```

Edit `.env` with your favorite editor:

```bash
nano .env
# or
code .env
# or
vim .env
```

**Required configurations:**

```env
# Change this!
GEMINI_API_KEY=your-actual-api-key-from-step-1

# Change this to a random secure string!
JWT_SECRET=generate-a-random-secret-here-use-a-password-generator
```

**Optional configurations** (these have defaults):

```env
PORT=3000
CHROMA_PATH=./chroma_data
CHUNK_SIZE=1000
CHAT_TOP_K=5
```

### Generating a Strong JWT Secret

**Option 1 - Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2 - Using OpenSSL:**
```bash
openssl rand -hex 32
```

**Option 3 - Online Generator:**
Visit https://www.random.org/strings/ and generate a 64-character string.

## Step 5: Verify Installation

Check if everything is configured correctly:

```bash
npm run build
```

This should complete without errors. If you see errors, check:
- Node.js version: `node --version` (should be >= 18)
- TypeScript is installed: `npm list typescript`

## Step 6: Start the Application

### Development Mode (with hot reload):

```bash
npm run start:dev
```

You should see:

```
[Nest] 12345  - 01/15/2024, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/15/2024, 10:00:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 01/15/2024, 10:00:01 AM     LOG [Bootstrap] Application is running on: http://localhost:3000
[Nest] 12345  - 01/15/2024, 10:00:01 AM     LOG [Bootstrap] Swagger documentation: http://localhost:3000/api/docs
```

### Production Mode:

```bash
npm run build
npm run start:prod
```

## Step 7: Test the API

### Health Check

Open your browser and visit:

```
http://localhost:3000/api/v1
```

You should see:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "service": "AI Assistant Backend",
  "version": "1.0.0"
}
```

### API Documentation

Visit the Swagger UI:

```
http://localhost:3000/api/docs
```

You should see an interactive API documentation page.

## Step 8: First API Request

### Login with Demo Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "demo123"
  }'
```

**Expected response:**

```json
{
  "user": {
    "id": "...",
    "email": "demo@example.com",
    "username": "demo",
    "createdAt": "..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Save the token - you'll need it for authenticated requests!

## Troubleshooting

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:** Change the port in `.env`:

```env
PORT=3001
```

### Gemini API Error

**Error:** `Failed to initialize Gemini` or `API key not valid`

**Solutions:**
1. Verify your API key is correct in `.env`
2. Check you're not exceeding API quota
3. Visit [Google AI Studio](https://makersuite.google.com/) to verify API key status

### Permission Denied on Directories

**Error:** `EACCES: permission denied, mkdir 'uploads'`

**Solution:** Ensure write permissions:

```bash
chmod -R 755 /Library/WebServer/Documents/ai-learning/new_ai_pr
```

### Module Not Found

**Error:** `Cannot find module '@nestjs/core'` or `ERESOLVE unable to resolve dependency tree`

**Solution:** Reinstall dependencies with the legacy peer deps flag:

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### TypeScript Compilation Errors

**Solution:** Ensure TypeScript is installed globally:

```bash
npm install -g typescript
npm install
```

## Optional: ChromaDB Docker (Persistent Storage)

If you want to use ChromaDB server instead of local persistence:

```bash
docker-compose up -d
```

Then update `.env`:

```env
CHROMA_URL=http://localhost:8000
```

## Directory Permissions

Ensure these directories are writable:

```bash
mkdir -p uploads
mkdir -p chroma_data
mkdir -p logs
chmod 755 uploads chroma_data logs
```

## Verification Checklist

✅ Node.js 18+ installed  
✅ Dependencies installed (`node_modules` exists)  
✅ `.env` file created with GEMINI_API_KEY  
✅ Application starts without errors  
✅ Health check returns 200 OK  
✅ Swagger UI loads  
✅ Demo login works  

## Next Steps

1. Read [QUICK_START.md](QUICK_START.md) for your first document upload
2. Import [postman_collection.json](postman_collection.json) into Postman
3. Check [README.md](README.md) for detailed API documentation
4. Review [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system

## Getting Help

If you encounter issues:

1. Check the logs in `logs/error.log`
2. Enable debug mode: `npm run start:debug`
3. Review the troubleshooting section above
4. Check environment configuration in `.env`

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager (PM2, systemd)
3. Set up reverse proxy (nginx, Apache)
4. Use a real database (PostgreSQL, MySQL)
5. Configure SSL/TLS certificates
6. Set up monitoring and logging
7. Configure firewall rules
8. Use secrets management for API keys

Example with PM2:

```bash
npm install -g pm2
npm run build
pm2 start dist/main.js --name ai-assistant
pm2 save
pm2 startup
```

---

**Congratulations!** Your AI Assistant Backend is now running. 🎉
