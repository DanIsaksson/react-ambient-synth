/**
 * MacroKnob - Legacy wrapper around NeonKnob for backwards compatibility.
 * 
 * @deprecated Use NeonKnob directly for new code.
 */

import React from 'react';
import { NeonKnob } from './NeonKnob';

// Map legacy color strings to NeonKnob color theme
const colorMap: Record<string, 'green' | 'cyan' | 'purple' | 'orange' | 'red'> = {
    '#3b82f6': 'cyan',      // Blue -> Cyan
    '#00ff88': 'green',
    '#00ccff': 'cyan',
    '#a855f7': 'purple',
    '#ff8800': 'orange',
    '#ff0055': 'red',
};

interface MacroKnobProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    color?: string;
}

export const MacroKnob: React.FC<MacroKnobProps> = ({ 
    label, 
    value, 
    onChange, 
    color = '#3b82f6' 
}) => {
    // Map legacy color to NeonKnob theme
    const neonColor = colorMap[color] || 'cyan';

    return (
        <NeonKnob
            value={value}
            onChange={onChange}
            label={label}
            color={neonColor}
            size={64}
            min={0}
            max={100}
            unit="%"
        />
    );
};
