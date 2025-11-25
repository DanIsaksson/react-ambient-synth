import type { AppNode } from '../../store/nodeGraphStore';
import type { Edge } from '@xyflow/react';
import { audioCore } from './AudioCore';

export class GraphManager {
    static syncGraph(nodes: AppNode[], edges: Edge[]) {
        // Convert React Flow graph to a simplified patch format for the Worklet
        const patch = {
            nodes: nodes.map(node => ({
                id: node.id,
                type: node.type,
                params: node.data,
            })),
            connections: edges.map(edge => ({
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
            })),
        };

        // Send to AudioWorklet via AudioCore's SynthEngine
        const synth = audioCore.getSynth();
        if (synth) {
            synth.sendMessage({
                target: 'system', // Special target for graph updates
                action: 'UPDATE_GRAPH',
                payload: patch,
            });
        }
    }

    static syncMacros(macros: any[]) {
        const synth = audioCore.getSynth();
        if (synth) {
            synth.sendMessage({
                target: 'system',
                action: 'UPDATE_MACROS',
                payload: macros,
            });
        }
    }
}
