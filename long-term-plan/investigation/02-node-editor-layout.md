# Investigation: NodeEditor Layout

## File: `src/components/nodegraph/NodeEditor.tsx`

## Component Hierarchy

```
NodeEditor (export)
└── ReactFlowProvider
    └── NodeEditorContent
        ├── Atmospheric Background (position: absolute)
        ├── HeaderBar (height: 48px, flex-shrink: 0)
        ├── Canvas Container (flex: 1 1 0%, position: relative)
        │   └── ReactFlow
        │       ├── Background
        │       ├── Controls
        │       ├── MiniMap
        │       └── Panel (empty state message)
        ├── ModuleDock (flex-shrink: 0)
        ├── Macro Controls (position: absolute)
        └── Vignette Overlay (position: absolute)
```

## Critical Styles Analysis

### 1. Main Container (lines 167-176)
```tsx
<div style={{
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',            // ⚠️ Percentage-based height
    background: '#07070a',     // ✓ Opaque background
    position: 'relative',
    overflow: 'hidden',
}}>
```

**Issue**: `height: '100%'` depends on parent having explicit height.
Parent in App.tsx is `<div className="absolute inset-0">` which should provide full viewport.

### 2. Canvas Container (lines 196-207)
```tsx
<div 
    ref={reactFlowWrapper}
    style={{
        flex: '1 1 0%',        // Flex-grow: 1, shrink: 1, basis: 0
        minHeight: 0,          // ✓ Allows shrinking in flex
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',        // ⚠️ PROBLEM: height: 100% in a flex child
        background: '#0a0a0f',
    }}
>
```

**CRITICAL ISSUE**: Setting `height: '100%'` on a flex child with `flex: '1 1 0%'` is problematic!

- `flex-basis: 0%` means the element starts with 0 height
- `flex-grow: 1` makes it grow to fill space
- But `height: 100%` tries to be 100% of... what exactly?

In flex layouts, percentage heights can cause confusion. The flex-basis should handle sizing.

### 3. ReactFlow Props (lines 208-226)
```tsx
<ReactFlow
    // ... no style prop
    minZoom={0.2}
    maxZoom={2}
>
```

**Issue**: No explicit `style` prop on ReactFlow component.
Previously we had:
```tsx
style={{ 
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
}}
```

This was REMOVED in a recent edit!

## Root Cause Hypothesis

1. The canvas container has conflicting `flex` and `height: 100%` properties
2. ReactFlow needs its container to have explicit dimensions
3. The previous absolute positioning on ReactFlow was removed

## From User's DOM Output

Looking at the HTML, the canvas container IS rendering but React Flow shows a warning:
> "The React Flow parent container needs a width and a height to render the graph"

This confirms React Flow isn't getting the dimensions it needs.

## Solution Direction

1. Remove `height: '100%'` from canvas container (let flex handle it)
2. OR add explicit pixel height calculation
3. Possibly re-add absolute positioning to ReactFlow component
