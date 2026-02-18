# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/fairlens/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** FairLens  
**Updated:** 2026-02-18  
**Category:** Fintech / Responsible Lending  

---

## Global Rules

### Style Direction

**Editorial Ledger**  
Warm, precise, and credible. Think printed financial statements and careful underwriting notes. Crisp rules, generous whitespace, and a tactile paper tone. Avoid shiny tech vibes and avoid neon gradients.

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary (Ink) | `#1E1B16` | `--color-ink` |
| Secondary (Teal) | `#0F766E` | `--color-teal` |
| CTA/Accent (Sienna) | `#B65C3A` | `--color-accent` |
| Background (Parchment) | `#F7F2EA` | `--color-bg` |
| Surface (Paper) | `#FFFCF7` | `--color-surface` |
| Muted Text | `#5C554B` | `--color-muted` |
| Rule/Border | `#E6DED3` | `--color-line` |

**Color Notes:** Warm neutrals + grounded accents. No purple. No glossy gradients.

### Typography

- **Heading Font:** Fraunces (600/700)
- **Body Font:** IBM Plex Sans (400/500/600)
- **Mood:** Editorial, trustworthy, precise, grounded
- **Google Fonts:** Fraunces + IBM Plex Sans

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight gaps |
| `--space-sm` | `8px` | Inline spacing |
| `--space-md` | `16px` | Standard padding |
| `--space-lg` | `24px` | Section padding |
| `--space-xl` | `36px` | Large gaps |
| `--space-2xl` | `48px` | Section margins |
| `--space-3xl` | `72px` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 1px rgba(0,0,0,0.04)` | Subtle lift |
| `--shadow-md` | `0 6px 12px rgba(30,27,22,0.08)` | Cards |
| `--shadow-lg` | `0 14px 24px rgba(30,27,22,0.12)` | Feature sections |

---

## Component Specs

### Buttons

```css
.btn-primary {
  background: var(--color-accent);
  color: #fff;
  padding: 12px 22px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: background-color 200ms ease, box-shadow 200ms ease, transform 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #A34E31;
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.btn-secondary {
  background: transparent;
  color: var(--color-ink);
  border: 1px solid var(--color-line);
  padding: 12px 20px;
  border-radius: 999px;
  font-weight: 600;
  transition: border-color 200ms ease, color 200ms ease, box-shadow 200ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: var(--color-ink);
  box-shadow: var(--shadow-sm);
}
```

### Cards

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 200ms ease, transform 200ms ease;
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input-field {
  padding: 12px 14px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  font-size: 16px;
  background: #fff;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.input-field:focus {
  border-color: var(--color-teal);
  outline: none;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
}
```

---

## Layout Rules

- Use clean grid alignment with generous spacing.
- Prefer thin rules and section dividers over heavy shadows.
- Highlight key numbers with typographic hierarchy, not color explosions.
- Avoid gradient hero backgrounds and neon glows.

---

## Anti-Patterns (Do NOT Use)

- Dark-mode-only palettes
- Purple/pink gradient hero sections
- Glossy glassmorphism panels
- Overused tech fonts (Inter, Roboto, Arial)
- Emoji icons or decorative stickers

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from a consistent icon set
- [ ] `cursor: pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum in light mode
- [ ] Visible focus states for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
