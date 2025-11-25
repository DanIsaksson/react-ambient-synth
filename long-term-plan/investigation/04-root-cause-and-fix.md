# Root Cause Analysis & Fix

## Summary of Findings

After analyzing:
1. App.tsx layer structure
2. NodeEditor.tsx layout code
3. User-provided DOM output
4. Screenshot visual evidence

## The Root Cause

**The React Flow canvas container is not getting proper height calculation.**

### Technical Details

The canvas container in `NodeEditor.tsx` (lines 196-207) has:

```tsx
style={{
    flex: '1 1 0%',      // Flex should expand to fill
    minHeight: 0,         // OK - allows shrinking
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',       // ⚠️ PROBLEM
    background: '#0a0a0f',
}}
```

**The problem**: `height: '100%'` on a flex child with `flex-basis: 0%` creates a conflict.

- `flex-basis: 0%` means "start at 0 height"
- `flex-grow: 1` means "grow to fill available space"
- `height: 100%` means "be 100% of parent's height"

When BOTH are present, browsers may:
1. Calculate the flex layout first (element gets some height)
2. Then apply `height: 100%` which may reference a different value
3. Result in unexpected sizing

### Why React Flow Shows Warning

React Flow internally checks `getBoundingClientRect()` on its container.
If the container has 0 height (or very small height), React Flow can't render properly.

The warning in user's console:
> "The React Flow parent container needs a width and a height to render the graph"

## The Fix

### Option A: Remove `height: 100%` (Recommended)

Let flexbox handle the height naturally:

```tsx
style={{
    flex: '1 1 0%',
    minHeight: 0,
    position: 'relative',
    zIndex: 1,
    width: '100%',
    // REMOVE height: '100%'
    background: '#0a0a0f',
}}
```

### Option B: Use `flex-basis: auto` with `height: 100%`

```tsx
style={{
    flex: '1 1 auto',    // Changed from 0% to auto
    minHeight: 0,
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    background: '#0a0a0f',
}}
```

### Option C: Use CSS `calc()` for explicit height

```tsx
style={{
    flex: 'none',        // Don't use flex sizing
    height: 'calc(100% - 48px - 76px)', // viewport - header - dock
    position: 'relative',
    zIndex: 1,
    width: '100%',
    background: '#0a0a0f',
}}
```

## Recommended Implementation

Use **Option A** as it's cleanest:

```tsx
{/* Main Canvas Container - Takes remaining space */}
<div 
    ref={reactFlowWrapper}
    style={{
        flex: '1 1 0%',
        minHeight: 0,
        position: 'relative',
        zIndex: 1,
        width: '100%',
        // height removed - let flex handle it
        background: '#0a0a0f',
    }}
>
```

Additionally, ensure the parent container (NodeEditorContent) has explicit full-viewport sizing:

```tsx
<div style={{
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',          // Use viewport units
    height: '100vh',         // Use viewport units
    background: '#07070a',
    position: 'relative',
    overflow: 'hidden',
}}>
```

## Testing Checklist

After implementing fix:
- [ ] React Flow canvas is visible between header and dock
- [ ] Grid background with dots is visible
- [ ] Zoom controls appear in bottom-left
- [ ] MiniMap appears in bottom-right
- [ ] Can pan/zoom the canvas with mouse
- [ ] Dropping modules from dock creates nodes
- [ ] No React Flow warning in console

---

## Implementation Applied

**Date**: November 25, 2025

### Changes Made to `NodeEditor.tsx`:

1. **Main Container** (lines 167-178):
```tsx
// BEFORE
width: '100%',
height: '100%',
position: 'relative',

// AFTER
width: '100vw',
height: '100vh',
position: 'absolute',
top: 0,
left: 0,
```

2. **Canvas Container** (lines 198-207):
```tsx
// BEFORE
flex: '1 1 0%',
height: '100%',  // REMOVED

// AFTER  
flex: 1,
// height removed
```

3. **ReactFlow Component** (lines 227-230):
```tsx
// ADDED
style={{
    width: '100%',
    height: '100%',
}}
```

### Build Status: ✅ SUCCESS
