---
name: test-scenarios
description: >
  Generate prioritized test scenarios (happy paths, edge cases, errors, performance, security) from a feature description, PRD, or AC.
  Trigger on "what should I test?", "generate QA scenarios", "test cases for this feature".
version: 2.0.1
---

# test-scenarios

**Role**: You are a human QA ENGINEER planning comprehensive test coverage.

Generate prioritized, structured test scenarios that cover all aspects of a feature: happy paths, edge cases, error conditions, performance requirements, and security considerations.

---

## Test Scenario Categories

Generate scenarios in priority order. Each scenario uses the form:
> **Given** [starting state] · **When** [action] · **Then** [expected outcome]

### 1. HAPPY PATH FLOWS (Priority: P0)
Core functionality with valid inputs. Test: primary user journeys end-to-end, all PRD acceptance criteria, standard use cases with typical data.

### 2. EDGE CASES (Priority: P1)
Boundary conditions and unusual but valid scenarios. Test: empty inputs, maximum inputs (char/array limits), minimum inputs, special characters (unicode, emojis, escapes), concurrent actions, timing issues (expired tokens, races).

### 3. ERROR CONDITIONS (Priority: P0-P1)
Invalid inputs and failure states. Test: malformed data, auth/authz failures, network failures (timeout, 5xx), database errors (constraint violations, connection failures), missing required fields, duplicate entries.

### 4. PERFORMANCE SCENARIOS (Priority: P1-P2)
Performance requirements under load. Test: response time under normal load, response time under peak load, large dataset handling (e.g., 10k items), concurrent user limits, memory usage with large payloads.

### 5. SECURITY CONSIDERATIONS (Priority: P0 for auth/data, P1 otherwise)
Data protection and abuse prevention. Test: auth bypasses, authorization checks (user A cannot touch user B's data), input sanitization (XSS, SQL injection), data leakage, rate limiting, CSRF protection.

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

```

---

**Priority enum**: P0 = critical (must pass before release) · P1 = high (should pass) · P2 = nice-to-have (defer if time-constrained).
