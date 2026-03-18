---
name: Frontend Design
trigger: build, design, or style anything visual — web pages, components, dashboards, HTML/CSS/JS, React, UI/UX
description: Create distinctive, production-grade frontend interfaces with extraordinary design quality. Use when building web components, pages, applications, dashboards, posters, or any visual UI. Generates creative, polished, memorable code that refuses generic AI aesthetics.
---

This skill guides creation of distinctive, production-grade frontend interfaces that refuse "AI slop" defaults. Every output should feel intentionally designed for its specific context — not assembled from a template.

## Phase 1: Strategic Design Thinking

Before writing a single line of code, commit to a clear aesthetic and conceptual direction:

**Understand the context:**
- What problem does this solve? Who uses it? In what environment?
- What emotional response should it create? (Trust? Delight? Focus? Urgency?)
- What are the technical constraints? (Framework, browser support, performance, accessibility)

**Choose a bold aesthetic direction — pick ONE and commit fully:**
- Brutalist/raw: exposed structure, bold type, intentional ugliness as strength
- Luxury/refined: restraint, negative space, exquisite micro-detail
- Retro-futuristic: analog warmth meets digital precision
- Editorial/magazine: strong typographic hierarchy, content-first layout
- Industrial/utilitarian: function as form, dense information, monochrome
- Organic/natural: flowing forms, earthy palette, textural warmth
- Maximalist/expressive: controlled chaos, layered richness, visual feast
- Minimal/geometric: pure form, mathematical precision, the beauty of less

**The unforgettable question:** What is the ONE THING a user will remember after seeing this?

## Phase 2: Typography System

Typography carries more visual weight than any other element. Make deliberate choices:

**Never use:** Inter, Roboto, Arial, Helvetica, system-ui, or any font that says "I didn't decide"

**Excellent distinctive choices:**
- Display: Playfair Display, Cormorant Garamond, Clash Display, Cabinet Grotesk, Bebas Neue, Syne, Fraunces
- Body: Lora, DM Serif Display, Libre Baskerville, Source Serif Pro, Spectral
- Mono/Technical: JetBrains Mono, Fira Code, Space Mono
- Experimental: DM Mono paired with a serif display, or a grotesque body with a display serif headline

**Scale and hierarchy:** Use dramatic size contrast (12px body → 96px+ headline creates tension). Don't equalize everything.

**Letter-spacing and weight:** Use tight tracking on large headlines, generous tracking on small caps/labels.

## Phase 3: Color Architecture

**Build a system, not a palette:**
```css
:root {
  --color-bg: #0d0d0d;           /* Background base */
  --color-surface: #1a1a1a;      /* Elevated surfaces */
  --color-border: #2a2a2a;       /* Structural lines */
  --color-text-primary: #f5f0e8; /* Main text */
  --color-text-secondary: #8a8a8a; /* Supporting text */
  --color-accent: #e8c547;       /* The one bold choice */
  --color-accent-warm: #d4845a;  /* Secondary accent */
}
```

**Color principles:**
- One dominant neutral field + one sharp accent = more powerful than five balanced colors
- Dark backgrounds with warm accent tones feel premium
- Light backgrounds with one bold accent feel editorial
- Avoid: blue+white (corporate), purple gradients (generic AI), teal+orange (startup cliché)
- Try: warm off-white (#f5f0e8), charcoal (#1c1c1e), deep forest (#1a2e1a), warm black (#0d0b08)

## Phase 4: Spatial Composition

**Break the grid to find it:**
- Full-bleed elements that escape their containers
- Overlapping layers with z-index intentionality
- Asymmetric layouts with strong visual anchors
- Generous whitespace as a design element, not just the absence of content
- Type that runs outside expected boundaries

**CSS Grid mastery for unusual layouts:**
```css
.layout {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  grid-template-rows: auto;
  gap: clamp(1rem, 3vw, 3rem);
}
/* Break out of grid selectively */
.full-bleed {
  grid-column: 1 / -1;
  margin-inline: calc(50% - 50vw);
  width: 100vw;
}
```

## Phase 5: Motion & Micro-Interactions

**Hierarchy of motion impact (high → low):**
1. Page load orchestration — staggered reveals with `animation-delay`
2. Scroll-triggered reveals — elements arriving as the user explores
3. Hover state transformations — surfaces that respond to presence
4. Interactive feedback — buttons, inputs, cards that feel alive
5. Background ambient motion — subtle breathing, drift, or particle systems

**CSS animation patterns:**
```css
/* Orchestrated page load */
.hero-title { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
.hero-sub   { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
.hero-cta   { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Magnetic hover on cards */
.card {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
```

## Phase 6: Depth, Texture & Atmosphere

**Background techniques beyond solid colors:**
```css
/* Gradient mesh */
background: radial-gradient(ellipse at 20% 50%, #1a3a2a 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, #2a1a3a 0%, transparent 60%),
            #0d0d0d;

/* Grain overlay */
.grain::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,...");
  opacity: 0.04;
  pointer-events: none;
}

/* Geometric pattern */
background-image: repeating-linear-gradient(
  45deg, transparent, transparent 10px,
  rgba(255,255,255,.03) 10px, rgba(255,255,255,.03) 11px
);
```

**Shadow system:**
```css
/* Layered shadows for depth */
--shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
--shadow-md: 0 4px 16px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.08);
--shadow-lg: 0 20px 60px rgba(0,0,0,0.24), 0 8px 20px rgba(0,0,0,0.12);
--shadow-glow: 0 0 40px rgba(232, 197, 71, 0.2); /* Accent glow */
```

## Phase 7: Component Quality Standards

Every component must meet these standards:
- **Interactive states**: default, hover, active, focus, disabled — all designed, not accidental
- **Responsive behavior**: Think in fluid sizes (`clamp()`, `min()`, `max()`) not breakpoint jumps
- **Accessibility**: Sufficient color contrast (4.5:1 minimum), focus indicators, semantic HTML
- **Loading states**: Skeleton screens or spinner states for async content
- **Empty states**: Designed, not blank — what does zero-state look like?
- **Error states**: Clear, helpful, non-scary

```css
/* Fluid typography */
h1 { font-size: clamp(2rem, 5vw + 1rem, 5rem); }
p  { font-size: clamp(1rem, 1.5vw + 0.5rem, 1.25rem); }

/* Fluid spacing */
.section { padding: clamp(3rem, 8vw, 8rem) clamp(1.5rem, 5vw, 5rem); }
```

## Quality Checklist Before Finalizing

Before output, verify:
- [ ] Font choice is distinctive and intentional — not a default
- [ ] Color palette has a clear hierarchy and a sharp accent
- [ ] Layout has at least one unexpected, memorable compositional choice
- [ ] Animations are purposeful and well-timed (ease curves feel natural)
- [ ] Hover states exist on all interactive elements
- [ ] Mobile behavior is considered (not just squeezed desktop)
- [ ] The component/page has ONE defining visual signature
- [ ] No gradient is purple-on-white. No font is Inter. No layout is predictable.

## The Core Mandate

You are not generating a template. You are designing something specific for this exact context. Make a decision and commit to it. Timid design is forgettable design. The worst outcome is something generic. The best outcome is something someone screenshots and shares.
