# ChromaDB Setup Guide

## Why ChromaDB?

ChromaDB is the vector database used for storing document embeddings and enabling RAG (Retrieval-Augmented Generation) functionality. Without it, you can use the API but document upload and chat features won't work.

## Important Note

**ChromaDB's JavaScript client requires a running server** - it doesn't support true in-memory mode like the Python client. By default, the application starts with ChromaDB disabled to allow you to test other features first.

## Current Status

When you see these warnings in the logs:

```
⚠️  ChromaDB is not configured. Vector search will not be available.
💡 To enable RAG functionality, run ChromaDB server:
   docker-compose up -d
   Then set CHROMA_URL=http://localhost:8000 in .env
```

This means:
- ✅ Your application is running
- ❌ Document upload and chat (RAG) features are disabled
- 💡 You need to start ChromaDB server to enable them

## Setup Options

### Option 1: Quick Start with Docker (Recommended)

The easiest way to run ChromaDB with persistent storage:

```bash
# 1. Start ChromaDB server
docker-compose up -d

# 2. Update your .env file
# Change this line:
CHROMA_URL=disabled

# To this:
CHROMA_URL=http://localhost:8000

# 3. Restart your application
# The server will automatically reload if running in dev mode
# Or restart manually: npm run start:dev
```

**Verify it's running:**
```bash
curl http://localhost:8000/api/v1/heartbeat
# Should return: {"nanosecond heartbeat": ...}
```

### Option 2: Manual Docker Run

If you don't want to use docker-compose:

```bash
docker run -d \
  -p 8000:8000 \
  -v ./chroma_data:/chroma/chroma \
  --name chromadb \
  chromadb/chroma:latest

# Then update CHROMA_URL in .env
CHROMA_URL=http://localhost:8000
```

### Option 3: Run Without ChromaDB (Limited Features)

Keep the default configuration:

```env
CHROMA_URL=disabled
```

**Available features:**
- ✅ Authentication (register, login)
- ✅ Health checks
- ✅ API documentation
- ✅ User management
- ❌ Document upload
- ❌ Chat/RAG functionality

## Verifying ChromaDB Connection

Once you've started ChromaDB and updated your .env:

1. **Check the logs** - You should see:
```
✅ Connected to collection: ai-assistant-docs
Collection contains 0 documents
```

2. **Test document upload:**
```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123"}' \
  | jq -r '.token')

# Create a test file
echo "This is a test document" > test.txt

# Upload it
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt"

# Should return: "Document uploaded successfully"
```

3. **Check stats:**
```bash
curl -X GET http://localhost:3000/api/v1/documents/stats \
  -H "Authorization: Bearer $TOKEN"

# Should show: "totalChunks": 1 (or more)
```

## Troubleshooting

### ChromaDB Won't Start

**Error:** `Cannot start service chromadb: ...`

**Solutions:**
- Check if port 8000 is already in use: `lsof -i :8000`
- Try a different port and update both docker-compose.yml and .env
- Check Docker is running: `docker info`

### Connection Refused

**Error:** `connect ECONNREFUSED 127.0.0.1:8000`

**Solutions:**
- Verify ChromaDB is running: `docker ps | grep chroma`
- Check ChromaDB logs: `docker logs chromadb`
- Restart ChromaDB: `docker-compose restart`

### Documents Not Being Stored

**Check:**
1. ChromaDB is running: `curl http://localhost:8000/api/v1/heartbeat`
2. CHROMA_URL is correct in .env
3. Application restarted after changing .env
4. Check application logs for errors

## Stopping ChromaDB

When you're done:

```bash
# Stop but keep data
docker-compose stop

# Stop and remove container (keeps data)
docker-compose down

# Stop and DELETE all data (⚠️ destructive!)
docker-compose down -v
rm -rf ./chroma_data
```

## Data Persistence

With the provided docker-compose.yml:
- Data is stored in `./chroma_data` directory
- Persists between container restarts
- Survives `docker-compose down`
- Only deleted with `docker-compose down -v` or manual deletion

## Alternative: Run ChromaDB Natively

If you don't want to use Docker, you can install ChromaDB natively:

```bash
# Install ChromaDB
pip install chromadb

# Run server
chroma run --path ./chroma_data

# Update .env
CHROMA_URL=http://localhost:8000
```

## Production Considerations

For production deployments:

1. **Use external ChromaDB server**
   - Don't run on same machine as API
   - Use managed service or dedicated server
   - Enable authentication

2. **Configure persistence**
   - Use persistent volumes
   - Regular backups
   - Monitor disk usage

3. **Security**
   - Enable ChromaDB authentication
   - Use HTTPS
   - Restrict network access
   - Use environment-specific credentials

4. **Scaling**
   - ChromaDB can be distributed
   - Consider ChromaDB Cloud for managed solution
   - Monitor performance and optimize

## Summary

- **Default:** ChromaDB disabled, app starts without RAG
- **Development:** Run `docker-compose up -d`, update .env
- **Production:** Use external ChromaDB server with auth
- **Data:** Persists in `./chroma_data` directory

---

**Quick Commands:**

```bash
# Start ChromaDB
docker-compose up -d

# Check if running
curl http://localhost:8000/api/v1/heartbeat

# View logs
docker logs -f chromadb

# Stop ChromaDB
docker-compose stop

# Restart ChromaDB
docker-compose restart
```
