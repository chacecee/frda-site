"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

function AvatarModel() {
  const gltf = useLoader(GLTFLoader, "/models/frda-avatar/frda-avatar.gltf");
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [gltf]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={groupRef} position={[0, -1.2, 0]} scale={1.55}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function AvatarScene() {
  return (
    <Canvas
      camera={{ position: [0, 1.2, 4.6], fov: 32 }}
      dpr={[1, 1.5]}
      shadows
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#020817", 7, 13]} />

      <ambientLight intensity={1.4} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.8}
        castShadow
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.65} />
      <spotLight position={[0, 6, 2]} intensity={1.2} angle={0.35} penumbra={1} />

      <Suspense fallback={null}>
        <AvatarModel />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 2.1}
        maxPolarAngle={Math.PI / 1.9}
      />
    </Canvas>
  );
}

export default function AboutAvatar3D() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[360px] w-full md:h-[520px]" />;
  }

  return <div className="h-[360px] w-full md:h-[520px]"><AvatarScene /></div>;
}