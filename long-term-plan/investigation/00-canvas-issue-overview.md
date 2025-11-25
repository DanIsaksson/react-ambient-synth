# Canvas Layout Investigation

**Date**: November 25, 2025  
**Issue**: React Flow canvas not visible; Three.js canvas (Scene3D) appears instead

## Symptom Summary

The user sees:
1. A grey box at the top labeled "CanvasImpl" (Three.js/React Three Fiber canvas)
2. The NodeEditor header bar with "AMBIENT FLOW" and controls
3. The ModuleDock at the bottom with draggable module tiles
4. **Missing**: The React Flow infinite canvas workspace between header and dock

## Visual Evidence

- The "CanvasImpl" element is the Scene3D visualizer, NOT the graph editor
- The React Flow canvas should be a dark area with:
  - Dotted grid background
  - Zoom controls (+ / - / fit buttons)
  - Minimap in corner
  - Draggable/droppable node workspace

## Key Questions

1. **Is the NodeEditor rendering at all?** - Check if `viewMode === 'graph'` is true
2. **Is the React Flow component mounting?** - Check DOM for `react-flow__wrapper`
3. **Is there a z-index/layer issue?** - Scene3D might be covering NodeEditor
4. **Is the canvas container collapsing?** - Flexbox height calculation issue

## Files to Investigate

1. `src/App.tsx` - Layer management, viewMode state
2. `src/components/nodegraph/NodeEditor.tsx` - Canvas container layout
3. `src/components/visualizers/Scene3D.tsx` - Background visualizer
4. CSS/Tailwind classes affecting z-index and positioning

## Investigation Plan

See subsequent files:
- `01-app-layer-structure.md` - App.tsx analysis
- `02-node-editor-layout.md` - NodeEditor.tsx analysis  
- `03-scene3d-interference.md` - Scene3D positioning
- `04-dom-structure-analysis.md` - Actual DOM output analysis
- `05-root-cause-and-fix.md` - Conclusions and solution
