# Quick Start Guide

Get up and running with the AI Assistant Backend in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Google Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))

## Setup Steps

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your-api-key-here
JWT_SECRET=my-secret-key-123
```

### 3. Start the Server

```bash
npm run start:dev
```

You should see:

```
[Bootstrap] Application is running on: http://localhost:3000
[Bootstrap] Swagger documentation: http://localhost:3000/api/docs
```

## Test the API

### 1. Login with Demo Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "demo123"
  }'
```

Save the token from the response:

```json
{
  "user": { "id": "...", "email": "demo@example.com" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Upload a Document

Create a test file:

```bash
echo "Our company offers 30-day returns on all electronics. 
Customer service is available 24/7 at support@example.com.
We ship worldwide with tracking." > test-document.txt
```

Upload it:

```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@test-document.txt"
```

Wait 5-10 seconds for processing to complete.

### 3. Ask a Question

```bash
curl -X POST http://localhost:3000/api/v1/chat/ask \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is your return policy?",
    "topK": 3
  }'
```

You should get a response with an answer based on your document!

## Next Steps

- Visit the Swagger UI: http://localhost:3000/api/docs
- Upload PDF documents
- Create chat sessions for conversations
- Check document stats
- Read the full [README.md](README.md)

## Common Issues

**Port already in use:**
```bash
# Change port in .env
PORT=3001
```

**Gemini API error:**
- Verify your API key is correct
- Check you have API quota remaining

**Document upload fails:**
- Ensure the `uploads` directory is writable
- Check file size < 10MB

## Using Swagger UI

The easiest way to test is with Swagger UI:

1. Go to http://localhost:3000/api/docs
2. Click "Authorize" button
3. Enter: `Bearer YOUR_TOKEN`
4. Test all endpoints interactively!

## What's Happening Behind the Scenes

1. **Document Upload**: Text is extracted, split into chunks, embedded, and stored in ChromaDB
2. **Chat Request**: Your question is embedded, similar chunks are retrieved, and Gemini generates an answer with context
3. **RAG Magic**: Responses are grounded in your documents, not just general knowledge

Enjoy building with the AI Assistant Backend! 🚀
