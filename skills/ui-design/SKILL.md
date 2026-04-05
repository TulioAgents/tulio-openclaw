---
name: design-taste-frontend
description: Senior UI/UX Engineer. Architect digital interfaces overriding default LLM biases. Enforces metric-based rules, strict component architecture, CSS hardware acceleration, and balanced design engineering. Invoke with /design-ui.
source: https://github.com/Leonxlnx/taste-skill
---

# High-Agency Frontend Skill

## 1. ACTIVE BASELINE CONFIGURATION

- DESIGN_VARIANCE: 8 (1=Perfect Symmetry, 10=Artsy Chaos)
- MOTION_INTENSITY: 6 (1=Static/No movement, 10=Cinematic/Magic Physics)
- VISUAL_DENSITY: 4 (1=Art Gallery/Airy, 10=Pilot Cockpit/Packed Data)

**AI Instruction:** The standard baseline for all generations is strictly set to these values (8, 6, 4). Do not ask the user to edit this file. Otherwise, ALWAYS listen to the user: adapt these values dynamically based on what they explicitly request in their chat prompts. Use these baseline (or user-overridden) values as your global variables to drive the specific logic in Sections 3 through 7.

## 2. DEFAULT ARCHITECTURE & CONVENTIONS

Unless the user explicitly specifies a different stack, adhere to these structural constraints to maintain consistency:

- **DEPENDENCY VERIFICATION [MANDATORY]:** Before importing ANY 3rd party library (e.g. `framer-motion`, `lucide-react`, `zustand`), you MUST check `package.json`. If the package is missing, you MUST output the installation command (e.g. `npm install package-name`) before providing the code. **Never** assume a library exists.
- **Framework & Interactivity:** React or Next.js. Default to Server Components (`RSC`).
  - **RSC SAFETY:** Global state works ONLY in Client Components. In Next.js, wrap providers in a `"use client"` component.
  - **INTERACTIVITY ISOLATION:** If Sections 4 or 7 (Motion/Liquid Glass) are active, the specific interactive UI component MUST be extracted as an isolated leaf component with `'use client'` at the very top. Server Components must exclusively render static layouts.
- **State Management:** Use local `useState`/`useReducer` for isolated UI. Use global state strictly for deep prop-drilling avoidance.
- **Styling Policy:** Use Tailwind CSS (v3/v4) for 90% of styling.
  - **TAILWIND VERSION LOCK:** Check `package.json` first. Do not use v4 syntax in v3 projects.
  - **T4 CONFIG GUARD:** For v4, do NOT use `tailwindcss` plugin in `postcss.config.js`. Use `@tailwindcss/postcss` or the Vite plugin.
- **ANTI-EMOJI POLICY [CRITICAL]:** NEVER use emojis in code, markup, text content, or alt text. Replace symbols with high-quality icons (Radix, Phosphor) or clean SVG primitives. Emojis are BANNED.
- **Responsiveness & Spacing:**
  - Standardize breakpoints (`sm`, `md`, `lg`, `xl`).
  - Contain page layouts using `max-w-[1400px] mx-auto` or `max-w-7xl`.
  - **Viewport Stability [CRITICAL]:** NEVER use `h-screen` for full-height Hero sections. ALWAYS use `min-h-[100dvh]` to prevent catastrophic layout jumping on mobile browsers (iOS Safari).
  - **Grid over Flex-Math:** NEVER use complex flexbox percentage math (`w-[calc(33%-1rem)]`). ALWAYS use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`) for reliable structures.
- **Icons:** You MUST use exactly `@phosphor-icons/react` or `@radix-ui/react-icons` as the import paths (check installed version). Standardize `strokeWidth` globally (e.g., exclusively use `1.5` or `2.0`).

## 3. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

LLMs have statistical biases toward specific UI cliche patterns. Proactively construct premium interfaces using these engineered rules:

**Rule 1: Deterministic Typography**

- **Display/Headlines:** Default to `text-4xl md:text-6xl tracking-tighter leading-none`.
  - **ANTI-SLOP:** Discourage `Inter` for "Premium" or "Creative" vibes. Force unique character using `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
  - **TECHNICAL UI RULE:** Serif fonts are strictly BANNED for Dashboard/Software UIs. For these contexts, use exclusively high-end Sans-Serif pairings (`Geist` + `Geist Mono` or `Satoshi` + `JetBrains Mono`).
- **Body/Paragraphs:** Default to `text-base text-gray-600 leading-relaxed max-w-[65ch]`.

**Rule 2: Color Calibration**

- **Constraint:** Max 1 Accent Color. Saturation < 80%.
- **THE LILA BAN:** The "AI Purple/Blue" aesthetic is strictly BANNED. No purple button glows, no neon gradients. Use absolute neutral bases (Zinc/Slate) with high-contrast, singular accents (e.g. Emerald, Electric Blue, or Deep Rose).
- **COLOR CONSISTENCY:** Stick to one palette for the entire output. Do not fluctuate between warm and cool grays within the same project.

**Rule 3: Layout Diversification**

- **ANTI-CENTER BIAS:** Centered Hero/H1 sections are strictly BANNED when `LAYOUT_VARIANCE > 4`. Force "Split Screen" (50/50), "Left Aligned content/Right Aligned asset", or "Asymmetric White-space" structures.

**Rule 4: Materiality, Shadows, and "Anti-Card Overuse"**

- **DASHBOARD HARDENING:** For `VISUAL_DENSITY > 7`, generic card containers are strictly BANNED. Use logic-grouping via `border-t`, `divide-y`, or purely negative space. Data metrics should breathe without being boxed in unless elevation (z-index) is functionally required.
- **Execution:** Use cards ONLY when elevation communicates hierarchy. When a shadow is used, tint it to the background hue.

**Rule 5: Interactive UI States**

- **Mandatory Generation:** LLMs naturally generate "static" successful states. You MUST implement full interaction cycles:
  - **Loading:** Skeletal loaders matching layout sizes (avoid generic circular spinners).
  - **Empty States:** Beautifully composed empty states indicating how to populate data.
  - **Error States:** Clear, inline error reporting (e.g., forms).
  - **Tactile Feedback:** On `:active`, use `-translate-y-[1px]` or `scale-[0.98]` to simulate a physical push indicating success/action.

**Rule 6: Data & Form Patterns**

- **Forms:** Label MUST sit above input. Helper text is optional but should exist in markup. Error text below input. Use a standard `gap-2` for input blocks.

## 4. CREATIVE PROACTIVITY (Anti-Slop Implementation)

To actively combat generic AI designs, systematically implement these high-end coding concepts as your baseline:

- **"Liquid Glass" Refraction:** When glassmorphism is needed, go beyond `backdrop-blur`. Add a 1px inner border (`border-white/10`) and a subtle inner shadow (`shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`) to simulate physical edge refraction.
- **Magnetic Micro-physics (If MOTION_INTENSITY > 5):** Implement buttons that pull slightly toward the mouse cursor. **CRITICAL:** NEVER use React `useState` for magnetic hover or continuous animations. Use EXCLUSIVELY Framer Motion's `useMotionValue` and `useTransform` outside the React render cycle to prevent performance collapse on mobile.
- **Perpetual Micro-Interactions:** When `MOTION_INTENSITY > 5`, embed continuous, infinite micro-animations (Pulse, Typewriter, Float, Shimmer, Carousel) in standard components (avatars, status dots, backgrounds). Apply premium Spring Physics (`type: "spring", stiffness: 100, damping: 20`) to all interactive elements--no linear easing.
- **Layout Transitions:** Always utilize Framer Motion's `layout` and `layoutId` props for smooth re-ordering, resizing, and shared element transitions across state changes.
- **Staggered Orchestration:** Do not mount lists or grids instantly. Use `staggerChildren` (Framer) or CSS cascade (`animation-delay: calc(var(--index) * 100ms)`) to create sequential waterfall reveals. **CRITICAL:** For `staggerChildren`, the Parent (`variants`) and Children MUST reside in the identical Client Component tree.

## 5. PERFORMANCE GUARDRAILS

- **DOM Cost:** Apply grain/noise filters exclusively to fixed, pointer-event-none pseudo-elements and NEVER to scrolling containers.
- **Hardware Acceleration:** Never animate `top`, `left`, `width`, or `height`. Animate exclusively via `transform` and `opacity`.
- **Z-Index Restraint:** NEVER spam arbitrary `z-50` or `z-10` unprompted. Use z-indexes strictly for systemic layer contexts (Sticky Navbars, Modals, Overlays).

## 6. TECHNICAL REFERENCE (Dial Definitions)

### DESIGN_VARIANCE (Level 1-10)

- **1-3 (Predictable):** Flexbox `justify-center`, strict 12-column symmetrical grids, equal paddings.
- **4-7 (Offset):** Use `margin-top: -2rem` overlapping, varied image aspect ratios, left-aligned headers.
- **8-10 (Asymmetric):** Masonry layouts, CSS Grid with fractional units, massive empty zones (`padding-left: 20vw`).
- **MOBILE OVERRIDE:** For levels 4-10, any asymmetric layout above `md:` MUST fall back to single-column on viewports `< 768px`.

### MOTION_INTENSITY (Level 1-10)

- **1-3 (Static):** No automatic animations. CSS `:hover` and `:active` states only.
- **4-7 (Fluid CSS):** `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`. Focus on `transform` and `opacity`.
- **8-10 (Advanced Choreography):** Scroll-triggered reveals, Framer Motion hooks. NEVER use `window.addEventListener('scroll')`.

### VISUAL_DENSITY (Level 1-10)

- **1-3 (Art Gallery Mode):** Lots of white space, huge section gaps, expensive and clean.
- **4-7 (Daily App Mode):** Normal spacing for standard web apps.
- **8-10 (Cockpit Mode):** Tiny paddings. No card boxes; just 1px lines. Use `font-mono` for all numbers.

## 7. AI TELLS (Forbidden Patterns)

### Visual & CSS

- NO Neon/Outer Glows, NO Pure Black (`#000000`), NO Oversaturated Accents, NO Excessive Gradient Text, NO Custom Mouse Cursors.

### Typography

- NO Inter Font -- use `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
- NO Oversized H1s. Serif fonts ONLY for creative/editorial -- NEVER on dashboards.

### Layout & Spacing

- NO 3-Column Card Layouts. Use 2-column Zig-Zag, asymmetric grid, or horizontal scroll instead.

### Content & Data

- NO Generic Names ("John Doe"), NO Generic Avatars (SVG egg icons), NO Fake Round Numbers (`99.99%` -- use `47.2%`).
- NO Startup Slop Names ("Acme", "Nexus"), NO Filler Words ("Elevate", "Seamless", "Unleash").
- NO Broken Unsplash Links -- use `https://picsum.photos/seed/{random_string}/800/600`.

## 8. THE CREATIVE ARSENAL (High-End Concepts)

### Layout & Grids

Bento Grid, Masonry Layout, Chroma Grid, Split Screen Scroll, Curtain Reveal.

### Cards & Containers

Parallax Tilt Card, Spotlight Border Card, Glassmorphism Panel, Holographic Foil Card, Morphing Modal.

### Scroll-Animations

Sticky Scroll Stack, Horizontal Scroll Hijack, Zoom Parallax, Scroll Progress Path, Liquid Swipe Transition.

### Galleries & Media

Coverflow Carousel, Drag-to-Pan Grid, Accordion Image Slider, Hover Image Trail, Glitch Effect Image.

### Typography & Text

Kinetic Marquee, Text Mask Reveal, Text Scramble Effect, Circular Text Path, Gradient Stroke Animation.

### Micro-Interactions

Particle Explosion Button, Skeleton Shimmer, Directional Hover Aware Button, Ripple Click Effect, Mesh Gradient Background.

## 9. THE "MOTION-ENGINE" BENTO PARADIGM

For SaaS dashboards, use this architecture:

- **Palette:** Background `#f9fafb`, cards pure white `#ffffff`, `border-slate-200/50`, `rounded-[2.5rem]`.
- **Typography:** `Geist`, `Satoshi`, or `Cabinet Grotesk`. Labels outside and below cards.
- **Spring Physics:** `type: "spring", stiffness: 100, damping: 20`. No linear easing.
- **Perpetual Motion:** Every card must loop infinitely (Pulse, Typewriter, Float, or Carousel). Isolate in microscopic Client Components.

**5 Card Archetypes:**

1. **Intelligent List** -- Auto-sorting loop using `layoutId`, simulating AI prioritization.
2. **Command Input** -- Multi-step Typewriter cycling complex prompts + processing state.
3. **Live Status** -- "Breathing" indicators with overshoot spring pop-up badge.
4. **Wide Data Stream** -- Seamless infinite carousel (`x: ["0%", "-100%"]`).
5. **Contextual UI** -- Staggered text highlight + float-in floating action toolbar.

## 10. FINAL PRE-FLIGHT CHECK

- [ ] Global state used appropriately (no arbitrary prop-drilling)?
- [ ] Mobile layout collapse guaranteed for high-variance designs?
- [ ] Full-height sections use `min-h-[100dvh]` not `h-screen`?
- [ ] `useEffect` animations have strict cleanup functions?
- [ ] Empty, loading, and error states provided?
- [ ] Cards omitted in favor of spacing where possible?
- [ ] CPU-heavy perpetual animations isolated in their own Client Components?
