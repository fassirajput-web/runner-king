
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, GEMINI_COLORS } from '../../types';
import { audio } from '../System/Audio';

const OBSTACLE_HEIGHT = 1.6;
const OBSTACLE_GEOMETRY = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_GLOW_GEO = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_RING_GEO = new THREE.RingGeometry(0.6, 0.9, 6);
const GEM_GEOMETRY = new THREE.IcosahedronGeometry(0.3, 0);
const ALIEN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_DOME_GEO = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI/2);
const ALIEN_EYE_GEO = new THREE.SphereGeometry(0.1);
const MISSILE_CORE_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
const MISSILE_RING_GEO = new THREE.TorusGeometry(0.15, 0.02, 16, 32);
const SHADOW_LETTER_GEO = new THREE.PlaneGeometry(2, 0.6);
const SHADOW_GEM_GEO = new THREE.CircleGeometry(0.6, 32);
const SHADOW_ALIEN_GEO = new THREE.CircleGeometry(0.8, 32);
const SHADOW_MISSILE_GEO = new THREE.PlaneGeometry(0.15, 3);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 7, 1);
const SHOP_BACK_GEO = new THREE.BoxGeometry(1, 5, 1.2);
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.2, 0.8);
const SHOP_FLOOR_GEO = new THREE.PlaneGeometry(1, 4);

const PARTICLE_COUNT = 600;
const BASE_LETTER_INTERVAL = 140; 

const getLetterInterval = (level: number) => {
    // Slower interval growth to keep the word achievable in high levels
    return BASE_LETTER_INTERVAL * (1 + (level - 1) * 0.1);
};

const MISSILE_SPEED = 30;
const FONT_URL = "https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json";

const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color()
    })), []);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color } = e.detail;
            let spawned = 0;
            const burstAmount = 40; 
            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = 2 + Math.random() * 10;
                    p.vel.set(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)).multiplyScalar(speed);
                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    p.color.set(color);
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);
        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * 1.5;
                p.pos.addScaledVector(p.vel, safeDelta);
                p.vel.y -= safeDelta * 5; 
                p.vel.multiplyScalar(0.98);
                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                dummy.position.copy(p.pos);
                const scale = Math.max(0, p.life * 0.25);
                dummy.scale.set(scale, scale, scale);
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
    );
};

const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const { status, speed, collectGem, collectLetter, collectedLetters, laneCount, setDistance, openShop, level } = useStore();
  const objectsRef = useRef<GameObject[]>([]);
  const [, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  const prevLevel = useRef(level);
  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDistance = useRef(BASE_LETTER_INTERVAL);

  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && (prevStatus.current === GameStatus.GAME_OVER || prevStatus.current === GameStatus.VICTORY);
    const isMenuReset = status === GameStatus.MENU;
    const isLevelUp = level !== prevLevel.current && status === GameStatus.PLAYING;

    if (isMenuReset || isRestart) {
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        distanceTraveled.current = 0;
        nextLetterDistance.current = getLetterInterval(1);
    } else if (isLevelUp) {
        objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);
        objectsRef.current.push({ id: uuidv4(), type: ObjectType.SHOP_PORTAL, position: [0, 0, -100], active: true });
        nextLetterDistance.current = distanceTraveled.current + getLetterInterval(level);
        setRenderTrigger(t => t + 1);
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
        setDistance(Math.floor(distanceTraveled.current));
    }
    prevStatus.current = status;
    prevLevel.current = level;
  }, [status, level, setDistance]);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) playerObjRef.current = group.children[0];
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;
    const safeDelta = Math.min(delta, 0.05); 
    const dist = speed * safeDelta;
    distanceTraveled.current += dist;
    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    if (playerObjRef.current) playerObjRef.current.getWorldPosition(playerPos);

    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];
    for (const obj of objectsRef.current) {
        let moveAmount = dist;
        if (obj.type === ObjectType.MISSILE) moveAmount += MISSILE_SPEED * safeDelta;
        const prevZ = obj.position[2];
        obj.position[2] += moveAmount;
        
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 newSpawns.push({ id: uuidv4(), type: ObjectType.MISSILE, position: [obj.position[0], 1.0, obj.position[2] + 2], active: true, color: '#ff0000' });
                 window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#ff00ff' } }));
                 hasChanges = true;
             }
        }

        let keep = true;
        if (obj.active) {
            const zThreshold = 2.0; 
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);
            if (obj.type === ObjectType.SHOP_PORTAL) {
                if (Math.abs(obj.position[2] - playerPos.z) < 2) { 
                     openShop();
                     obj.active = false;
                     hasChanges = true;
                     keep = false; 
                }
            } else if (inZZone) {
                const dx = Math.abs(obj.position[0] - playerPos.x);
                if (dx < 0.9) {
                     const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;
                     if (isDamageSource) {
                         const playerBottom = playerPos.y;
                         const playerTop = playerPos.y + 1.8;
                         let objBottom = obj.position[1] - 0.5;
                         let objTop = obj.position[1] + 0.5;
                         if (obj.type === ObjectType.OBSTACLE) { objBottom = 0; objTop = OBSTACLE_HEIGHT; }
                         else if (obj.type === ObjectType.MISSILE) { objBottom = 0.5; objTop = 1.5; }

                         if (playerBottom < objTop && playerTop > objBottom) { 
                             window.dispatchEvent(new Event('player-hit'));
                             obj.active = false; 
                             hasChanges = true;
                             if (obj.type === ObjectType.MISSILE) {
                                window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#ff4400' } }));
                             }
                         }
                     } else {
                         if (Math.abs(obj.position[1] - playerPos.y) < 2.5) {
                            if (obj.type === ObjectType.GEM) { collectGem(obj.points || 50); audio.playGemCollect(); }
                            if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) { collectLetter(obj.targetIndex); audio.playLetterCollect(); }
                            window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: obj.color || '#ffffff' } }));
                            obj.active = false;
                            hasChanges = true;
                         }
                     }
                }
            }
        }
        if (obj.position[2] > REMOVE_DISTANCE) { keep = false; hasChanges = true; }
        if (keep) keptObjects.push(obj);
    }

    if (newSpawns.length > 0) keptObjects.push(...newSpawns);

    let furthestZ = 0;
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE);
    if (staticObjects.length > 0) furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    else furthestZ = -20;

    if (furthestZ > -SPAWN_DISTANCE) {
         // Gap closes as level increases
         const minGap = Math.max(8, 14 - (level * 0.05)); 
         const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
         const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

         if (isLetterDue) {
             const lane = getRandomLane(laneCount);
             const target = ['R','U','N','N','E','R'];
             const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));
             if (availableIndices.length > 0) {
                 const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                 const val = target[chosenIndex];
                 const color = GEMINI_COLORS[chosenIndex % GEMINI_COLORS.length];
                 keptObjects.push({ id: uuidv4(), type: ObjectType.LETTER, position: [lane * LANE_WIDTH, 1.0, spawnZ], active: true, color, value: val, targetIndex: chosenIndex });
                 nextLetterDistance.current += getLetterInterval(level);
                 hasChanges = true;
             }
         } else if (Math.random() > 0.1) {
            // Difficulty scaling: Aliens and Triple Spikes become more common with level
            const alienChance = Math.min(0.6, 0.1 + (level * 0.005));
            const isObstacle = Math.random() > 0.25;

            if (isObstacle) {
                const spawnAlien = level >= 2 && Math.random() < alienChance;
                if (spawnAlien) {
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);
                    let alienCount = 1 + Math.floor(Math.random() * Math.min(3, Math.floor(level/15) + 1));
                    alienCount = Math.min(alienCount, availableLanes.length);
                    for (let k = 0; k < alienCount; k++) {
                        keptObjects.push({ id: uuidv4(), type: ObjectType.ALIEN, position: [availableLanes[k] * LANE_WIDTH, 1.5, spawnZ], active: true, color: '#00ff00', hasFired: false });
                    }
                } else {
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);
                    const tripleSpikeThreshold = Math.max(0.5, 0.9 - (level * 0.005));
                    let countToSpawn = 1;
                    const p = Math.random();
                    if (p > tripleSpikeThreshold) countToSpawn = Math.min(3, availableLanes.length);
                    else if (p > 0.4) countToSpawn = Math.min(2, availableLanes.length);
                    for (let i = 0; i < countToSpawn; i++) {
                        const laneX = availableLanes[i] * LANE_WIDTH;
                        keptObjects.push({ id: uuidv4(), type: ObjectType.OBSTACLE, position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ], active: true, color: '#ff0054' });
                        if (Math.random() < 0.3) keptObjects.push({ id: uuidv4(), type: ObjectType.GEM, position: [laneX, OBSTACLE_HEIGHT + 1.0, spawnZ], active: true, color: '#ffd700', points: 100 });
                    }
                }
            } else {
                const lane = getRandomLane(laneCount);
                keptObjects.push({ id: uuidv4(), type: ObjectType.GEM, position: [lane * LANE_WIDTH, 1.2, spawnZ], active: true, color: '#00ffff', points: 50 });
            }
            hasChanges = true;
         }
    }
    if (hasChanges) { objectsRef.current = keptObjects; setRenderTrigger(t => t + 1); }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => obj.active ? <GameEntity key={obj.id} data={obj} /> : null)}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const shadowRef = useRef<THREE.Mesh>(null);
    const { laneCount } = useStore();
    
    useFrame((state, delta) => {
        if (groupRef.current) groupRef.current.position.set(data.position[0], 0, data.position[2]);
        if (visualRef.current) {
            const baseHeight = data.position[1];
            if (data.type === ObjectType.SHOP_PORTAL) visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.02);
            else if (data.type === ObjectType.MISSILE) { visualRef.current.rotation.z += delta * 20; visualRef.current.position.y = baseHeight; }
            else if (data.type === ObjectType.ALIEN) { visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2; visualRef.current.rotation.y += delta; }
            else if (data.type !== ObjectType.OBSTACLE) {
                visualRef.current.rotation.y += delta * 3;
                const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
                visualRef.current.position.y = baseHeight + bobOffset;
                if (shadowRef.current) shadowRef.current.scale.setScalar(1 - bobOffset);
            } else visualRef.current.position.y = baseHeight;
        }
    });

    const shadowGeo = useMemo(() => {
        if (data.type === ObjectType.LETTER) return SHADOW_LETTER_GEO;
        if (data.type === ObjectType.GEM) return SHADOW_GEM_GEO;
        if (data.type === ObjectType.ALIEN) return SHADOW_ALIEN_GEO;
        if (data.type === ObjectType.MISSILE) return SHADOW_MISSILE_GEO;
        return SHADOW_DEFAULT_GEO; 
    }, [data.type]);

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {data.type !== ObjectType.SHOP_PORTAL && shadowGeo && (
                <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
                    <meshBasicMaterial color="#000000" opacity={0.3} transparent />
                </mesh>
            )}
            <group ref={visualRef} position={[0, data.position[1], 0]}>
                {data.type === ObjectType.SHOP_PORTAL && (
                    <group>
                         <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2, 1, 1]}><meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} /></mesh>
                         <mesh position={[0, 2, 0]} geometry={SHOP_BACK_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}><meshBasicMaterial color="#000000" /></mesh>
                         <mesh position={[0, 3, 0]} geometry={SHOP_OUTLINE_GEO} scale={[laneCount * LANE_WIDTH + 2.2, 1, 1]}><meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.3} /></mesh>
                         <Center position={[0, 5, 0.6]}><Text3D font={FONT_URL} size={1.2} height={0.2}>CYBER SHOP<meshBasicMaterial color="#ffff00" /></Text3D></Center>
                         <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHOP_FLOOR_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}><meshBasicMaterial color="#00ffff" transparent opacity={0.3} /></mesh>
                    </group>
                )}
                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        <mesh geometry={OBSTACLE_GEOMETRY} castShadow receiveShadow><meshStandardMaterial color="#330011" roughness={0.3} metalness={0.8} flatShading={true}/></mesh>
                        <mesh scale={[1.02, 1.02, 1.02]} geometry={OBSTACLE_GLOW_GEO}><meshBasicMaterial color={data.color} wireframe transparent opacity={0.3} /></mesh>
                         <mesh position={[0, -OBSTACLE_HEIGHT/2 + 0.05, 0]} rotation={[-Math.PI/2,0,0]} geometry={OBSTACLE_RING_GEO}><meshBasicMaterial color={data.color} transparent opacity={0.4} side={THREE.DoubleSide} /></mesh>
                    </group>
                )}
                {data.type === ObjectType.ALIEN && (
                    <group>
                        <mesh castShadow geometry={ALIEN_BODY_GEO}><meshStandardMaterial color="#4400cc" metalness={0.8} roughness={0.2} /></mesh>
                        <mesh position={[0, 0.2, 0]} geometry={ALIEN_DOME_GEO}><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} transparent opacity={0.8} /></mesh>
                        <mesh position={[0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}><meshBasicMaterial color="#ff00ff" /></mesh>
                        <mesh position={[-0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}><meshBasicMaterial color="#ff00ff" /></mesh>
                    </group>
                )}
                {data.type === ObjectType.MISSILE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                        <mesh geometry={MISSILE_CORE_GEO}><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} /></mesh>
                        <mesh position={[0, 1.0, 0]} geometry={MISSILE_RING_GEO}><meshBasicMaterial color="#ffff00" /></mesh>
                        <mesh position={[0, 0, 0]} geometry={MISSILE_RING_GEO}><meshBasicMaterial color="#ffff00" /></mesh>
                        <mesh position={[0, -1.0, 0]} geometry={MISSILE_RING_GEO}><meshBasicMaterial color="#ffff00" /></mesh>
                    </group>
                )}
                {data.type === ObjectType.GEM && (
                    <mesh castShadow geometry={GEM_GEOMETRY}><meshStandardMaterial color={data.color} roughness={0} metalness={1} emissive={data.color} emissiveIntensity={2} /></mesh>
                )}
                {data.type === ObjectType.LETTER && (
                    <group scale={[1.5, 1.5, 1.5]}>
                         <Center><Text3D font={FONT_URL} size={0.8} height={0.5} bevelEnabled bevelThickness={0.02} bevelSize={0.02} bevelSegments={5}>{data.value}<meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.5} /></Text3D></Center>
                    </group>
                )}
            </group>
        </group>
    );
});
