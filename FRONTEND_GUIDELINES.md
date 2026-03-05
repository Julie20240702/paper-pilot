# FRONTEND_GUIDELINES.md — Design System
# Paper Pilot

**Rule: Every component must follow these guidelines. No random colors or inconsistent spacing.**

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#F5F0EB` | App background (warm off-white) |
| `bg-surface` | `#FFFFFF` | Card and panel backgrounds |
| `bg-surface-2` | `#F0EBE3` | Hover states, secondary surfaces |
| `border-subtle` | `#E5E7EB` | Dividers, card borders |
| `text-primary` | `#1A1A1A` | Main body text |
| `text-secondary` | `#6B7280` | Labels, captions, placeholders |
| `accent` | `#D946A8` | Active tab, links, citations, buttons |
| `accent-hover` | `#BE3A93` | Hover state for accent elements |
| `accent-green` | `#059669` | Success states |
| `accent-red` | `#DC2626` | Error states |
| `accent-yellow` | `#D97706` | Warning states |
| `sidebar` | `#EDEBE6` | Left icon sidebar background |

**Overall theme**: Light mode. Warm, clean, academic. Soft shadows on cards. Rounded corners (12px). Inspired by modern fintech/productivity apps.

---

## Typography

| Element | Tailwind Class | Notes |
|---------|---------------|-------|
| App title | `text-xl font-bold text-white` | Header logo |
| Section heading | `text-sm font-semibold text-text-secondary uppercase tracking-wider` | Tab section labels |
| Body text | `text-sm text-text-primary leading-relaxed` | Main content |
| Caption / label | `text-xs text-text-secondary` | Page numbers, timestamps |
| Code / citation | `text-xs font-mono` | `[Page X]` citations |
| Chat user message | `text-sm text-white` | Right-aligned bubble |
| Chat AI message | `text-sm text-text-primary` | Left-aligned |

**Font**: System font stack (no custom fonts in v1)  
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

---

## Spacing Scale

Use Tailwind's default spacing. Key values:
- `p-2` (8px) — tight padding inside small elements
- `p-3` (12px) — default padding inside cards
- `p-4` (16px) — panel padding
- `gap-2` / `gap-3` — spacing between list items
- `mb-4` — spacing between sections

---

## Component Patterns

### Page Citation Link `[Page X]`
```jsx
<button
  onClick={() => onJumpToPage(pageNumber)}
  className="text-xs font-mono text-pink-500 hover:text-pink-600
             underline cursor-pointer bg-transparent border-none"
>
  [Page {pageNumber}]
</button>
```

### Tab Button (Active)
```jsx
className="px-4 py-2 text-sm font-medium text-gray-900
           border-b-2 border-pink-500 bg-transparent"
```

### Tab Button (Inactive)
```jsx
className="px-4 py-2 text-sm font-medium text-gray-400
           border-b-2 border-transparent hover:text-gray-700
           hover:border-gray-300 bg-transparent"
```

### Card (for arguments, figures)
```jsx
className="bg-white rounded-xl p-4 mb-3
           border border-gray-200 hover:border-gray-300
           shadow-sm hover:shadow-md transition-shadow"
```

### Primary Button
```jsx
className="px-4 py-2 bg-pink-500 hover:bg-pink-600
           text-white text-sm font-medium rounded-lg
           transition-colors duration-150 shadow-sm"
```

### Input / Textarea
```jsx
className="w-full bg-white border border-gray-200
           rounded-lg p-3 text-sm text-gray-900 placeholder-gray-400
           focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400
           resize-none shadow-sm"
```

### Loading Spinner
```jsx
className="animate-spin h-5 w-5 border-2 border-pink-400
           border-t-transparent rounded-full"
```

### Error Message
```jsx
className="text-sm text-red-600 bg-red-50
           border border-red-200 rounded-lg p-3"
```

---

## Layout Rules

### App Shell
```
height: 100vh
display: flex
flex-direction: column
overflow: hidden
background: #F5F0EB
```

### Header
```
height: 56px (h-14)
flex-shrink: 0
background: #FFFFFF
border-bottom: 1px solid #E5E7EB
box-shadow: 0 1px 3px rgba(0,0,0,0.05)
```

### Main Content Area (below header)
```
flex: 1
display: flex
overflow: hidden
```

### Left Panel (PDF Viewer)
```
default width: 55%
min-width: 30%
overflow: auto
background: #F5F0EB
```

### Right Panel (AI Panel)
```
default width: 45%
min-width: 25%
display: flex
flex-direction: column
overflow: hidden
background: #FFFFFF
border-left: 1px solid #E5E7EB
```

### Resizable Divider
```
width: 4px
background: #E5E7EB
cursor: col-resize
hover: background: #D946A8
```

---

## Responsive Behavior

**v1 is desktop-only.** Minimum supported width: 1024px.

On screens < 1024px wide: show a message "Paper Pilot works best on a desktop browser."

---

## Icons

Use simple Unicode characters or inline SVG. No icon library dependency in v1.

| Symbol | Usage |
|--------|-------|
| `↑` `↓` | Page navigation |
| `+` `-` | Zoom controls |
| `✕` | Close / dismiss |
| `▼` `▶` | Collapse/expand notes |
| `↩` | Send message (Enter key hint) |
