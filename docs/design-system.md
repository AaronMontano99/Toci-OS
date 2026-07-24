# Subtle Gradient Design System

## 1. Visual Theme & Atmosphere

The Subtle Gradient Design System is clean, trustworthy, and modern, using a refined violet-to-indigo spectrum as its commanding visual accent. The design operates on white backgrounds with Gradient Violet (`#6D5CE7`, `#5646C5`, `#4338A8`) creating a distinctive, professional identity. The open-source Manrope typeface handles display headings with bold (700) weight and negative tracking, while Inter serves as the UI workhorse.

**Key Characteristics:**
- Gradient Violet (`#6D5CE7`) as primary brand with darker variants (`#5646C5`, `#4338A8`)
- Manrope (display) + Inter (UI) dual font system
- Near-black (`#101114`) text with cool blue-gray neutral scale
- 12px radius buttons (rounded but not pill)
- Subtle shadows (`rgba(0,0,0,0.03) 0px 4px 24px`) — whisper-level
- Green accent (`#149e61`) for positive/success states

## 2. Color Palette & Roles

### Primary
- **Gradient Violet** (`#6D5CE7`): Primary CTA, brand accent, links
- **Violet Dark** (`#5646C5`): Button borders, outlined variants
- **Indigo Deep** (`#4338A8`): Deepest violet
- **Violet Subtle** (`rgba(109,92,231,0.16)`): Violet at 16% — subtle button backgrounds
- **Near Black** (`#101114`): Primary text

### Neutral
- **Cool Gray** (`#686b82`): Primary neutral, borders at 24% opacity
- **Silver Blue** (`#9497a9`): Secondary text, muted elements
- **White** (`#ffffff`): Primary surface
- **Border Gray** (`#dedee5`): Divider borders

### Semantic
- **Green** (`#149e61`): Success/positive at 16% opacity for badges
- **Green Dark** (`#026b3f`): Badge text

## 3. Typography Rules

### Font Families
- **Display**: `Manrope`, fallbacks: `Helvetica, Arial, sans-serif`
- **UI / Body**: `Inter`, fallbacks: `Helvetica Neue, Helvetica, Arial, sans-serif`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Display Hero | Manrope | 48px | 700 | 1.17 | -1px |
| Section Heading | Manrope | 36px | 700 | 1.22 | -0.5px |
| Sub-heading | Manrope | 28px | 700 | 1.29 | -0.5px |
| Feature Title | Inter | 22px | 600 | 1.20 | normal |
| Body | Inter | 16px | 400 | 1.38 | normal |
| Body Medium | Inter | 16px | 500 | 1.38 | normal |
| Button | Inter | 16px | 500–600 | 1.38 | normal |
| Caption | Inter | 14px | 400–700 | 1.43–1.71 | normal |
| Small | Inter | 12px | 400–500 | 1.33 | normal |
| Micro | Inter | 7px | 500 | 1.00 | uppercase |

## 4. Component Stylings

### Buttons

**Primary Violet**
- Background: `#6D5CE7`
- Text: `#ffffff`
- Padding: 13px 16px
- Radius: 12px

**Violet Outlined**
- Background: `#ffffff`
- Text: `#5646C5`
- Border: `1px solid #5646C5`
- Radius: 12px

**Violet Subtle**
- Background: `rgba(109,92,231,0.16)`
- Text: `#6D5CE7`
- Padding: 8px
- Radius: 12px

**White Button**
- Background: `#ffffff`
- Text: `#101114`
- Radius: 10px
- Shadow: `rgba(0,0,0,0.03) 0px 4px 24px`

**Secondary Gray**
- Background: `rgba(148,151,169,0.08)`
- Text: `#101114`
- Radius: 12px

### Badges
- Success: `rgba(20,158,97,0.16)` bg, `#026b3f` text, 6px radius
- Neutral: `rgba(104,107,130,0.12)` bg, `#484b5e` text, 8px radius

## 5. Layout Principles

### Spacing: 1px, 2px, 3px, 4px, 5px, 6px, 8px, 10px, 12px, 13px, 15px, 16px, 20px, 24px, 25px
### Border Radius: 3px, 6px, 8px, 10px, 12px, 16px, 9999px, 50%

## 6. Depth & Elevation
- Subtle: `rgba(0,0,0,0.03) 0px 4px 24px`
- Micro: `rgba(16,24,40,0.04) 0px 1px 4px`

## 7. Do's and Don'ts

### Do
- Use Gradient Violet (#6D5CE7) for CTAs and links
- Apply 12px radius on all buttons
- Use Manrope for headings, Inter for body

### Don't
- Don't use pill buttons — 12px is the max radius for buttons
- Don't use other violets outside the defined scale

## 8. Responsive Behavior
Breakpoints: 375px, 425px, 640px, 768px, 1024px, 1280px, 1536px

## 9. Agent Prompt Guide

### Quick Color Reference
- Brand: Gradient Violet (`#6D5CE7`)
- Dark variant: `#5646C5`
- Text: Near Black (`#101114`)
- Secondary text: `#9497a9`
- Background: White (`#ffffff`)

### Example Component Prompts
- "Create hero: white background. Manrope 48px weight 700, letter-spacing -1px. Violet CTA (#6D5CE7, 12px radius, 13px 16px padding)."
