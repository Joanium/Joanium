---
name: Code Review
trigger: review this code, code review, feedback on my code, is this code good, improve this code, check my implementation, critique this code, best practices
description: Perform thorough, constructive, prioritized code reviews across any language or framework. Use when reviewing code quality, correctness, performance, security, and maintainability.
---

A great code review is not a list of complaints — it's a structured transfer of craft. The goal is to make the code better, help the author grow, and protect the system from future pain.

## Review Mindset

**You are a collaborator, not a judge:**
- Assume good intent and competence — ask questions before asserting problems
- Separate must-fix (correctness, security) from should-fix (quality) from could-fix (style)
- Every comment should explain WHY, not just what to change
- Praise good code — this is not only about problems

**The reviewer's contract:**
- Be specific — "this could be cleaner" is not a review comment
- Be kind — critique the code, never the person
- Be prioritized — distinguish critical issues from minor preferences
- Be constructive — suggest the fix, not just the problem

## Review Structure

### Pass 1: Holistic Understanding (read without commenting)
Before noting anything, answer:
```
- What is this code trying to do?
- Does the approach make sense at a high level?
- Is this the right abstraction?
- Are there obvious missing pieces?
```

### Pass 2: Correctness (does it work?)
```
Logic errors:
- Does the algorithm correctly handle the stated requirements?
- Are edge cases handled? (empty inputs, null/undefined, zero, negative numbers, max values)
- Are error conditions handled gracefully?
- Are assumptions documented or validated?

State management:
- Is state mutated unexpectedly?
- Are race conditions possible in async code?
- Is data consistently valid at all points?

Tests:
- Do the tests actually test the behavior (not just the implementation)?
- Are edge cases tested?
- Are failure modes tested?
- Would these tests catch a regression?
```

### Pass 3: Security (does it protect?)
```
Input validation:
- Is all user input validated before use?
- Is there SQL injection risk? (use parameterized queries, always)
- Is there XSS risk? (escape output, use CSP)
- Is there path traversal risk for file operations?

Authentication & Authorization:
- Are auth checks at the right level (not just UI)?
- Is the user's permission verified before every sensitive operation?
- Are secrets/credentials ever in code? (should be env vars)
- Are session tokens handled securely?

Dependencies:
- Are dependencies from trusted sources?
- Are there known vulnerabilities in the dependencies used?

Sensitive data:
- Is PII/sensitive data logged anywhere?
- Is sensitive data encrypted at rest and in transit?
- Is sensitive data leaked in error messages or responses?
```

### Pass 4: Performance (does it scale?)
```
Algorithmic complexity:
- What is the time complexity? Is O(n²) acceptable for the expected input size?
- Are there unnecessary nested loops?
- Are there O(n) operations inside loops that could be O(1)?

Database & I/O:
- N+1 query problem: are queries inside loops loading one record at a time?
- Are queries indexed? (check the query plan for slow queries)
- Is pagination used for large result sets?
- Are expensive operations cached where appropriate?

Memory:
- Are large objects created unnecessarily?
- Is memory released (streams closed, listeners removed, resources cleaned up)?
- Are there memory leaks from uncleaned subscriptions or event listeners?
```

### Pass 5: Maintainability (will future-you understand this?)
```
Naming:
- Do names describe WHAT the thing is/does, not HOW?
- Are names at the right abstraction level?
- Are names consistent with the rest of the codebase?

Functions & Classes:
- Does each function do one thing? (Single Responsibility)
- Is each function at one level of abstraction?
- Are functions short enough to understand in one reading?
- Is the class hierarchy reasonable or is inheritance overused?

Comments:
- Do comments explain WHY, not WHAT? (the code shows what; comments explain intent)
- Are there any outdated or misleading comments?
- Are complex algorithms/decisions documented?

Duplication:
- Is there repeated logic that should be extracted?
- Are there similar patterns that could be unified?
- Does this reinvent something the language/framework already provides?

Dependencies:
- Are dependencies injected (testable) or hardcoded (not testable)?
- Are there circular dependencies?
- Is the coupling between modules appropriate?
```

## Comment Templates

Use consistent severity labeling:

```
[CRITICAL]  Must fix before merge — correctness, security, data loss risk
[IMPORTANT] Should fix before merge — significant quality/performance issue
[SUGGESTION] Consider fixing — quality improvement
[QUESTION]  Asking for understanding before judging
[NITPICK]   Minor style preference — take it or leave it
[PRAISE]    This is well done

Examples:

[CRITICAL] This query is vulnerable to SQL injection. Use parameterized queries:
  db.query("SELECT * FROM users WHERE id = $1", [userId])
  Instead of: db.query(`SELECT * FROM users WHERE id = ${userId}`)

[IMPORTANT] This creates an N+1 query — for each post, you're loading the author 
  separately. Use an eager load: Post.findAll({ include: Author })

[SUGGESTION] This function is doing both validation and persistence. Consider 
  splitting into validateUser() and saveUser() for clearer testing and single 
  responsibility.

[QUESTION] I notice you're using a global variable here — was this intentional? 
  Usually we'd pass this as a parameter to make the dependency explicit.

[NITPICK] Personal preference, but I find early returns easier to read than 
  deeply nested if/else.

[PRAISE] Nice use of the factory pattern here — this makes it easy to add new 
  types without changing the calling code.
```

## Language-Specific Checklists

### JavaScript / TypeScript
```
- Are async operations properly awaited? No floating Promises?
- Are errors caught in async functions (try/catch or .catch())?
- TypeScript: is `any` avoided? Are types specific?
- Are event listeners cleaned up (in React: useEffect cleanup)?
- Is optional chaining used for nullable access (user?.profile?.name)?
- Are array methods used appropriately (map/filter/reduce vs forEach)?
- Are magic numbers replaced with named constants?
```

### Python
```
- Are exceptions specific (not bare `except:`)? 
- Are context managers used for resources (with open(...) as f)?
- Are list/dict comprehensions readable (not too complex)?
- Are mutable default arguments avoided?
- Are f-strings used (not % or .format()) for modern code?
- Are type hints present for function signatures?
- Is the code PEP-8 compliant (or the project's style guide)?
```

### SQL
```
- Are all queries parameterized (no string interpolation)?
- Is SELECT * avoided in production code?
- Are appropriate indexes likely to exist for WHERE / JOIN clauses?
- Are transactions used for multi-step operations that must be atomic?
- Is pagination used (LIMIT/OFFSET or cursor) for unbounded queries?
- Are N+1 patterns avoided (use JOINs or CTEs)?
```

## The Review Summary

End every code review with a summary block:

```
## Review Summary

**Overall:** [One sentence on the quality and approach]

**Must address before merge:**
- [CRITICAL issue 1]
- [CRITICAL issue 2]

**Recommended improvements:**
- [IMPORTANT issue 1]
- [SUGGESTION 1]

**Well done:**
- [Specific praise]

**Estimated effort to address:** [Small / Medium / Large]
```
