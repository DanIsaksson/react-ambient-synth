import { create } from 'zustand';
import {
    type Connection,
    type Edge,
    type EdgeChange,
    type Node,
    type NodeChange,
    addEdge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';

export type NodeData = {
    label: string;
    [key: string]: any;
};

export type AppNode = Node<NodeData>;

// Edge data type for modulation connections
export interface ModulationEdgeData {
    isModulation?: boolean;
    amount?: number;
    bipolar?: boolean;
}

interface NodeGraphState {
    nodes: AppNode[];
    edges: Edge[];
    onNodesChange: OnNodesChange<AppNode>;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    addNode: (node: AppNode) => void;
    deleteNode: (nodeId: string) => void;
    deleteEdge: (edgeId: string) => void;
    updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
    updateEdgeData: (edgeId: string, data: Partial<ModulationEdgeData>) => void;
}

export const useNodeGraphStore = create<NodeGraphState>((set, get) => ({
    nodes: [
        { id: 'osc-1', type: 'oscillator', position: { x: 100, y: 100 }, data: { label: 'Oscillator 1', freq: 220, waveform: 'sine' } },
        { id: 'out-1', type: 'output', position: { x: 400, y: 100 }, data: { label: 'Output' } },
    ],
    edges: [
        { id: 'e-default', source: 'osc-1', target: 'out-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
    onNodesChange: (changes: NodeChange<AppNode>[]) => {
        // Protect our node data from being overwritten by ReactFlow's stale references
        // ReactFlow can send 'replace' changes with outdated data
        const safeChanges = changes.map(change => {
            if (change.type === 'replace' && 'item' in change && change.item) {
                const existingNode = get().nodes.find(n => n.id === change.id);
                if (existingNode) {
                    return {
                        ...change,
                        item: {
                            ...change.item,
                            data: existingNode.data, // Preserve our data!
                        },
                    };
                }
            }
            return change;
        });
        set({
            nodes: applyNodeChanges(safeChanges, get().nodes),
        });
    },
    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },
    onConnect: (connection: Connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
    },
    addNode: (node: AppNode) => {
        set((state) => ({ nodes: [...state.nodes, node] }));
    },
    deleteNode: (nodeId: string) => {
        set((state) => ({
            nodes: state.nodes.filter(n => n.id !== nodeId),
            // Also remove edges connected to this node
            edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        }));
    },
    deleteEdge: (edgeId: string) => {
        set((state) => ({ edges: state.edges.filter(e => e.id !== edgeId) }));
    },
    updateNodeData: (nodeId: string, newData: Partial<NodeData>) => {
        // Use callback form of set() to ensure we have latest state
        // Using get().nodes can return stale data during rapid updates
        set((state) => ({
            nodes: state.nodes.map(node => 
                node.id === nodeId 
                    ? { ...node, data: { ...node.data, ...newData } }
                    : node
            ),
        }));
    },
    updateEdgeData: (edgeId: string, newData: Partial<ModulationEdgeData>) => {
        set((state) => ({
            edges: state.edges.map(edge =>
                edge.id === edgeId
                    ? { ...edge, data: { ...edge.data, ...newData } }
                    : edge
            ),
        }));
    },
}));
