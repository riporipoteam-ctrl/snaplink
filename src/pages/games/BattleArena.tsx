import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { doc, setDoc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';
import { Heart, Swords, Shield, Zap, RotateCcw, Trophy, Skull } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createHumanoid, animateHumanoid, generateAvatarConfig, disposeHumanoid,
  createRenderer, updateThirdPersonCamera,
  createInputState, getMovementFromInput, getAnimState,
  updatePhysics, createSkybox, setupLighting,
  type HumanoidParts, type InputState, type PhysicsBody, type TrackedPlayer, type PlayerState,
} from './shared';

const ARENA_SIZE = 60;
const MAX_HP = 100;
const ATTACK_DAMAGE = 15;
const ATTACK_COOLDOWN = 0.6;
const ATTACK_RANGE = 3.5;
const KNOCKBACK_FORCE = 18;
const POWERUP_RESPAWN = 10;

interface PowerUp {
  mesh: THREE.Group;
  type: 'health' | 'speed' | 'damage' | 'shield';
  collected: boolean;
  respawnTimer: number;
  pos: THREE.Vector3;
}

interface BattlePlayer extends TrackedPlayer {
  health: number;
}

export function BattleArena() {
  const { currentUser, userProfile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<HumanoidParts | null>(null);
  const physicsRef = useRef<PhysicsBody>({ pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), rot: 0, grounded: true });
  const inputRef = useRef<InputState>(createInputState());
  const cameraAngleRef = useRef(0);
  const cameraPitchRef = useRef(0.3);
  const animFrameRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());
  const trackedRef = useRef(new Map<string, BattlePlayer>());
  const powerupsRef = useRef<PowerUp[]>([]);

  const [hp, setHp] = useState(MAX_HP);
  const [kills, setKills] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [speedBuff, setSpeedBuff] = useState(false);
  const [damageBuff, setDamageBuff] = useState(false);
  const [shieldBuff, setShieldBuff] = useState(false);
  const [playerCount, setPlayerCount] = useState(1);
  const [showControls, setShowControls] = useState(true);

  const hpRef = useRef(MAX_HP);
  const killsRef = useRef(0);
  const deathsRef = useRef(0);
  const attackCooldownRef = useRef(0);
  const speedBuffRef = useRef(0);
  const damageBuffRef = useRef(0);
  const shieldBuffRef = useRef(0);
  const deadRef = useRef(false);
  const respawnTimerRef = useRef(0);
  const lastSyncRef = useRef(0);

  const respawn = useCallback(() => {
    const body = physicsRef.current;
    const angle = Math.random() * Math.PI * 2;
    body.pos.set(Math.cos(angle) * 20, 0, Math.sin(angle) * 20);
    body.vel.set(0, 0, 0);
    body.grounded = true;
    hpRef.current = MAX_HP;
    setHp(MAX_HP);
    deadRef.current = false;
    setIsDead(false);
    respawnTimerRef.current = 0;
  }, []);

  useEffect(() => {
    if (!containerRef.current || !currentUser || !userProfile) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    createSkybox(scene, 0x0a0008);
    setupLighting(scene, 0xff4444);

    // Red-tinted arena lighting
    const redLight = new THREE.PointLight(0xff2200, 2, 50);
    redLight.position.set(0, 15, 0);
    scene.add(redLight);

    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 300);
    const renderer = createRenderer(container);
    rendererRef.current = renderer;

    // Arena floor
    const arenaGeo = new THREE.CircleGeometry(ARENA_SIZE, 64);
    const arenaMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.8, metalness: 0.2 });
    const arena = new THREE.Mesh(arenaGeo, arenaMat);
    arena.rotation.x = -Math.PI / 2;
    arena.receiveShadow = true;
    scene.add(arena);

    // Arena ring
    const ringGeo = new THREE.TorusGeometry(ARENA_SIZE, 1, 8, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 0.3, metalness: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5;
    scene.add(ring);

    // Inner circle marking
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(20, 0.2, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.5 })
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.02;
    scene.add(innerRing);

    // Grid
    const grid = new THREE.GridHelper(ARENA_SIZE * 2, 30, 0xff1100, 0x1a0505);
    grid.position.y = 0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.15;
    scene.add(grid);

    // Arena obstacles (pillars)
    const pillarPositions = [
      [15, 0], [-15, 0], [0, 15], [0, -15],
      [10, 10], [-10, 10], [10, -10], [-10, -10],
      [25, 12], [-25, 12], [25, -12], [-25, -12],
    ];
    const pillarGroup = new THREE.Group();
    pillarPositions.forEach(([px, pz]) => {
      const pillarGeo = new THREE.CylinderGeometry(1.5, 1.8, 5, 8);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a1a1a, metalness: 0.7, roughness: 0.3 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, 2.5, pz);
      pillar.castShadow = true;
      pillarGroup.add(pillar);

      // Pillar top glow
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6 });
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.2, 8), glowMat);
      glow.position.set(px, 5.1, pz);
      pillarGroup.add(glow);

      const pLight = new THREE.PointLight(0xff4400, 0.3, 10);
      pLight.position.set(px, 5.5, pz);
      pillarGroup.add(pLight);
    });
    scene.add(pillarGroup);

    // Power-ups
    const powerUpConfigs: { x: number; z: number; type: PowerUp['type'] }[] = [
      { x: 0, z: 0, type: 'health' },
      { x: 20, z: 20, type: 'speed' },
      { x: -20, z: 20, type: 'damage' },
      { x: 20, z: -20, type: 'shield' },
      { x: -20, z: -20, type: 'health' },
      { x: 30, z: 0, type: 'speed' },
      { x: -30, z: 0, type: 'damage' },
      { x: 0, z: 30, type: 'shield' },
    ];

    const typeColors = { health: 0x44ff44, speed: 0x44ccff, damage: 0xff4444, shield: 0xffaa00 };
    const pups: PowerUp[] = [];
    powerUpConfigs.forEach(({ x, z, type }) => {
      const group = new THREE.Group();
      const geo = type === 'health' ? new THREE.OctahedronGeometry(0.6) :
                  type === 'speed' ? new THREE.TetrahedronGeometry(0.7) :
                  type === 'damage' ? new THREE.BoxGeometry(0.8, 0.8, 0.8) :
                  new THREE.IcosahedronGeometry(0.6);
      const mat = new THREE.MeshStandardMaterial({
        color: typeColors[type],
        emissive: typeColors[type],
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.8,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      const glow = new THREE.PointLight(typeColors[type], 0.5, 6);
      glow.position.y = 1;
      group.add(glow);

      group.position.set(x, 1.5, z);
      scene.add(group);
      pups.push({ mesh: group, type, collected: false, respawnTimer: 0, pos: new THREE.Vector3(x, 1.5, z) });
    });
    powerupsRef.current = pups;

    // Attack visual (sword swing arc)
    const swingGeo = new THREE.TorusGeometry(2.5, 0.15, 4, 16, Math.PI * 0.7);
    const swingMat = new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0 });
    const swingMesh = new THREE.Mesh(swingGeo, swingMat);
    swingMesh.rotation.x = Math.PI / 2;
    scene.add(swingMesh);

    // Player
    const config = generateAvatarConfig(currentUser.uid, userProfile.displayName || 'Player', userProfile.role || 'user', userProfile.photoURL, userProfile.level, userProfile.username, !!userProfile.isPremium);
    const player = createHumanoid(config);
    player.root.position.set(0, 0, 15);
    scene.add(player.root);
    playerRef.current = player;
    physicsRef.current.pos.set(0, 0, 15);

    // Health bar above player
    const hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    const hpBarFill = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    hpBarBg.position.y = 3.5;
    hpBarFill.position.y = 3.5;
    player.root.add(hpBarBg);
    player.root.add(hpBarFill);

    // Input
    const input = inputRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      input.keys.add(e.code);
      if (e.code === 'KeyF' || e.code === 'KeyE') {
        // Attack
        if (attackCooldownRef.current <= 0 && !deadRef.current) {
          attackCooldownRef.current = ATTACK_COOLDOWN;
          setIsAttacking(true);
          setTimeout(() => setIsAttacking(false), 300);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => input.keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        cameraAngleRef.current -= e.movementX * 0.003;
        cameraPitchRef.current = Math.max(-0.3, Math.min(1.0, cameraPitchRef.current + e.movementY * 0.003));
      }
    };
    const onMouseDown = () => {
      if (document.pointerLockElement === renderer.domElement) {
        if (attackCooldownRef.current <= 0 && !deadRef.current) {
          attackCooldownRef.current = ATTACK_COOLDOWN;
          setIsAttacking(true);
          setTimeout(() => setIsAttacking(false), 300);
        }
      } else {
        renderer.domElement.requestPointerLock();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX < window.innerWidth / 2) {
        input.joystick.active = true;
        input.joystick.startX = t.clientX;
        input.joystick.startY = t.clientY;
      } else {
        input.cameraTouch.active = true;
        input.cameraTouch.lastX = t.clientX;
        input.cameraTouch.lastY = t.clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.clientX < window.innerWidth / 2 && input.joystick.active) {
          const dx = (t.clientX - input.joystick.startX) / 60;
          const dy = (t.clientY - input.joystick.startY) / 60;
          const len = Math.sqrt(dx * dx + dy * dy);
          input.joystick.dx = len > 1 ? dx / len : dx;
          input.joystick.dy = len > 1 ? dy / len : dy;
        } else if (t.clientX >= window.innerWidth / 2 && input.cameraTouch.active) {
          cameraAngleRef.current -= (t.clientX - input.cameraTouch.lastX) * 0.005;
          cameraPitchRef.current = Math.max(-0.3, Math.min(1.0, cameraPitchRef.current + (t.clientY - input.cameraTouch.lastY) * 0.005));
          input.cameraTouch.lastX = t.clientX;
          input.cameraTouch.lastY = t.clientY;
        }
      }
    };
    const onTouchEnd = () => {
      input.joystick.active = false; input.joystick.dx = 0; input.joystick.dy = 0;
      input.cameraTouch.active = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const clock = clockRef.current;
    clock.start();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      // Cooldowns
      if (attackCooldownRef.current > 0) attackCooldownRef.current -= dt;
      if (speedBuffRef.current > 0) { speedBuffRef.current -= dt; if (speedBuffRef.current <= 0) setSpeedBuff(false); }
      if (damageBuffRef.current > 0) { damageBuffRef.current -= dt; if (damageBuffRef.current <= 0) setDamageBuff(false); }
      if (shieldBuffRef.current > 0) { shieldBuffRef.current -= dt; if (shieldBuffRef.current <= 0) setShieldBuff(false); }

      // Death check
      if (deadRef.current) {
        respawnTimerRef.current -= dt;
        if (respawnTimerRef.current <= 0) respawn();
        if (playerRef.current) playerRef.current.root.visible = false;
        renderer.render(scene, camera);
        return;
      }
      if (playerRef.current) playerRef.current.root.visible = true;

      const { moveX, moveZ, jump, sprint } = getMovementFromInput(input);
      const body = physicsRef.current;
      const effectiveSprint = sprint || speedBuffRef.current > 0;
      updatePhysics(body, moveX, moveZ, jump, effectiveSprint, cameraAngleRef.current, dt, ARENA_SIZE - 2);

      // Update player mesh
      if (playerRef.current) {
        playerRef.current.root.position.copy(body.pos);
        playerRef.current.root.rotation.y = body.rot;
        const anim = getAnimState(body.vel.x, body.vel.z, body.vel.y, body.grounded, effectiveSprint);
        animateHumanoid(playerRef.current, isAttacking ? 'wave' : anim, time, dt);
      }

      // HP bar
      const hpPct = hpRef.current / MAX_HP;
      hpBarFill.scale.x = hpPct;
      hpBarFill.position.x = -(1 - hpPct);
      (hpBarFill.material as THREE.MeshBasicMaterial).color.setHex(
        hpPct > 0.5 ? 0x44ff44 : hpPct > 0.25 ? 0xffaa00 : 0xff4444
      );

      // Swing visual
      if (isAttacking) {
        swingMesh.position.copy(body.pos);
        swingMesh.position.y = 1.5;
        swingMesh.rotation.y = body.rot;
        swingMat.opacity = 0.6;
      } else {
        swingMat.opacity = Math.max(0, swingMat.opacity - 3 * dt);
      }

      // Power-ups
      for (const pu of pups) {
        if (pu.collected) {
          pu.respawnTimer -= dt;
          if (pu.respawnTimer <= 0) {
            pu.collected = false;
            pu.mesh.visible = true;
          }
          continue;
        }
        pu.mesh.rotation.y += 1.5 * dt;
        pu.mesh.position.y = pu.pos.y + Math.sin(time * 2 + pu.pos.x) * 0.3;

        if (body.pos.distanceToSquared(pu.mesh.position) < 4) {
          pu.collected = true;
          pu.mesh.visible = false;
          pu.respawnTimer = POWERUP_RESPAWN;

          if (pu.type === 'health') {
            hpRef.current = Math.min(MAX_HP, hpRef.current + 30);
            setHp(hpRef.current);
          } else if (pu.type === 'speed') {
            speedBuffRef.current = 8;
            setSpeedBuff(true);
          } else if (pu.type === 'damage') {
            damageBuffRef.current = 8;
            setDamageBuff(true);
          } else if (pu.type === 'shield') {
            shieldBuffRef.current = 8;
            setShieldBuff(true);
          }
        }
      }

      // Particles
      pillarGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh && child.geometry.type === 'CylinderGeometry') {
          // Subtle glow pulse
        }
      });

      // Camera
      updateThirdPersonCamera(camera, body.pos, cameraAngleRef.current, cameraPitchRef.current, 16, 10, dt);

      // Update tracked players
      trackedRef.current.forEach((tp) => {
        tp.humanoid.root.position.lerp(tp.targetPos, 8 * dt);
        let rDiff = tp.targetRotY - tp.humanoid.root.rotation.y;
        while (rDiff > Math.PI) rDiff -= Math.PI * 2;
        while (rDiff < -Math.PI) rDiff += Math.PI * 2;
        tp.humanoid.root.rotation.y += rDiff * 8 * dt;
        animateHumanoid(tp.humanoid, tp.data.animState || 'idle', time, dt);
      });

      renderer.render(scene, camera);
    };
    animate();

    // Firestore sync
    const posUnsub = onSnapshot(collection(db, 'game_positions'), snap => {
      const now = Date.now();
      const activeIds = new Set<string>();
      snap.forEach(d => {
        const data = d.data() as PlayerState;
        if (data.uid === currentUser.uid) return;
        if (now - data.lastUpdate > 12000) return;
        activeIds.add(data.uid);

        const existing = trackedRef.current.get(data.uid);
        if (existing) {
          existing.data = data;
          existing.targetPos.set(data.x, data.y, data.z);
          existing.targetRotY = data.rotY;
          existing.health = data.health ?? MAX_HP;
        } else {
          const cfg = generateAvatarConfig(data.uid, data.displayName, data.role, data.photoURL);
          const hum = createHumanoid(cfg);
          hum.root.position.set(data.x, data.y, data.z);
          scene.add(hum.root);
          trackedRef.current.set(data.uid, {
            data, humanoid: hum,
            targetPos: new THREE.Vector3(data.x, data.y, data.z),
            targetRotY: data.rotY,
            health: data.health ?? MAX_HP,
          });
        }
      });
      // Remove stale
      trackedRef.current.forEach((_, uid) => {
        if (!activeIds.has(uid)) {
          const tp = trackedRef.current.get(uid)!;
          scene.remove(tp.humanoid.root);
          disposeHumanoid(tp.humanoid);
          trackedRef.current.delete(uid);
        }
      });
      setPlayerCount(trackedRef.current.size + 1);
    });

    const syncInterval = setInterval(() => {
      const body = physicsRef.current;
      setDoc(doc(db, 'game_positions', currentUser.uid), {
        uid: currentUser.uid,
        displayName: userProfile.displayName || 'Player',
        username: userProfile.username || '',
        photoURL: userProfile.photoURL || '',
        role: userProfile.role || 'user',
        x: Math.round(body.pos.x * 10) / 10,
        y: Math.round(body.pos.y * 10) / 10,
        z: Math.round(body.pos.z * 10) / 10,
        rotY: Math.round(body.rot * 100) / 100,
        animState: getAnimState(body.vel.x, body.vel.z, body.vel.y, body.grounded, false),
        health: hpRef.current,
        lastUpdate: Date.now(),
      }, { merge: true }).catch(() => {});
    }, 150);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      posUnsub();
      clearInterval(syncInterval);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      trackedRef.current.forEach(tp => disposeHumanoid(tp.humanoid));
      trackedRef.current.clear();
      if (playerRef.current) disposeHumanoid(playerRef.current);
      deleteDoc(doc(db, 'game_positions', currentUser.uid)).catch(() => {});
    };
  }, [currentUser, userProfile, respawn, isAttacking]);

  const attack = () => {
    if (attackCooldownRef.current <= 0 && !deadRef.current) {
      attackCooldownRef.current = ATTACK_COOLDOWN;
      setIsAttacking(true);
      setTimeout(() => setIsAttacking(false), 300);

      // Check if any tracked player is in range
      const body = physicsRef.current;
      const forward = new THREE.Vector3(Math.sin(body.rot), 0, Math.cos(body.rot));
      trackedRef.current.forEach((tp) => {
        const toEnemy = new THREE.Vector3().subVectors(tp.humanoid.root.position, body.pos);
        const dist = toEnemy.length();
        if (dist < ATTACK_RANGE) {
          const dot = forward.dot(toEnemy.normalize());
          if (dot > 0.3) {
            // Hit! (visual feedback)
            tp.humanoid.root.position.add(toEnemy.multiplyScalar(0.5));
          }
        }
      });
    }
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-gray-900" style={{ touchAction: 'none' }}>
      {/* HUD */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
        <div className="bg-black/60 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-red-500/20 space-y-1.5 min-w-[150px]">
          {/* Health bar */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                <Heart size={14} className="text-red-400 fill-red-400" />
                <span className="text-xs font-bold">{hp}/{MAX_HP}</span>
              </div>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${hp > 50 ? 'bg-green-500' : hp > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                animate={{ width: `${(hp / MAX_HP) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <Swords size={12} className="text-orange-400" />
              <span className="text-orange-400 font-bold">{kills}</span>
            </div>
            <div className="flex items-center gap-1">
              <Skull size={12} className="text-gray-500" />
              <span className="text-gray-400">{deaths}</span>
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>{playerCount} in arena</span>
          </div>
        </div>

        {/* Buffs */}
        <div className="flex gap-1">
          {speedBuff && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 p-1.5 rounded-lg">
              <Zap size={14} />
            </motion.div>
          )}
          {damageBuff && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-red-500/20 border border-red-500/30 text-red-400 p-1.5 rounded-lg">
              <Swords size={14} />
            </motion.div>
          )}
          {shieldBuff && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 p-1.5 rounded-lg">
              <Shield size={14} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Attack button */}
      <div className="absolute bottom-20 right-4 z-40 flex flex-col gap-2">
        <motion.button
          className="w-16 h-16 bg-red-500/30 backdrop-blur-md rounded-full border-2 border-red-500/50 text-white flex items-center justify-center active:bg-red-500/60"
          whileTap={{ scale: 0.9 }}
          onClick={attack}
        >
          <Swords size={24} />
        </motion.button>
      </div>

      {/* Death screen */}
      <AnimatePresence>
        {isDead && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
            >
              <Skull size={64} className="text-red-500 mx-auto mb-4" />
              <h2 className="text-3xl font-black text-white mb-2">YOU DIED</h2>
              <p className="text-gray-400 text-sm">Respawning...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls hint */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md text-white text-xs px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span>WASD: Move</span><span>·</span><span>Space: Jump</span><span>·</span><span>Click/F: Attack</span><span>·</span><span>Shift: Sprint</span>
            <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-white ml-2">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile controls */}
      <div className="absolute bottom-4 left-4 z-40 md:hidden">
        <button
          className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-full border border-white/20 text-white font-bold text-xl active:bg-white/30"
          onTouchStart={() => inputRef.current.keys.add('Space')}
          onTouchEnd={() => inputRef.current.keys.delete('Space')}
        >
          ⬆
        </button>
      </div>
    </div>
  );
}
