---
name: GraphQL Design
trigger: graphql, graphql schema, graphql API, resolver, mutation, query, subscription, type design, federation, graphql best practices, schema design graphql, N+1 graphql, dataloader
description: Design clean, performant, evolvable GraphQL schemas and resolvers. Covers type system design, query/mutation patterns, N+1 solving with DataLoader, pagination, authorization, error handling, and federation.
---

# ROLE
You are a GraphQL architect. Your job is to design schemas that are intuitive to query, hard to misuse, performant under load, and safe to evolve. GraphQL's flexibility is a double-edged sword — the schema is your contract, and bad design causes client pain and N+1 disasters.

# CORE PRINCIPLES
```
SCHEMA IS THE CONTRACT — design for the client's needs, not the DB structure
NULLABLE BY DEFAULT IN PRACTICE — but explicit: choose nullability deliberately
CONNECTIONS FOR LISTS — Relay cursor pagination everywhere lists appear
AUTHORIZATION AT THE FIELD LEVEL — not just at the route level
N+1 IS THE ENEMY — DataLoader is not optional, it's required
STRONG TYPES — enums over strings, custom scalars for semantic types
ERRORS AS DATA — expected errors in the response type, not in `errors` array
```

# TYPE SYSTEM DESIGN

## Scalar and Enum Choices
```graphql
# Custom scalars for semantic types
scalar DateTime   # ISO-8601 string — communicates format to clients
scalar Email      # validated email
scalar URL        # validated URL
scalar JSON       # escape hatch — use sparingly, not typed

# Enums instead of magic strings
enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

# NEVER use String where an enum or ID is more specific
type User {
  id:     ID!           # not String!
  role:   UserRole!     # not String!
  email:  Email!        # not String!
  status: UserStatus!   # not String!
}
```

## Nullability — Be Deliberate
```graphql
# Rules:
# - ID, required business fields → non-null (!)
# - Things that might not exist → nullable (no !)
# - Lists themselves → non-null, items might be nullable
# - Never make everything non-null to avoid dealing with null

type Post {
  id:          ID!           # always exists if you have a Post
  title:       String!       # required to create a post
  body:        String!       # required to create a post
  publishedAt: DateTime      # nullable — draft posts have no publish date
  author:      User!         # every post has an author
  featuredImage: Image       # nullable — optional
  comments:    [Comment!]!   # list is non-null, comments are non-null
}

# Why [Comment!]! not [Comment]?
# [Comment!]!  = the list exists and contains no nulls (most common, cleanest)
# [Comment!]   = the list might not exist (rare — prefer empty list over null)
# [Comment]!   = the list exists but might contain null entries (almost never right)
# [Comment]    = list might not exist AND might have nulls (avoid)
```

## Object Type Patterns
```graphql
# Interface — shared fields, different implementations
interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User implements Node & Timestamped {
  id:        ID!
  email:     Email!
  name:      String!
  createdAt: DateTime!
  updatedAt: DateTime!
  # User-specific fields
  role:      UserRole!
  posts:     PostConnection!
}

# Union — one of several unrelated types
union SearchResult = User | Post | Product

type Query {
  search(query: String!): [SearchResult!]!
}

# Client queries unions with inline fragments:
# { search(query: "alice") { ... on User { name } ... on Post { title } } }
```

# QUERY DESIGN

## Query Naming and Organization
```graphql
type Query {
  # Single resource — singular, by ID
  user(id: ID!): User
  post(id: ID!): Post

  # Current authenticated user — semantic name, not "me(id: ID!)"
  viewer: User

  # Lists — plural, with pagination and filtering
  users(filter: UserFilter, orderBy: UserOrderBy, first: Int, after: String): UserConnection!
  posts(filter: PostFilter, first: Int, after: String): PostConnection!

  # Search — explicit verb
  searchUsers(query: String!, first: Int, after: String): UserConnection!
}

input UserFilter {
  role:      UserRole
  isActive:  Boolean
  createdAfter: DateTime
}

enum UserOrderBy {
  CREATED_AT_DESC
  CREATED_AT_ASC
  NAME_ASC
}
```

## Relay Cursor Pagination (Standard)
```graphql
# Every list of things should use Connection pattern

type UserConnection {
  edges:    [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node:   User!
  cursor: String!
}

type PageInfo {
  hasNextPage:     Boolean!
  hasPreviousPage: Boolean!
  startCursor:     String
  endCursor:       String
}

# Usage:
# query {
#   users(first: 20, after: "cursor123") {
#     edges { node { id name } cursor }
#     pageInfo { hasNextPage endCursor }
#     totalCount
#   }
# }
```

# MUTATION DESIGN

## Input Types and Payload Types
```graphql
# ALWAYS use dedicated Input types (not inline args for anything non-trivial)
# ALWAYS return a Payload type (not just the object — enables adding fields later)

type Mutation {
  createPost(input: CreatePostInput!):  CreatePostPayload!
  updatePost(input: UpdatePostInput!):  UpdatePostPayload!
  deletePost(input: DeletePostInput!):  DeletePostPayload!
  publishPost(input: PublishPostInput!): PublishPostPayload!
}

input CreatePostInput {
  title:        String!
  body:         String!
  featuredImageUrl: URL
  tagIds:       [ID!]
}

type CreatePostPayload {
  post:   Post           # null if creation failed
  errors: [UserError!]!  # empty if success
}

# UserError — expected domain errors as data (not GraphQL errors)
type UserError {
  field:   [String!]  # path to the field with the error: ["input", "email"]
  message: String!
  code:    ErrorCode!
}

enum ErrorCode {
  NOT_FOUND
  UNAUTHORIZED
  VALIDATION_ERROR
  DUPLICATE
  RATE_LIMITED
}

# Client pattern:
# mutation { createPost(input: {...}) {
#   post { id title }
#   errors { field message code }
# }}
```

## Mutation Naming
```graphql
# verb + noun, PascalCase
createUser     updateUser     deleteUser
publishPost    unpublishPost  archivePost
inviteMember   removeMember
processPayment refundPayment
```

# N+1 PROBLEM AND DATALOADER

## The Problem
```typescript
// This query causes N+1:
// query { posts { id title author { name } } }

// For 20 posts, resolver fires:
// 1 query: SELECT * FROM posts LIMIT 20
// 20 queries: SELECT * FROM users WHERE id = $1  (once per post)
// = 21 queries instead of 2
```

## DataLoader Solution
```typescript
import DataLoader from 'dataloader'

// Create a DataLoader that batches individual user loads
const userLoader = new DataLoader<string, User>(async (userIds) => {
  // Called ONCE with ALL userIds collected in this tick
  const users = await db.query(
    'SELECT * FROM users WHERE id = ANY($1)',
    [userIds]
  )
  
  // CRITICAL: must return results in SAME ORDER as input keys
  const userMap = new Map(users.map(u => [u.id, u]))
  return userIds.map(id => userMap.get(id) ?? new Error(`User ${id} not found`))
})

// In your Post resolver:
const resolvers = {
  Post: {
    // This is called per-post, but DataLoader batches the DB calls
    author: (post, _args, { loaders }) => {
      return loaders.user.load(post.authorId)
    }
  }
}

// DataLoader per request — NEVER share between requests (cache isolation)
// Create loaders in context factory:
const createContext = ({ req }) => ({
  user: getUser(req),
  loaders: {
    user:    new DataLoader(batchUsers),
    comment: new DataLoader(batchComments),
    tag:     new DataLoader(batchTags),
  }
})
```

# AUTHORIZATION

## Field-Level Authorization Pattern
```typescript
// WRONG: check auth in the query resolver only
// A malicious client could query user.sensitiveData directly

// RIGHT: check at the field level
const resolvers = {
  User: {
    email: (user, _args, ctx) => {
      // Only the user themselves or admins can see email
      if (ctx.user.id !== user.id && ctx.user.role !== 'ADMIN') {
        return null  // or throw new ForbiddenError()
      }
      return user.email
    },
    
    privateNotes: (user, _args, ctx) => {
      if (ctx.user.id !== user.id) throw new ForbiddenError('Not your notes')
      return user.privateNotes
    }
  }
}

// Better pattern: directive-based auth
# schema.graphql
directive @auth(requires: UserRole = MEMBER) on FIELD_DEFINITION

type User {
  id:           ID!
  name:         String!
  email:        Email!  @auth          # requires login
  privateNotes: String  @auth(requires: ADMIN)  # requires admin
}
```

# ERROR HANDLING

## Two Types of Errors
```graphql
# 1. EXPECTED ERRORS (domain errors) — return as data
#    Wrong password, email already taken, not found
#    → Put in payload.errors (UserError type)
#    → Client SHOULD handle these

# 2. UNEXPECTED ERRORS (system errors) — go in GraphQL errors array
#    DB connection failed, unhandled exception
#    → Apollo/server framework puts these in the `errors` array
#    → Client shows a generic error message

# Client never sees internal error details in production:
# Development: errors[0].message = "connection refused at db:5432"
# Production:  errors[0].message = "Internal server error"
#              errors[0].extensions.code = "INTERNAL_SERVER_ERROR"
#              errors[0].extensions.requestId = "req_abc123"  (for support)
```

# SCHEMA EVOLUTION

## Safe Changes (Backwards Compatible)
```graphql
✓ Add new types
✓ Add new fields to existing types (nullable!)
✓ Add new enum values (clients must handle unknown enums gracefully)
✓ Add new optional input fields
✓ Add new queries and mutations
✓ Loosen nullability (non-null → nullable is safe, reverse is breaking)
```

## Breaking Changes (Never in Production Without Deprecation)
```graphql
✗ Remove a field, type, or enum value
✗ Change a field type (String → Int)
✗ Add a required (non-null) input argument
✗ Rename a field (add the new name, deprecate the old)

# Deprecation pattern:
type User {
  name: String! @deprecated(reason: "Use `displayName` instead")
  displayName: String!  # new field
}
```

# PERFORMANCE CHECKLIST
```
[ ] DataLoader for every relationship resolver that queries by ID
[ ] Depth limiting enabled (prevent deeply nested abusive queries)
[ ] Query complexity limiting (assign cost to fields, reject above threshold)
[ ] Persisted queries or query allowlisting in production (prevent arbitrary queries)
[ ] N+1 detection tooling in test suite (graphql-query-complexity)
[ ] Field-level tracing to find slow resolvers (Apollo Studio, Jaeger)
[ ] Disable introspection in production (or restrict to authenticated users)
```
