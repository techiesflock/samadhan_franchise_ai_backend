# AI Assistant Backend - RAG System

A production-ready backend for a custom AI assistant built with **NestJS**, **Google Gemini API**, and **RAG (Retrieval-Augmented Generation)** using vector databases.

## 🚀 Features

- **🔐 JWT Authentication** - Secure user authentication and authorization
- **📄 Document Management** - Upload and process PDFs, text files, and documents
- **🧠 RAG System** - Retrieval-Augmented Generation for accurate, context-aware responses
- **🔍 Vector Search** - Fast semantic search using ChromaDB
- **💬 Chat Interface** - Conversational AI with session management
- **📊 Embeddings** - Google Gemini embeddings for semantic understanding
- **🎯 Context-Aware** - Answers questions based on your knowledge base
- **📈 Scalable Architecture** - Modular NestJS design for enterprise applications

## 🛠️ Tech Stack

- **Backend Framework**: NestJS
- **LLM**: Google Gemini API (gemini-1.5-flash)
- **Embeddings**: Google Gemini text-embedding-004
- **Vector Database**: ChromaDB
- **Language**: TypeScript
- **Document Processing**: pdf-parse, LangChain
- **Authentication**: JWT with Passport
- **API Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- **Node.js** >= 18.x
- **npm** or **yarn**
- **Google Gemini API Key** - Get it from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **ChromaDB** (optional if using local persistence)

## 🔧 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-assistant-backend
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

> **Note**: We use `--legacy-peer-deps` to handle peer dependency conflicts in LangChain packages.

### 3. Configure environment variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Required
GEMINI_API_KEY=your-gemini-api-key-here
JWT_SECRET=your-secret-key-here

# Optional - Start ChromaDB for RAG functionality
CHROMA_URL=disabled  # or http://localhost:8000 after running docker-compose up -d
```

### 4. Start the application

**Development mode:**

```bash
npm run start:dev
```

The server will start on `http://localhost:3000`

> **⚠️ Note:** By default, ChromaDB is disabled. The app will start successfully but document upload and chat features won't work. To enable RAG functionality, see [ChromaDB Setup Guide](CHROMADB_SETUP.md).

### 5. (Optional) Enable RAG Functionality

To use document upload and chat features:

```bash
# Start ChromaDB server
docker-compose up -d

# Update .env file:
CHROMA_URL=http://localhost:8000

# Restart the app (it will auto-reload in dev mode)
```

See [CHROMADB_SETUP.md](CHROMADB_SETUP.md) for detailed instructions.

## 📚 API Documentation

Once the application is running, visit:

**Swagger UI**: `http://localhost:3000/api/docs`

## 🔑 Quick Start Guide

### 1. Register/Login

**Register a new user:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "johndoe",
    "password": "StrongP@ss123"
  }'
```

**Login (or use demo user):**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "demo123"
  }'
```

**Response:**

```json
{
  "user": {
    "id": "...",
    "email": "demo@example.com",
    "username": "demo"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Save the token for subsequent requests.

### 2. Upload Documents

Upload PDF or text files to build your knowledge base:

```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

**Response:**

```json
{
  "statusCode": 201,
  "message": "Document uploaded successfully. Processing in background.",
  "data": {
    "id": "doc-uuid",
    "fileName": "document.pdf",
    "status": "processing"
  }
}
```

### 3. Ask Questions

Once documents are processed, start chatting:

```bash
curl -X POST http://localhost:3000/api/v1/chat/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the main features of the product?",
    "topK": 5
  }'
```

**Response:**

```json
{
  "statusCode": 200,
  "data": {
    "sessionId": "session-uuid",
    "message": "What are the main features of the product?",
    "answer": "Based on the documentation, the main features include...",
    "sources": [
      {
        "content": "Excerpt from relevant document...",
        "fileName": "product-manual.pdf",
        "score": 0.92
      }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🏗️ Architecture

### Module Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── config/                 # Configuration
│   └── configuration.ts
├── common/                 # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   └── interfaces/
└── modules/
    ├── auth/              # Authentication & JWT
    ├── chat/              # Chat & RAG logic
    │   ├── chat.service.ts       # RAG orchestration
    │   └── services/
    │       └── gemini.service.ts # LLM integration
    ├── documents/         # Document management
    ├── ingestion/         # Document processing & chunking
    └── vector/            # Vector database operations
```

### RAG Flow

```
1. User uploads document
   ↓
2. Extract text (pdf-parse)
   ↓
3. Split into chunks (RecursiveCharacterTextSplitter)
   ↓
4. Generate embeddings (Gemini text-embedding-004)
   ↓
5. Store in ChromaDB

User asks question
   ↓
1. Generate query embedding
   ↓
2. Search vector DB (top-k similar chunks)
   ↓
3. Build context from retrieved chunks
   ↓
4. Send to Gemini with context + question
   ↓
5. Return answer with sources
```

## 🔌 API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/profile` - Get user profile

### Documents

- `POST /api/v1/documents/upload` - Upload single document
- `POST /api/v1/documents/upload/multiple` - Upload multiple documents
- `GET /api/v1/documents` - List all documents
- `GET /api/v1/documents/stats` - Get statistics
- `GET /api/v1/documents/:id` - Get document details
- `DELETE /api/v1/documents/:id` - Delete document

### Chat

- `POST /api/v1/chat/ask` - Ask a question
- `POST /api/v1/chat/sessions` - Create chat session
- `GET /api/v1/chat/sessions` - Get user sessions
- `GET /api/v1/chat/sessions/:id` - Get session details
- `DELETE /api/v1/chat/sessions/:id` - Delete session
- `POST /api/v1/chat/sessions/:id/clear` - Clear session history
- `GET /api/v1/chat/health` - Health check

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `GEMINI_API_KEY` | Google Gemini API key | **Required** |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` |
| `JWT_SECRET` | JWT signing secret | **Change in prod** |
| `CHROMA_PATH` | ChromaDB storage path | `./chroma_data` |
| `CHUNK_SIZE` | Text chunk size | `1000` |
| `CHUNK_OVERLAP` | Chunk overlap size | `200` |
| `CHAT_TOP_K` | Retrieved documents | `5` |
| `CHAT_TEMPERATURE` | LLM temperature | `0.7` |

### Document Processing

- **Supported formats**: PDF, TXT, DOC, DOCX
- **Max file size**: 10MB (configurable)
- **Chunking strategy**: RecursiveCharacterTextSplitter
- **Chunk size**: 1000 characters
- **Chunk overlap**: 200 characters

### Vector Database

- **Default**: ChromaDB with local persistence
- **Collection**: `ai-assistant-docs`
- **Embeddings**: Google Gemini text-embedding-004 (768 dimensions)

## 🔒 Security

- **JWT-based authentication** with configurable expiration
- **Password hashing** using bcrypt
- **Request validation** with class-validator
- **CORS** configuration
- **File upload validation** (type, size)
- **Global exception handling**

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Production Deployment

### Build for production

```bash
npm run build
```

### Start production server

```bash
npm run start:prod
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure proper CORS origins
4. Use secure database connections
5. Set up proper logging and monitoring
6. Configure SSL/TLS

## 🐳 Docker Support (Optional)

Create `docker-compose.yml` for ChromaDB:

```yaml
version: '3.8'
services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - ./chroma_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
```

Run:

```bash
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

MIT License - feel free to use this project for your applications.

## 🆘 Troubleshooting

### Common Issues

**ChromaDB connection error:**
- Ensure ChromaDB is running (or using local persistence)
- Check `CHROMA_PATH` configuration

**Gemini API errors:**
- Verify API key is correct
- Check API quota/limits
- Ensure model name is valid

**File upload fails:**
- Check file size limits
- Verify file type is supported
- Check disk space for uploads

**Out of memory:**
- Reduce `CHUNK_SIZE`
- Process documents in smaller batches
- Increase Node.js heap size: `NODE_OPTIONS=--max-old-space-size=4096`

## 📧 Support

For issues and questions, please open a GitHub issue.

## 🎉 Acknowledgments

- NestJS team for the amazing framework
- Google for Gemini API
- ChromaDB for vector database
- LangChain for document processing utilities

---

**Built with ❤️ using NestJS and Google Gemini**
