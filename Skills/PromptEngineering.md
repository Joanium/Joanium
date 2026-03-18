---
name: Prompt Engineering
trigger: write a prompt, improve a prompt, get better AI output, prompt for [task], system prompt, few-shot examples, chain of thought, AI instruction design
description: Design, optimize, and systematically improve prompts for any AI model. Use when creating system prompts, refining instructions, or building AI-powered workflows.
---

Prompt engineering is the practice of designing inputs that reliably produce high-quality outputs from language models. It combines clear communication, task decomposition, behavioral specification, and iterative refinement.

## Core Principles

**The model does what you describe, not what you intend**
- Ambiguity in your prompt becomes variance in output
- Implicit assumptions stay implicit — make everything explicit
- The model fills gaps with training-data defaults — override defaults you don't want

**Constraints are as important as instructions**
- Tell the model what NOT to do as explicitly as what to do
- Define the output format, length, and structure precisely
- Scope the task — "write a summary" is infinite; "write a 3-sentence summary focusing on X" is tractable

## Prompt Anatomy

A well-structured prompt has these components:

```
[ROLE/PERSONA]      Who is the model being asked to behave as?
[CONTEXT]           What background does the model need?
[TASK]              What specifically needs to be done?
[INSTRUCTIONS]      How should it be done? What rules apply?
[OUTPUT FORMAT]     What should the response look like?
[EXAMPLES]          What does good look like? (few-shot)
[CONSTRAINTS]       What should be avoided or excluded?
[INPUT]             The actual content to process (when applicable)
```

Not every prompt needs all components — but knowing they exist lets you add them when output quality is inconsistent.

## Prompt Patterns & Techniques

### 1. Role Prompting
Assign a specific expert identity to shape response style and depth:
```
You are a senior product manager at a B2B SaaS company with 10+ years of 
experience writing PRDs that engineering teams actually find clear and actionable.
```
**Why it works:** The role activates relevant training patterns — vocabulary, format expectations, level of detail.

**When to add specificity:** Generic roles ("expert", "assistant") are weak. Specific roles with context are strong.

### 2. Few-Shot Examples
Show the model what good looks like — don't just tell it:
```
Convert the following feature request into a user story using this format:

Example 1:
Input: "Users should be able to reset their password"
Output: As a registered user, I want to reset my forgotten password via email 
        so that I can regain access to my account without contacting support.

Example 2:
Input: "Add dark mode"
Output: As a user who works in low-light environments, I want to switch the 
        interface to dark mode so that I can reduce eye strain during extended use.

Now convert: [your input]
```
**Guideline:** 2-5 examples cover most cases. More examples = higher quality but higher token cost.

### 3. Chain of Thought (CoT)
Force the model to reason before answering:
```
Think through this problem step by step before giving your final answer.
Show your reasoning for each step. Only give your conclusion after completing 
the full reasoning chain.
```
**When to use:** Complex reasoning, math, multi-step decisions, ambiguous classification.
**Variant:** "Think out loud in a <thinking> block before writing your response."

### 4. Output Format Specification
Define structure precisely to make output reliable and parseable:
```
Respond with a JSON object in exactly this format:
{
  "summary": "2-3 sentence summary",
  "sentiment": "positive" | "negative" | "neutral",
  "key_themes": ["theme1", "theme2", "theme3"],
  "confidence": 0.0-1.0
}
Do not include any text outside the JSON object.
```

**For prose outputs, specify:**
```
Format your response as follows:
- Start with a one-sentence bottom line
- Follow with 3-5 bullet points of supporting detail
- End with a single recommended next action
- Total length: 150-200 words
- Tone: direct and professional, avoid hedging language
```

### 5. Negative Space Instructions
Explicitly exclude what you don't want — the model won't always infer it:
```
DO NOT:
- Include caveats or disclaimers
- Use bullet points (use prose paragraphs)
- Suggest "consulting a professional" 
- Pad the response with repetition of the question
- Use phrases like "Certainly!", "Of course!", or "Great question!"
```

### 6. Context Injection
Give the model the information it needs to produce specific, not generic, output:
```
Here is the relevant context:
<context>
Company: Acme Corp, B2B project management software, mid-market focus
Target user: Operations managers at companies with 50-500 employees
Current pain point: Manual status updates across 3 different tools
Competitor framing: "Unlike Asana, we don't require you to restructure your workflow"
</context>

Given this context, write the homepage hero copy.
```

### 7. Constitutional/Self-Critique
Ask the model to review its own output:
```
After writing the first draft, review it against these criteria:
1. Is every claim specific and not generic?
2. Is the tone consistent throughout?
3. Is there any unnecessary repetition?
4. Does the conclusion follow logically from the body?

Revise the draft based on your critique and output only the final version.
```

### 8. Persona + Anti-Persona
Define the target audience precisely:
```
Write this as if the reader is:
- A first-generation entrepreneur, no formal business education
- Has failed once before and is cautious about overcommitting
- Reads on mobile, skims before they read

Do NOT write as if the reader:
- Has an MBA or finance background
- Is familiar with startup jargon (ARR, burn rate, EBITDA)
- Will read every word carefully
```

## System Prompt Design

For persistent AI behaviors, system prompts define the operating parameters:

```markdown
# System Prompt Template

## Identity
You are [name], a [role] who [core value proposition].

## Personality
[3-5 adjectives with brief explanation of how each manifests in communication]

## Behavior Rules
- Always [non-negotiable behavior]
- Never [non-negotiable constraint]
- When [situation], [specific response approach]

## Communication Style
- Tone: [specific descriptor]
- Length: [guideline]  
- Format: [structure preferences]
- Voice: [first/second/third person + examples]

## Scope
You help with: [list of in-scope topics]
You do not: [list of out-of-scope behaviors]

## Edge Cases
If asked [X], respond by [Y]
If the user seems [situation], [behavioral guidance]
```

## Prompt Debugging

When output quality is poor, diagnose systematically:

**Symptom → Likely Cause → Fix:**
```
Output is too generic       → Insufficient context         → Add specifics about audience, constraints, purpose
Output is too long          → No length constraint         → Add explicit word/sentence count
Output ignores instructions → Instructions buried in prose → Move to numbered list, bold key constraints
Output is inconsistent      → No format specification      → Add format template or examples
Output has wrong tone       → Tone not specified           → Add explicit tone descriptor + example
Output misses the point     → Task not clearly scoped      → Rewrite the task statement; add what success looks like
```

## Evaluation Framework

Test prompts systematically:

```
1. Write 3-5 diverse test inputs that represent real use cases
2. Run the prompt on all test inputs
3. Grade outputs: Excellent / Acceptable / Unacceptable
4. For every "Unacceptable": identify which prompt component is missing or wrong
5. Fix that component and re-test
6. Repeat until all test inputs produce Excellent/Acceptable output
```

**Quality dimensions to evaluate:**
- Accuracy: Is the information correct?
- Relevance: Does it address the actual task?
- Format: Is the structure as specified?
- Tone: Does the voice match the specification?
- Consistency: Does it produce similar quality on similar inputs?
- Robustness: Does it handle edge cases gracefully?

## Common Mistakes

1. **Vague tasks** — "Write something about X" → "Write a 200-word explanation of X for a 10-year-old"
2. **No output format** — leaving structure to the model produces inconsistent results
3. **Over-specifying constraints** without specifying the goal — constraints without purpose
4. **Prompt stuffing** — so many instructions the model loses track; prioritize ruthlessly
5. **No examples** when the task has a specific style requirement
6. **Ignoring context window** — long inputs + long instructions = truncated reasoning
7. **Not iterating** — a first-draft prompt is a hypothesis, not a solution
