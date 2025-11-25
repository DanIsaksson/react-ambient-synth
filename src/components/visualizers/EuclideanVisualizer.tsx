import { ParticleSystem } from './ParticleSystem';

export const EuclideanVisualizer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: any,
    particleSystem?: ParticleSystem
) => {
    const { kick, hat } = state;
    if (!kick || !hat) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 20;

    // Draw Kick Ring (Outer)
    drawRhythmRing(ctx, centerX, centerY, maxRadius, kick, '#646cff', particleSystem);

    // Draw Hat Ring (Inner)
    drawRhythmRing(ctx, centerX, centerY, maxRadius * 0.7, hat, '#a78bfa', particleSystem);
};

const drawRhythmRing = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    gen: any,
    color: string,
    particleSystem?: ParticleSystem
) => {
    const { steps, pattern, currentStep } = gen;
    const anglePerStep = (Math.PI * 2) / steps;

    // Draw Ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Steps
    for (let i = 0; i < steps; i++) {
        const angle = i * anglePerStep - (Math.PI / 2); // Start at top
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;

        const isPulse = pattern[i] === 1;
        const isActive = i === currentStep;

        ctx.beginPath();
        const dotRadius = isActive ? 8 : (isPulse ? 5 : 3);
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);

        if (isActive) {
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';

            // Spawn particles if active and it's a pulse
            if (isPulse && particleSystem) {
                // We need a way to only spawn once per step.
                // Since this runs every frame, we'll spawn a lot if we're not careful.
                // But currentStep changes only on tick.
                // We can just spawn a few particles every frame while active?
                // Or maybe just a small chance?
                if (Math.random() < 0.3) {
                    particleSystem.emit(x, y, color, 2);
                }
            }

        } else if (isPulse) {
            ctx.fillStyle = color;
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = '#444';
            ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0;
    }
};
