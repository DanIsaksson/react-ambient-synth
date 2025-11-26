import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { BaseNode, HANDLE_PRESETS } from './BaseNode';
import { useNodeGraphStore } from '../../../store/nodeGraphStore';

interface PhysicsNodeProps {
    id: string;
    data: {
        gravity?: number;
        restitution?: number;
        friction?: number;
        [key: string]: any;
    };
    selected?: boolean;
}

export const PhysicsNode = memo(({ id, data, selected }: PhysicsNodeProps) => {
    const updateNodeData = useNodeGraphStore(state => state.updateNodeData);
    
    // Read directly from Zustand store (NOT from ReactFlow's potentially stale props)
    const gravity = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.gravity ?? 9.8);
    const restitution = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.restitution ?? 0.7);
    const friction = useNodeGraphStore(state => state.nodes.find(n => n.id === id)?.data?.friction ?? 0.1);

    // Handlers
    const handleGravityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { gravity: Number(e.target.value) });
    }, [id, updateNodeData]);

    const handleRestitutionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { restitution: Number(e.target.value) });
    }, [id, updateNodeData]);

    const handleFrictionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { friction: Number(e.target.value) });
    }, [id, updateNodeData]);
    
    // Ball animation state (local - visual only)
    const [ballY, setBallY] = useState(10);
    const velocityRef = useRef(0);
    const animRef = useRef<number | null>(null);

    // Simple physics simulation for visualization
    useEffect(() => {
        const height = 50;
        let y = 10;
        let vel = 0;
        
        const animate = () => {
            vel += gravity * 0.02; // Gravity
            vel *= (1 - friction * 0.1); // Air resistance
            y += vel;
            
            // Bounce off bottom
            if (y >= height - 5) {
                y = height - 5;
                vel *= -restitution;
            }
            
            // Bounce off top
            if (y <= 5) {
                y = 5;
                vel *= -restitution;
            }
            
            setBallY(y);
            velocityRef.current = vel;
            animRef.current = requestAnimationFrame(animate);
        };
        
        animRef.current = requestAnimationFrame(animate);
        return () => {
            if (animRef.current !== null) cancelAnimationFrame(animRef.current);
        };
    }, [gravity, restitution, friction]);

    const sliderClass = `w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500
        [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.5)]
        [&::-webkit-slider-thumb]:cursor-pointer`;

    return (
        <BaseNode 
            title="Physics" 
            type="control" 
            selected={selected}
            nodeId={id}
            nodeType="physics"
            handles={HANDLE_PRESETS.physics}
            icon="⚛️"
        >
            <div className="flex flex-col gap-4">
                {/* Physics Visualization */}
                <div className="bg-black/40 rounded-lg border border-white/5 h-[60px] relative overflow-hidden">
                    {/* Ball */}
                    <div 
                        className="absolute w-3 h-3 rounded-full bg-cyan-400 left-1/2 -translate-x-1/2 transition-none"
                        style={{ 
                            top: ballY,
                            boxShadow: `0 0 ${8 + Math.abs(velocityRef.current) * 2}px rgba(6,182,212,0.6)`,
                        }}
                    />
                    {/* Ground line */}
                    <div className="absolute bottom-1 left-2 right-2 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                </div>

                {/* Gravity Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Gravity</label>
                        <span className="text-[10px] text-cyan-400 font-mono">{gravity.toFixed(1)} m/s²</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="20"
                        step="0.1"
                        value={gravity}
                        onChange={handleGravityChange}
                        className={sliderClass}
                    />
                </div>

                {/* Bounce Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Bounce</label>
                        <span className="text-[10px] text-cyan-400 font-mono">{(restitution * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1.2"
                        step="0.05"
                        value={restitution}
                        onChange={handleRestitutionChange}
                        className={sliderClass}
                    />
                </div>

                {/* Friction Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Friction</label>
                        <span className="text-[10px] text-cyan-400 font-mono">{(friction * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={friction}
                        onChange={handleFrictionChange}
                        className={sliderClass}
                    />
                </div>
            </div>
        </BaseNode>
    );
});
