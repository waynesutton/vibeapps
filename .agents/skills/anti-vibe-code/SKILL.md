# Anti Vibe Code UI Skill

Audit and fix common AI-generated UI anti-patterns. Use this skill when reviewing or building frontend components to ensure the app looks intentionally designed, not AI-generated.

## When to use

- Building new pages or components
- Reviewing existing UI for vibe-coded patterns
- Redesigning landing pages
- Before deploying frontend changes

## The checklist

Run through every item. If a component fails any check, fix it before shipping.

### 1. Icon containers

**Pattern to find:**
```
rounded-lg bg-*/20 flex items-center justify-center
```
with an icon inside.

**Fix:** Remove the container div. Let the icon sit inline with text.

```tsx
// BAD: icon in colored rounded box
<div className="w-8 h-8 rounded-lg bg-mono-green/20 flex items-center justify-center">
  <Code size={16} className="text-mono-green" />
</div>

// GOOD: icon inline with text
<Code size={16} weight="bold" className="text-mono-green" />
```

### 2. Glassmorphism on static elements

**Pattern to find:**
```
backdrop-blur-xl
```
on anything that is NOT a modal overlay or dropdown.

**Fix:** Replace with solid background.

```tsx
// BAD: glassmorphism on persistent sidebar
<div className="bg-mono-panel/50 backdrop-blur-xl">

// GOOD: solid background
<div className="bg-mono-panel">
```

`backdrop-blur-sm` on modal backdrops (`bg-black/60 backdrop-blur-sm`) is acceptable.

### 3. Hover scale on icons

**Pattern to find:**
```
group-hover:scale-110 transition-transform
```
on icon containers or static elements.

**Fix:** Remove the scale transform entirely. If the parent card has a hover state (border color change), that is enough.

### 4. Hero glow blobs

**Pattern to find:**
```
bg-*/[0.08] blur-[120px] animate-hero-glow
```

**Fix:** Remove ambient glow divs entirely. Clean dark background reads as intentional. Blurred color blobs read as AI-generated.

### 5. Unnecessary shadows on buttons

**Pattern to find:** Buttons with `shadow-lg` or shadow backdrops.

**Fix:** Buttons get solid backgrounds. No shadows.

### 6. Nested cards

**Pattern to find:** A bordered card that contains another bordered card inside it.

**Fix:** Flatten. Use spacing, font weight, and color to separate content within a single card.

### 7. Same-hue color stacking

**Pattern to find:** An icon, its container, and its parent all using the same color at different opacities (green icon in green/20 box on green/10 background).

**Fix:** Use neutral backgrounds. Let the icon color be the only accent.

### 8. Serif in hero

**Pattern to find:** `font-serif`, Instrument Serif, DM Serif, Playfair Display in hero headings.

**Fix:** Use the project's sans-serif font (Inter). Save serif for intentional editorial contexts.

### 9. Green left border

**Pattern to find:** `border-l-2 border-green` combined with `rounded-*`.

**Fix:** Either remove the left border or remove the border-radius.

### 10. Entrance animations on visible content

**Pattern to find:** `animate-fade-up`, `animate-slide-right` on elements that are above the fold.

**Fix:** Remove. Content that is immediately visible should not animate in.

## Audit command

To run a quick grep audit on your codebase:

```bash
# Icon in colored box pattern
rg "rounded-lg bg-.*\/\d+ flex items-center justify-center" components/

# Glassmorphism on non-modals
rg "backdrop-blur-xl" components/

# Hover scale on icons
rg "group-hover:scale" components/

# Hero glow blobs
rg "animate-hero-glow" components/ app/

# Emoji as visual assets
rg "[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}]" components/
```

## Reference

Based on Yuwen Lu's analysis of common bad patterns in AI-generated website design. The core insight: when UI can be generated for free, we see an abundance of flashy design that is not tastefully put together. Clear messages beat noise. Intention beats carelessness.

Good reference sites for intentional design: Cursor, Linear, Vercel, Raycast.
