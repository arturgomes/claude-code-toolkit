# Structured Content Template

Bridge between analysis and the image prompt: the exact text and visuals for each section, in a format the prompt can carry.

## Rules

| Rule | Requirement |
|------|-------------|
| **Format** | Markdown only |
| **Tone** | Friendly, clear teacher; encouraging, never condescending |
| **Facts** | Only what the source says; no new facts or examples |
| **Exact data** | Numbers, dates, names, units, formulas and quotes copied exactly |
| **Wording** | Explanatory text reworded to the level's limits in `levels/<level>.md`; terms kept and glossed |
| **Labels** | Every on-image text is written out here in double quotes, final spelling and accents included; text that is not meant to be drawn never uses quotation marks |

## Format

```markdown
# [Infographic Title]

**Text Labels**:
- Title: "[Exact title text]"
- Subhead: "[Exact text]" (optional)

## Overview
[1-2 sentences]

## Learning Objectives
After viewing this infographic, the student can:
1. [Objective]
2. [Objective]

---

## Section 1: [Section Title]

**Key Concept**: [One sentence]

**Content**:
- [Point, exact data copied verbatim]
- [Point, reworded to the grade level]

**Visual Element**:
- Type: [icon/diagram/illustration/chart]
- Subject: [what it depicts]
- Treatment: [how it is shown]

**Text Labels**:
- Headline: "[Exact text]"
- Labels: "[Label 1]", "[Label 2]"

---

[Repeat for each section]

---

## Key Terms
- "[Term]": "[plain-words gloss]"

## Data Points (Verbatim)
Reference list for checking, written without quotation marks so it is not drawn; a figure appears on the image only when a section's Text Labels quote it.
- [Exact number, date, formula or quote] (attribution if a quote)

## Design Instructions
- [Style, color, layout wishes from the user; omit if none]
```

## Section Patterns

| Content | Fields to add |
|---------|---------------|
| **Step** | `Action` (imperative verb + object), `Why` (if the source gives it), numbered icon, arrow to the next step |
| **Comparison** | A table: `Aspect`, `[Item A]`, `[Item B]`; split-screen visual, one color per item |
| **Cycle stage** | `Stage name`, `What happens`, arrow to the next stage; the last stage points back to the first |
| **Part of a whole** | `Part name`, `Function`, a leader line to the part in the drawing |
| **Timeline event** | `Date` (exact), `Event`, `Why it matters` (if the source gives it) |
| **Number** | `Value` (exact), `What it measures`, big-numeral treatment |

## Quality Checklist

- [ ] Title states the main idea
- [ ] Each section maps to one objective
- [ ] Section count and label length within the level's limits
- [ ] Data copied exactly; terms kept and glossed
- [ ] Every on-image label (title included) written out in double quotes, accents correct
- [ ] No quotation marks around anything that must not be drawn
- [ ] No new facts added
