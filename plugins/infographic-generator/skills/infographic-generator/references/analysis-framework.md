# Content Analysis Framework

Analyze the source like a teacher planning one visual lesson aid, before choosing layout or style.

## Teacher Mindset

| Principle | Application |
|-----------|-------------|
| **Student-centered** | Ask what the student must understand or be able to do afterwards |
| **One idea per section** | A section that teaches two things becomes two sections |
| **Show, don't tell** | Every section gets a visual that carries meaning, not decoration |
| **Cognitive load** | Fewer, bigger pieces; the grade level caps the count (see `levels/<level>.md`) |
| **Accuracy first** | A wrong picture sticks harder than a wrong sentence |

## 1. Content Type → Layout

| Type | Examples | Layout |
|------|----------|--------|
| Timeline / history | Roman Empire, a scientist's life | `linear-progression` |
| Process / steps | Solving an equation, a lab procedure | `linear-progression`, `winding-roadmap` |
| Comparison | Mitosis vs. meiosis; plant vs. animal cell | `binary-comparison`, `comparison-matrix` |
| Hierarchy / levels | Food pyramid, layers of the atmosphere | `hierarchical-layers` |
| Classification | Animal kingdoms, types of triangles | `tree-branching` |
| Relationships | Ecosystem, parts of speech | `hub-spoke`, `venn-diagram`, `jigsaw` |
| Cycle | Water cycle, rock cycle | `circular-flow` |
| Parts of a thing | Cell, flower, volcano, engine | `structural-breakdown` |
| Places / space | Regions, a map of a battle | `isometric-map` |
| Story / plot | A novel's arc | `story-mountain`, `comic-strip` |
| Cause and effect | Problem and solution | `bridge`, `iceberg` |
| Overview / review | A whole chapter, exam revision | `bento-grid`, `periodic-table` |

## 2. Learning Objectives

Write 1-3, from the student's perspective, with an observable verb (name, order, compare, explain, label).

Format: "After viewing this infographic, the student can..."

## 3. Audience

| Factor | Decide |
|--------|--------|
| **Level** | `early` (6-10), `middle` (11-14) or `high` (15-17); sets limits, vocabulary and style fit |
| **Use** | Classroom projection (landscape), phone or handout (portrait), exam revision (dense but ordered) |
| **Prior knowledge** | What the student already met in class; unfamiliar terms need a gloss |

## 4. Complexity

Count the main points, then compare with the level's section cap. Over the cap: split into two infographics, or ask the user which points to keep. Never shrink type to fit.

## 5. Visual Opportunities

| Content element | Visual treatment |
|-----------------|------------------|
| Numbers, dates | Large, highlighted numerals |
| Comparisons | Side by side, one color per item |
| Processes | Numbered steps with arrows |
| Hierarchies | Layers or pyramids, size = importance |
| Cycles | A closed loop with direction arrows |
| Parts | Labeled cut-away or exploded view |
| Terms | Colored keyword plus gloss callout |

## 6. Content Integrity

| Kind | Rule |
|------|------|
| Numbers, dates, names, units, formulas, quotes | Copy exactly: "73%" never "about 70%" |
| Technical terms | Keep the term; add a plain-words gloss on first use, do not replace it |
| Explanatory sentences | May be reworded to the grade level (shorter, concrete verbs) if the meaning is unchanged |
| Facts and examples | Add none that the source lacks |
| Suspected error in the source | Do not draw it and do not silently fix it; note it in `analysis.md` and tell the user |
| Personal data and secrets | Remove student names, grades, contact data, credentials and API keys |

**Topic-only input** (e.g. "ciclo da água, 6º ano"): write `source.md` from well-established curriculum facts, mark its first line `generated from topic: teacher must review`, and ask the user to confirm it before generating the prompt.

## Output Format

Save to `analysis.md`:

```yaml
---
title: "[Main topic]"
subject: "[science/history/geography/math/language/other]"
level: "[early/middle/high]"
data_type: "[timeline/process/comparison/cycle/...]"
point_count: [number]
source_language: "[pt-BR/en]"
output_language: "[pt-BR/en]"
---
```

Then these sections:

- `## Main Topic`: 1-2 sentences
- `## Learning Objectives`: "After viewing this infographic, the student can..." plus 1-3 items
- `## Key Data Points (Verbatim)`: every number, date, name, formula, quote
- `## Key Terms`: term plus plain-words gloss
- `## Possible Source Errors`: only if any
- `## Design Instructions`: the user's own style, color or layout wishes
- `## Recommended Combinations`: 3 layout x style pairs with a one-line reason each

## Checklist

- [ ] Read the whole source
- [ ] Topic summarized in 1-2 sentences
- [ ] 1-3 objectives with observable verbs
- [ ] Level chosen and point count within its cap
- [ ] Every data point extracted exactly
- [ ] Key terms listed with glosses
- [ ] Personal data and secrets removed
