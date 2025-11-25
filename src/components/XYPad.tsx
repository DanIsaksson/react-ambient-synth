import React, { useRef, useEffect, useState } from 'react';

interface XYPadProps {
    x: number; // -1 to 1
    y: number; // 0 to 1
    onChange: (x: number, y: number) => void;
    isAuto: boolean;
}

export const XYPad: React.FC<XYPadProps> = ({ x, y, onChange, isAuto }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Draw loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            // Grid
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
            ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
            ctx.stroke();

            // Point
            // Map x (-1..1) to (0..w)
            // Map y (0..1) to (h..0) (inverted because 1 is high freq/top)
            const px = ((x + 1) / 2) * w;
            const py = (1 - y) * h;

            ctx.fillStyle = isAuto ? '#03dac6' : '#bb86fc';
            ctx.shadowBlur = 15;
            ctx.shadowColor = ctx.fillStyle;

            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fill();

            // Trails or pulse if auto?
            if (isAuto) {
                ctx.beginPath();
                ctx.strokeStyle = ctx.fillStyle;
                ctx.lineWidth = 2;
                ctx.arc(px, py, 12 + Math.sin(Date.now() / 200) * 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        };

        const anim = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(anim);
    }, [x, y, isAuto]);

    const handlePointer = (e: React.PointerEvent) => {
        if (isAuto) return; // Disable manual control if auto is on? Or allow override?
        // Let's allow override but maybe it fights the LFO. 
        // For now, disable dragging if auto is on.

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const cx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const cy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        // Map back to props
        // cx (0..1) -> x (-1..1)
        // cy (0..1) -> y (1..0)
        const newX = cx * 2 - 1;
        const newY = 1 - cy;

        onChange(newX, newY);
    };

    return (
        <canvas
            ref={canvasRef}
            width={300}
            height={200}
            className="xy-pad"
            onPointerDown={(e) => {
                if (!isAuto) {
                    setIsDragging(true);
                    canvasRef.current?.setPointerCapture(e.pointerId);
                    handlePointer(e);
                }
            }}
            onPointerMove={(e) => {
                if (isDragging && !isAuto) handlePointer(e);
            }}
            onPointerUp={(e) => {
                setIsDragging(false);
                canvasRef.current?.releasePointerCapture(e.pointerId);
            }}
            style={{
                background: '#1e1e1e',
                borderRadius: '10px',
                border: '1px solid #333',
                cursor: isAuto ? 'not-allowed' : 'crosshair',
                touchAction: 'none'
            }}
        />
    );
};
