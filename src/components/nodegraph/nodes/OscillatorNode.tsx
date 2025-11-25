import { memo, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

interface OscillatorNodeProps {
    id: string;
    data: {
        freq?: number;
        waveform?: string;
        [key: string]: any;
    };
    selected?: boolean;
}

export const OscillatorNode = memo(({ id, data, selected }: OscillatorNodeProps) => {
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
    // This ensures the slider always reflects the latest committed value
    const freq = useNodeGraphStore(state => {
        const node = state.nodes.find(n => n.id === id);
        return node?.data?.freq ?? 440;
    });
    const waveform = useNodeGraphStore(state => {
        const node = state.nodes.find(n => n.id === id);
        return node?.data?.waveform ?? 'sine';
    });

    // Handler updates store directly - no local state needed
    const handleFreqChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { freq: Number(e.target.value) });
    }, [id, updateNodeData]);

    const handleWaveformChange = useCallback((wave: string) => {
        updateNodeData(id, { waveform: wave });
    }, [id, updateNodeData]);

    return (
        <BaseNode 
            title="Oscillator" 
            type="source" 
            selected={selected}
            nodeId={id}
            handles={HANDLE_PRESETS.sourceOnly}
            icon="〰️"
        >
            <div className="flex flex-col gap-4">
                {/* Frequency Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Frequency</label>
                        <span className="text-[10px] text-cyan-400 font-mono">{freq} Hz</span>
                    </div>
                    <input
                        type="range"
                        min="20"
                        max="2000"
                        value={freq}
                        onChange={handleFreqChange}
                        className="nodrag nopan w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500
                            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.5)]
                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all
                            [&::-webkit-slider-thumb]:hover:scale-125"
                    />
                </div>

                {/* Waveform Select */}
                <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Waveform</label>
                    <div className="grid grid-cols-4 gap-1">
                        {['sine', 'square', 'sawtooth', 'triangle'].map((wave) => (
                            <button
                                key={wave}
                                onClick={() => handleWaveformChange(wave)}
                                style={{
                                    padding: '6px 8px',
                                    fontSize: 9,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    borderRadius: 6,
                                    border: waveform === wave 
                                        ? '1px solid rgb(6,182,212)' 
                                        : '1px solid rgba(255,255,255,0.1)',
                                    background: waveform === wave 
                                        ? 'rgba(6,182,212,0.15)' 
                                        : 'rgba(0,0,0,0.3)',
                                    color: waveform === wave 
                                        ? 'rgb(6,182,212)' 
                                        : 'rgba(255,255,255,0.4)',
                                    boxShadow: waveform === wave 
                                        ? '0 0 12px rgba(6,182,212,0.3), inset 0 0 8px rgba(6,182,212,0.1)' 
                                        : 'none',
                                    transition: 'all 150ms ease',
                                    cursor: 'pointer',
                                }}
                            >
                                {wave.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});
