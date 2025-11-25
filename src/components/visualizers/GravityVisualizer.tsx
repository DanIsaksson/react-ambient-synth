import { ParticleSystem } from './ParticleSystem';

export const GravityVisualizer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: any,
    particleSystem: ParticleSystem,
    lastImpactTimeRef: React.MutableRefObject<number>
) => {
    const { bodies, impacts } = state;
    if (!bodies) return;

    // Scale factors
    const scaleY = height / 20;
    const floorY = height - 20; // 20px padding from bottom

    // Draw Floor (Impact Zone)
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(width, floorY);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Handle Impacts & Particles
    if (impacts) {
        let maxTime = lastImpactTimeRef.current;

        impacts.forEach((impact: any) => {
            const x = impact.x * width; // Normalized x to screen width

            // Draw Flash
            ctx.beginPath();
            ctx.arc(x, floorY, 30, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, 0.5)`;
            ctx.fill();

            // Spawn Particles if new
            if (impact.time > lastImpactTimeRef.current) {
                const color = impact.x < 0.5 ? '#646cff' : '#a78bfa'; // Earth vs Moon color
                particleSystem.emit(x, floorY, color, 20);
                if (impact.time > maxTime) maxTime = impact.time;
            }
        });

        lastImpactTimeRef.current = maxTime;
    }

    // Draw Bodies
    bodies.forEach((body: any, index: number) => {
        const x = (width / 3) * (index + 1); // Distribute horizontally
        const y = floorY - (body.y * scaleY);

        const radius = body.name === 'Earth' ? 20 : 12;
        const color = body.name === 'Earth' ? '#646cff' : '#a78bfa'; // Blue / Purple

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(body.name, x, y - radius - 10);
    });
};
