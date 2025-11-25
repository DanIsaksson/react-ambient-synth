export const ChaosVisualizer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number,
    state: any
) => {
    const { x, y, z } = state;
    if (x === undefined || y === undefined) return;

    // Render in top-right corner
    const size = 100;
    const padding = 10;
    const left = width - size - padding;
    const top = padding;

    // Background for the scope
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(left, top, size, size);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(left, top, size, size);

    // Map Lorenz coordinates to box
    // x: -20 to 20 -> 0 to size
    // z: 0 to 50 -> size to 0 (y-axis inverted)

    const scaleX = size / 40;
    const scaleY = size / 60;

    const px = left + (x + 20) * scaleX;
    const py = top + size - (z * scaleY);

    // Draw Point
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff00'; // Matrix green
    ctx.fill();

    // Label
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.fillText('LORENZ', left + 5, top + 12);

    // Values
    ctx.fillText(`X: ${x.toFixed(1)}`, left + 5, top + size - 25);
    ctx.fillText(`Z: ${z.toFixed(1)}`, left + 5, top + size - 15);
};
