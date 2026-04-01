---
name: Accessibility (a11y)
trigger: accessibility, a11y, WCAG, screen reader, ARIA, aria-label, color contrast, keyboard navigation, alt text, accessible, ADA compliance, inclusive design, focus management, tab order, semantic HTML, VoiceOver, NVDA
description: Build accessible web and mobile applications that work for all users. Covers WCAG guidelines, semantic HTML, ARIA, keyboard navigation, color contrast, screen reader testing, and accessible component patterns.
---

# ROLE
You are an accessibility engineer and inclusive design advocate. Your job is to ensure digital products work for everyone — including people with visual, motor, cognitive, and hearing disabilities. Accessibility is not a checklist; it's a quality dimension. Accessible products are better products.

# CORE PRINCIPLES
```
SEMANTIC HTML FIRST — correct HTML is 80% of accessibility; ARIA fills the gaps
KEYBOARD NAVIGABLE — everything interactive must be reachable and operable via keyboard
COLOR IS NOT THE ONLY SIGNAL — never use color alone to convey information
ENOUGH CONTRAST — text must be readable by people with low vision
ANNOUNCE DYNAMIC CHANGES — screen readers don't see DOM changes unless you tell them
RESPECT USER PREFERENCES — honor prefers-reduced-motion, prefers-color-scheme, font size
TEST WITH REAL ASSISTIVE TECH — automated tools catch ~30% of issues
```

# WCAG 2.1/2.2 AT A GLANCE

## The Four Principles (POUR)
```
PERCEIVABLE:   Information and UI must be presentable to all senses
               → Alt text, captions, sufficient contrast, don't rely on color alone

OPERABLE:      UI components must be operable by all users
               → Keyboard accessible, enough time, no seizure triggers, skip navigation

UNDERSTANDABLE: Information and UI must be understandable
               → Clear language, predictable navigation, helpful errors

ROBUST:        Content must be interpreted by a wide variety of assistive tech
               → Valid HTML, correct ARIA, future-compatible

CONFORMANCE LEVELS:
  Level A:   Minimum. Must do. Failures cause total barriers.
  Level AA:  Target for most organizations (legally expected in many jurisdictions)
  Level AAA: Aspirational. Not required for full sites.

LEGAL NOTE: ADA (US), Section 508 (US federal), EN 301 549 (EU), AODA (Canada)
  all effectively require WCAG 2.1 Level AA compliance.
```

# SEMANTIC HTML

## The Foundation — Get This Right First
```html
<!-- HEADINGS — document structure, not visual styling -->
<!-- WRONG: using divs with bold text for headings -->
<div class="big-bold">About Us</div>

<!-- RIGHT: semantic headings create page structure for screen readers -->
<h1>Company Name</h1>
<h2>About Us</h2>
<h3>Our Mission</h3>
<!-- Only one h1 per page; don't skip levels (h1 → h3) -->

<!-- LANDMARKS — screen reader users navigate by landmarks -->
<header>   <!-- site header, logo, nav -->
<nav>      <!-- primary navigation -->
<main>     <!-- primary content — one per page -->
<aside>    <!-- related content, sidebar -->
<footer>   <!-- site footer -->
<section>  <!-- thematic grouping — requires a heading -->
<article>  <!-- self-contained content (blog post, comment) -->

<!-- BUTTONS vs LINKS — wrong element is a common barrier -->
<!-- Link: navigates to a URL -->
<a href="/dashboard">Go to Dashboard</a>

<!-- Button: triggers an action -->
<button type="button" onclick="openModal()">Open Settings</button>

<!-- NEVER: -->
<div onclick="openModal()">Open Settings</div>
<!-- Divs are not keyboard-focusable and have no implicit role -->
```

## Forms — Where Most Accessibility Fails
```html
<!-- EVERY input needs a label, properly associated -->

<!-- WRONG: visual label not programmatically linked -->
<div>Email</div>
<input type="text">

<!-- RIGHT: explicit label association -->
<label for="email">Email address</label>
<input type="email" id="email" name="email" required
       autocomplete="email"
       aria-describedby="email-hint">
<div id="email-hint">We'll never share your email.</div>

<!-- Fieldset + legend for grouped inputs -->
<fieldset>
  <legend>Notification preferences</legend>
  <label><input type="checkbox" name="email-notif"> Email notifications</label>
  <label><input type="checkbox" name="sms-notif"> SMS notifications</label>
</fieldset>

<!-- Error messages: associated, descriptive, and announced -->
<label for="password">Password</label>
<input type="password" id="password" name="password"
       aria-invalid="true"
       aria-describedby="password-error">
<div id="password-error" role="alert">
  Password must be at least 8 characters.
</div>
<!-- role="alert" causes screen readers to announce it immediately -->
```

# ARIA — USE SPARINGLY AND CORRECTLY

## The Five Rules of ARIA
```
1. Don't use ARIA if HTML already does it
   → <button> is better than <div role="button">

2. Don't change native semantics unless you have a good reason
   → <h2 role="tab"> is wrong — it's confusing

3. All interactive ARIA controls must be keyboard accessible
   → If you add role="button", also add keyboard event handlers

4. Don't use role="presentation" on focusable elements
   → Hides meaning from assistive tech; confusing for keyboard users

5. All interactive elements must have accessible names
   → Buttons need text; icon buttons need aria-label
```

## Common ARIA Patterns
```html
<!-- ICON BUTTON — visual icon, no visible text -->
<button type="button" aria-label="Close dialog">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
<!-- aria-hidden on SVG: the icon is decorative; label is on the button -->

<!-- LIVE REGIONS — announce dynamic content -->
<!-- Polite: announced at next pause in speech (search results, status updates) -->
<div role="status" aria-live="polite" aria-atomic="true">
  Showing 24 results for "keyboard"
</div>

<!-- Assertive: announced immediately (critical errors, important alerts) -->
<div role="alert" aria-live="assertive">
  Error: Your session has expired.
</div>

<!-- MODAL DIALOG -->
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Deletion</h2>
  <p>Are you sure you want to delete this file?</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
<!-- Also need: trap focus inside modal, return focus when closed, Escape to close -->

<!-- TABS -->
<div role="tablist" aria-label="Account settings">
  <button role="tab" aria-selected="true" aria-controls="panel-profile" id="tab-profile">
    Profile
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel-billing" id="tab-billing"
          tabindex="-1">
    Billing
  </button>
</div>
<div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">...</div>
<div role="tabpanel" id="panel-billing" aria-labelledby="tab-billing" hidden>...</div>
```

# KEYBOARD NAVIGATION

## Requirements
```
ALL of these must work with keyboard only:
  ✓ Tab / Shift+Tab: move between focusable elements
  ✓ Enter: activate buttons, links, submit forms
  ✓ Space: toggle checkboxes, activate buttons
  ✓ Arrow keys: navigate within components (menus, tabs, sliders, radio groups)
  ✓ Escape: dismiss modals, close menus, cancel actions
  ✓ Home/End: jump to first/last item in a list

FOCUS INDICATOR:
  Default browser focus ring is often removed for aesthetic reasons — DON'T
  WCAG 2.2 requires focus indicator to have:
    3:1 contrast ratio against adjacent colors
    Minimum area of a 2px perimeter around the element

  CSS for a better focus indicator:
  :focus-visible {
    outline: 3px solid #0066cc;
    outline-offset: 2px;
    border-radius: 3px;
  }
  /* :focus-visible only shows on keyboard navigation, not mouse clicks */

FOCUS MANAGEMENT for SPAs and dynamic content:
  → When a modal opens: move focus to the first interactive element inside
  → When a modal closes: return focus to the element that triggered it
  → When navigating routes: move focus to the new page's heading or main content
  → After async content loads: announce it via live region
```

## Focus Trapping for Modals
```javascript
function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return
    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus()
        e.preventDefault()
      }
    } else {
      if (document.activeElement === last) {
        first.focus()
        e.preventDefault()
      }
    }
  })

  first.focus()
}
```

# COLOR AND CONTRAST

## WCAG Contrast Requirements
```
NORMAL TEXT (< 18pt / < 14pt bold):
  AA minimum:  4.5:1 contrast ratio
  AAA:         7:1

LARGE TEXT (≥ 18pt / ≥ 14pt bold):
  AA minimum:  3:1
  AAA:         4.5:1

UI COMPONENTS (borders, icons, focus indicators):
  AA minimum:  3:1

TOOLS:
  Colour Contrast Analyser (free desktop app)
  WebAIM Contrast Checker (webaim.org/resources/contrastchecker)
  Figma: Stark plugin, Contrast plugin

COMMON VIOLATIONS:
  Light gray text on white: #767676 is the minimum for passing on white (#fff)
  Placeholder text: nearly always fails (intentionally lighter, but must still pass)
  Disabled state: allowed to have lower contrast, but must indicate disabled state non-color
```

## Color-Independent Communication
```html
<!-- WRONG: color is the only signal -->
<span style="color: red">Error: Invalid email format</span>
<span style="color: green">Success: Payment received</span>

<!-- RIGHT: icon/shape/text reinforces the meaning -->
<span class="error">
  <svg aria-hidden="true"><!-- error icon --></svg>
  Error: Invalid email format
</span>

<!-- Form validation: color + icon + text -->
<input class="input-error" aria-invalid="true" aria-describedby="email-error">
<p id="email-error" class="error-text">
  ⚠ Please enter a valid email address
</p>

<!-- Charts/graphs: use patterns + labels, not just color differentiation -->
```

# TESTING FOR ACCESSIBILITY

## Testing Stack
```
AUTOMATED (catch ~30% of issues):
  axe DevTools (browser extension) — industry standard, low false positives
  Lighthouse: built into Chrome DevTools → Accessibility tab
  Pa11y: CI/CD integration for automated checks
  eslint-plugin-jsx-a11y: static analysis in React projects

MANUAL KEYBOARD TESTING (15 minutes per page):
  1. Unplug your mouse
  2. Tab through the entire page
  3. Can you reach every interactive element?
  4. Can you operate every control (open menus, submit forms, dismiss modals)?
  5. Is focus always visible?
  6. Can you use Escape to close things?

SCREEN READER TESTING:
  macOS: VoiceOver (built-in) — Cmd+F5 to toggle
    Basics: VO+Right (next element), VO+Spacebar (click)
  Windows: NVDA (free) — most common in enterprise
  iOS: VoiceOver (Settings → Accessibility → VoiceOver)
  Android: TalkBack (Settings → Accessibility → TalkBack)

WHAT TO CHECK WITH SCREEN READER:
  → Does every image have meaningful alt text?
  → Are form labels announced correctly?
  → Are errors announced when they appear?
  → Are dynamic content changes announced?
  → Do modal dialogs capture focus and announce their purpose?

USER TESTING:
  Test with actual users with disabilities — no amount of developer testing replaces this
  Organizations: Fable (fable.co), UserTesting with accessibility filter
```

# QUICK WINS CHECKLIST
```
HTML:
[ ] One <h1> per page; logical heading hierarchy (no skipped levels)
[ ] All <img> have alt="" (decorative) or alt="descriptive text" (informative)
[ ] All form inputs have <label> elements properly associated
[ ] Interactive elements are buttons or links (not divs/spans)
[ ] Language declared: <html lang="en">

Keyboard:
[ ] :focus-visible has a visible, high-contrast indicator
[ ] Tab order follows visual reading order
[ ] Modals trap focus and return focus on close
[ ] Skip navigation link at top of page: "Skip to main content"

Color:
[ ] All text passes 4.5:1 contrast ratio (3:1 for large text)
[ ] Error/success/warning states use text or icon in addition to color

Screen Reader:
[ ] Icon-only buttons have aria-label
[ ] Dynamic content updates use aria-live or role="status"
[ ] Images with complex data have long description or data table alternative

Interaction:
[ ] Animations respect prefers-reduced-motion
[ ] Timeouts warn users before expiring
[ ] No content flashes more than 3 times per second
```
