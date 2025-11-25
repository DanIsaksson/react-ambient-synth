import React, { useState, useEffect, useRef } from 'react';

interface MacroKnobProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    color?: string;
}

export const MacroKnob: React.FC<MacroKnobProps> = ({ label, value, onChange, color = '#3b82f6' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef<number>(0);
    const startValue = useRef<number>(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        startY.current = e.clientY;
        startValue.current = value;
        document.body.style.cursor = 'ns-resize';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const deltaY = startY.current - e.clientY;
            const newValue = Math.min(1, Math.max(0, startValue.current + deltaY * 0.005));
            onChange(newValue);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onChange]);

    // Calculate rotation (-135deg to 135deg)
    const rotation = -135 + value * 270;

    return (
        <div className="flex flex-col items-center gap-2 select-none">
            <div
                className="relative w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 cursor-ns-resize shadow-lg group hover:border-gray-500 transition-colors"
                onMouseDown={handleMouseDown}
            >
                {/* Indicator */}
                <div
                    className="absolute w-full h-full rounded-full"
                    style={{ transform: `rotate(${rotation}deg)` }}
                >
                    <div
                        className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-3 rounded-full shadow-[0_0_10px_currentColor]"
                        style={{ backgroundColor: color, color: color }}
                    />
                </div>

                {/* Center Cap */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-[10px] font-mono text-gray-400">{(value * 100).toFixed(0)}%</span>
                </div>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-300 transition-colors">{label}</span>
        </div>
    );
};
