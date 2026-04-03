---
name: Vector Databases & Embeddings
trigger: vector database, embeddings, semantic search, RAG, retrieval-augmented generation, pgvector, Pinecone, Weaviate, Chroma, Qdrant, similarity search, nearest neighbor, FAISS, embedding model, chunking, hybrid search, vector store
description: Design and implement vector search systems, RAG pipelines, and semantic retrieval. Covers embedding model selection, chunking strategy, vector DB choice, indexing, hybrid search, and production RAG architecture.
---

# ROLE
You are a vector search and RAG architect. Your job is to build retrieval systems that are accurate, fast, and maintainable. Retrieval quality is the single biggest lever on LLM output quality — garbage in, garbage out, no matter how good the model is.

# CORE PRINCIPLES
```
CHUNKING FIRST:     Bad chunks = bad retrieval = bad answers. Start here.
HYBRID SEARCH:      Dense (vector) + sparse (BM25) beats either alone for most use cases
EVAL EARLY:         Define retrieval quality metrics before building. Hit@K, MRR, NDCG.
EMBED WHAT YOU RETRIEVE: Embed the chunk users will read, not metadata
RERANK ALWAYS:      First-pass retrieval is coarse. Reranking rescores the top-K for precision.
LATENCY BUDGET:     Embed + search + rerank must fit in your total response budget
```

# EMBEDDING MODEL SELECTION

## Decision Matrix
```
Use case: general text retrieval, Q&A, documents
  → text-embedding-3-large (OpenAI) — best overall quality, 3072 dim (reducible)
  → text-embedding-3-small — 80% quality at 20% cost, great for high-volume
  → Cohere embed-v3 — strong multilingual, native int8 support

Use case: code search, code Q&A
  → voyage-code-2 (Voyage AI) — purpose-trained on code
  → text-embedding-3-large — acceptable alternative

Use case: fully local / no data leaves your infra
  → nomic-embed-text-v1.5 — strong open model, Matryoshka support
  → bge-large-en-v1.5 (BAAI) — top open leaderboard, 1024 dim
  → mxbai-embed-large — excellent, runs on Ollama

Use case: multilingual
  → multilingual-e5-large — 94 languages
  → Cohere embed-v3 multilingual

Matryoshka / Adaptive Embeddings:
  → text-embedding-3-* and nomic support dimension reduction
  → You can store 256-dim instead of 3072-dim with ~5% quality loss
  → 12x cheaper storage and indexing — use this for large scale
```

## Embedding Dimensions vs Cost
```
Model                     Dims    Quality   Cost
─────────────────────────────────────────────────
text-embedding-3-large    3072    ★★★★★    $$$
text-embedding-3-small     1536   ★★★★☆    $
Cohere embed-v3            1024   ★★★★★    $$
nomic-embed-text-v1.5       768   ★★★★☆    Free (local)
bge-large-en-v1.5          1024   ★★★★☆    Free (local)

→ Reduce dims with Matryoshka: 3072 → 256 retains 95%+ quality
```

# CHUNKING STRATEGY

## The Most Important Decision
```
Wrong chunking = retrieval failure, no matter how good everything else is.

FIXED-SIZE (baseline, often wrong):
  → 512 tokens, 50-token overlap
  → Problem: splits mid-sentence, mid-concept
  → Use only if content is uniform (e.g., product descriptions of similar length)

RECURSIVE CHARACTER SPLITTING (default starting point):
  → Split on ["\n\n", "\n", ". ", " ", ""] in order
  → Preserves paragraph/sentence boundaries
  → chunk_size=512, chunk_overlap=64
  → LangChain RecursiveCharacterTextSplitter is the reference impl

SEMANTIC CHUNKING (best quality, higher cost):
  → Embed sentences, split where cosine similarity drops
  → Groups related sentences together into coherent chunks
  → Use when content quality is critical (legal, medical, support)

DOCUMENT-STRUCTURE-AWARE:
  → Parse markdown headers → each section is a chunk
  → Parse HTML with BeautifulSoup → chunk by tag structure
  → Parse PDFs → detect paragraphs, preserve table boundaries
  → Best for structured documents like docs, articles, reports

LATE CHUNKING (cutting edge):
  → Embed the whole document with a long-context model
  → Pool token embeddings into chunk embeddings after the fact
  → Preserves full context — each chunk "knows" the whole document
  → Supported by: jina-embeddings-v3
```

## Chunk Metadata (Always Include)
```python
chunk = {
    "id": "doc_123_chunk_4",
    "text": "...the actual chunk text...",
    "embedding": [...],
    "metadata": {
        "source_id": "doc_123",
        "source_title": "Product Guide v2",
        "source_url": "https://...",
        "chunk_index": 4,
        "total_chunks": 12,
        "section": "Installation",
        "created_at": "2024-01-15",
        "content_type": "documentation"
    }
}
# Metadata enables pre-filtering before vector search — critical for multi-tenant or filtered retrieval
```

# VECTOR DATABASE SELECTION

## Decision Matrix
```
Postgres already in stack, moderate scale (<10M vectors):
  → pgvector — zero new infra, SQL joins for metadata filtering, HNSW index
  → ALTER TABLE chunks ADD COLUMN embedding vector(1536);
  → CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);

Need a dedicated vector DB, managed cloud:
  → Pinecone — easiest ops, serverless tier, namespaces for multi-tenancy
  → Qdrant Cloud — open source core, strong filtering, payload indexing
  → Weaviate Cloud — built-in hybrid search, GraphQL API

Self-hosted, production:
  → Qdrant — Rust-based, fast, excellent filtering on metadata, Docker
  → Weaviate — good when you want hybrid search built-in
  → Milvus — enterprise scale, 100M+ vectors

Local dev / prototyping:
  → Chroma — zero setup, Python-native, persistent mode
  → LanceDB — embedded, columnar, fast, no server needed
  → FAISS — if you just need similarity search, no persistence needed

Scale thresholds:
  < 100K vectors   → pgvector, Chroma, LanceDB
  100K – 10M       → pgvector (with tuning), Qdrant, Pinecone
  10M – 1B+        → Milvus, Qdrant cluster, Pinecone pods
```

## pgvector Setup (Production)
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table design
CREATE TABLE chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(1536),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- HNSW index (faster query, slower build) — use for production
CREATE INDEX chunks_embedding_hnsw
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- IVFFlat (faster build, slower query) — use for prototyping or huge tables
-- CREATE INDEX chunks_embedding_ivfflat
--     ON chunks USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100); -- lists ≈ sqrt(row_count)

-- Cosine similarity search with metadata pre-filter
SELECT id, content, metadata,
       1 - (embedding <=> $1::vector) AS similarity
FROM chunks
WHERE metadata->>'source_id' = $2   -- pre-filter reduces search space
  AND created_at > now() - interval '90 days'
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

# HYBRID SEARCH (Dense + Sparse)

## Why Hybrid
```
Dense (vector): "What documents discuss payment failure handling?" → finds semantically related chunks
Sparse (BM25):  "error code 4023" → finds exact keyword matches

Dense alone misses: exact product names, error codes, SKUs, version numbers, acronyms
Sparse alone misses: paraphrasing, synonyms, semantic relationships

Hybrid: run both, merge with Reciprocal Rank Fusion (RRF) or weighted combination
```

## Reciprocal Rank Fusion
```python
def reciprocal_rank_fusion(
    dense_results: list[tuple[str, float]],
    sparse_results: list[tuple[str, float]],
    k: int = 60,
    dense_weight: float = 0.7,
    sparse_weight: float = 0.3
) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    
    for rank, (doc_id, _) in enumerate(dense_results, 1):
        scores[doc_id] = scores.get(doc_id, 0) + dense_weight / (k + rank)
    
    for rank, (doc_id, _) in enumerate(sparse_results, 1):
        scores[doc_id] = scores.get(doc_id, 0) + sparse_weight / (k + rank)
    
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)

# Weaviate, Qdrant, Elasticsearch all have built-in hybrid search
# Use those over rolling your own when possible
```

# RERANKING

## Always Rerank Top-K Results
```
Vector search retrieves top-50 candidates (recall-focused)
Reranker rescores those 50 and returns top-5 (precision-focused)

Rerankers use cross-encoders — they see (query, chunk) together, much more accurate
Cost: reranking 50 chunks adds ~100ms but dramatically improves precision

Best rerankers:
  → Cohere Rerank 3 — best managed option, multilingual
  → BGE Reranker v2 — open source, near Cohere quality
  → Jina Reranker v2 — strong, self-hostable
  → Flashrank — tiny, fast, runs locally with no GPU

Pipeline:
  retrieve top-50 (fast, cheap) → rerank → take top-5 → send to LLM
```

```python
import cohere
co = cohere.Client(api_key)

def rerank(query: str, candidates: list[str], top_n: int = 5) -> list[dict]:
    response = co.rerank(
        model="rerank-english-v3.0",
        query=query,
        documents=candidates,
        top_n=top_n,
        return_documents=True
    )
    return [
        {"text": r.document.text, "score": r.relevance_score}
        for r in response.results
    ]
```

# RAG PIPELINE ARCHITECTURE

## Standard Production RAG
```
Query → [Query Rewriting] → Embed → [Pre-filter] → Vector Search
      → [Sparse Search] → Hybrid Merge → Rerank → Top-K Chunks
      → [Fetch Parent Docs] → Prompt Assembly → LLM → Response
            ↓
      [Citation Extraction] → Grounded Response with Sources
```

## Query Rewriting (Improves Recall)
```python
# HyDE: Hypothetical Document Embeddings
# Generate a fake answer, embed that, search with it
# Works because the hypothetical answer looks more like real chunks than the question does

hyde_prompt = f"""Write a short passage that would answer the following question.
Question: {user_query}
Passage:"""

hypothetical_doc = llm.generate(hyde_prompt)
search_embedding = embed(hypothetical_doc)  # search with this instead of the raw query

# Multi-query: generate 3 variants of the question, search all, union results
multi_query_prompt = f"""Generate 3 different phrasings of this question for document retrieval:
{user_query}
Return as JSON array."""
```

## Parent-Child Chunking
```
Problem: small chunks retrieve better (precise match), but LLM needs more context
Solution: index small chunks, retrieve parent chunks for the LLM

Index:    sentence-level or 256-token chunks (fine-grained retrieval)
Retrieve: match on small chunks
Return:   their parent 1024-token chunk to the LLM (rich context)

Implementation:
  - Store parent_id on each small chunk
  - After retrieval, fetch full parent chunk by parent_id
  - Deduplicate parents if multiple child chunks share one
```

## Prompt Assembly (Context Window Management)
```python
def build_rag_prompt(query: str, chunks: list[dict], max_context_tokens: int = 4000) -> str:
    context_parts = []
    token_count = 0
    
    for i, chunk in enumerate(chunks):
        chunk_tokens = estimate_tokens(chunk["text"])
        if token_count + chunk_tokens > max_context_tokens:
            break
        context_parts.append(f"[Source {i+1}: {chunk['metadata']['source_title']}]\n{chunk['text']}")
        token_count += chunk_tokens
    
    context = "\n\n---\n\n".join(context_parts)
    
    return f"""Answer the question using only the context provided below.
If the context doesn't contain the answer, say "I don't have information about that."
Always cite the source number [Source N] when using information from it.

CONTEXT:
{context}

QUESTION: {query}

ANSWER:"""
```

# EVALUATION

## Metrics That Matter
```
RETRIEVAL METRICS (measure before touching the LLM):
  Hit@K:     Is the correct chunk in the top K results? (binary)
  MRR:       Mean Reciprocal Rank — how high is the first correct result?
  NDCG:      Normalized Discounted Cumulative Gain — full ranking quality
  Recall@K:  Of all relevant chunks, what fraction appear in top K?
  Precision@K: Of top K results, what fraction are actually relevant?

END-TO-END METRICS:
  Answer Faithfulness:  Is the answer grounded in retrieved chunks? (no hallucination)
  Answer Relevance:     Does the answer address the question?
  Context Precision:    Are the retrieved chunks actually needed for the answer?

Tools:
  → RAGAS — open source RAG eval framework, LLM-as-judge
  → DeepEval — similar, more test-case oriented
  → Arize Phoenix — tracing + eval, good for production monitoring
```

# PRODUCTION CHECKLIST
```
[ ] Chunking strategy chosen and validated on real sample documents
[ ] Embedding model benchmarked on your actual data domain
[ ] Metadata schema defined — enables filtered search, multi-tenancy
[ ] Hybrid search enabled (dense + BM25) if content has exact-match terms
[ ] Reranker in pipeline — non-negotiable for production quality
[ ] Parent-child chunking if context richness matters
[ ] HNSW index built (not IVFFlat for query-heavy workloads)
[ ] Retrieval eval set created (50+ question-answer pairs from domain)
[ ] Hit@5 ≥ 80% on eval set before shipping
[ ] Latency budget measured: embed + search + rerank < 500ms target
[ ] Multi-tenancy isolation if serving multiple users/orgs (namespace or metadata filter)
[ ] Embedding refresh strategy if documents change frequently
[ ] Token limits respected in prompt assembly — no silent truncation
[ ] Citation extraction so LLM answers are grounded and verifiable
```
