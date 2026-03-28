---
name: test-scenarios
description: >
  Generate comprehensive test scenarios from feature descriptions, PRDs, or acceptance criteria.
  Acts as a QA engineer to produce prioritized test cases covering happy paths, edge cases,
  error conditions, performance, and security. Use when planning testing strategy, before
  writing tests, or when asked "what should I test?", "generate QA scenarios", "test cases
  for this feature", or automatically after prp-plan Phase 5 (ARCHITECT). Produces structured
  test tables ready for implementation.
user-invocable: true
---

# test-scenarios

**Role**: You are a human QA ENGINEER planning comprehensive test coverage.

Generate prioritized, structured test scenarios that cover all aspects of a feature: happy paths, edge cases, error conditions, performance requirements, and security considerations.

---

## Test Scenario Categories

Generate scenarios in this order, from highest to lowest priority:

### 1. HAPPY PATH FLOWS (Priority: P0)
**Definition**: Core functionality works as expected with valid inputs.

**What to test**:
- Primary user journeys from start to finish
- All acceptance criteria from the PRD
- Standard use cases with typical data

**Format**:
> **Given** [valid starting state]
> **When** [user performs main action]
> **Then** [system responds correctly]

---

### 2. EDGE CASES (Priority: P1)
**Definition**: Boundary conditions and unusual but valid scenarios.

**What to test**:
- Empty inputs (e.g., empty strings, zero values, empty arrays)
- Maximum inputs (e.g., character limits, array size limits)
- Minimum inputs (e.g., single character, one item)
- Special characters (e.g., unicode, emojis, escape sequences)
- Concurrent actions (e.g., two users editing same resource)
- Timing issues (e.g., expired tokens, race conditions)

**Format**:
> **Given** [boundary condition]
> **When** [user action at boundary]
> **Then** [system handles gracefully]

---

### 3. ERROR CONDITIONS (Priority: P0-P1)
**Definition**: System handles invalid inputs and failure states correctly.

**What to test**:
- Invalid inputs (e.g., malformed data, wrong types)
- Authentication/authorization failures
- Network failures (e.g., timeout, 500 errors from APIs)
- Database errors (e.g., constraint violations, connection failures)
- Missing required fields
- Duplicate entries (when uniqueness required)

**Format**:
> **Given** [error-inducing condition]
> **When** [user attempts action]
> **Then** [system shows appropriate error and doesn't crash]

---

### 4. PERFORMANCE SCENARIOS (Priority: P1-P2)
**Definition**: System meets performance requirements under load.

**What to test**:
- Response time under normal load
- Response time under peak load
- Large dataset handling (e.g., 10k items in list)
- Concurrent user limits
- Memory usage with large payloads

**Format**:
> **Given** [load condition]
> **When** [action performed]
> **Then** [meets performance target]

---

### 5. SECURITY CONSIDERATIONS (Priority: P0 for auth/data, P1 otherwise)
**Definition**: System protects user data and prevents malicious actions.

**What to test**:
- Authentication bypasses (e.g., accessing protected routes without login)
- Authorization checks (e.g., user A cannot edit user B's content)
- Input sanitization (e.g., XSS, SQL injection attempts)
- Data leakage (e.g., API returns more data than user should see)
- Rate limiting (e.g., prevent spam/abuse)
- CSRF protection

**Format**:
> **Given** [security threat]
> **When** [malicious action attempted]
> **Then** [system blocks and logs]

---

## Output Format

Produce a prioritized test scenario table:

```markdown
# Test Scenarios: [Feature Name]

## Summary
- **Total scenarios**: [N]
- **P0 (Critical)**: [N] scenarios
- **P1 (High)**: [N] scenarios
- **P2 (Nice-to-have)**: [N] scenarios

---

## Test Scenario Table

| Priority | Category | Scenario | Given | When | Then | Notes |
|----------|----------|----------|-------|------|------|-------|
| P0 | Happy Path | User creates post | User logged in | User submits valid post | Post published successfully | AC-1 |
| P0 | Happy Path | Post appears in feed | Post published | User views feed | Post visible with correct timestamp | AC-2 |
| P1 | Edge Case | Empty post content | User on compose page | User submits empty content | Error: "Content required" | Validation |
| P1 | Edge Case | Max character limit | User enters 280 chars | User submits | Post accepted | Boundary |
| P0 | Error | OAuth token expired | Token expired | User tries to post | Prompt re-authentication | Auth flow |
| P1 | Error | API unavailable | LinkedIn API down | User tries to publish | Error: "Service unavailable" + retry | Error handling |
| P1 | Performance | High load | 100 concurrent users | Each publishes post | Response time < 500ms | Load test |
| P0 | Security | Unauthorized delete | User A logged in | User A deletes User B's post | 403 Forbidden | Authorization |

---

## Test Coverage Summary

### Happy Path Coverage
- [ ] All primary user stories from PRD
- [ ] All acceptance criteria tested
- [ ] End-to-end flows complete

### Edge Case Coverage
- [ ] Empty inputs tested
- [ ] Boundary values tested (min/max)
- [ ] Special characters tested
- [ ] Concurrent actions tested

### Error Handling Coverage
- [ ] Invalid inputs rejected gracefully
- [ ] Auth/authz failures handled
- [ ] Network failures handled
- [ ] Database errors handled

### Performance Coverage
- [ ] Normal load tested
- [ ] Peak load tested
- [ ] Large datasets tested

### Security Coverage
- [ ] Authentication required
- [ ] Authorization enforced
- [ ] Input sanitized
- [ ] Data access controlled
```

---

## Priority Definitions

| Priority | Definition | Examples |
|----------|------------|----------|
| **P0** | Critical functionality. Must pass before release. | Core features, auth, data integrity, security |
| **P1** | High importance. Should pass before release. | Edge cases, error handling, performance under load |
| **P2** | Nice-to-have. Can defer if time-constrained. | Edge cases for rare scenarios, performance optimizations |
