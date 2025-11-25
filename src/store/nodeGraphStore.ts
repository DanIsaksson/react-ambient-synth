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

interface NodeGraphState {
    nodes: AppNode[];
    edges: Edge[];
    onNodesChange: OnNodesChange<AppNode>;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    addNode: (node: AppNode) => void;
}

export const useNodeGraphStore = create<NodeGraphState>((set, get) => ({
    nodes: [
        { id: 'osc-1', type: 'oscillator', position: { x: 100, y: 100 }, data: { label: 'Oscillator 1' } },
        { id: 'out-1', type: 'output', position: { x: 400, y: 100 }, data: { label: 'Output' } },
    ],
    edges: [],
    onNodesChange: (changes: NodeChange<AppNode>[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
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
        set({ nodes: [...get().nodes, node] });
    }
}));
