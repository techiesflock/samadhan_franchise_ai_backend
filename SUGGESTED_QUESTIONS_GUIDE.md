# Suggested Follow-Up Questions Guide

## Overview

The AI Assistant now automatically generates **3 contextually relevant follow-up questions** after each response, helping users discover related topics and continue the conversation naturally.

## How It Works

After providing an answer, the system:
1. ✅ Analyzes the user's question
2. ✅ Reviews the answer provided
3. ✅ Considers available topics from the knowledge base
4. ✅ Generates 3 relevant follow-up questions
5. ✅ Returns them in the response

## Example Response

### Request
```bash
curl -X POST 'http://localhost:3000/api/v1/chat/ask' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "How do I start a headphone manufacturing business?"
  }'
```

### Response
```json
{
  "sessionId": "abc-123",
  "message": "How do I start a headphone manufacturing business?",
  "answer": "Starting a headphone manufacturing business requires several key steps: market research, product design, sourcing components...",
  "sources": [...],
  "responseSource": "knowledge_base",
  "modelUsed": "gemini-2.5-flash",
  "suggestedQuestions": [
    "What equipment is needed for headphone manufacturing?",
    "How much capital is required to start production?",
    "What are the key quality standards for headphones?"
  ],
  "timestamp": "2026-02-02T08:00:00.000Z"
}
```

## Benefits

### 1. **Improved User Experience**
Users don't have to think about what to ask next - the AI guides them.

### 2. **Conversation Flow**
Keeps the conversation natural and flowing, like chatting with an expert.

### 3. **Discovery**
Helps users discover topics they might not have thought to ask about.

### 4. **Engagement**
Increases interaction time and exploration of the knowledge base.

## Configuration

### Enable/Disable Suggestions

```env
# .env file
CHAT_ENABLE_SUGGESTIONS=true  # Enable (default)
# or
CHAT_ENABLE_SUGGESTIONS=false # Disable
```

### How Questions Are Generated

The system uses:
- **Model**: `gemini-2.5-flash-lite` (fast and cost-effective)
- **Temperature**: 0.7 (creative but focused)
- **Max Tokens**: 200 (short, concise questions)
- **Context**: User's question + Answer + Available topics

## Characteristics of Good Suggestions

Each suggested question:
- ✅ **Relevant**: Directly related to the topic discussed
- ✅ **Natural**: Sounds like something a real person would ask
- ✅ **Specific**: Clear and actionable
- ✅ **Concise**: 5-15 words each
- ✅ **Diverse**: Covers different aspects of the topic

## Examples by Use Case

### Example 1: Technical Documentation
**User asks**: "What is the API rate limit?"

**Suggested questions**:
```json
"suggestedQuestions": [
  "How can I increase my API rate limit?",
  "What happens when I exceed the rate limit?",
  "Are there different rate limits for different endpoints?"
]
```

### Example 2: Business Queries
**User asks**: "What is the return policy?"

**Suggested questions**:
```json
"suggestedQuestions": [
  "How long do I have to return a product?",
  "Are there any restocking fees?",
  "Can I return opened items?"
]
```

### Example 3: Educational Content
**User asks**: "Explain machine learning"

**Suggested questions**:
```json
"suggestedQuestions": [
  "What's the difference between supervised and unsupervised learning?",
  "What are some real-world applications of machine learning?",
  "How do I get started learning machine learning?"
]
```

## Frontend Integration

### Display Suggested Questions

#### React Example
```typescript
const ChatMessage = ({ response }) => {
  return (
    <div className="chat-message">
      <div className="answer">{response.answer}</div>
      
      {response.suggestedQuestions && (
        <div className="suggested-questions">
          <h4>💡 You might also want to ask:</h4>
          <div className="questions">
            {response.suggestedQuestions.map((question, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestedQuestion(question)}
                className="suggested-question-btn"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const handleSuggestedQuestion = (question) => {
  // Send the suggested question as a new message
  sendMessage(question);
};
```

#### CSS Example
```css
.suggested-questions {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.suggested-questions h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
}

.questions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggested-question-btn {
  padding: 10px 15px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.suggested-question-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
  transform: translateX(5px);
}
```

### Vue Example
```vue
<template>
  <div class="chat-message">
    <div class="answer">{{ response.answer }}</div>
    
    <div v-if="response.suggestedQuestions" class="suggested-questions">
      <h4>💡 You might also want to ask:</h4>
      <div class="questions">
        <button
          v-for="(question, idx) in response.suggestedQuestions"
          :key="idx"
          @click="askQuestion(question)"
          class="suggested-question-btn"
        >
          {{ question }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: ['response'],
  methods: {
    askQuestion(question) {
      this.$emit('send-message', question);
    }
  }
}
</script>
```

## API Details

### Response Fields

```typescript
interface ChatResponse {
  sessionId: string;
  message: string;
  answer: string;
  sources: Array<{...}>;
  responseSource: 'knowledge_base' | 'ai_generated';
  relevanceScore?: number;
  modelUsed: string;
  suggestedQuestions?: string[];  // ⭐ New field
  timestamp: Date;
}
```

### When Suggestions Are Included

- ✅ **Enabled**: `CHAT_ENABLE_SUGGESTIONS=true`
- ✅ **Generated**: AI successfully generated questions
- ❌ **Not included**: If disabled or generation fails
- ❌ **Empty array**: Never returned (undefined instead)

## Performance Impact

### Additional Latency
- **~500-800ms** for question generation
- Uses `gemini-2.5-flash-lite` (fast model)
- Runs **after** main answer is generated
- Doesn't block the main response

### Cost
- **Minimal**: Uses flash-lite model
- **~50 tokens** input + **~100 tokens** output per request
- **Non-blocking**: Generation failure doesn't affect main response

## Monitoring

### Server Logs
```
💡 Generating suggested follow-up questions...
[ChatService] Generated 3 suggested questions
```

### Check in Response
```json
{
  "suggestedQuestions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ]
}
```

## Troubleshooting

### No Suggestions Appearing

**Check 1**: Is it enabled?
```bash
# In .env
CHAT_ENABLE_SUGGESTIONS=true
```

**Check 2**: Check server logs
```bash
# Should see:
💡 Generating suggested follow-up questions...
[ChatService] Generated 3 suggested questions
```

**Check 3**: Check response
```bash
curl ... | jq '.suggestedQuestions'
```

### Poor Quality Suggestions

**Solution 1**: Adjust temperature in code
```typescript
// In chat.service.ts
{ temperature: 0.5 }  // More focused (less creative)
// or
{ temperature: 0.9 }  // More creative (less focused)
```

**Solution 2**: Update the prompt
Edit the `generateSuggestedQuestions` method prompt for better results.

### Too Slow

**Solution 1**: Already using flash-lite (fastest)

**Solution 2**: Disable if not needed
```env
CHAT_ENABLE_SUGGESTIONS=false
```

**Solution 3**: Generate in background (advanced)
```typescript
// Don't await
this.generateSuggestedQuestions(...).then(questions => {
  // Cache or store for later
});
```

## Best Practices

### 1. Make Them Clickable
Always make suggested questions clickable/tappable for easy use.

### 2. Visual Distinction
Use different styling to distinguish suggestions from the main answer.

### 3. Mobile Friendly
Ensure buttons are large enough for touch (min 44px height).

### 4. Track Usage
Monitor which suggestions users click to improve generation.

```typescript
const trackSuggestionClick = (question, position) => {
  analytics.track('Suggested Question Clicked', {
    question,
    position,
    sessionId: response.sessionId
  });
};
```

### 5. A/B Testing
Test different prompt styles to find what works best for your users.

## Advanced: Custom Suggestion Logic

### Override Suggestions Server-Side
```typescript
// In chat.service.ts
private async generateSuggestedQuestions(...): Promise<string[]> {
  // Custom logic based on topic
  if (userQuestion.includes('pricing')) {
    return [
      'What discounts are available?',
      'Is there a free trial?',
      'What payment methods do you accept?'
    ];
  }
  
  // Default AI generation
  return await this.aiGenerateSuggestions(...);
}
```

### Client-Side Filtering
```typescript
const filteredSuggestions = response.suggestedQuestions?.filter(q => 
  q.length < 100 && // Not too long
  !q.includes('forbidden term') && // Filter unwanted content
  q.endsWith('?') // Must be a question
);
```

## Analytics

### Track Metrics
```typescript
{
  totalQuestions: 150,
  suggestionsGenerated: 450,
  suggestionsClicked: 180,
  clickRate: 40%, // 180/450
  avgResponseTime: 650ms
}
```

### Improve Over Time
- Track which suggestions get clicked
- Analyze patterns
- Update prompts based on data
- A/B test different generation strategies

## Summary

✅ **Automatic**: Generated after every response
✅ **Smart**: Context-aware and relevant
✅ **Fast**: Uses flash-lite model (~500-800ms)
✅ **Configurable**: Easy to enable/disable
✅ **Frontend-Friendly**: Simple JSON array
✅ **Cost-Effective**: Minimal additional cost

Suggested questions help users explore your knowledge base naturally! 🚀
