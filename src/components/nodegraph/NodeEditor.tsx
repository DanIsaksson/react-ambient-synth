import React, { useEffect, useCallback, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, useReactFlow, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNodeGraphStore } from '../../store/nodeGraphStore';
import { useModulationStore } from '../../store/modulationStore';
import { useAudioStore } from '../../store/useAudioStore';
import { GraphManager } from '../../audio/engine/GraphManager';
import { ModuleDock } from './NodeSidebar';
import { MacroKnob } from '../controls/MacroKnob';

import { OscillatorNode } from './nodes/OscillatorNode';
import { OutputNode } from './nodes/OutputNode';
import { FilterNode } from './nodes/FilterNode';
import { EnvelopeNode } from './nodes/EnvelopeNode';
import { SequencerNode } from './nodes/SequencerNode';
import { KarplusNode } from './nodes/KarplusNode';
import { PhysicsNode } from './nodes/PhysicsNode';
import { TextureNode } from './nodes/TextureNode';
import { ResonatorNode } from './nodes/ResonatorNode';
import { EuclideanNode } from './nodes/EuclideanNode';
import { LFONode } from './nodes/LFONode';
import { NoiseNode } from './nodes/NoiseNode';
import { Spatial3DNode } from './nodes/Spatial3DNode';
import { SignalEdge } from './edges/SignalEdge';

// ============================================================================
// NODE & EDGE TYPE REGISTRATION
// ============================================================================

const edgeTypes = { signal: SignalEdge };
const defaultEdgeOptions = { type: 'signal', animated: true };

const nodeTypes = {
    oscillator: OscillatorNode,
    filter: FilterNode,
    envelope: EnvelopeNode,
    sequencer: SequencerNode,
    euclidean: EuclideanNode,
    lfo: LFONode,
    noise: NoiseNode,
    spatial: Spatial3DNode,
    karplus: KarplusNode,
    physics: PhysicsNode,
    texture: TextureNode,
    resonator: ResonatorNode,
    output: OutputNode,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

// ============================================================================
// MAIN NODE EDITOR CONTENT
// ============================================================================

const NodeEditorContent: React.FC = () => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, deleteEdge } = useNodeGraphStore();
    const { macros, setMacroValue } = useModulationStore();
    const { init, isGraphPlaying } = useAudioStore();
    const { screenToFlowPosition } = useReactFlow();
    
    // Track when audio system is fully initialized (worklet loaded)
    const [isAudioReady, setIsAudioReady] = useState(false);

    // Initialize audio when entering graph mode (async with proper cleanup)
    useEffect(() => {
        let mounted = true;
        const initAudio = async () => {
            await init();
            if (mounted) {
                setIsAudioReady(true);
                console.log('[NodeEditor] Audio system ready');
            }
        };
        initAudio();
        return () => { mounted = false; };
    }, [init]);

    // Sync graph changes to AudioWorklet - ONLY after audio is ready
    useEffect(() => {
        if (isAudioReady) {
            console.log('[NodeEditor] Syncing graph to worklet', { nodes: nodes.length, edges: edges.length });
            GraphManager.syncGraph(nodes, edges);
        }
    }, [nodes, edges, isAudioReady]);

    // Safety net: Re-sync graph when Graph Mode playback starts
    useEffect(() => {
        if (isGraphPlaying && isAudioReady) {
            console.log('[NodeEditor] Re-syncing graph on play');
            GraphManager.syncGraph(nodes, edges);
        }
    }, [isGraphPlaying, isAudioReady, nodes, edges]);

    // Sync macro changes
    useEffect(() => {
        GraphManager.syncMacros(macros);
    }, [macros]);

    // Delete edge on click (for easy disconnection testing)
    const onEdgeClick = useCallback((_event: React.MouseEvent, edge: { id: string }) => {
        console.log('[NodeEditor] Edge clicked, deleting:', edge.id);
        deleteEdge(edge.id);
    }, [deleteEdge]);

    const onDragOver: React.DragEventHandler<HTMLDivElement> = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop: React.DragEventHandler<HTMLDivElement> = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            console.log('[NodeEditor] Drop detected, type:', type);
            
            if (!type) {
                console.log('[NodeEditor] No type found in dataTransfer');
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
            
            console.log('[NodeEditor] Adding node at position:', position);

            addNode({
                id: getId(),
                type,
                position,
                data: { label: `${type} node` },
            });
        },
        [screenToFlowPosition, addNode],
    );

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100vw',
            height: '100vh',
            background: '#07070a',
            position: 'absolute',
            top: 0,
            left: 0,
            overflow: 'hidden',
        }}>
            {/* Atmospheric Background Gradient */}
            <div 
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: `
                        radial-gradient(ellipse 80% 50% at 50% 0%, rgba(6,182,212,0.08) 0%, transparent 50%),
                        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(168,85,247,0.05) 0%, transparent 50%),
                        radial-gradient(ellipse 40% 30% at 10% 80%, rgba(245,158,11,0.03) 0%, transparent 50%)
                    `,
                    zIndex: 0,
                }}
            />

            {/* Spacer for unified header */}
            <div style={{ height: 48, flexShrink: 0 }} />

            {/* Main Canvas Container - Takes remaining space */}
            <div 
                ref={reactFlowWrapper}
                style={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    background: '#0a0a0f',
                }}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgeClick={onEdgeClick}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    defaultEdgeOptions={defaultEdgeOptions}
                    fitView
                    snapToGrid
                    snapGrid={[20, 20]}
                    colorMode="dark"
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.2}
                    maxZoom={2}
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {/* Custom Grid Background */}
                    <Background 
                        color="rgba(255,255,255,0.03)" 
                        gap={20} 
                        size={1}
                    />
                    
                    {/* Controls - Bottom Left */}
                    <Controls 
                        className="!bg-black/50 !backdrop-blur-xl !border !border-white/10 !rounded-xl !shadow-2xl 
                            [&>button]:!bg-transparent [&>button]:!border-0 [&>button]:!text-gray-500 
                            [&>button:hover]:!bg-white/10 [&>button:hover]:!text-white
                            [&>button]:!w-8 [&>button]:!h-8" 
                        position="bottom-left"
                        showInteractive={false}
                    />
                    
                    {/* MiniMap - Bottom Right */}
                    <MiniMap 
                        style={{ 
                            background: 'rgba(0,0,0,0.6)',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                        }} 
                        nodeColor={(n) => {
                            if (n.type === 'output') return '#10b981';
                            if (n.type === 'oscillator' || n.type === 'karplus') return '#06b6d4';
                            if (n.type === 'filter') return '#a855f7';
                            return '#f59e0b';
                        }}
                        maskColor="rgba(0,0,0,0.8)"
                        position="bottom-right"
                        pannable
                        zoomable
                    />

                    {/* Centered Title Overlay (shows when canvas is empty) */}
                    {nodes.length === 0 && (
                        <Panel position="top-center" className="!top-1/3">
                            <div className="text-center pointer-events-none select-none">
                                <h2 className="text-4xl font-extralight tracking-[0.5em] text-white/10 uppercase mb-4">
                                    Graph Mode
                                </h2>
                                <p className="text-sm text-white/20">
                                    Drag modules from below to start patching
                                </p>
                            </div>
                        </Panel>
                    )}
                </ReactFlow>
            </div>

            {/* Module Dock - Bottom (flex child, stays at bottom) */}
            <div style={{ flexShrink: 0, zIndex: 10, position: 'relative' }}>
                <ModuleDock />
            </div>

            {/* Macro Controls - Floating */}
            {macros.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: 64,
                    right: 16,
                    zIndex: 20,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}>
                    {macros.map(macro => (
                        <MacroKnob
                            key={macro.id}
                            label={macro.label}
                            value={macro.value}
                            onChange={(val) => setMacroValue(macro.id, val)}
                            color="#3b82f6"
                        />
                    ))}
                </div>
            )}

            {/* Vignette Overlay */}
            <div 
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 0,
                    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%)',
                }}
            />
        </div>
    );
};

// ============================================================================
// EXPORT
// ============================================================================

export const NodeEditor: React.FC = () => {
    return (
        <ReactFlowProvider>
            <NodeEditorContent />
        </ReactFlowProvider>
    );
};
