---
name: UX Research
trigger: user research, user interviews, usability testing, user feedback, product discovery, persona, user journey, pain points, customer insight, jobs to be done
description: Plan and execute UX research — from research questions to interviews to synthesis. Use when doing user discovery, validating product ideas, understanding behavior, or synthesizing qualitative insights.
---

UX research is the systematic study of users — their goals, behaviors, mental models, and pain points — to inform better product decisions. Good research produces actionable insights grounded in real human behavior, not assumptions.

## Research Planning

### Define the Research Question
The most important step. Bad research questions produce useless findings.

```
❌ Too broad:  "How do our users feel about the product?"
❌ Too narrow: "Do users prefer button color blue or green?"
✓ Right scope: "What are the biggest friction points in our onboarding flow 
               that prevent users from completing their first [core action]?"
✓ Right scope: "What does our target user's current workflow look like for 
               [problem we solve], and where does it break down?"
```

**Research question checklist:**
- Is this specific enough to produce actionable findings?
- Can we actually learn this through research (vs. analytics)?
- Will the answer change a product or business decision?
- Do we NOT already know the answer? (Don't research what data already tells you)

### Choose the Right Method

| Research Goal | Best Method |
|---------------|-------------|
| Understand behavior, goals, workflows | User interviews |
| Evaluate a specific design/flow | Usability testing |
| Measure satisfaction/sentiment at scale | Surveys |
| Understand how people navigate | Card sorting / tree testing |
| Observe real-world usage | Contextual inquiry / diary study |
| Prioritize features or pain points | Jobs to Be Done (JTBD) interviews |
| Validate assumptions quickly | Guerrilla research (café testing) |

**Qualitative vs Quantitative:**
```
Qualitative (interviews, observation): 
- Answers WHY and HOW
- Deep insight, small sample (5-15 people)
- Best for: discovery, exploration, problem understanding

Quantitative (surveys, analytics):
- Answers WHAT and HOW MANY
- Statistical validity, large sample
- Best for: validation, measurement, prioritization
```

## User Interview Guide

### Recruiting Participants
```
Target profile:
- Define specific criteria (not "any user" — be precise)
- Include both current users and target users who don't use your product yet
- Aim for 5-8 participants per research question (law of diminishing returns)
- Screener survey to qualify candidates

Screener example questions:
1. What is your current role/title?
2. How often do you [relevant behavior]?
3. What tools do you currently use for [problem area]?
4. [Specific qualifying criterion]
```

### Interview Structure (60-minute session)
```
0-5 min:   INTRO
           Thank them, explain purpose (learning from THEM, not testing them)
           "There are no right or wrong answers — we want your honest experience"
           Ask permission to record
           
5-15 min:  WARM-UP
           Background questions — their role, context, how they work
           Goal: understand their world before asking about the specific topic

15-45 min: CORE QUESTIONS
           Open-ended, behavior-focused questions (see below)
           
45-55 min: TASKS (if usability testing)
           "Can you show me how you would [task]?" — observe, don't guide
           
55-60 min: WRAP-UP
           "Is there anything about this topic I didn't ask about that you think is important?"
           "If you had a magic wand and could change one thing about [area], what would it be?"
```

### Interview Question Design
```
BEHAVIORAL (best — ask about real past behavior, not hypotheticals)
✓ "Walk me through the last time you [did the relevant thing]"
✓ "Can you show me how you currently handle [workflow]?"
✓ "What happened the last time [problem situation] came up?"

FOLLOW-UP PROBES (dig deeper — essential technique)
✓ "Tell me more about that."
✓ "Why did you do it that way?"
✓ "What were you thinking at that moment?"
✓ "How did that make you feel?"
✓ "What did you do next?"
✓ "Can you give me a specific example?"

AVOID (these produce bad data)
❌ Leading: "How frustrated were you when that happened?"
❌ Hypothetical: "What would you do if the feature had X?"
❌ Yes/no: "Do you find it easy to use?"
❌ Compound: "What do you use it for and how often?"
```

## Usability Testing

### Prototype Testing Protocol
```
Setup:
- Use Figma, a staging environment, or the live product
- Screen share or in-person — record the session
- Establish the think-aloud protocol: "Please narrate your thoughts as you go"

Task instructions:
- Realistic scenario, not step-by-step instructions
✓ "Imagine you need to invite a team member to the project you're working on. 
   Please go ahead and do that."
❌ "Click 'Settings', then 'Team Members', then 'Invite.'"

Observe, don't help:
- Silence is golden — resist the urge to assist
- Note: Where do they pause? Where do they go wrong? What do they say?
- Only intervene if completely stuck for > 2 minutes

Post-task questions:
- "On a scale of 1-10, how difficult was that task?"
- "What was confusing about that experience?"
- "What would you expect to happen when you [point of confusion]?"
```

## Research Synthesis

### Affinity Mapping
```
Process (best done collaboratively):
1. Write every observation, quote, and behavior on individual sticky notes
2. Group related notes together without forcing categories
3. Name the groups (these become your themes)
4. Look for: surprising patterns, repeated pain points, mental model mismatches

Digital tools: FigJam, Miro, Notion
```

### Insight vs. Observation
```
❌ Observation: "Users clicked the wrong button 4 out of 6 times"
✓ Insight:      "Users expect the primary action to be on the right side 
                because they associate left-side CTAs with navigation, not 
                commitment — the current layout inverts their mental model"

An insight explains WHY behavior happens and implies what to do about it.
```

### Research Report Structure
```
# [Research Study]: Findings & Recommendations

## Executive Summary
[3-5 sentences: research question, method, key findings, top recommendation]

## Research Overview
- Objective:
- Method:
- Participants: n= [number], [brief profile description]
- Dates conducted:

## Key Findings
### Finding 1: [Insight title]
Evidence: [Quotes, behaviors observed, frequency]
Implication: [What this means for the product]

### Finding 2: [Insight title]
[Repeat structure]

## Recommendations (prioritized)
1. [Highest priority recommendation + rationale]
2. [Second priority]

## Appendix
- Screener
- Interview guide
- Raw notes (optional)
```

### Jobs To Be Done Framework
```
When [SITUATION], I want to [MOTIVATION], so I can [OUTCOME].

Example: "When I'm preparing for a client presentation, I want to quickly find 
the most recent version of our proposal, so I can make sure I'm showing 
accurate pricing and not embarrass myself."

JTBD interviews focus on:
1. The trigger event: "What made you start looking for a solution?"
2. The consideration process: "What did you look at? What mattered?"
3. The switching moment: "What finally made you decide to change?"
4. The expected outcome: "What were you hoping it would do for you?"
```
