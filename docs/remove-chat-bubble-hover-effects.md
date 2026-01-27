# Remove Hover Effects on Chat Bubbles

## Scope

Remove all hover-specific styling from **user** and **assistant** message bubbles in the chat UI, in both **full-page** and **floating widget** layouts. Links, buttons, and other interactive elements inside messages are **not** in scope—only the bubble containers.

## Current Behavior

| Layout | Bubble | Hover effect |
|--------|--------|--------------|
| Full-page | User & Assistant | `hover:shadow-md` + left gradient bar `opacity-0` → `group-hover:opacity-100` |
| Floating | User | `hover:shadow-md` |
| Floating | Assistant | Left gradient bar `opacity-0` → `group-hover:opacity-100` |

## Plan

### 1. Full-page layout (`chatbot-panel.tsx`)

**Message bubble div** (shared by user & assistant, ~L2851):

| Current | Change |
|--------|--------|
| `shadow-sm hover:shadow-md transition-all duration-200` | Remove `hover:shadow-md`. Keep `shadow-sm` and `transition-all duration-200` only if used elsewhere; otherwise simplify to `shadow-sm` or drop transition for the bubble. |
| `group` | Remove (only used for `group-hover` on gradient). |
| Inner gradient div: `opacity-0 group-hover:opacity-100 transition-opacity` | Remove this `<div>` entirely (the left-edge gradient bar). |

**Processing placeholder bubble** (~L2889): has a gradient bar with `animate-pulse-slow` (no hover). Leave as-is; it is not a message bubble.

### 2. Floating widget layout (`chatbot-panel.tsx`)

**User bubble** (~L2382–2384):

| Current | Change |
|--------|--------|
| `hover:shadow-md` | Remove. |
| Keep `shadow-sm transition-all duration-200` as needed. | |

**Assistant bubble** (~L2385–2389):

| Current | Change |
|--------|--------|
| `group` | Remove. |
| Gradient div `opacity-0 group-hover:opacity-100 transition-opacity` | Remove the gradient `<div>` entirely. |

**Loading placeholder** (~L2407): no hover. No change.

### 3. Summary of edits

- Full-page: remove `hover:shadow-md`, `group`, and the gradient bar div from the message bubble.
- Floating user: remove `hover:shadow-md` from the bubble `className`.
- Floating assistant: remove `group` and the gradient bar div.

`transition-all duration-200` / `transition-opacity` on the bubble can be kept or removed; no functional hover remains. Prefer keeping `transition-*` only if other state changes (e.g. focus) use it; otherwise remove for cleanliness.

## Files

- `components/chatbot-panel.tsx` only.

## Out of scope

- Hover on links inside markdown (e.g. "点击欣赏第一张"), sample prompt buttons, Tools Invoked bar, Images sidebar, input area, etc. Those keep their existing hover styles.
