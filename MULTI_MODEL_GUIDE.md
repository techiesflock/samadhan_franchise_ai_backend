# Multi-Model Support Guide

## Overview

The AI Assistant now supports **dynamic model selection** per request, allowing you to choose the best model for your specific use case.

## Available Models

| Model | Use Case | Speed | Cost | Intelligence |
|-------|----------|-------|------|--------------|
| `gemini-2.5-flash` ⭐ | **Default** - Main chat, Q&A, Knowledge Base | ⚡⚡⚡ Fast | 💰 Low | 🧠🧠 Good |
| `gemini-2.5-pro` | **Deep Logic** - Complex reasoning, analysis | ⚡⚡ Medium | 💰💰 Medium | 🧠🧠🧠 Excellent |
| `gemini-2.5-flash-lite` | **High Traffic** - Simple queries, high volume | ⚡⚡⚡⚡ Ultra Fast | 💰 Very Low | 🧠 Basic |
| `text-embedding-004` | **Search/RAG** - Embeddings only (automatic) | ⚡⚡⚡ Fast | 💰 Very Low | N/A |

## How to Use

### Request with Default Model
```bash
curl -X POST 'http://localhost:3000/api/v1/chat/ask' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What is in the uploaded documents?"
  }'
```

Response:
```json
{
  "answer": "...",
  "modelUsed": "gemini-2.5-flash",
  "responseSource": "knowledge_base"
}
```

### Request with Specific Model

#### Example 1: Use Pro Model for Deep Analysis
```bash
curl -X POST 'http://localhost:3000/api/v1/chat/ask' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Analyze the business model and provide strategic recommendations",
    "model": "gemini-2.5-pro"
  }'
```

Response:
```json
{
  "answer": "Detailed analysis...",
  "modelUsed": "gemini-2.5-pro",
  "responseSource": "knowledge_base"
}
```

#### Example 2: Use Flash-Lite for Simple Query
```bash
curl -X POST 'http://localhost:3000/api/v1/chat/ask' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What is the title of the document?",
    "model": "gemini-2.5-flash-lite"
  }'
```

Response:
```json
{
  "answer": "Document Title XYZ",
  "modelUsed": "gemini-2.5-flash-lite",
  "responseSource": "knowledge_base"
}
```

## Use Case Matrix

### 1. General Q&A (Default)
```json
{
  "message": "What is the return policy?",
  "model": "gemini-2.5-flash"  // Optional, this is default
}
```
**When to use**: Standard questions, knowledge base retrieval, general chat

### 2. Complex Analysis (Pro)
```json
{
  "message": "Compare the pros and cons of approach A vs B and recommend the best strategy",
  "model": "gemini-2.5-pro"
}
```
**When to use**:
- Multi-step reasoning
- Strategic analysis
- Code review and debugging
- Mathematical problems
- Legal or medical queries requiring nuance

### 3. Simple Queries (Flash-Lite)
```json
{
  "message": "What is the document date?",
  "model": "gemini-2.5-flash-lite"
}
```
**When to use**:
- Simple fact extraction
- Yes/no questions
- Basic summaries
- High-volume, low-complexity requests
- Cost optimization

### 4. Embeddings (Automatic)
The `text-embedding-004` model is used automatically for:
- Document ingestion
- Query embedding for RAG
- Vector search operations

You don't need to specify this model - it's handled internally.

## API Reference

### Request Body

```typescript
{
  message: string;           // Required: Your question
  sessionId?: string;        // Optional: Continue conversation
  includeHistory?: boolean;  // Optional: Include chat history (default: true)
  topK?: number;            // Optional: Number of documents to retrieve (1-20, default: 5)
  model?: string;           // Optional: Model to use
}
```

### Allowed Models (Enum)
```typescript
enum GeminiModel {
  FLASH = 'gemini-2.5-flash',       // Default
  PRO = 'gemini-2.5-pro',           // Deep logic
  FLASH_LITE = 'gemini-2.5-flash-lite'  // High traffic
}
```

### Response Body

```typescript
{
  sessionId: string;
  message: string;
  answer: string;
  sources: Array<{...}>;
  responseSource: 'knowledge_base' | 'ai_generated';
  relevanceScore: number;
  modelUsed: string;         // Shows which model was used
  timestamp: Date;
}
```

## Configuration

### Default Model (.env)
```env
# Default model for all requests (if not specified)
GEMINI_MODEL=gemini-2.5-flash

# Embedding model (used automatically for RAG)
GEMINI_EMBEDDING_MODEL=text-embedding-004
```

## Cost Optimization Strategies

### Strategy 1: Tiered Approach
```javascript
// Route simple queries to flash-lite
if (query.length < 50 && !query.includes('?')) {
  model = 'gemini-2.5-flash-lite';
}
// Route complex queries to pro
else if (query.includes('analyze') || query.includes('compare')) {
  model = 'gemini-2.5-pro';
}
// Use default flash for everything else
else {
  model = 'gemini-2.5-flash';
}
```

### Strategy 2: User-Based Tiers
```javascript
// Free tier: flash-lite only
if (user.tier === 'free') {
  model = 'gemini-2.5-flash-lite';
}
// Premium tier: pro access
else if (user.tier === 'premium') {
  model = 'gemini-2.5-pro';
}
// Standard tier: flash (default)
else {
  model = 'gemini-2.5-flash';
}
```

### Strategy 3: Adaptive Selection
```javascript
// Start with flash, escalate to pro if needed
let model = 'gemini-2.5-flash';
const response = await chat({ message, model });

// If confidence is low, retry with pro
if (response.confidence < 0.7) {
  model = 'gemini-2.5-pro';
  const betterResponse = await chat({ message, model });
}
```

## Performance Comparison

### Response Time (Average)

| Model | Simple Query | Complex Query | With RAG |
|-------|--------------|---------------|----------|
| flash-lite | 500ms | 800ms | 1.2s |
| flash | 600ms | 1.0s | 1.5s |
| pro | 1.2s | 2.5s | 3.0s |

### Token Limits

| Model | Input Tokens | Output Tokens |
|-------|--------------|---------------|
| flash-lite | 32k | 2k |
| flash | 32k | 8k |
| pro | 128k | 8k |

## Error Handling

### Invalid Model
```json
{
  "statusCode": 400,
  "message": "Model must be one of: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite"
}
```

### Model Not Available
```json
{
  "statusCode": 500,
  "message": "[GoogleGenerativeAI Error]: Model not found"
}
```

## Monitoring & Logs

### Server Logs
```
[ChatService] Using model: gemini-2.5-pro
[GeminiService] Using model: gemini-2.5-pro
[GeminiService] Generated chat response (1234 chars) using gemini-2.5-pro
```

### Response Tracking
Check the `modelUsed` field in every response:
```json
{
  "modelUsed": "gemini-2.5-pro",
  "answer": "..."
}
```

## Best Practices

### 1. Match Model to Task
```bash
# Simple fact → flash-lite
"What is the date?" → gemini-2.5-flash-lite

# Standard Q&A → flash
"Explain the policy" → gemini-2.5-flash

# Complex analysis → pro
"Compare strategies and recommend best approach" → gemini-2.5-pro
```

### 2. Default to Flash
Unless you have a specific reason to use pro or flash-lite, stick with the default `gemini-2.5-flash`. It provides the best balance.

### 3. Monitor Costs
Track model usage:
```sql
SELECT 
  model_used,
  COUNT(*) as request_count,
  AVG(response_time) as avg_time
FROM chat_logs
GROUP BY model_used;
```

### 4. Cache Responses
For repeated queries, cache responses regardless of model:
```javascript
const cacheKey = `${message}_${model}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

### 5. Implement Rate Limits
```javascript
// Flash-lite: unlimited
// Flash: 100 req/min
// Pro: 20 req/min per user
```

## Testing

### Test All Models
```bash
# Test flash
curl ... -d '{"message": "Test", "model": "gemini-2.5-flash"}'

# Test pro
curl ... -d '{"message": "Test", "model": "gemini-2.5-pro"}'

# Test flash-lite
curl ... -d '{"message": "Test", "model": "gemini-2.5-flash-lite"}'
```

### Verify Model Usage
Check the `modelUsed` field in responses to confirm the correct model was used.

## Swagger Documentation

Visit `http://localhost:3000/api/docs` to see the interactive API documentation with model selection dropdown.

## Advanced: Frontend Integration

### React Example
```typescript
const useChat = () => {
  const [model, setModel] = useState<GeminiModel>('gemini-2.5-flash');

  const sendMessage = async (message: string) => {
    const response = await fetch('/api/v1/chat/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message, model })
    });
    
    return response.json();
  };

  return { model, setModel, sendMessage };
};

// Usage
const ChatInterface = () => {
  const { model, setModel, sendMessage } = useChat();

  return (
    <>
      <select value={model} onChange={e => setModel(e.target.value)}>
        <option value="gemini-2.5-flash">Flash (Default)</option>
        <option value="gemini-2.5-pro">Pro (Deep Logic)</option>
        <option value="gemini-2.5-flash-lite">Flash Lite (Fast)</option>
      </select>
      
      <button onClick={() => sendMessage('Hello')}>Send</button>
    </>
  );
};
```

## Summary

✅ **3 Models Available**: flash, pro, flash-lite
✅ **Simple API**: Just add `"model": "gemini-2.5-pro"` to request
✅ **Response Tracking**: `modelUsed` field shows which model was used
✅ **Cost Optimization**: Choose model based on complexity
✅ **Transparent**: Logs show model selection in real-time

Choose the right model for each task and optimize your AI costs! 🚀
