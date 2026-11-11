# Notice

Derived from `baoyu-infographic` v1.56.1 by JimLiu (https://github.com/JimLiu/baoyu-skills), MIT licensed, via the Hermes Agent port. The upstream license and copyright notice are in `LICENSE-upstream`; keep that file with any redistribution.

## Changes from upstream

- Audience: school students, with three grade levels (`early`, `middle`, `high`) in `references/levels/`
- Languages: Brazilian Portuguese (`pt-BR`) and English (`en`) only; all CJK text removed, and the script rejects other languages
- Catalog trimmed to school use: dropped layouts `funnel`, `dashboard`, `dense-modules`; dropped styles `cyberpunk-neon`, `corporate-memphis`, `ui-wireframe`, `pop-laboratory`, `morandi-journal`, `retro-pop-grid`
- Content rule changed: figures, dates, names and quotes stay exact, but explanatory text is reworded to the grade level and technical terms are kept and glossed (upstream forbids all rewording)
- Output is the prompt; rendering with `image_generate` is optional
- `scripts/build_prompt.py` assembles the prompt instead of the agent pasting files by hand, and leaves out selection hints (best-for, pairings, style fit) so the image model is not handed other styles
- Only text inside double quotes is drawn on the image; everything else in the content block is direction
- Fixed upstream `Recommended Pairings` entries that named styles which do not exist
- Business framing in layout and style files replaced with school examples
