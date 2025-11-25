# Investigation: App.tsx Layer Structure

## File: `src/App.tsx` (lines 134-147)

```tsx
return (
  <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
    {/* Layer 0: Background Visualizer (3D) */}
    <div className="absolute inset-0 z-0">
      <Scene3D />
    </div>

    {/* Layer 1: Graph Mode (Full Screen Workspace) - Fully opaque */}
    {viewMode === 'graph' && (
      <div className="absolute inset-0 z-10 animate-fade-in">
        <NodeEditor onExitGraphMode={() => setViewMode('classic')} />
      </div>
    )}

    {/* Layer 2: HUD (Classic Mode only) */}
    {viewMode === 'classic' && (
      <div className="absolute inset-0 z-20 pointer-events-none ...">
        ...
      </div>
    )}
  </div>
);
```

## Layer Analysis

| Layer | z-index | Element | Visibility |
|-------|---------|---------|------------|
| 0 | z-0 | Scene3D | Always rendered |
| 1 | z-10 | NodeEditor | Only when `viewMode === 'graph'` |
| 2 | z-20 | Classic HUD | Only when `viewMode === 'classic'` |

## Observations

1. **Scene3D is ALWAYS rendered** - Even in Graph Mode, Scene3D is present at z-0
2. **NodeEditor should cover Scene3D** - At z-10, it should be above z-0
3. **The layers are mutually exclusive** - HUD and NodeEditor never render together

## Potential Issues

### Issue 1: Scene3D Visibility
The Scene3D Three.js canvas is visible in the screenshot even though NodeEditor (z-10) should cover it.
This suggests NodeEditor might be:
- Not fully opaque
- Not taking full viewport height
- Having a transparent region at the top

### Issue 2: NodeEditor Wrapper Has No Background
```tsx
<div className="absolute inset-0 z-10 animate-fade-in">
  <NodeEditor />
</div>
```

The wrapper div has NO background color! It relies on NodeEditorContent's internal background.
If NodeEditorContent doesn't fill 100% height, Scene3D will show through.

## Verdict

The App.tsx layer structure is **mostly correct**, but:
1. Scene3D renders at 100% width but possibly limited height (Canvas reports 150px height)
2. NodeEditor wrapper has no fallback background
3. The issue is likely inside NodeEditor.tsx
