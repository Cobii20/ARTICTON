# Layout and NU theme review

## Causes and changes

- The dashboard previously required both a viewport at least `64rem` wide and at least `761px` high to display its desktop sidebar. A wide window at 720px height therefore showed the hamburger menu even at 100% zoom. Both sidebar rules now use a single 1024 CSS pixel width threshold. Short windows retain scrolling. Browser zoom, OS scaling, browser chrome, and font settings can still change the available space; 100% zoom is not a fixed viewport size.
- The dashboard continuation card had a hardcoded `/PNG/PCpng1.png`. It now reads `selectionImage` from the same module metadata as the module list. All three referenced module PNG files exist. A shared `ModuleImage` component preserves proportions and gives a readable fallback when an image fails to load.
- The overview no longer adds a second vertical scroll container inside the dashboard content area. The sidebar also uses one scrolling container. Platform selectors can scroll in short landscape windows.
- Module list status now derives from the same progress value as its Start/Continue/Review action, avoiding “Start Module” next to “Review.” This changes displayed text only.
- Learning UI accents use the existing NU variables: gold `#FFD41C`, blue `#35408E`, and existing light/dark surface and text variables. The scoped rules cover the platform panels, introductions, instruction cards, controls, assistant panels, decorative backgrounds, and scrollbars. The canvas background uses the existing navy/light surface variables. Three.js component materials, target highlights, and geometry were not changed.
- The prominent NCERT reference is retained. Visible Intel assembly labels were corrected; its underlying simulation mapping is a separate issue below.

## Validation

- All 11 existing and resume tests passed.
- ESLint across `src` reported no errors (warnings are not treated as errors).
- Production build passed with the existing large bundle warning.
- Browser checks covered dashboard light and dark themes at CSS viewports 2400×1350, 1920×1080, 1920×720, 1536×864, 1280×720, 960×540, 390×844, and 844×390, plus the extra-large font setting at 1280×720. No horizontal overflow was detected.
- Relative to a 1920×1080 content viewport, those sizes include the effective layout space for 80%, 100%, 125%, 150%, and 200% zoom. These were viewport emulations, not OS display-scaling changes or browser-toolbar zoom automation.
- Both platform selectors and all four guided module variants were rendered in light and dark themes. Introduction and step-card transitions were exercised. Additional checks covered narrow introduction scrolling and short landscape selectors.
- The landing page was checked in portrait and landscape. All 42 JSX files were scanned for literal image/model references, and source lint covered all JSX files. Signed-in admin/faculty workflows, full practice completion, and cross-account navigation were not exercised in the isolated visual preview.
- Practical-exam components and their theme selectors were not edited. Dashboard sidebar behavior changes apply to the dashboard shell shared by its sections.

## Existing functional issues outside this change

1. `src/PAGES/Modules/Module3/Module3AssemblyINTEL.jsx` still loads AMD models, uses the AMD procedure-guide mapping, and saves completion under `module3AMD`. Its legacy reset keys and some internal names are also AMD-specific. Correcting visible labels does not fix that simulation/data mismatch. It needs a separate change with verified Intel geometry, stage behavior, and completion migration.
2. Fourteen legacy files under `module2-scenes` and `module3-scenes` reference missing `*(BLENDER).glb` assets, including CPU, motherboard, RAM, SSD, HDD, PSU, and case. The active platform-specific guided pages use a different model set. No model substitutions were made because their coordinates and interactions require validation.
3. Global `#root` spacing overrides still affect many pages at width/height breakpoints. Removing them wholesale would change practice-exam styling and unrelated screens. This review addresses the dashboard's conflicting sidebar condition and concrete layout issues without replacing that global styling system.
4. Resume history remains account-scoped browser storage. The overall course completion display and the current practice-session progress can legitimately differ; this change does not alter either tracking system.

Verification screenshots and scripts are retained locally under `.tmp/nu-review/`, which is git-ignored.
