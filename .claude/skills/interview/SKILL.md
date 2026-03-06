# Interview - Spec-Driven Feature Design Through AI Interviewing

## Overview

Before writing any code, Claude interviews you in depth about your feature/idea to surface gaps, edge cases, tradeoffs, and unclear requirements. The output is a comprehensive,  
 battle-ready spec written to a file. Based on the "Let Claude Code Interview You" workflow.

## Trigger Conditions

- User invokes `/interview`
- User says "interview me about...", "spec out...", "let's design...", or "help me think through..."

## Workflow Steps

### 1. Locate or Create the Spec File

**Process:**

1. Check if user provided a spec file path or if `spec.md` exists in the current directory
2. If a spec file exists, read it to understand the initial idea
3. If no spec file exists, ask the user to describe their idea in a few sentences
4. Create `spec.md` (or user-specified filename) with the initial idea as a starting point

### 2. Analyze the Initial Idea

**Process:**

1. Read the spec file thoroughly
2. Identify:
   - What is clearly defined
   - What is vaguely defined
   - What is completely missing
3. Categorize gaps into interview tracks:
   - **Core Purpose & Users** — Who is this for? What problem does it solve? What does success look like?
   - **Technical Architecture** — Data models, APIs, services, infrastructure, performance constraints
   - **UI/UX & Interactions** — User flows, states, error handling, accessibility, edge case UX
   - **Business Logic & Rules** — Validation, permissions, workflows, state machines, calculations
   - **Scale & Performance** — Concurrency, data volume, caching, rate limiting, degradation
   - **Security & Privacy** — Auth, authorization, data handling, audit, compliance
   - **Integration & Dependencies** — External services, existing systems, migration, backwards compatibility
   - **Failure Modes & Recovery** — What breaks? How do you know? How do you recover?
   - **Deployment & Operations** — Rollout strategy, feature flags, monitoring, rollback
   - **Tradeoffs & Alternatives** — What was considered and rejected? What are the known compromises?

### 3. Conduct the Interview

**This is the core of the skill. Use `AskUserQuestion` for EVERY question.**

**Interview Rules:**

1. **Ask non-obvious questions.** Never ask things that are self-evident from the spec. Dig into the hard parts — the things the user hasn't thought about yet.
2. **Ask one focused question at a time** (or a tightly related cluster of 2-3). Don't overwhelm.
3. **Go deep, not wide.** When a response reveals complexity, follow up on it before moving to another track.
4. **Challenge assumptions.** If the user says "it's simple," ask what happens when it's not.
5. **Use concrete scenarios.** Instead of "how do you handle errors?", ask "User A submits a form, the DB write succeeds but the email fails — what should they see?"
6. **Surface tradeoffs explicitly.** "You said X, but that conflicts with Y — which takes priority?"
7. **Don't accept vague answers.** If the user says "we'll figure that out later," push back: "What's the minimum decision we need now to avoid rework?"
8. **Track what's been covered.** Mentally maintain which tracks have been explored and which haven't.
9. **Continue until complete.** Don't stop after 5 questions. Keep going until every track has been explored to sufficient depth. A thorough interview is typically 15-30+ questions.
10. **Signal progress.** Periodically say something like "Good — I think we've nailed down the data model. Let me move to failure scenarios."

**Question Quality Guidelines:**

- BAD: "What database will you use?" (obvious/generic)
- GOOD: "If two ops users approve the same candidate simultaneously, which approval wins and what happens to the other session?"
- BAD: "Will there be error handling?" (yes/no, useless)
- GOOD: "The vendor API times out mid-verification — do you retry, queue for later, or mark as failed? What does the ops user see in each case?"
- BAD: "What are the requirements?" (lazy, too broad)
- GOOD: "You mentioned companies can configure custom checks — can they change the config while a candidate's check is in-flight? What happens to the in-progress check?"

### 4. Write the Final Spec

**Once the interview is complete, write the spec to the file.**

**Spec Output Structure:**

```markdown
# [Feature/Project Name]

## Problem Statement

What problem this solves and why it matters.

## Users & Personas

Who uses this and what they care about.

## Core Requirements

### Must Have

- Requirement 1 — [rationale from interview]
- Requirement 2 — [rationale from interview]

### Nice to Have

- Requirement 3 — [rationale from interview]

### Out of Scope

- Explicitly excluded items and why

## Technical Design

### Data Model

Tables/collections, key fields, relationships, indexes.

### API Design

Endpoints, request/response shapes, auth requirements.

### Business Logic

Rules, state machines, calculations, workflows.

### Integration Points

External services, existing system touchpoints.

## User Experience

### User Flows

Step-by-step flows for primary and secondary paths.

### Edge Cases & Error States

What can go wrong and what the user sees.

### UI States

Loading, empty, error, success, partial states.

## Scale & Performance

Concurrency model, caching strategy, expected volumes, bottlenecks.

## Security & Privacy

Auth model, data sensitivity, audit requirements.

## Failure Modes & Recovery

What breaks, how you detect it, how you recover.

## Deployment Strategy

Rollout plan, feature flags, migration steps, rollback plan.

## Tradeoffs & Decisions

Key decisions made during the interview with rationale.
Alternatives considered and why they were rejected.

## Open Questions

Anything that still needs resolution (ideally minimal after a good interview).

Writing Rules:

- Be specific, not generic. Use real field names, real API paths, real error messages.
- Include rationale for decisions — future readers should understand why, not just what.
- Flag any areas where the user said "figure it out later" as Open Questions.
- Keep it concise but complete. This spec should be sufficient for implementation without further clarification.

5. Review & Iterate

Process:

1. After writing the spec, ask the user to review it
2. If they want changes, update the spec
3. The spec is done when the user confirms it

Customization

The user can optionally specify:

- A different output file path (default: spec.md in current directory)
- A focus area ("just interview me about the API design" vs. full-scope)
- A target audience for the spec (e.g., "this spec is for junior devs to implement")
- An existing codebase to reference (Claude will read relevant files to ask better questions)

Error Handling

- If user gives one-word answers repeatedly, explicitly ask them to elaborate
- If the idea is too vague to even start, ask for a 3-sentence elevator pitch first
- If the scope is enormous, suggest breaking it into sub-specs and interview one at a time

Completion

The skill is complete when:

- All interview tracks have been explored
- The spec file has been written with all sections filled
- The user has reviewed and approved the final spec
- Open questions (if any) are clearly documented
```
