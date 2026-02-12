# OpenAI Integration Guide

## Overview

Your AI Assistant backend now supports both **OpenAI** and **Google Gemini** as AI providers. You can easily switch between them using environment variables.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# AI Provider Configuration
# Options: 'openai' or 'gemini'
AI_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Gemini Configuration (backup)
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-2.5-flash-lite
```

## Supported Models

### OpenAI Models

#### Chat Models
- `gpt-4o-mini` (recommended) - Fast, cost-effective
- `gpt-4o` - Most capable, higher cost
- `gpt-4-turbo` - Fast and capable
- `gpt-3.5-turbo` - Fast and economical

#### Embedding Models
- `text-embedding-3-small` (recommended) - 1536 dimensions, cost-effective
- `text-embedding-3-large` - 3072 dimensions, higher quality
- `text-embedding-ada-002` - Legacy model, 1536 dimensions

### Gemini Models

#### Chat Models
- `gemini-2.5-flash` (recommended)
- `gemini-1.5-flash`
- `gemini-1.5-pro`

#### Embedding Models
- `gemini-2.5-flash-lite`
- `text-embedding-004`

## Switching Providers

### To Use OpenAI (Current Default)

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...your-key...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### To Use Gemini

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...your-key...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-2.5-flash-lite
```

## Features

### All Features Supported

Both providers support:
- ✅ Chat completions with context (RAG)
- ✅ Text embeddings for vector search
- ✅ Conversation history
- ✅ Document Q&A
- ✅ Image analysis (vision capabilities)
- ✅ Follow-up question generation
- ✅ Response caching

### Provider-Specific Notes

#### OpenAI
- **Pros:**
  - High-quality responses
  - Fast processing
  - Excellent instruction following
  - Large context windows
  - Better reasoning capabilities
  
- **Cons:**
  - API costs (though gpt-4o-mini is very affordable)
  - Rate limits on free tier

#### Gemini
- **Pros:**
  - Free tier available
  - Fast processing
  - Good quality responses
  - Multimodal capabilities
  
- **Cons:**
  - May have different response styles
  - API availability varies by region

## API Keys

### Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy and add to your `.env` file

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Create an API key
4. Copy and add to your `.env` file

## Cost Comparison

### OpenAI Pricing (as of 2024)

**gpt-4o-mini:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**text-embedding-3-small:**
- $0.02 per 1M tokens

### Gemini Pricing

**Free Tier:**
- 15 requests per minute
- 1,500 requests per day

**Paid Tier:**
- Variable pricing based on model

## Testing

After configuring your environment variables:

```bash
# Restart the server
npm run start:dev

# Check health endpoint to verify configuration
curl http://localhost:3000/api/v1/chat/health
```

The health endpoint will show:
```json
{
  "status": "ok",
  "aiProvider": "openai",
  "aiConfigured": true,
  "activeSessions": 0,
  "vectorStore": {
    "totalChunks": 0,
    "collectionName": "ai-assistant-docs"
  }
}
```

## Architecture

### Unified AI Service

The backend uses a unified `AIService` that automatically routes requests to the configured provider:

```typescript
// In your code, you always use AIService
this.aiService.chat(message, context, history);
this.aiService.generateEmbedding(text);
this.aiService.analyzeImage(buffer, mimeType, prompt);
```

The `AIService` handles:
- Provider selection based on `AI_PROVIDER` env var
- Consistent API across providers
- Automatic fallback handling
- Error management

### Services Structure

```
src/modules/chat/services/
├── ai.service.ts          # Unified interface (use this)
├── openai.service.ts      # OpenAI implementation
├── gemini.service.ts      # Gemini implementation
├── qa-cache.service.ts    # Response caching
└── file-processor.service.ts  # File handling
```

## Troubleshooting

### API Key Not Working

**OpenAI:**
```bash
# Test your API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Gemini:**
```bash
# Test your API key
curl "https://generativelanguage.googleapis.com/v1/models?key=YOUR_API_KEY"
```

### Provider Not Switching

1. Check `.env` file has `AI_PROVIDER=openai` or `AI_PROVIDER=gemini`
2. Restart the server completely
3. Check logs for initialization messages
4. Verify health endpoint shows correct provider

### Rate Limiting

If you hit rate limits:
- For OpenAI: Upgrade to paid tier or reduce request frequency
- For Gemini: Wait for rate limit reset or upgrade plan
- Implement request queuing in your application

## Best Practices

1. **Use Environment Variables:** Never hardcode API keys
2. **Monitor Costs:** Track API usage in your provider dashboard
3. **Cache Responses:** The Q&A cache reduces API calls
4. **Choose Right Model:** 
   - Development: Use cheaper models (gpt-4o-mini)
   - Production: Balance cost vs quality
5. **Handle Errors:** Implement retry logic with exponential backoff
6. **Test Both Providers:** Ensure your app works with either

## Migration Guide

### From Gemini to OpenAI

1. Update `.env`:
   ```bash
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-proj-...
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
   ```

2. **Important:** Embeddings are **not compatible** between providers
   - OpenAI embeddings: 1536 dimensions
   - Gemini embeddings: Different dimensions
   
3. If switching providers, you need to:
   - Clear existing ChromaDB collection
   - Re-upload and process all documents with new embeddings

4. To clear ChromaDB:
   ```bash
   # Using ChromaDB admin interface or
   # Delete the collection via API
   ```

### From OpenAI to Gemini

Same steps as above, but reverse the provider configuration.

## Support

For issues or questions:
- OpenAI: [OpenAI Help Center](https://help.openai.com/)
- Gemini: [Google AI Support](https://ai.google.dev/)
- This Project: Check the main README or create an issue

## Current Configuration

Your system is currently configured to use:
- **Provider:** OpenAI
- **Chat Model:** gpt-4o-mini
- **Embedding Model:** text-embedding-3-small
- **API Key:** Configured in `.env`

Enjoy your AI Assistant with OpenAI! 🚀
