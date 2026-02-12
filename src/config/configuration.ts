export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },

  vector: {
    provider: process.env.VECTOR_PROVIDER || 'chroma',
    chromaMode: process.env.CHROMA_MODE || 'local', // 'local' or 'cloud'
    chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
    collectionName: process.env.COLLECTION_NAME || 'ai-assistant-docs',
    chromaCloud: {
      apiKey: process.env.CHROMA_CLOUD_API_KEY,
      tenant: process.env.CHROMA_CLOUD_TENANT,
      database: process.env.CHROMA_CLOUD_DATABASE,
    },
  },

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },

  ingestion: {
    chunkSize: parseInt(process.env.CHUNK_SIZE, 10) || 1000,
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP, 10) || 200,
  },

  chat: {
    topK: parseInt(process.env.CHAT_TOP_K, 10) || 5,
    temperature: parseFloat(process.env.CHAT_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.CHAT_MAX_TOKENS, 10) || 2048,
    relevanceThreshold: parseFloat(process.env.CHAT_RELEVANCE_THRESHOLD) || 0.5,
    enableSuggestions: process.env.CHAT_ENABLE_SUGGESTIONS !== 'false',
  },
});
