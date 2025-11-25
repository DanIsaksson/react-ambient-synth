import React, { useEffect, useRef } from 'react';
import { audioCore } from '../../audio/engine/AudioCore';
import { GravityVisualizer } from './GravityVisualizer';
import { EuclideanVisualizer } from './EuclideanVisualizer';
import { ChaosVisualizer } from './ChaosVisualizer';
import { ParticleSystem } from './ParticleSystem';

export const VisualizerContainer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>(0);
    const particleSystem = useRef(new ParticleSystem());
    const lastImpactTime = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            // Clear canvas
            // Clear canvas with fade effect for trails
            ctx.fillStyle = 'rgba(18, 18, 18, 0.2)'; // Adjust opacity for trail length
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Add Bloom Effect
            ctx.globalCompositeOperation = 'lighter';

            // 1. Render Scene Visuals
            const atmosphere = audioCore.getAtmosphere();
            if (atmosphere) {
                const scene = atmosphere.getCurrentScene();
                if (scene && scene.getVisualState) {
                    const state = scene.getVisualState();

                    if (scene.name === "Gravity Phasing") {
                        GravityVisualizer(ctx, canvas.width, canvas.height, state, particleSystem.current, lastImpactTime);
                    } else if (scene.name === "Euclidean Groove") {
                        EuclideanVisualizer(ctx, canvas.width, canvas.height, state, particleSystem.current);
                    }
                }

                // 2. Render Module Visuals (Overlay)
                // We use getLorenzState directly from AtmosphereEngine
                const chaosState = atmosphere.getLorenzState();
                if (chaosState) {
                    ChaosVisualizer(ctx, canvas.width, canvas.height, chaosState);
                }
            }

            // 3. Render Particles
            particleSystem.current.update();
            particleSystem.current.draw(ctx);

            // Reset composite operation
            ctx.globalCompositeOperation = 'source-over';

            animationFrameRef.current = requestAnimationFrame(render);
        };

        // Handle Resize
        const handleResize = () => {
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial size

        render();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="visualizer-container" style={{
            width: '100%',
            height: '300px',
            backgroundColor: '#111',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '2rem',
            border: '1px solid #333'
        }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};
