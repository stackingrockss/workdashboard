# Skill: /brand

> Quick reference guide for Briefcase visual identity and design system

## Brand Identity

| Element | Value |
|---------|-------|
| **Name** | Briefcase |
| **Logo** | `Briefcase` icon from `lucide-react` |
| **Tagline** | "AI-powered deal intelligence for strategic enterprise sales" |
| **Font** | Geist (sans) / Geist Mono (monospace) |

## Primary Color - Executive Charcoal Blue

```css
/* Light mode */
--primary: oklch(0.30 0.04 260);
--primary-hover: oklch(0.25 0.05 260);
--primary-foreground: oklch(1 0 0); /* white */

/* Dark mode */
--primary: oklch(0.60 0.06 260);
--primary-hover: oklch(0.55 0.07 260);
--primary-foreground: oklch(0.10 0.02 260); /* near-black */
```

## Full Color Palette

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--background` | `oklch(0.995 0.002 260)` | `oklch(0.15 0.02 260)` | Page background |
| `--foreground` | `oklch(0.15 0.02 260)` | `oklch(0.95 0.01 260)` | Primary text |
| `--muted` | `oklch(0.96 0.008 260)` | `oklch(0.22 0.03 260)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.55 0.02 260)` | `oklch(0.65 0.02 260)` | Secondary text |
| `--border` | `oklch(0.92 0.01 260)` | `oklch(1 0 0 / 10%)` | Borders |
| `--destructive` | `oklch(0.63 0.24 25)` | `oklch(0.70 0.22 25)` | Error/delete |
| `--success` | `oklch(0.45 0.10 145)` | `oklch(0.55 0.14 145)` | Success states |
| `--warning` | `oklch(0.80 0.15 85)` | `oklch(0.82 0.16 85)` | Warning states |

### Chart Colors (Data Visualization)

```css
--chart-1: oklch(0.30 0.04 260);  /* Primary blue */
--chart-2: oklch(0.45 0.10 145);  /* Green */
--chart-3: oklch(0.50 0.06 200);  /* Cyan */
--chart-4: oklch(0.65 0.08 85);   /* Yellow */
--chart-5: oklch(0.40 0.06 280);  /* Purple */
```

## Typography Scale

| Class | Size | Weight | Letter Spacing | Usage |
|-------|------|--------|----------------|-------|
| `.text-display` | 2.25rem | 700 | -0.025em | Hero headings |
| `.text-headline` | 1.5rem | 600 | -0.02em | Section headings |
| `.text-title` | 1.125rem | 600 | -0.01em | Card titles |
| `.text-body` | 0.875rem | 400 | normal | Body text |
| `.text-body-sm` | 0.8125rem | 400 | normal | Smaller body |
| `.text-caption` | 0.75rem | 500 | 0.01em (uppercase) | Labels, captions |
| `.text-label` | 0.8125rem | 500 | normal | Form labels |

## Radius System

```css
--radius: 0.375rem;           /* 6px - base */
--radius-sm: calc(var(--radius) - 4px);   /* 2px */
--radius-md: calc(var(--radius) - 2px);   /* 4px */
--radius-lg: var(--radius);                /* 6px */
--radius-xl: calc(var(--radius) + 4px);   /* 10px */
```

## Shadow System

```css
/* Light mode */
--shadow-sm: 0 1px 2px oklch(0 0 0 / 3%), 0 1px 3px oklch(0 0 0 / 4%);
--shadow-md: 0 4px 6px oklch(0 0 0 / 3.5%), 0 2px 4px oklch(0 0 0 / 3%);
--shadow-lg: 0 10px 25px oklch(0 0 0 / 6%), 0 4px 10px oklch(0 0 0 / 3.5%);
--shadow-glow: 0 0 0 3px oklch(0.30 0.04 260 / 12%);  /* Focus ring */

/* Dark mode - more pronounced */
--shadow-sm: 0 1px 3px oklch(0 0 0 / 25%);
--shadow-md: 0 4px 8px oklch(0 0 0 / 35%);
--shadow-lg: 0 10px 30px oklch(0 0 0 / 45%);
--shadow-glow: 0 0 0 3px oklch(0.60 0.06 260 / 18%);
```

## Animation Tokens

```css
/* Easing */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);       /* Exit animations */
--ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);   /* Entrance animations */

/* Duration */
--duration-fast: 150ms;      /* Quick interactions */
--duration-normal: 200ms;    /* Standard animations */
--duration-slow: 300ms;      /* Sidebar, major transitions */
```

## Layout Dimensions

```css
--sidebar-width-expanded: 240px;
--sidebar-width-collapsed: 64px;
```

## Button Variants

| Variant | Usage | Tailwind Classes |
|---------|-------|------------------|
| `default` | Primary actions | `bg-primary text-primary-foreground` |
| `destructive` | Delete/danger | `bg-destructive text-destructive-foreground` |
| `outline` | Secondary actions | `border border-input bg-background` |
| `secondary` | Tertiary actions | `bg-secondary text-secondary-foreground` |
| `ghost` | Minimal UI | `hover:bg-accent hover:text-accent-foreground` |
| `link` | Text links | `text-primary underline-offset-4` |

## Icon Usage

Always use `lucide-react` icons:

```tsx
import { Briefcase, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

// Standard sizes
<Icon className="h-4 w-4" />  // Default
<Icon className="h-5 w-5" />  // Slightly larger
<Icon className="h-6 w-6" />  // Headers
```

## Focus States

```tsx
// Standard focus ring
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Disabled state
className="disabled:pointer-events-none disabled:opacity-50"
```

## Dark Mode

Dark mode is implemented via CSS custom properties with `.dark` class:

```tsx
// Tailwind dark mode classes
className="bg-background dark:bg-background"  // Uses CSS variables
className="text-foreground dark:text-foreground"

// The theme automatically switches all color tokens
```

## Key Files

| File | Purpose |
|------|---------|
| `src/app/globals.css` | All CSS variables and global styles |
| `src/components/ui/*` | shadcn/ui components (40+ files) |
| `src/lib/constants.ts` | Semantic labels and configuration |
| `tailwind.config.ts` | Tailwind configuration |

## Quick Reference

```tsx
// Brand logo
import { Briefcase } from "lucide-react";
<Briefcase className="h-6 w-6" />

// Primary button
<Button>Action</Button>

// Destructive button
<Button variant="destructive">Delete</Button>

// Card with proper styling
<Card className="shadow-sm hover:shadow-md transition-shadow">
  <CardHeader>
    <CardTitle className="text-title">Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Muted text
<p className="text-sm text-muted-foreground">Secondary info</p>

// Success/error toast
import { toast } from "sonner";
toast.success("Done!");
toast.error("Failed");
```