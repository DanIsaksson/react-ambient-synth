import type { AppNode } from '../../store/nodeGraphStore';
import type { Edge } from '@xyflow/react';
import { audioCore } from './AudioCore';

// Extended edge data for modulation connections
interface ModulationEdgeData {
    isModulation?: boolean;
    amount?: number;
    bipolar?: boolean;
}

export class GraphManager {
    static syncGraph(nodes: AppNode[], edges: Edge[]) {
        // Validate: Create set of valid node IDs
        const nodeIds = new Set(nodes.map(n => n.id));
        
        // Filter out invalid connections (where source or target doesn't exist)
        const validEdges = edges.filter(edge => {
            const valid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
            if (!valid) {
                console.warn('[GraphManager] Dropping invalid edge:', {
                    source: edge.source,
                    target: edge.target,
                    sourceExists: nodeIds.has(edge.source),
                    targetExists: nodeIds.has(edge.target),
                });
            }
            return valid;
        });
        
        // Separate audio connections from modulation connections
        // Modulation edges have targetHandle starting with 'mod-' or data.isModulation=true
        const audioEdges = validEdges.filter(edge => {
            const data = edge.data as ModulationEdgeData | undefined;
            const isModulation = data?.isModulation || edge.targetHandle?.startsWith('mod-');
            return !isModulation;
        });
        
        const modulationEdges = validEdges.filter(edge => {
            const data = edge.data as ModulationEdgeData | undefined;
            return data?.isModulation || edge.targetHandle?.startsWith('mod-');
        });
        
        // Convert React Flow graph to a simplified patch format for the Worklet
        const patch = {
            nodes: nodes.map(node => ({
                id: node.id,
                type: node.type,
                params: node.data,
            })),
            // Audio connections (signal flow)
            connections: audioEdges.map(edge => ({
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
            })),
            // Modulation connections (control -> parameter)
            modulations: modulationEdges.map(edge => {
                const data = edge.data as ModulationEdgeData | undefined;
                // Extract parameter name from targetHandle (e.g., 'mod-freq' -> 'freq')
                const targetParam = edge.targetHandle?.replace('mod-', '') || '';
                return {
                    sourceId: edge.source,
                    targetId: edge.target,
                    targetParam,
                    amount: data?.amount ?? 0.5,
                    bipolar: data?.bipolar ?? true,
                };
            }),
        };

        // Send to AudioWorklet via AudioCore's SynthEngine
        const synth = audioCore.getSynth();
        if (synth) {
            synth.sendMessage({
                target: 'system', // Special target for graph updates
                action: 'UPDATE_GRAPH',
                payload: patch,
            });
            
            // Log modulation connections for debugging
            if (patch.modulations.length > 0) {
                console.log('[GraphManager] Modulations sent to worklet:', patch.modulations);
            }
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
