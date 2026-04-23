---
name: product-spec
description: >
  Generate comprehensive Product Requirement Documents (PRDs) from feature ideas.
  Acts as a Product Owner to define feature scope, user stories, acceptance criteria,
  and technical constraints before planning begins. Use when starting a new feature,
  defining requirements for a proposal, or when asked "create a PRD", "define product spec",
  "act as product owner", or "what should this feature include?". Produces structured
  artifacts ready for technical planning (QPLAN) and QA test generation (QUX).
version: 2.0.0
---

# product-spec

**Role**: You are a PRODUCT OWNER defining a feature request.

Generate comprehensive product artifacts that clearly scope what to build, why it matters, and how success will be measured.

---

## Output Structure

Generate artifacts in this exact order:

### 1. FEATURE OVERVIEW
- **Feature name**: One clear, descriptive name
- **One-line description**: 10-15 words max
- **Business value**: Why does this matter? What problem does it solve?
- **Key metrics**: 2-3 specific, measurable outcomes
- **Target users**: Primary persona(s) who will use this
- **Priority level**: P0 (critical) | P1 (high) | P2 (nice-to-have)

### 2. USER STORIES
Write stories in the format:
> **As a** [user type]
> **I want** [goal]
> **So that** [benefit]

Include:
- **Primary stories**: Core functionality (3-5 stories)
- **Edge case stories**: Unusual but important scenarios (1-3 stories)

**Rule**: Each story must be independently deliverable and testable.

### 3. ACCEPTANCE CRITERIA
For each user story, define testable conditions in Given-When-Then format:

> **Given** [context/precondition]
> **When** [action/trigger]
> **Then** [expected outcome]

Cover:
- Happy path scenarios (what should work)
- Edge cases (boundary conditions)
- Error states (what happens when things go wrong)
- Performance requirements (if applicable: load time, response time, throughput)

### 4. DEPENDENCIES & CONSTRAINTS
Document what must exist or be true:
- **Technical dependencies**: APIs, packages, infrastructure, external services
- **Feature dependencies**: What features must exist first? What blocks this?
- **Known limitations**: Platform constraints, legal/compliance requirements
- **Security/compliance requirements**: Authentication, data privacy, audit trails

### 5. OUT OF SCOPE
Explicitly list what this feature will NOT do:
- Related features deferred to future iterations
- Functionality that might seem related but isn't included
- Nice-to-haves that won't make the first version

### 6. SUCCESS METRICS
Define how we'll measure success:
- **Quantifiable KPIs**: Numbers that change (e.g., "reduce support tickets by 30%")
- **User behavior changes**: Observable shifts (e.g., "users enable feature within first login")
- **Technical metrics**: Performance indicators (e.g., "99.9% uptime")

### 7. TECHNICAL CONSIDERATIONS
High-level technical context:
- **Affected systems**: Which packages/modules need changes?
- **Database schema changes**: New tables, columns, migrations needed?
- **API contracts**: New endpoints, changes to existing APIs?
- **Third-party integrations**: External services, webhooks, OAuth providers?

### 8. UI/UX REQUIREMENTS
If user-facing:
- **Key user flows**: Step-by-step journeys (e.g., "1. Click button → 2. Fill form → 3. Confirmation")
- **Mobile vs desktop**: Different experiences or responsive design?
- **Accessibility requirements**: WCAG level, screen reader support, keyboard navigation?

---

## Output Format

```markdown
# Feature: [Feature Name]

## 1. FEATURE OVERVIEW
- **Name**: [Name]
- **Description**: [One-line]
- **Business Value**: [Why]
- **Key Metrics**: [Measurable outcomes]
- **Target Users**: [Personas]
- **Priority**: [P0/P1/P2]

## 2. USER STORIES

### Primary Stories
1. **As a** [user] **I want** [goal] **So that** [benefit]
2. [...]

### Edge Case Stories
1. **As a** [user] **I want** [goal] **So that** [benefit]

## 3. ACCEPTANCE CRITERIA

### Story 1: [Story title]
- **Given** [context] **When** [action] **Then** [outcome]
- **Given** [context] **When** [action] **Then** [outcome]

### Story 2: [Story title]
- [...]

## 4. DEPENDENCIES & CONSTRAINTS
- **Technical Dependencies**: [List]
- **Feature Dependencies**: [List]
- **Known Limitations**: [List]
- **Security/Compliance**: [List]

## 5. OUT OF SCOPE
- [Explicit exclusion 1]
- [Explicit exclusion 2]

## 6. SUCCESS METRICS
- [KPI 1]: [Target]
- [KPI 2]: [Target]

## 7. TECHNICAL CONSIDERATIONS
- **Affected Systems**: [Packages/modules]
- **Database Changes**: [Schema updates]
- **API Contracts**: [New/changed endpoints]
- **Integrations**: [Third-party services]

## 8. UI/UX REQUIREMENTS
- **Key Flows**: [Step-by-step]
- **Mobile/Desktop**: [Responsive strategy]
- **Accessibility**: [Requirements]
```

---

## Example

```markdown
# Feature: Dark Mode Toggle

## 1. FEATURE OVERVIEW
- **Name**: Dark Mode Toggle
- **Description**: Allow users to switch between light and dark themes
- **Business Value**: Reduce eye strain for users working at night; increase accessibility
- **Key Metrics**: 40% of users enable dark mode within 1 week; 15% reduction in "bright screen" support tickets
- **Target Users**: All users, especially power users and accessibility-focused users
- **Priority**: P1

## 2. USER STORIES

### Primary Stories
1. **As a** user **I want** to toggle dark mode from settings **So that** I can reduce eye strain at night
2. **As a** user **I want** my theme preference saved **So that** it persists across sessions

### Edge Case Stories
1. **As a** user with system-level dark mode **I want** the app to respect my OS preference **So that** I don't have to configure it manually

## 3. ACCEPTANCE CRITERIA

### Story 1: Toggle dark mode
- **Given** I am on the settings page **When** I click "Dark Mode" toggle **Then** the UI switches to dark theme immediately
- **Given** Dark mode is enabled **When** I navigate to any page **Then** all pages render in dark theme

### Story 2: Persist preference
- **Given** I enabled dark mode **When** I log out and log back in **Then** dark mode is still enabled

## 4. DEPENDENCIES & CONSTRAINTS
- **Technical Dependencies**: CSS variables for theming, localStorage for persistence
- **Feature Dependencies**: Settings page must exist
- **Known Limitations**: Third-party embedded widgets may not support dark theme
- **Security/Compliance**: None

## 5. OUT OF SCOPE
- Automatic theme switching based on time of day (future P2 feature)
- Custom color schemes beyond light/dark (future enhancement)
- Dark mode for marketing pages (only in-app pages)

## 6. SUCCESS METRICS
- **Adoption**: 40% of active users enable dark mode within 1 week
- **Support ticket reduction**: 15% fewer "bright screen" complaints
- **Performance**: Theme switch completes in <100ms

## 7. TECHNICAL CONSIDERATIONS
- **Affected Systems**: `packages/web` (Next.js frontend), `packages/shared` (theme utilities)
- **Database Changes**: Add `theme_preference` column to `users` table
- **API Contracts**: None (client-side only)
- **Integrations**: None

## 8. UI/UX REQUIREMENTS
- **Key Flows**: Settings → Toggle switch → Immediate UI update
- **Mobile/Desktop**: Same toggle on both platforms
- **Accessibility**: Ensure WCAG AA contrast ratios in both themes
```
