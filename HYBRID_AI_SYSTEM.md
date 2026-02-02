# Hybrid AI System Documentation

## Overview

The AI Assistant now features a **Hybrid AI System** that intelligently combines:
1. **Knowledge Base Retrieval (RAG)** - Searches uploaded documents
2. **AI Generation** - Generates responses when knowledge base has no relevant data
3. **Self-Learning** - Saves AI-generated responses for future retrieval

## How It Works

### 1. Query Processing Flow

```
User Question
     ↓
Generate Embedding
     ↓
Search Knowledge Base (ChromaDB)
     ↓
Check Relevance Score
     ↓
  ┌─────────────┴─────────────┐
  ↓                           ↓
High Relevance           Low Relevance
(Score ≥ 0.5)           (Score < 0.5)
  ↓                           ↓
Use RAG                  Use AI Generation
(Knowledge Base)         (Pure AI)
  ↓                           ↓
  │                      Save Q&A to
  │                      Knowledge Base
  │                           ↓
  └───────────┬───────────────┘
              ↓
        Return Response
        (with source indicator)
```

### 2. Response Sources

Each response includes a `responseSource` field indicating:

- **`knowledge_base`**: Answer found in uploaded documents
- **`ai_generated`**: No relevant data found, AI generated the answer
- **`hybrid`**: Combination of both (future enhancement)

### 3. Self-Learning Mechanism

When the AI generates a response (no relevant knowledge base data):
1. The Q&A pair is automatically saved to ChromaDB
2. It's embedded and indexed for future searches
3. Next time a similar question is asked, it can be retrieved from the knowledge base

## Configuration

### Environment Variables

```env
# Relevance threshold (0-1): If search results score below this, use AI generation
CHAT_RELEVANCE_THRESHOLD=0.5
```

### Adjusting the Threshold

- **Lower (0.3-0.4)**: More aggressive use of knowledge base, even with weak matches
- **Default (0.5)**: Balanced approach
- **Higher (0.6-0.8)**: More conservative, only use knowledge base for strong matches

## API Response Format

### Example Response (Knowledge Base)

```json
{
  "sessionId": "abc-123",
  "message": "What is the return policy?",
  "answer": "According to our policy document, items can be returned within 30 days...",
  "sources": [
    {
      "content": "Return Policy: Items can be returned...",
      "fileName": "policy.pdf",
      "score": 0.87,
      "metadata": {
        "chunkIndex": 5,
        "source": "local_file"
      }
    }
  ],
  "responseSource": "knowledge_base",
  "relevanceScore": 0.87,
  "timestamp": "2026-02-02T07:40:00.000Z"
}
```

### Example Response (AI Generated)

```json
{
  "sessionId": "abc-123",
  "message": "What is quantum computing?",
  "answer": "Quantum computing is a revolutionary computing paradigm...",
  "sources": [],
  "responseSource": "ai_generated",
  "relevanceScore": 0.0,
  "timestamp": "2026-02-02T07:40:00.000Z"
}
```

## Benefits

### 1. **Complete Coverage**
- Never fails to answer questions
- Falls back to AI when knowledge base is insufficient

### 2. **Continuous Learning**
- System learns from every interaction
- Knowledge base grows organically over time

### 3. **Transparency**
- Users know the source of information
- Can trust document-based answers
- Understand when AI is making educated guesses

### 4. **Cost Efficiency**
- Reduces repeated AI API calls for similar questions
- Builds up a cache of common Q&A pairs

## Use Cases

### Knowledge Base Response
```bash
curl -X POST 'http://localhost:3000/api/v1/chat/ask' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What is covered in the uploaded manual?"
  }'

# Response: Uses uploaded PDF documents
# responseSource: "knowledge_base"
```

### AI Generated Response
```bash
curl -X POST 'http://localhost:3000/api/v1/chat/ask' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Explain artificial intelligence in simple terms"
  }'

# Response: Pure AI generation (no documents about AI uploaded)
# responseSource: "ai_generated"
# This Q&A is now saved for future queries!
```

## Monitoring

### Check Response Source in Logs

```
[ChatService] Built context from 5 documents (Knowledge Base)
[ChatService] Generating response with Gemini using Knowledge Base...
```

OR

```
[ChatService] No relevant data in knowledge base. Generating AI response...
[ChatService] AI-generated response saved to knowledge base
```

## Best Practices

### 1. Optimize Threshold
Monitor your `relevanceScore` values and adjust `CHAT_RELEVANCE_THRESHOLD` based on:
- Document quality
- Query types
- User expectations

### 2. Upload Core Documents
Upload essential documents to build a strong knowledge base:
```bash
POST /api/v1/documents/upload
```

### 3. Review AI-Generated Content
Periodically review AI-generated Q&A pairs in ChromaDB:
```bash
GET /api/v1/documents/stats
```

### 4. Clear Outdated Content
Remove outdated AI-generated responses:
```bash
DELETE /api/v1/documents/:id
```

## Advanced Configuration

### Custom Relevance Scoring

Edit `src/modules/chat/chat.service.ts`:

```typescript
// Custom scoring logic
const hasRelevantData = searchResults.length > 0 && 
  searchResults.some(result => {
    // Add custom logic here
    return result.score >= this.relevanceThreshold &&
           result.metadata.source === 'trusted_source';
  });
```

### Metadata Filtering

Filter by source type:
```typescript
const trustedSources = searchResults.filter(r => 
  r.metadata.source === 'uploaded_documents'
);
```

## Troubleshooting

### Issue: Too Many AI-Generated Responses

**Solution**: Lower the relevance threshold
```env
CHAT_RELEVANCE_THRESHOLD=0.4
```

### Issue: Inaccurate Knowledge Base Matches

**Solution**: Raise the relevance threshold
```env
CHAT_RELEVANCE_THRESHOLD=0.7
```

### Issue: ChromaDB Not Saving AI Responses

**Check**:
1. ChromaDB is running (`docker-compose ps`)
2. Collection exists (`http://localhost:8000`)
3. Check logs for errors

## Future Enhancements

- [ ] Hybrid mode (combine both sources)
- [ ] User feedback on response quality
- [ ] Automatic threshold optimization
- [ ] Response confidence scores
- [ ] Multi-model fallback chain
- [ ] A/B testing different thresholds

## Technical Details

### Storage Format (AI-Generated Q&A)

```javascript
{
  id: "ai-qa-{uuid}",
  content: "Question: {question}\n\nAnswer: {answer}",
  metadata: {
    documentId: "ai-qa-{uuid}",
    fileName: "AI Generated Q&A",
    chunkIndex: 0,
    totalChunks: 1,
    source: "ai_generated",
    type: "qa_pair",
    question: "{original_question}",
    answer: "{generated_answer}",
    userId: "{user_id}",
    createdAt: "{timestamp}"
  }
}
```

### Embedding Process

1. Combine question + answer into single document
2. Generate embedding using Gemini `text-embedding-004`
3. Store in ChromaDB with full metadata
4. Indexed automatically for semantic search

## Summary

The Hybrid AI System provides:
✅ Intelligent fallback mechanism
✅ Automatic knowledge base expansion
✅ Transparent response sourcing
✅ Cost-effective repeated queries
✅ Continuous system improvement

Your AI assistant now learns and improves with every interaction!
