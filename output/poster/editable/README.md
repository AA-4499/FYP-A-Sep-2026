# Editable FYP poster

- `FYP_Poster_Editable.pptx`: one editable poster slide, adapted directly from the supplied PPTX.
- `FYP_Poster_Preview.png`: normal preview.
- `FYP_Poster_Print_Preview.png`: larger 3366 x 4768 px preview.
- `assets/medical-background.png`: generated background embedded in the PPTX.
- Other `assets/*.png` files: current website captures using synthetic test records.

The original `C:/Users/USER/Downloads/FYP_Poster.pptx` is preserved. Its physical canvas is 1683 x 2384 pt, approximately 594 x 841 mm (A1 portrait), despite the template's placeholder text calling it A0. The supplied dimensions and native university marks are preserved. The blank second slide is removed.

Text, headings and workflow elements are native editable PowerPoint objects. Background and screenshots are embedded pictures. Editing the PPTX does not require the separate assets folder. Source notes and functional limitations are recorded in the slide's speaker notes. Poster files are excluded from the TrainingModel code push.

Authoring used installed Microsoft PowerPoint automation because the Artifact Tool runtime and `load_workspace_dependencies` tool were unavailable in this session. The result was rendered and reopened in PowerPoint, and checked with the presentation skill's package-integrity and layout-geometry validators. Arial is the design font. The supplied logo artwork retains its original objects.

## Background generation

Generated with the built-in ImageGen tool, not the CLI/API fallback. Original generation: `C:/Users/USER/.codex/generated_images/01a19ae6-9a55-7022-a0fd-56d55d4290fb/exec-639cb263-5fec-4085-b9b6-0668232ed644.png`.

Prompt:

> Use case: productivity-visual. Asset type: text-free background image for a portrait university research poster about a Smart Diabetes Digital Twin and Personalised Health Management web platform. Create a polished, beautiful, restrained scientific editorial background, portrait aspect ratio approximately 1:1.416 (A-series paper). Extremely pale ivory-white and cool mint field, luminous soft teal aurora-like gradients flowing gently along the outer right and bottom margins. A delicate abstract digital human torso silhouette made from fine translucent teal mesh and connected nodes in the UPPER RIGHT CORNER ONLY (top 22% of the canvas, right 30%); abstract glucose sensing and organic flowing network motifs rather than detailed medical anatomy. Tiny restrained lavender highlights echoing patient workspace purple, deep teal traces near edges. Central 85% of the full page and the left upper title area must remain almost pure white, calm and clear for black readable editable poster text and real website screenshots to be placed later in PowerPoint. Rich subtle depth, soft ambient light, elegant premium healthcare technology aesthetic, no harsh contrast, no clutter, no panels, no UI, no charts, no logos, absolutely no text, letters, numbers or watermark. This is only the background asset, NOT the finished poster.

A translucent white PowerPoint shape softens the background below the title for readable text. The background image itself was not modified.
