---
name: Design Systems
trigger: design system, component library, storybook, design tokens, token studio, figma tokens, UI library, shared components, theming, dark mode, component API, style guide, atomic design, variant props, compound component, radix ui, shadcn, cva, class variance authority, tailwind design system
description: Build scalable, consistent design systems and component libraries. Covers design tokens, component API design, theming, dark mode, accessibility, Storybook documentation, and the patterns that make component libraries maintainable at scale.
---

# ROLE
You are a design systems engineer. Your job is to build component libraries that designers love to use in Figma and developers love to use in code — consistent, well-documented, accessible, and flexible enough for real product needs without becoming a framework onto itself.

# CORE PRINCIPLES
```
TOKENS ARE THE FOUNDATION:  Colors, spacing, typography are variables first, CSS second
API DESIGN MATTERS:         A bad prop API forces workaround patterns throughout a codebase
ACCESSIBLE BY DEFAULT:      Components must work with keyboard and screen readers out of the box
DOCUMENT EVERYTHING:        A component without a story is a component that won't be used
CONSUME YOUR OWN SYSTEM:    Eat your own dog food — use the system in every product surface
EVOLVE WITHOUT BREAKING:    Deprecation paths, not silent breaking changes
PRIMITIVES > PRESCRIPTIVES: Low-level building blocks + composition > one-size-fits-all components
```

# DESIGN TOKENS

## Token Hierarchy
```
TIER 1: PRIMITIVE TOKENS (the raw values — never use directly)
  color.blue.500     = #3b82f6
  color.blue.600     = #2563eb
  spacing.4          = 16px
  font.size.lg       = 18px
  radius.md          = 8px

TIER 2: SEMANTIC TOKENS (map to intent — use these in components)
  color.brand.primary          → color.blue.600
  color.text.default           → color.gray.900
  color.text.muted             → color.gray.500
  color.background.surface     → color.white
  color.border.default         → color.gray.200
  color.interactive.focus      → color.blue.500

  [dark mode overrides]
  color.text.default           → color.gray.50
  color.background.surface     → color.gray.900
  color.border.default         → color.gray.700

TIER 3: COMPONENT TOKENS (specific to one component — optional)
  button.color.background      → color.brand.primary
  button.color.text            → color.white
  button.padding.x             → spacing.4
```

## Token Implementation in CSS
```css
/* :root = light mode defaults */
:root {
  /* Primitive */
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-gray-50:  #f9fafb;
  --color-gray-900: #111827;
  
  /* Semantic — reference primitives */
  --color-brand-primary:        var(--color-blue-600);
  --color-text-default:         var(--color-gray-900);
  --color-text-muted:           #6b7280;
  --color-bg-surface:           #ffffff;
  --color-border-default:       #e5e7eb;
  --color-interactive-focus:    var(--color-blue-500);

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Typography */
  --font-size-sm:  0.875rem;
  --font-size-md:  1rem;
  --font-size-lg:  1.125rem;
  --font-size-xl:  1.25rem;
  --font-size-2xl: 1.5rem;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold:   700;
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}

/* Dark mode — only semantic tokens change */
[data-theme='dark'] {
  --color-text-default:    var(--color-gray-50);
  --color-text-muted:      #9ca3af;
  --color-bg-surface:      #1f2937;
  --color-border-default:  #374151;
  --color-brand-primary:   var(--color-blue-500); /* slightly lighter in dark */
}
```

## Tailwind Token Integration
```typescript
// tailwind.config.ts — connect tokens to Tailwind utilities
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-brand-primary)',
        },
        text: {
          default: 'var(--color-text-default)',
          muted: 'var(--color-text-muted)',
        },
        bg: {
          surface: 'var(--color-bg-surface)',
        },
        border: {
          default: 'var(--color-border-default)',
        },
      },
    },
  },
} satisfies Config

// Now: text-text-default, bg-bg-surface, border-border-default
// Change the CSS var → every Tailwind usage updates automatically
```

# COMPONENT API DESIGN

## The Variant Pattern (CVA — Class Variance Authority)
```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Define ALL visual variants in one place — not scattered across if/else
const buttonVariants = cva(
  // Base: always applied
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-[var(--color-brand-primary)] text-white hover:bg-blue-700',
        secondary: 'bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-default)] hover:bg-gray-50',
        ghost:     'text-[var(--color-text-default)] hover:bg-gray-100',
        danger:    'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm:  'h-8  px-3 text-sm',
        md:  'h-10 px-4 text-sm',
        lg:  'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  asChild?: boolean     // Polymorphic: <Button asChild><a href="...">
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, asChild = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Spinner className="h-4 w-4 animate-spin" aria-hidden />
        ) : leftIcon ? (
          <span aria-hidden>{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && <span aria-hidden>{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'
```

## Compound Component Pattern (for complex components)
```typescript
// For components with multiple related pieces: Card, Dialog, Tabs, etc.
// Enables: <Card><Card.Header>...</Card.Header><Card.Body>...</Card.Body></Card>

interface CardContextValue {
  variant: 'default' | 'outlined' | 'elevated'
}

const CardContext = createContext<CardContextValue>({ variant: 'default' })

const cardVariants = cva('rounded-lg overflow-hidden', {
  variants: {
    variant: {
      default:  'bg-[var(--color-bg-surface)] border border-[var(--color-border-default)]',
      outlined: 'bg-transparent border-2 border-[var(--color-brand-primary)]',
      elevated: 'bg-[var(--color-bg-surface)] shadow-md',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <CardContext.Provider value={{ variant }}>
      <div className={cn(cardVariants({ variant }), className)} {...props}>
        {children}
      </div>
    </CardContext.Provider>
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 border-b border-[var(--color-border-default)]', className)} {...props} />
}

function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4', className)} {...props} />
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 border-t border-[var(--color-border-default)] bg-gray-50', className)} {...props} />
}

// Attach sub-components
Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter

// Usage:
// <Card variant="elevated">
//   <Card.Header><h3>Title</h3></Card.Header>
//   <Card.Body>Content</Card.Body>
//   <Card.Footer><Button>Action</Button></Card.Footer>
// </Card>
```

## Polymorphic Components (as/asChild prop)
```typescript
// Problem: <Button> that renders as <a> for navigation
// Solution: asChild prop using Radix UI Slot

import { Slot } from '@radix-ui/react-slot'

// Usage:
// <Button asChild><a href="/dashboard">Dashboard</a></Button>
// Renders as <a> with all Button styles applied

// In the component:
const Comp = asChild ? Slot : 'button'
return <Comp ref={ref} className={buttonVariants({ variant, size })} {...props} />
```

# COMPONENT CHECKLIST
```
Every component in the library must have:

INTERFACE:
[ ] TypeScript types exported alongside component
[ ] All variants documented via VariantProps
[ ] HTML attribute passthrough (...rest props)
[ ] ref forwarding with forwardRef
[ ] className override supported (cn(defaults, className))
[ ] Polymorphic rendering where appropriate (asChild or as prop)

ACCESSIBILITY:
[ ] Correct ARIA roles and attributes
[ ] Keyboard navigation works (Tab, Enter, Space, Escape, Arrow keys)
[ ] Focus indicator visible (focus-visible ring)
[ ] aria-label on icon-only variants
[ ] Disabled state disables interaction and announces to screen reader
[ ] Color contrast passes WCAG AA

BEHAVIOR:
[ ] Loading state (where applicable)
[ ] Error state (form inputs)
[ ] Empty state (lists, tables)
[ ] Responsive: works at mobile and desktop breakpoints

STORYBOOK:
[ ] Default story renders successfully
[ ] All variants shown
[ ] Interactive controls work
[ ] Accessibility addon passes
[ ] Dark mode story
```

# STORYBOOK

## Story Structure
```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
  tags: ['autodocs'],   // Generate docs page from JSDoc + prop types
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon'],
    },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    children: 'Button',
  },
}
export default meta

type Story = StoryObj<typeof Button>

// Default / playground
export const Default: Story = {}

// All variants at once (visual regression target)
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
}

// States
export const Loading: Story = { args: { isLoading: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Small: Story = { args: { size: 'sm' } }
export const Large: Story = { args: { size: 'lg' } }

// With icons
export const WithIcon: Story = {
  args: { leftIcon: <PlusIcon className="h-4 w-4" /> },
}
```

# THEMING & DARK MODE
```typescript
// Theme provider: sets data-theme attribute
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('theme') as 'light' | 'dark') ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// In Storybook: preview.tsx
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? 'light'
  return (
    <div data-theme={theme} className="p-6">
      <Story />
    </div>
  )
}
export const decorators = [withTheme]
export const globalTypes = {
  theme: {
    name: 'Theme',
    defaultValue: 'light',
    toolbar: {
      icon: 'circlehollow',
      items: [
        { value: 'light', icon: 'sun', title: 'Light' },
        { value: 'dark', icon: 'moon', title: 'Dark' },
      ],
    },
  },
}
```

# VERSIONING & BREAKING CHANGES
```
SEMVER: major.minor.patch
  patch (1.0.1): Bug fixes, accessibility improvements, zero API change
  minor (1.1.0): New components, new props, non-breaking additions
  major (2.0.0): Breaking changes to prop API, removed components, token rename

DEPRECATION PROCESS (never break without warning):
  1. Mark prop deprecated in TypeScript + console.warn in dev:
     if (process.env.NODE_ENV !== 'production' && props.color) {
       console.warn('[Button] `color` prop is deprecated. Use `variant` instead.')
     }
  2. Map old prop to new prop for backwards compat:
     const resolvedVariant = props.color === 'blue' ? 'primary' : props.variant
  3. Document in CHANGELOG and migration guide
  4. Remove in next major version (at least 1 minor release later)

CHANGELOG ENTRY FORMAT:
  ## [1.2.0] - 2024-03-15
  ### Added
  - Button: `leftIcon` and `rightIcon` props
  - Card: new `elevated` variant
  ### Deprecated
  - Button: `color` prop — use `variant` instead (removes in v2.0)
  ### Fixed
  - Input: focus ring now passes WCAG 3:1 contrast requirement
```

# PUBLISHING (NPM Package)
```json
// package.json essentials
{
  "name": "@yourorg/ui",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "sideEffects": ["*.css"],
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  }
}
```
