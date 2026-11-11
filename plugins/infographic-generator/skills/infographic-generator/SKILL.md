---
name: infographic-generator
description: "Infographic image prompts for school students (pt-BR, en)."
version: 1.0.0
author: Artur Oliveira, JimLiu (baoyu-skills)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [infographic, education, students, school, image-prompt, creative]
    category: creative
---

# Infographic Generator Skill

Turns a lesson, text or topic into a ready-to-use image prompt for an educational infographic aimed at school students. Two dimensions combine freely: **layout** (information structure) and **style** (visual look), tuned by the student's **grade level**. It writes the prompt; rendering the image is an optional last step. Text on the image is Brazilian Portuguese (`pt-BR`) or English (`en`) only.

Derived from JimLiu's `baoyu-infographic` (MIT); see `NOTICE.md`.

## When to Use

- A teacher or student asks for an infographic, visual summary, mind map, timeline or poster about a school topic ("infográfico", "resumo visual", "linha do tempo", "mapa mental", "cartaz")
- Input is a text, file path, URL or just a topic with a grade ("ciclo da água, 6º ano")

Do not use for business dashboards, marketing graphics or dense data reports.

## Prerequisites

- `python3` on `PATH` (standard library only) for `scripts/build_prompt.py`
- An image-generation tool, only if one is available and the user wants the image rendered here instead of pasting the prompt into another tool

## How to Run

Write the structured content (Procedure step 2) to a file, then assemble the prompt with Bash. Call the script by its absolute path (this skill's folder is where this `SKILL.md` lives) and run it from the user's working directory, so `infographic/` lands there and not inside the skill:

```
python3 /path/to/infographic-generator/scripts/build_prompt.py --layout circular-flow --style hand-drawn-edu --level middle --aspect landscape --language pt-BR --content infographic/ciclo-da-agua/structured-content.md --out infographic/ciclo-da-agua/prompts/infographic.md
```

Run it with `--help` for the valid values. The script inlines the base template and the level, layout and style definitions (without their selection hints), rejects any language other than `pt-BR` or `en`, and renames an existing output to `-backup-YYYYMMDD-HHMMSS`.

## Quick Reference

### Options

| Option | Values | Default |
|--------|--------|---------|
| Level | `early`, `middle`, `high` | `middle` |
| Layout | 18, see below | `bento-grid` |
| Style | 15, see below | `hand-drawn-edu` |
| Aspect | `landscape` (16:9), `portrait` (9:16), `square` (1:1), or any W:H | `landscape` |
| Language | `pt-BR`, `en` | the user's language, else `pt-BR` |

### Levels

| Level | Ages | Brazil / US | Limits |
|-------|------|-------------|--------|
| `early` | 6-10 | Fundamental anos iniciais / elementary | 3-4 sections, 1-5 word labels, no formulas |
| `middle` | 11-14 | Fundamental anos finais / middle school | 4-6 sections, glossed key terms |
| `high` | 15-17 | Ensino Médio / high school | 5-8 sections, formulas and data allowed |

Full definitions: `references/levels/<level>.md`

### Layouts

| Layout | Best For |
|--------|----------|
| `linear-progression` | Timelines, steps, procedures |
| `winding-roadmap` | Journeys, milestones |
| `binary-comparison` | A vs B, before-after, pros-cons |
| `comparison-matrix` | Several items on the same traits |
| `hierarchical-layers` | Pyramids, levels |
| `tree-branching` | Classification, categories |
| `hub-spoke` | One concept with its parts or subtopics |
| `structural-breakdown` | Parts of a cell, plant, machine |
| `bento-grid` | Chapter overview, revision (default) |
| `iceberg` | Visible vs hidden causes |
| `bridge` | Problem and solution |
| `isometric-map` | Places, regions, spatial relations |
| `periodic-table` | Categorized collections |
| `comic-strip` | Narrative sequences |
| `story-mountain` | Plot arc, rising tension |
| `jigsaw` | Interconnected parts |
| `venn-diagram` | Overlapping concepts |
| `circular-flow` | Cycles, repeating processes |

Full definitions: `references/layouts/<layout>.md`

### Styles

| Style | Description |
|-------|-------------|
| `hand-drawn-edu` | Macaron pastels, hand-drawn wobble, stick figures (default) |
| `craft-handmade` | Hand-drawn, paper craft |
| `claymation` | 3D clay figures, stop-motion |
| `kawaii` | Cute, pastels |
| `storybook-watercolor` | Soft painted, whimsical |
| `chalkboard` | Chalk on a classroom board |
| `bold-graphic` | Comic style, halftone |
| `aged-academia` | Vintage science, sepia |
| `technical-schematic` | Blueprint, engineering |
| `origami` | Folded paper, geometric |
| `pixel-art` | Retro 8-bit |
| `ikea-manual` | Minimal line-art steps |
| `knolling` | Organized flat-lay |
| `lego-brick` | Toy brick construction |
| `subway-map` | Transit diagram |

Full definitions: `references/styles/<style>.md`

### Subject Combinations

| Topic | Layout + Style |
|-------|----------------|
| History timeline | `linear-progression` + `aged-academia` (high) or `craft-handmade` |
| Water or rock cycle | `circular-flow` + `hand-drawn-edu` or `storybook-watercolor` |
| Parts of a cell or plant | `structural-breakdown` + `hand-drawn-edu` or `technical-schematic` (high) |
| Math or lab steps | `linear-progression` + `ikea-manual` |
| Mitosis vs. meiosis | `binary-comparison` + `bold-graphic` |
| Food chain or pyramid | `hierarchical-layers` + `claymation` or `hand-drawn-edu` |
| Animal classification | `tree-branching` + `craft-handmade` |
| Book plot | `story-mountain` + `storybook-watercolor` |
| Biomes, regions | `isometric-map` + `lego-brick` or `craft-handmade` |
| Chapter revision | `bento-grid` + `chalkboard` |
| Set overlap | `venn-diagram` + `craft-handmade` |

### Keyword Shortcuts

When the request contains one of these, take the layout and offer the styles first in Procedure step 3; skip content-based layout inference.

| Keyword (pt-BR / en) | Layout | Styles |
|----------------------|--------|--------|
| linha do tempo / timeline | `linear-progression` | `aged-academia`, `craft-handmade` |
| passo a passo / step by step | `linear-progression` | `ikea-manual`, `hand-drawn-edu` |
| ciclo / cycle | `circular-flow` | `hand-drawn-edu`, `storybook-watercolor` |
| mapa mental / mind map | `hub-spoke` | `hand-drawn-edu`, `craft-handmade` |
| comparar, versus / compare, vs | `binary-comparison` | `bold-graphic`, `hand-drawn-edu` |
| classificação / classification | `tree-branching` | `craft-handmade`, `aged-academia` |
| partes de, anatomia / parts of | `structural-breakdown` | `hand-drawn-edu`, `technical-schematic` |
| enredo, história contada / plot | `story-mountain` | `storybook-watercolor`, `bold-graphic` |
| resumo visual, revisão / visual summary | `bento-grid` | `chalkboard`, `hand-drawn-edu` |
| infográfico / infographic (alone) | `bento-grid` | `hand-drawn-edu`, `craft-handmade` |

## Procedure

Work in `infographic/{topic-slug}/`: slug of 2-4 ASCII words in kebab-case without accents (`ciclo-da-agua`); on conflict append `-YYYYMMDD-HHMMSS`. Before overwriting `source.md`, `analysis.md` or `structured-content.md`, rename the old file to `<name>-backup-YYYYMMDD-HHMMSS.md`.

1. **Analyze.** Read `references/analysis-framework.md`. Save the source with Write as `source.md` (topic-only input: follow the framework's topic-only rule and get the user's confirmation first). Save `analysis.md`: topic, learning objectives, level, key terms, verbatim data, design wishes.
2. **Structure.** Read `references/structured-content-template.md`. Save `structured-content.md`: the title and every on-image label in double quotes, accents included, and nothing else in quotes (the image model draws only quoted strings). No new facts; numbers, dates, names, formulas and quotes exact; explanatory text reworded to the level; terms kept and glossed.
3. **Recommend.** Check Keyword Shortcuts first; otherwise propose 3 layout x style pairs from the tables, filtered by the level's `Style Fit` in `references/levels/<level>.md`.
4. **Confirm.** One AskUserQuestion call, questions in the user's language: (Q1) which combination, (Q2) level, if not already stated, (Q3) aspect, with landscape for projection and portrait for phone or handout, (Q4) output language `pt-BR` or `en`, only if the source language differs from the user's.
5. **Build.** Run the script from How to Run. Show the final prompt in a fenced block so it can be pasted into any image tool.
6. **Render (optional).** Only if an image-generation tool is available; otherwise the user pastes the prompt into one. Offer it. If accepted, call the tool with the prompt: `16:9` is `landscape`, `9:16` is `portrait`, `1:1` is `square`, other ratios take the nearest. Retry once on failure. Save the result next to the prompt as `infographic.png`.
7. **Summarize.** Topic, level, layout, style, aspect, language, output path, files created.

## Pitfalls

1. **Portuguese accents.** Image models garble ã, õ, ç and friends in long text. Keep labels short, quote every one in `structured-content.md`, and check the render letter by letter; if accents are wrong, regenerate or move the long text out of the image into a caption.
2. **Data integrity.** "73%" stays "73%". Reword explanations, never figures, dates, names or formulas.
3. **Do not swap terms for simpler words.** Keep "fotossíntese" and gloss it; a student must meet the real term.
4. **Generated topic facts need a teacher.** Topic-only input is written from memory: flag it, ask for review, and never present it as sourced.
5. **Respect the level cap.** Too many points: split into two infographics or ask which to keep; never shrink the type.
6. **One idea per section.** Two ideas make two sections.
7. **Strip personal data** (student names, grades, contacts) and any credentials from every file.
8. **Style consistency.** Apply one style definition throughout; do not mix.
9. **Sensitive topics** (war, health, sexuality education) stay factual and non-graphic; no photorealistic people.

## Verification

- `prompts/infographic.md` exists and contains no `{{` placeholder
- Its language line says `Brazilian Portuguese (pt-BR)` or `English`; the content block quotes the title and every on-image label, and quotes nothing else
- Section count and label length respect the chosen level
- Numbers, dates, names and formulas match `source.md` exactly
- If rendered: all accents correct, text readable at phone size, nothing drawn that the content does not state
- Skill self-check, from the skill folder: `uv run --no-project --with pytest python -m pytest tests -q`
