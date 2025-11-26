import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { GravityScene3D } from './scenes/GravityScene3D';

interface Scene3DProps {
    /**
     * When true, pauses the render loop to save GPU cycles.
     * Use when the 3D scene is hidden behind opaque UI (e.g., Graph Mode).
     */
    paused?: boolean;
}

export const Scene3D: React.FC<Scene3DProps> = ({ paused = false }) => {
    // We can use a simple state or ref to track the current scene name if needed for switching
    // For now, let's just render GravityScene3D as the default/only 3D scene

    return (
        <div style={{ width: '100%', height: '100%', background: '#000' }}>
            <Canvas
                // PERF: 'demand' stops the render loop entirely when paused
                // This saves significant GPU cycles when Graph Mode is active
                frameloop={paused ? 'demand' : 'always'}
                // PERF: Reduce DPR when paused (though frameloop handles most savings)
                dpr={paused ? [1, 1] : [1, 2]}
                gl={{ antialias: false, toneMappingExposure: 1.5 }}
                camera={{ position: [0, 5, 10], fov: 45 }}
            >
                <color attach="background" args={['#050505']} />

                <Suspense fallback={null}>
                    <GravityScene3D />
                </Suspense>

                {/* PERF: Only render post-processing when visible */}
                {!paused && (
                    <EffectComposer>
                        {/* PERF: Reduced bloom intensity from 1.5 to 1.0 */}
                        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.0} radius={0.4} />
                        <Noise opacity={0.05} />
                        <Vignette eskil={false} offset={0.1} darkness={1.1} />
                    </EffectComposer>
                )}
            </Canvas>
        </div>
    );
};
