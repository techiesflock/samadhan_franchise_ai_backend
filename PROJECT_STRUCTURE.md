# Project Structure

```
ai-assistant-backend/
│
├── src/                                    # Source code
│   ├── main.ts                            # Application entry point
│   ├── app.module.ts                      # Root module
│   ├── app.controller.ts                  # Health check controller
│   ├── app.service.ts                     # Health check service
│   │
│   ├── config/                            # Configuration
│   │   └── configuration.ts               # Environment configuration
│   │
│   ├── common/                            # Shared utilities
│   │   ├── decorators/                    # Custom decorators
│   │   │   ├── current-user.decorator.ts # Extract user from request
│   │   │   └── public.decorator.ts        # Mark routes as public
│   │   ├── filters/                       # Exception filters
│   │   │   └── http-exception.filter.ts   # Global error handler
│   │   ├── guards/                        # Route guards
│   │   │   └── jwt-auth.guard.ts          # JWT authentication guard
│   │   └── interfaces/                    # TypeScript interfaces
│   │       └── user.interface.ts          # User & JWT payload types
│   │
│   └── modules/                           # Feature modules
│       │
│       ├── auth/                          # Authentication module
│       │   ├── auth.module.ts
│       │   ├── auth.service.ts            # User management, JWT
│       │   ├── auth.controller.ts         # Auth endpoints
│       │   ├── dto/                       # Data Transfer Objects
│       │   │   ├── register.dto.ts
│       │   │   └── login.dto.ts
│       │   └── strategies/                # Passport strategies
│       │       ├── jwt.strategy.ts
│       │       └── local.strategy.ts
│       │
│       ├── documents/                     # Document management
│       │   ├── documents.module.ts
│       │   ├── documents.service.ts       # File handling, metadata
│       │   └── documents.controller.ts    # Upload, CRUD endpoints
│       │
│       ├── ingestion/                     # Document processing
│       │   ├── ingestion.module.ts
│       │   └── ingestion.service.ts       # Text extraction, chunking, embeddings
│       │
│       ├── vector/                        # Vector database
│       │   ├── vector.module.ts
│       │   └── vector.service.ts          # ChromaDB operations
│       │
│       └── chat/                          # Chat & RAG
│           ├── chat.module.ts
│           ├── chat.service.ts            # RAG orchestration
│           ├── chat.controller.ts         # Chat endpoints
│           ├── dto/
│           │   ├── ask-question.dto.ts
│           │   └── create-session.dto.ts
│           └── services/
│               └── gemini.service.ts      # LLM & embeddings
│
├── uploads/                               # Uploaded files (gitignored)
├── chroma_data/                          # Vector DB storage (gitignored)
├── logs/                                 # Application logs (gitignored)
│   ├── error.log
│   └── combined.log
│
├── test/                                 # E2E tests
│   └── jest-e2e.json
│
├── dist/                                 # Compiled output (gitignored)
│
├── node_modules/                         # Dependencies (gitignored)
│
├── .env                                  # Environment variables (gitignored)
├── .env.example                          # Environment template
├── .gitignore                            # Git ignore rules
├── .eslintrc.js                          # ESLint configuration
├── .prettierrc                           # Prettier configuration
│
├── package.json                          # Dependencies & scripts
├── tsconfig.json                         # TypeScript configuration
├── nest-cli.json                         # NestJS CLI configuration
│
├── docker-compose.yml                    # Docker Compose for ChromaDB
├── postman_collection.json               # Postman API collection
│
├── README.md                             # Main documentation
├── QUICK_START.md                        # Quick start guide
├── ARCHITECTURE.md                       # Architecture documentation
└── PROJECT_STRUCTURE.md                  # This file
```

## Module Breakdown

### Core Modules (5)

1. **AuthModule** - JWT authentication
2. **DocumentsModule** - File upload & management
3. **IngestionModule** - Document processing & chunking
4. **VectorModule** - Embeddings storage & retrieval
5. **ChatModule** - RAG & LLM integration

### Key Services

- **AuthService** - User authentication & JWT
- **DocumentsService** - File handling
- **IngestionService** - Text extraction, chunking, embedding generation
- **VectorService** - ChromaDB operations
- **ChatService** - RAG orchestration
- **GeminiService** - LLM & embeddings API

### Key Controllers

- **AuthController** - `/auth/*` endpoints
- **DocumentsController** - `/documents/*` endpoints
- **ChatController** - `/chat/*` endpoints

## Technology Stack

### Backend
- NestJS 10.x
- TypeScript 5.x
- Node.js 18+

### AI/ML
- Google Gemini API
- LangChain (text splitting)
- ChromaDB (vector store)

### Authentication
- Passport.js
- JWT tokens
- bcrypt (password hashing)

### Validation
- class-validator
- class-transformer

### Documentation
- Swagger/OpenAPI

### Logging
- Winston

## File Counts

- TypeScript files: ~30
- Modules: 5
- Services: 7
- Controllers: 3
- DTOs: 4
- Guards: 1
- Filters: 1
- Decorators: 2

## Entry Points

1. **Application**: `src/main.ts`
2. **Root Module**: `src/app.module.ts`
3. **API Docs**: `http://localhost:3000/api/docs`
4. **Health Check**: `http://localhost:3000/api/v1`

## Build Output

- Source maps enabled
- Output directory: `dist/`
- ES2021 target
- CommonJS modules

## Development Tools

- Hot reload: `npm run start:dev`
- Debugging: `npm run start:debug`
- Linting: `npm run lint`
- Formatting: `npm run format`
- Testing: `npm run test`

---

This structure follows NestJS best practices with clear separation of concerns and modular architecture.
