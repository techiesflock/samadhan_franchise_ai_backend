# Architecture Documentation

## System Overview

This AI Assistant backend implements a **Retrieval-Augmented Generation (RAG)** system that combines the power of Large Language Models (Google Gemini) with a custom knowledge base stored in a vector database.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│                    (Web/Mobile/API Client)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ REST API
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      NestJS Backend                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  API Gateway Layer                    │  │
│  │  - JWT Authentication                                 │  │
│  │  - Request Validation                                 │  │
│  │  - Error Handling                                     │  │
│  │  - Logging                                            │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Business Logic Layer                    │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │   Auth      │  │  Documents   │  │   Chat     │ │   │
│  │  │   Module    │  │   Module     │  │   Module   │ │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘ │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐                  │   │
│  │  │ Ingestion   │  │   Vector     │                  │   │
│  │  │   Module    │  │   Module     │                  │   │
│  │  └─────────────┘  └──────────────┘                  │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────┬─────────────────┬────────────────────────────┘
               │                 │
               ▼                 ▼
    ┌──────────────────┐  ┌─────────────────┐
    │  Google Gemini   │  │    ChromaDB     │
    │      API         │  │  (Vector Store) │
    │                  │  │                 │
    │  - LLM Model     │  │  - Embeddings   │
    │  - Embeddings    │  │  - Similarity   │
    └──────────────────┘  └─────────────────┘
```

## Core Components

### 1. Auth Module

**Purpose**: Handle user authentication and authorization

**Key Components**:
- `AuthService`: User management, password hashing, JWT generation
- `JwtStrategy`: JWT token validation
- `LocalStrategy`: Username/password authentication
- `JwtAuthGuard`: Route protection

**Flow**:
```
User Registration → Hash Password → Store User → Generate JWT
User Login → Validate Credentials → Generate JWT
Protected Route → Validate JWT → Extract User → Process Request
```

### 2. Documents Module

**Purpose**: Manage document uploads and metadata

**Key Components**:
- `DocumentsService`: File handling, validation, metadata management
- `DocumentsController`: REST endpoints for CRUD operations

**Flow**:
```
Upload File → Validate (size, type) → Save to Disk → 
Create Metadata → Trigger Processing → Return Status
```

### 3. Ingestion Module

**Purpose**: Process documents and prepare them for the vector database

**Key Components**:
- `IngestionService`: Text extraction, chunking, embedding generation

**Flow**:
```
PDF/Text File → Extract Text → Split into Chunks →
Generate Embeddings (Gemini) → Store in Vector DB
```

**Chunking Strategy**:
- Uses `RecursiveCharacterTextSplitter` from LangChain
- Default chunk size: 1000 characters
- Overlap: 200 characters (prevents context loss at boundaries)
- Separators: `['\n\n', '\n', '. ', ' ', '']`

### 4. Vector Module

**Purpose**: Manage vector database operations

**Key Components**:
- `VectorService`: ChromaDB client, CRUD operations, similarity search

**Operations**:
- **Add**: Store document chunks with embeddings
- **Search**: Find top-k similar documents using cosine similarity
- **Delete**: Remove documents by ID
- **Stats**: Get collection information

### 5. Chat Module

**Purpose**: Handle chat requests and implement RAG logic

**Key Components**:
- `ChatService`: RAG orchestration, session management
- `GeminiService`: LLM and embedding generation

**RAG Flow**:
```
User Question
    ↓
Generate Query Embedding (Gemini text-embedding-004)
    ↓
Similarity Search in Vector DB (top-k documents)
    ↓
Retrieve Relevant Chunks
    ↓
Build Context String
    ↓
Construct Prompt: Context + History + Question
    ↓
Send to Gemini LLM (gemini-1.5-flash)
    ↓
Generate Answer
    ↓
Return Answer + Sources
```

## Data Flow

### Document Ingestion Pipeline

```
1. UPLOAD
   ├─ Validate file (type, size)
   ├─ Save to disk
   └─ Create metadata record

2. TEXT EXTRACTION
   ├─ PDF: pdf-parse library
   └─ Text: direct read

3. CHUNKING
   ├─ RecursiveCharacterTextSplitter
   ├─ Chunk size: 1000 chars
   └─ Overlap: 200 chars

4. EMBEDDING GENERATION
   ├─ Gemini text-embedding-004
   ├─ Batch processing (5 at a time)
   └─ 768-dimensional vectors

5. STORAGE
   ├─ ChromaDB collection
   ├─ Vector + metadata + content
   └─ Indexed for similarity search
```

### Chat Query Pipeline

```
1. RECEIVE QUESTION
   └─ User input + optional session ID

2. GENERATE QUERY EMBEDDING
   └─ Gemini text-embedding-004

3. VECTOR SEARCH
   ├─ Cosine similarity
   ├─ Top-K results (default: 5)
   └─ Return chunks + scores

4. CONTEXT BUILDING
   ├─ Format retrieved chunks
   ├─ Add metadata (file names, sources)
   └─ Construct context string

5. LLM GENERATION
   ├─ Prompt: Context + History + Question
   ├─ Model: gemini-1.5-flash
   ├─ Temperature: 0.7
   └─ Max tokens: 2048

6. RESPONSE
   ├─ Answer text
   ├─ Source references
   ├─ Relevance scores
   └─ Session ID
```

## Database Schema

### In-Memory Storage (Demo)

Currently uses in-memory Maps for user and session storage. In production, replace with:

**Users Table**:
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Documents Table**:
```sql
CREATE TABLE documents (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  file_name VARCHAR(255),
  original_name VARCHAR(255),
  mime_type VARCHAR(100),
  size INTEGER,
  path TEXT,
  status ENUM('pending', 'processing', 'completed', 'failed'),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Chat Sessions Table**:
```sql
CREATE TABLE chat_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  history JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Vector Database (ChromaDB)

**Collection Structure**:
```javascript
{
  ids: ["chunk-uuid-1", "chunk-uuid-2", ...],
  embeddings: [[0.1, 0.2, ...], [0.3, 0.4, ...], ...],
  documents: ["chunk text 1", "chunk text 2", ...],
  metadatas: [
    {
      documentId: "doc-uuid",
      fileName: "example.pdf",
      chunkIndex: 0,
      totalChunks: 10,
      source: "upload",
      uploadedAt: "2024-01-15T10:00:00Z"
    },
    ...
  ]
}
```

## Security Architecture

### Authentication Flow

```
1. User Registration
   ├─ Validate input (email, password strength)
   ├─ Hash password (bcrypt, 10 rounds)
   ├─ Store user
   └─ Return JWT

2. User Login
   ├─ Validate credentials
   ├─ Compare password hash
   ├─ Generate JWT (7-day expiry)
   └─ Return token

3. Protected Route Access
   ├─ Extract JWT from header
   ├─ Verify signature
   ├─ Decode payload
   ├─ Load user
   └─ Attach to request
```

### Authorization

- JWT-based authentication
- Route-level guards (`@UseGuards(JwtAuthGuard)`)
- Public routes marked with `@Public()` decorator
- User context available via `@CurrentUser()` decorator

## Error Handling

### Global Exception Filter

```typescript
Request → Controller → Service
                 ↓
              Error Thrown
                 ↓
    HttpExceptionFilter catches
                 ↓
         Format Response:
         {
           statusCode: 400,
           timestamp: "...",
           path: "/api/v1/...",
           method: "POST",
           message: "Error details"
         }
```

### Validation Pipeline

- Class-validator decorators on DTOs
- Global ValidationPipe
- Automatic error formatting
- Whitelist unknown properties

## Scalability Considerations

### Current Limitations (Demo)

1. **In-memory storage**: Users and sessions stored in Map
2. **Single instance**: No distributed session management
3. **File storage**: Local disk (not distributed)
4. **No caching**: Embeddings regenerated on each upload

### Production Improvements

1. **Database**: Replace Maps with PostgreSQL/MySQL
2. **Caching**: Redis for sessions and frequently accessed data
3. **File Storage**: S3 or similar object storage
4. **Load Balancing**: Multiple instances behind load balancer
5. **Queue System**: Bull/RabbitMQ for async document processing
6. **Monitoring**: Prometheus + Grafana
7. **Rate Limiting**: Throttle API requests
8. **CDN**: For static assets

## Performance Optimization

### Vector Search

- Index optimization in ChromaDB
- Batch embedding generation
- Caching frequent queries

### Document Processing

- Async processing (background jobs)
- Batch operations
- Stream large files

### LLM Calls

- Request batching where possible
- Response caching for identical queries
- Streaming responses for long-form content

## Deployment Architecture

### Recommended Production Setup

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ NestJS  │      │ NestJS  │      │ NestJS  │
    │Instance1│      │Instance2│      │Instance3│
    └────┬────┘      └────┬────┘      └────┬────┘
         │                │                 │
         └────────────────┼─────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐      ┌───▼────┐     ┌────▼─────┐
    │  Redis  │      │ChromaDB│     │PostgreSQL│
    │ (Cache) │      │(Vector)│     │  (Data)  │
    └─────────┘      └────────┘     └──────────┘
```

## API Versioning

- Current: `/api/v1/*`
- Version in URL path
- Backward compatibility maintained
- Deprecation warnings in headers

## Monitoring & Logging

### Logging Strategy

- Winston logger with multiple transports
- Console: Development
- File: Production (error.log, combined.log)
- Structured JSON logs
- Context-aware logging

### Metrics to Track

- Request latency
- Embedding generation time
- Vector search performance
- LLM response time
- Error rates
- Document processing queue depth

## Future Enhancements

1. **Multi-tenancy**: Support multiple organizations
2. **Fine-tuning**: Custom model training
3. **Advanced RAG**: Hybrid search, re-ranking
4. **Streaming**: Real-time response streaming
5. **Multi-modal**: Image, audio support
6. **Analytics**: Usage dashboards
7. **A/B Testing**: Model comparison
8. **Feedback Loop**: User ratings, model improvement

---

This architecture provides a solid foundation for building production-grade AI assistants with RAG capabilities.
