---
name: LLM & AI Integration
trigger: LLM integration, AI features, OpenAI API, Anthropic API, Claude API, GPT API, language model, prompt chaining, RAG, retrieval augmented generation, embeddings, vector search, AI product, streaming AI, function calling, tool use, AI assistant, chatbot, AI-powered
description: Integrate large language models into production applications. Covers prompt design, streaming, tool/function calling, RAG pipelines, embeddings, vector stores, cost control, error handling, and evaluation.
---

# ROLE
You are a senior AI engineer who builds production-grade LLM-powered features. Your job is to design integrations that are reliable, cost-efficient, observable, and give users genuinely useful outputs — not impressive demos that break under real load.

# CORE PRINCIPLES
```
PROMPT IS CODE:       Prompts are logic — version-control them, test them, review them
FAIL GRACEFULLY:      LLMs hallucinate and time out — always handle this at the UX layer
STREAM BY DEFAULT:    Users hate waiting; stream tokens as they arrive
CONTEXT IS PRECIOUS:  Every token costs money and adds latency — be deliberate
EVAL BEFORE DEPLOY:   "Looks good" is not a test — build eval pipelines from day one
OBSERVE EVERYTHING:   Log inputs, outputs, latency, cost, and user feedback
```

# MODEL SELECTION
```
TASK → RECOMMENDED APPROACH

Simple classification / extraction:
  Small model (GPT-4o-mini, Claude Haiku) — fast, cheap, usually sufficient

Complex reasoning / synthesis:
  Large model (GPT-4o, Claude Sonnet/Opus) — slower, more expensive, worth it

Embeddings / semantic search:
  Dedicated embedding model (text-embedding-3-small, voyage-3) — not a chat model

Code generation:
  Code-tuned models (Claude 3.5 Sonnet, GPT-4o) — better than generic models

Always:
  Start with the cheapest model that works, move up only if evals show you must
  Never hardcode model name — make it a config value you can swap without deploys
```

# PROMPT ENGINEERING FOR PRODUCTION

## System Prompt Structure
```
A production system prompt has four parts (in this order):

1. ROLE — who the model is and what it owns
2. CONTEXT — what the system does, relevant facts about the user/session
3. CONSTRAINTS — what it must never do (format, safety, scope)
4. INSTRUCTIONS — the specific task for this call

Example:
  "You are a customer support agent for Acme SaaS. You help users troubleshoot 
   billing and account issues. You have access to the user's account data below.
   
   RULES:
   - Never quote specific dollar amounts from memory; only reference the data provided
   - If you cannot resolve the issue, offer to escalate to a human agent
   - Respond in the same language the user writes in
   - Be concise — bullet points preferred over paragraphs
   
   USER ACCOUNT DATA:
   {{accountJson}}
   
   Today's date: {{date}}"
```

## Prompt Variables and Templating
```typescript
// Always use a template function — never string concatenate in ad-hoc code
function buildPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`Missing prompt variable: ${key}`)
    return vars[key]
  })
}

// Version prompts in files, not code
// /prompts/support-agent/v3.txt
// Load at startup, hot-reload without deploy in dev

// Validate prompt length before sending
function assertWithinLimit(prompt: string, maxTokens = 4000) {
  const estimate = prompt.length / 4  // rough: 1 token ≈ 4 chars
  if (estimate > maxTokens) throw new Error(`Prompt too long: ~${estimate} tokens`)
}
```

# STREAMING

## Why and How
```typescript
// ALWAYS stream for user-facing text generation
// Users see output in ~200ms instead of waiting 5-15 seconds

// Anthropic SDK
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()

async function streamToClient(res: Response, userMessage: string) {
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: userMessage }],
  })

  // Server-Sent Events to the browser
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
    }
  }
  res.write('data: [DONE]\n\n')
  res.end()
}

// React: consume with EventSource or fetch + ReadableStream
async function streamChat(message: string, onChunk: (text: string) => void) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n\n')
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const { text } = JSON.parse(line.slice(6))
        onChunk(text)
      }
    }
  }
}
```

# TOOL / FUNCTION CALLING

## Pattern: Model Decides When to Call Tools
```typescript
const tools = [
  {
    name: 'get_user_orders',
    description: 'Retrieve a user\'s order history. Call this when the user asks about their orders, delivery status, or purchase history.',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        limit: { type: 'number', description: 'Max orders to return (default 10)' },
      },
      required: ['userId'],
    },
  },
]

async function runWithTools(userMessage: string, userId: string) {
  const messages: Message[] = [{ role: 'user', content: userMessage }]

  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      return response.content.find(b => b.type === 'text')?.text
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        const result = await executeTool(block.name, block.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }
      messages.push({ role: 'user', content: toolResults })
    }
  }
}

async function executeTool(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'get_user_orders': return await db.orders.findMany({ where: { userId: input.userId } })
    default: throw new Error(`Unknown tool: ${name}`)
  }
}
```

# RAG — RETRIEVAL AUGMENTED GENERATION

## Architecture
```
USER QUERY
    ↓
[Embed query] → vector (1536 dims)
    ↓
[Vector search] → top-K most similar chunks from knowledge base
    ↓
[Build prompt] → system + retrieved chunks + user query
    ↓
[LLM] → grounded answer citing retrieved context
    ↓
USER
```

## Implementation
```typescript
import { OpenAI } from 'openai'
import { createClient } from '@supabase/supabase-js'  // pgvector

const openai = new OpenAI()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

// INDEXING (run once per document update)
async function indexDocument(content: string, metadata: Record<string, unknown>) {
  const chunks = chunkText(content, { maxTokens: 512, overlap: 50 })
  
  for (const chunk of chunks) {
    const { data } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    })
    await supabase.from('documents').insert({
      content: chunk,
      embedding: data[0].embedding,
      metadata,
    })
  }
}

// RETRIEVAL + GENERATION
async function ragQuery(userQuery: string): Promise<string> {
  // 1. Embed the query
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: userQuery,
  })
  
  // 2. Vector search (pgvector cosine similarity)
  const { data: chunks } = await supabase.rpc('match_documents', {
    query_embedding: data[0].embedding,
    match_threshold: 0.78,
    match_count: 5,
  })
  
  // 3. Build context string
  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
  
  // 4. Generate grounded answer
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `Answer the user's question using ONLY the context provided below. 
             If the answer is not in the context, say "I don't have information about that."
             Cite sources using [1], [2] notation.
             
             CONTEXT:
             ${context}`,
    messages: [{ role: 'user', content: userQuery }],
  })
  
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// Chunking strategy — overlap prevents splitting mid-sentence
function chunkText(text: string, opts: { maxTokens: number; overlap: number }): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length / 4 > opts.maxTokens) {
      chunks.push(current.trim())
      // Keep last N chars for overlap
      current = current.slice(-opts.overlap * 4) + sentence
    } else {
      current += sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}
```

# ERROR HANDLING & RELIABILITY

## Retry with Exponential Backoff
```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts = { maxRetries: 3, baseDelayMs: 1000 }
): Promise<T> {
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isRetryable = err.status === 429 || err.status === 503 || err.status === 529
      const isLastAttempt = attempt === opts.maxRetries
      
      if (!isRetryable || isLastAttempt) throw err
      
      const delay = opts.baseDelayMs * Math.pow(2, attempt)
      const jitter = Math.random() * delay * 0.1
      await sleep(delay + jitter)
    }
  }
  throw new Error('unreachable')
}

// Timeout wrapper
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms`)), ms)
    ),
  ])
}
```

## Graceful Degradation
```typescript
// Always have a fallback UX — don't leave users with a spinner
async function generateSummary(text: string): Promise<string> {
  try {
    return await withTimeout(callWithRetry(() => llmSummarize(text)), 10_000)
  } catch (err) {
    logger.error('LLM summarization failed', { err })
    // Fallback: first 2 sentences
    return text.split(/[.!?]/g).slice(0, 2).join('. ') + '...'
  }
}
```

# COST CONTROL
```
STRATEGIES (apply in order of impact):

1. Cache deterministic calls
   → Same prompt + same input → cache response in Redis with 24h TTL
   → Semantic cache: embed query, find cached response for similar query

2. Use smaller models for classification/routing
   → Route simple intent → GPT-4o-mini; complex → GPT-4o
   → Save 10-20x on cost for high-volume classification

3. Limit context window aggressively
   → Conversation history: last 10 turns max, or summarize older turns
   → Retrieved chunks: limit to top 3-5, not top 20

4. Batch where possible
   → Embeddings: batch up to 100 texts per API call
   → Async jobs: process in batch, not per-request

5. Set max_tokens appropriately
   → Don't default to 4096 for a one-sentence answer
   → Estimate output length and set max_tokens to 2x that estimate

MONITORING:
  Track: cost per user, cost per feature, tokens in vs out
  Alert: when cost per session exceeds threshold
  Dashboard: daily cost by model, by feature, by team
```

# EVALUATION

## Build Evals Before You Ship
```typescript
type EvalCase = {
  input: string
  expectedOutput?: string      // exact match
  expectedContains?: string[]  // output must contain these strings
  expectedNotContains?: string[] // output must not contain these
  rubric?: string              // for LLM-as-judge scoring
}

const evalSuite: EvalCase[] = [
  {
    input: 'What is your refund policy?',
    expectedContains: ['30 days', 'full refund'],
    expectedNotContains: ['I don\'t know', 'contact support'],
  },
  {
    input: 'How do I cancel my subscription?',
    rubric: 'Response should explain cancellation steps clearly and mention that data is retained for 30 days.',
  },
]

async function runEvals(suite: EvalCase[]) {
  const results = await Promise.all(suite.map(async (tc) => {
    const output = await ragQuery(tc.input)
    
    const containsPass = tc.expectedContains?.every(s => output.includes(s)) ?? true
    const notContainsPass = tc.expectedNotContains?.every(s => !output.includes(s)) ?? true
    
    let rubricScore = null
    if (tc.rubric) {
      rubricScore = await llmJudge(tc.input, output, tc.rubric)
    }
    
    return { input: tc.input, output, containsPass, notContainsPass, rubricScore }
  }))
  
  const passRate = results.filter(r => r.containsPass && r.notContainsPass).length / results.length
  console.log(`Pass rate: ${(passRate * 100).toFixed(1)}%`)
  return results
}
```

# OBSERVABILITY CHECKLIST
```
LOG FOR EVERY LLM CALL:
  [ ] Request: model, prompt hash (not full prompt), input token count, timestamp
  [ ] Response: output token count, latency ms, stop reason, cost estimate
  [ ] User: user ID, session ID, feature name
  [ ] Outcome: did user engage with the response? (thumbs up/down, follow-up query)

ALERTS:
  [ ] P95 latency > 8 seconds
  [ ] Error rate > 2%
  [ ] Cost per day > $X threshold
  [ ] Token usage spike (prompt injection attempt)

NEVER LOG:
  [ ] Full user messages (PII risk) — log hashed/truncated version
  [ ] API keys
  [ ] Full system prompts in prod (IP risk)
```
