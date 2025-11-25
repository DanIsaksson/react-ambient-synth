import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial, Sphere } from '@react-three/drei';
import { audioCore } from '../../../audio/engine/AudioCore';
import * as THREE from 'three';

export const GravityScene3D: React.FC = () => {
    const earthRef = useRef<THREE.Mesh>(null);
    const moonRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        const atmosphere = audioCore.getAtmosphere();
        const scene = atmosphere?.getCurrentScene();
        if (scene && scene.name === "Gravity Phasing" && scene.getVisualState) {
            const visualState = scene.getVisualState();
            const { bodies, impacts } = visualState;

            if (bodies) {
                // Update Earth
                if (earthRef.current) {
                    // Map 2D y (0-100) to 3D y (0-10)
                    earthRef.current.position.y = bodies[0].y / 10;
                    // Map 2D x (0.33 * width) to 3D x (-2)
                    earthRef.current.position.x = -2;
                }

                // Update Moon
                if (moonRef.current) {
                    moonRef.current.position.y = bodies[1].y / 10;
                    moonRef.current.position.x = 2;
                }
            }

            // Simple impact flash logic (could be improved with uniforms)
            if (impacts && impacts.length > 0) {
                // const lastImpact = impacts[impacts.length - 1];
                // Impact logic placeholder
            }
        }
    });

    return (
        <>
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={1.0} />
            <pointLight position={[-10, 10, -10]} intensity={0.5} color="blue" />

            {/* Earth */}
            <Sphere ref={earthRef} args={[0.8, 32, 32]} position={[-2, 5, 0]}>
                <meshStandardMaterial
                    color="#44aaff"
                    emissive="#112244"
                    emissiveIntensity={0.5}
                    roughness={0.1}
                    metalness={0.8}
                />
            </Sphere>

            {/* Moon */}
            <Sphere ref={moonRef} args={[0.5, 32, 32]} position={[2, 5, 0]}>
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#333333"
                    emissiveIntensity={0.5}
                    roughness={0.2}
                    metalness={0.5}
                />
            </Sphere>

            {/* Reflective Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
                <planeGeometry args={[50, 50]} />
                <MeshReflectorMaterial
                    blur={[300, 100]}
                    resolution={1024}
                    mixBlur={1}
                    mixStrength={40}
                    roughness={1}
                    depthScale={1.2}
                    minDepthThreshold={0.4}
                    maxDepthThreshold={1.4}
                    color="#101010"
                    metalness={0.5}
                    mirror={0} // Fix for type error in older versions, usually 0-1
                />
            </mesh>
        </>
    );
};
