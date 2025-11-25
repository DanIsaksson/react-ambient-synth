# Investigation: DOM Structure Analysis

## User-Provided DOM (Parsed)

```
body
└── #root
    └── div.relative.w-full.h-screen (Main App Container)
        ├── div.absolute.inset-0.z-0 (Scene3D Layer)
        │   └── div (Scene3D wrapper, 100% x 100%)
        │       └── div (overflow container)
        │           └── canvas [width: 1105.8px, height: 150px] ← THREE.JS CANVAS
        │
        └── div.absolute.inset-0.z-10.animate-fade-in (NodeEditor Layer)
            └── div (NodeEditorContent - flex column, 100% x 100%, bg: #07070a)
                ├── div (Atmospheric gradient, position: absolute)
                ├── div (HeaderBar, height: 48px)
                ├── div (Canvas Container, flex: 1 1 0%)
                │   └── div.react-flow (ReactFlow wrapper)
                │       ├── div.react-flow__renderer
                │       │   └── div.react-flow__pane
                │       │       └── div.react-flow__viewport [transform: translate(-95px, -62px) scale(2)]
                │       │           ├── div.react-flow__edges (empty)
                │       │           └── div.react-flow__nodes
                │       │               ├── OscillatorNode (at 100,100)
                │       │               └── OutputNode (at 400,100)
                │       ├── svg.react-flow__background (Grid)
                │       ├── div.react-flow__controls (Zoom buttons)
                │       └── div.react-flow__minimap
                │
                ├── div (ModuleDock wrapper)
                │   └── ModuleDock (7 draggable tiles)
                │
                ├── div (Macro Controls, position: absolute, top: 64px, right: 16px)
                │   └── MacroKnobs (Tension, Space, Force, Flow)
                │
                └── div (Vignette overlay, position: absolute)
```

## Key Observations

### 1. Three.js Canvas Dimensions
```html
<canvas style="width: 1105.8px; height: 150px;">
```
- Width: 1105.8px (almost full viewport width)
- Height: **150px** ← This is very small!

The Scene3D canvas is only rendering at 150px height, not full viewport.
This is likely because the GravityScene3D or Canvas component is calculating height incorrectly.

### 2. React Flow IS Rendering
The DOM shows:
- `react-flow__wrapper` exists
- `react-flow__nodes` contains 2 nodes (Oscillator and Output)
- `react-flow__viewport` has transform: `translate(-95px, -62px) scale(2)`
- Controls and MiniMap are present

**React Flow is working!** The nodes exist in the DOM.

### 3. The Viewport Transform
```
transform: translate(-95px, -62px) scale(2)
```
- Scale 2x = zoomed in significantly
- Negative translate = panned to show nodes

This is `fitView` centering on the 2 default nodes.

### 4. Canvas Container Sizing
The canvas container has:
```
flex: 1 1 0%
min-height: 0px
position: relative
z-index: 1
width: 100%
background: rgb(10, 10, 15)
```

**Missing**: No explicit height! React Flow calculates container dimensions.

## The Actual Problem

Looking at the screenshot vs the DOM:

1. **What we see**: A grey/dark box at the top, then header, then dock
2. **What we expect**: Header at top, React Flow canvas filling middle, dock at bottom

The React Flow canvas IS in the DOM but appears to have **zero visual height** in the rendered output.

### Why?

The canvas container div uses `flex: 1 1 0%` which should expand, but:
1. It also has `height: 100%` which creates a circular dependency
2. React Flow needs explicit dimensions to render properly
3. The `fitView` + scale(2) might be zooming into a tiny area

## Proof Points

From the DOM:
- `react-flow__wrapper` has `width: 100%; height: 100%`
- The minimap shows nodes exist at positions (100,100) and (400,100)
- Controls panel shows zoom-in is DISABLED (max zoom reached?)

The canvas IS rendering but the **container dimensions are not propagating correctly**.
