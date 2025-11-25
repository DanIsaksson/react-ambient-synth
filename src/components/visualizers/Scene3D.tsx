import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { GravityScene3D } from './scenes/GravityScene3D';

export const Scene3D: React.FC = () => {
    // We can use a simple state or ref to track the current scene name if needed for switching
    // For now, let's just render GravityScene3D as the default/only 3D scene

    return (
        <div style={{ width: '100%', height: '100%', background: '#000' }}>
            <Canvas
                dpr={[1, 2]}
                gl={{ antialias: false, toneMappingExposure: 1.5 }}
                camera={{ position: [0, 5, 10], fov: 45 }}
            >
                <color attach="background" args={['#050505']} />

                <Suspense fallback={null}>
                    <GravityScene3D />
                </Suspense>

                <EffectComposer>
                    <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
                    <Noise opacity={0.05} />
                    <Vignette eskil={false} offset={0.1} darkness={1.1} />
                </EffectComposer>
            </Canvas>
        </div>
    );
};
