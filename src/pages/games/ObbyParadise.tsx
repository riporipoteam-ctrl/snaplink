import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useAuth } from '../../contexts/AuthContext';
import { Timer, Trophy, RotateCcw, Star, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createHumanoid, animateHumanoid, generateAvatarConfig, disposeHumanoid,
  createRenderer, updateThirdPersonCamera,
  createInputState, getMovementFromInput, getAnimState,
  createPlatform,
  type HumanoidParts, type InputState, type PhysicsBody,
} from './shared';

const GRAVITY = -35;
const MOVE_SPEED = 14;
const SPRINT_SPEED = 22;
const JUMP_FORCE = 15;
const CAMERA_DIST = 18;
const CAMERA_HEIGHT = 10;

// ============= OBBY LEVEL DATA =============
interface Platform {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  color: number;
  type: 'static' | 'moving' | 'spinning' | 'falling' | 'bouncy' | 'lava' | 'checkpoint' | 'finish';
  moveAxis?: 'x' | 'y' | 'z';
  moveRange?: number;
  moveSpeed?: number;
  spinSpeed?: number;
  mesh?: THREE.Mesh;
  originalPos?: THREE.Vector3;
  fallTimer?: number;
  fallen?: boolean;
}

interface Coin {
  x: number; y: number; z: number;
  mesh?: THREE.Mesh;
  collected: boolean;
}

function generateLevel(): { platforms: Platform[]; coins: Coin[]; spawnPoint: THREE.Vector3 } {
  const platforms: Platform[] = [];
  const coins: Coin[] = [];

  // Starting platform
  platforms.push({ x: 0, y: 0, z: 0, w: 8, h: 1, d: 8, color: 0x44cc44, type: 'checkpoint' });

  // ===== STAGE 1: Beginner Platforms =====
  platforms.push({ x: 0, y: 0, z: -10, w: 4, h: 1, d: 4, color: 0x44cc44, type: 'static' });
  platforms.push({ x: 5, y: 1, z: -16, w: 4, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  platforms.push({ x: 10, y: 2, z: -22, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  coins.push({ x: 10, y: 4, z: -22, collected: false });
  platforms.push({ x: 5, y: 3, z: -28, w: 4, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  platforms.push({ x: 0, y: 4, z: -34, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });

  // Moving platform
  platforms.push({ x: 0, y: 5, z: -42, w: 4, h: 1, d: 3, color: 0x00ccff, type: 'moving', moveAxis: 'x', moveRange: 8, moveSpeed: 2 });
  coins.push({ x: 0, y: 7, z: -42, collected: false });

  // Checkpoint 1
  platforms.push({ x: 8, y: 5, z: -50, w: 6, h: 1, d: 6, color: 0xffaa00, type: 'checkpoint' });

  // ===== STAGE 2: Moving & Spinning =====
  platforms.push({ x: 8, y: 6, z: -58, w: 3, h: 1, d: 3, color: 0xff6600, type: 'static' });
  platforms.push({ x: 8, y: 7, z: -65, w: 6, h: 1, d: 2, color: 0xff4444, type: 'spinning', spinSpeed: 1.5 });
  coins.push({ x: 8, y: 9, z: -65, collected: false });
  platforms.push({ x: 8, y: 8, z: -73, w: 3, h: 1, d: 3, color: 0xff6600, type: 'static' });

  // Vertical moving
  platforms.push({ x: 14, y: 8, z: -80, w: 3, h: 1, d: 3, color: 0x00ccff, type: 'moving', moveAxis: 'y', moveRange: 6, moveSpeed: 1.5 });
  platforms.push({ x: 20, y: 14, z: -85, w: 3, h: 1, d: 3, color: 0xff6600, type: 'static' });
  coins.push({ x: 20, y: 16, z: -85, collected: false });

  // Falling platforms
  platforms.push({ x: 20, y: 14, z: -92, w: 3, h: 1, d: 3, color: 0xffcc00, type: 'falling' });
  platforms.push({ x: 15, y: 14, z: -98, w: 3, h: 1, d: 3, color: 0xffcc00, type: 'falling' });
  platforms.push({ x: 10, y: 14, z: -104, w: 3, h: 1, d: 3, color: 0xffcc00, type: 'falling' });

  // Checkpoint 2
  platforms.push({ x: 5, y: 14, z: -110, w: 6, h: 1, d: 6, color: 0xffaa00, type: 'checkpoint' });

  // ===== STAGE 3: Lava & Bouncy =====
  platforms.push({ x: 5, y: 14, z: -118, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  // Lava on sides
  platforms.push({ x: 0, y: 13, z: -124, w: 4, h: 0.5, d: 12, color: 0xff2200, type: 'lava' });
  platforms.push({ x: 10, y: 13, z: -124, w: 4, h: 0.5, d: 12, color: 0xff2200, type: 'lava' });
  // Safe path
  platforms.push({ x: 5, y: 14, z: -120, w: 2, h: 1, d: 2, color: 0x44cc44, type: 'static' });
  platforms.push({ x: 5, y: 14, z: -124, w: 2, h: 1, d: 2, color: 0x44cc44, type: 'static' });
  platforms.push({ x: 5, y: 14, z: -128, w: 2, h: 1, d: 2, color: 0x44cc44, type: 'static' });
  coins.push({ x: 5, y: 16, z: -124, collected: false });

  // Bouncy
  platforms.push({ x: 5, y: 14, z: -135, w: 4, h: 1, d: 4, color: 0xff00ff, type: 'bouncy' });
  platforms.push({ x: 5, y: 22, z: -143, w: 4, h: 1, d: 4, color: 0xff00ff, type: 'bouncy' });
  coins.push({ x: 5, y: 26, z: -143, collected: false });
  platforms.push({ x: 5, y: 30, z: -150, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });

  // Checkpoint 3
  platforms.push({ x: 5, y: 30, z: -158, w: 6, h: 1, d: 6, color: 0xffaa00, type: 'checkpoint' });

  // ===== STAGE 4: Gauntlet =====
  // Spinning beams to dodge
  platforms.push({ x: 5, y: 30, z: -165, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  platforms.push({ x: 5, y: 31, z: -172, w: 12, h: 0.6, d: 1.5, color: 0xff4444, type: 'spinning', spinSpeed: 2.5 });
  platforms.push({ x: 5, y: 30, z: -172, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  platforms.push({ x: 5, y: 31, z: -180, w: 10, h: 0.6, d: 1.5, color: 0xff4444, type: 'spinning', spinSpeed: -3 });
  platforms.push({ x: 5, y: 30, z: -180, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  coins.push({ x: 5, y: 33, z: -176, collected: false });

  // Final approach
  platforms.push({ x: 5, y: 31, z: -188, w: 3, h: 1, d: 3, color: 0x00ccff, type: 'moving', moveAxis: 'x', moveRange: 10, moveSpeed: 3 });
  platforms.push({ x: 0, y: 32, z: -196, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });
  platforms.push({ x: -5, y: 33, z: -203, w: 3, h: 1, d: 3, color: 0xffcc00, type: 'falling' });
  platforms.push({ x: -5, y: 34, z: -210, w: 3, h: 1, d: 3, color: 0x44cc44, type: 'static' });

  // Finish!
  platforms.push({ x: -5, y: 34, z: -218, w: 8, h: 1, d: 8, color: 0xffdd00, type: 'finish' });
  coins.push({ x: -5, y: 37, z: -218, collected: false });

  return { platforms, coins, spawnPoint: new THREE.Vector3(0, 2, 0) };
}

export function ObbyParadise() {
  const { currentUser, userProfile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playerRef = useRef<HumanoidParts | null>(null);
  const physicsRef = useRef<PhysicsBody>({ pos: new THREE.Vector3(0, 2, 0), vel: new THREE.Vector3(), rot: 0, grounded: false });
  const inputRef = useRef<InputState>(createInputState());
  const cameraAngleRef = useRef(0);
  const cameraPitchRef = useRef(0.4);
  const animFrameRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());
  const levelRef = useRef<ReturnType<typeof generateLevel> | null>(null);
  const checkpointRef = useRef(new THREE.Vector3(0, 2, 0));
  const platformMeshesRef = useRef<THREE.Mesh[]>([]);

  const [timer, setTimer] = useState(0);
  const [coins, setCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [stage, setStage] = useState(1);
  const [finished, setFinished] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const timerRef = useRef(0);
  const coinsRef = useRef(0);
  const deathsRef = useRef(0);
  const finishedRef = useRef(false);

  const respawn = useCallback(() => {
    const body = physicsRef.current;
    body.pos.copy(checkpointRef.current);
    body.vel.set(0, 0, 0);
    body.grounded = false;
    deathsRef.current++;
    setDeaths(deathsRef.current);
  }, []);

  const resetLevel = useCallback(() => {
    const body = physicsRef.current;
    body.pos.set(0, 2, 0);
    body.vel.set(0, 0, 0);
    body.grounded = false;
    checkpointRef.current.set(0, 2, 0);
    deathsRef.current = 0;
    coinsRef.current = 0;
    timerRef.current = 0;
    finishedRef.current = false;
    setDeaths(0);
    setCoins(0);
    setTimer(0);
    setStage(1);
    setFinished(false);

    if (levelRef.current) {
      levelRef.current.coins.forEach(c => { c.collected = false; if (c.mesh) c.mesh.visible = true; });
      levelRef.current.platforms.forEach(p => {
        if (p.type === 'falling' && p.mesh && p.originalPos) {
          p.mesh.position.copy(p.originalPos);
          p.mesh.visible = true;
          p.fallen = false;
          p.fallTimer = 0;
        }
      });
    }
  }, []);

  // ===== INIT =====
  useEffect(() => {
    if (!containerRef.current || !currentUser || !userProfile) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0a20);
    scene.fog = new THREE.FogExp2(0x0a0a20, 0.003);

    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 600);
    cameraRef.current = camera;
    const renderer = createRenderer(container);
    rendererRef.current = renderer;

    // Lighting
    const ambient = new THREE.AmbientLight(0x334466, 1.2);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x6688cc, 0x221122, 0.5);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(30, 60, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.far = 300;
    dir.shadow.camera.left = -100;
    dir.shadow.camera.right = 100;
    dir.shadow.camera.top = 100;
    dir.shadow.camera.bottom = -100;
    scene.add(dir);

    // Stars
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const r = 200 + Math.random() * 100;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 30;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.8 })));

    // Lava floor far below
    const lavaGeo = new THREE.PlaneGeometry(500, 500);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.6 });
    const lava = new THREE.Mesh(lavaGeo, lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = -30;
    scene.add(lava);

    // Fog particles
    const fogCount = 300;
    const fogGeo = new THREE.BufferGeometry();
    const fogPos = new Float32Array(fogCount * 3);
    const fogCol = new Float32Array(fogCount * 3);
    for (let i = 0; i < fogCount; i++) {
      fogPos[i * 3] = (Math.random() - 0.5) * 200;
      fogPos[i * 3 + 1] = Math.random() * 40 - 10;
      fogPos[i * 3 + 2] = (Math.random() - 0.5) * 500 - 100;
      const c = new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.5);
      fogCol[i * 3] = c.r; fogCol[i * 3 + 1] = c.g; fogCol[i * 3 + 2] = c.b;
    }
    fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3));
    fogGeo.setAttribute('color', new THREE.BufferAttribute(fogCol, 3));
    scene.add(new THREE.Points(fogGeo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));

    // Generate level
    const level = generateLevel();
    levelRef.current = level;
    setTotalCoins(level.coins.length);

    const meshes: THREE.Mesh[] = [];
    level.platforms.forEach(p => {
      let color = p.color;
      let emissive = false;
      if (p.type === 'lava') { color = 0xff2200; emissive = true; }
      if (p.type === 'bouncy') emissive = true;
      if (p.type === 'checkpoint') emissive = true;
      if (p.type === 'finish') emissive = true;

      const mesh = createPlatform(scene, p.x, p.y, p.z, p.w, p.h, p.d, color, emissive);
      p.mesh = mesh;
      p.originalPos = mesh.position.clone();
      meshes.push(mesh);

      // Checkpoint flag
      if (p.type === 'checkpoint' || p.type === 'finish') {
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4, 6);
        const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8 }));
        pole.position.set(p.x + p.w / 2 - 0.5, p.y + 2.5, p.z);
        scene.add(pole);

        const flagColor = p.type === 'finish' ? 0xffdd00 : 0x44ff44;
        const flagGeo = new THREE.PlaneGeometry(1.5, 1);
        const flagMat = new THREE.MeshStandardMaterial({ color: flagColor, emissive: flagColor, emissiveIntensity: 0.3, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(p.x + p.w / 2 + 0.2, p.y + 4, p.z);
        scene.add(flag);
      }

      // Neon edges for important platforms
      if (p.type !== 'static') {
        const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, p.h, p.d));
        const edgeColor = p.type === 'lava' ? 0xff4400 : p.type === 'bouncy' ? 0xff66ff : p.type === 'checkpoint' ? 0x44ff44 : p.type === 'finish' ? 0xffdd00 : 0x44ccff;
        const edges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: edgeColor }));
        edges.position.copy(mesh.position);
        scene.add(edges);
      }
    });
    platformMeshesRef.current = meshes;

    // Coins
    level.coins.forEach(c => {
      const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 16);
      const coinMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffaa00, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 });
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.castShadow = true;
      scene.add(mesh);
      c.mesh = mesh;

      // Coin glow
      const glow = new THREE.PointLight(0xffaa00, 0.4, 4);
      glow.position.copy(mesh.position);
      scene.add(glow);
    });

    // Player
    const config = generateAvatarConfig(currentUser.uid, userProfile.displayName || 'Player', userProfile.role || 'user', userProfile.photoURL, userProfile.level, userProfile.username, !!userProfile.isPremium);
    const player = createHumanoid(config);
    player.root.position.set(0, 2, 0);
    scene.add(player.root);
    playerRef.current = player;

    // Input handling
    const input = inputRef.current;
    const onKeyDown = (e: KeyboardEvent) => { if (!(e.target instanceof HTMLInputElement)) input.keys.add(e.code); };
    const onKeyUp = (e: KeyboardEvent) => input.keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        cameraAngleRef.current -= e.movementX * 0.003;
        cameraPitchRef.current = Math.max(-0.3, Math.min(1.0, cameraPitchRef.current + e.movementY * 0.003));
      }
    };
    const onClick = () => renderer.domElement.requestPointerLock();

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
    const onTouchEnd = () => { input.joystick.active = false; input.joystick.dx = 0; input.joystick.dy = 0; input.cameraTouch.active = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Game loop
    const clock = clockRef.current;
    clock.start();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      if (!finishedRef.current) {
        timerRef.current += dt;
        if (Math.floor(timerRef.current * 10) % 3 === 0) setTimer(timerRef.current);
      }

      const { moveX, moveZ, jump, sprint } = getMovementFromInput(input);
      const body = physicsRef.current;

      // Custom physics with platform collision
      const speed = sprint ? SPRINT_SPEED : MOVE_SPEED;
      const sin = Math.sin(cameraAngleRef.current);
      const cos = Math.cos(cameraAngleRef.current);
      const wmx = moveX * cos - moveZ * sin;
      const wmz = moveX * sin + moveZ * cos;
      body.vel.x = wmx * speed;
      body.vel.z = wmz * speed;

      if (jump && body.grounded) { body.vel.y = JUMP_FORCE; body.grounded = false; }
      body.vel.y += GRAVITY * dt;
      body.pos.x += body.vel.x * dt;
      body.pos.y += body.vel.y * dt;
      body.pos.z += body.vel.z * dt;

      // Face direction
      const mLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (mLen > 0.1) {
        const tgt = Math.atan2(wmx, wmz);
        let diff = tgt - body.rot;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        body.rot += diff * 10 * dt;
      }

      // Platform collisions
      body.grounded = false;
      const level = levelRef.current;
      if (level) {
        for (const p of level.platforms) {
          if (!p.mesh || !p.mesh.visible) continue;
          const mx = p.mesh.position.x;
          const my = p.mesh.position.y;
          const mz = p.mesh.position.z;
          const hw = p.w / 2 + 0.3;
          const hd = p.d / 2 + 0.3;
          const hh = p.h / 2;

          if (body.pos.x > mx - hw && body.pos.x < mx + hw &&
              body.pos.z > mz - hd && body.pos.z < mz + hd) {
            const topY = my + hh;
            if (body.pos.y >= topY - 0.5 && body.pos.y <= topY + 2 && body.vel.y <= 0) {
              // Standing on platform
              if (p.type === 'lava') {
                respawn();
                break;
              }
              if (p.type === 'bouncy') {
                body.vel.y = JUMP_FORCE * 2;
                body.grounded = false;
                continue;
              }
              body.pos.y = topY;
              body.vel.y = 0;
              body.grounded = true;

              // Moving platform — carry player
              if ((p.type === 'moving') && p.moveAxis && p.moveRange && p.moveSpeed && p.originalPos) {
                const offset = Math.sin(time * p.moveSpeed) * p.moveRange;
                const prevOffset = Math.sin((time - dt) * p.moveSpeed) * p.moveRange;
                const delta = offset - prevOffset;
                if (p.moveAxis === 'x') body.pos.x += delta;
                else if (p.moveAxis === 'y') body.pos.y += delta;
                else if (p.moveAxis === 'z') body.pos.z += delta;
              }

              if (p.type === 'falling' && !p.fallen) {
                p.fallTimer = (p.fallTimer || 0) + dt;
                if (p.fallTimer > 0.5) {
                  p.fallen = true;
                  p.mesh.visible = false;
                  setTimeout(() => {
                    if (p.mesh && p.originalPos) {
                      p.mesh.position.copy(p.originalPos);
                      p.mesh.visible = true;
                      p.fallen = false;
                      p.fallTimer = 0;
                    }
                  }, 3000);
                }
              }

              if (p.type === 'checkpoint') {
                checkpointRef.current.set(p.x, p.y + 2, p.z);
                const stageNum = level.platforms.filter(pl => pl.type === 'checkpoint').indexOf(p) + 1;
                if (stageNum > 0) setStage(stageNum);
              }
              if (p.type === 'finish' && !finishedRef.current) {
                finishedRef.current = true;
                setFinished(true);
              }
            }
          }
        }

        // Animate platforms
        for (const p of level.platforms) {
          if (!p.mesh || !p.originalPos) continue;
          if (p.type === 'moving' && p.moveAxis && p.moveRange && p.moveSpeed) {
            const offset = Math.sin(time * p.moveSpeed) * p.moveRange;
            if (p.moveAxis === 'x') p.mesh.position.x = p.originalPos.x + offset;
            else if (p.moveAxis === 'y') p.mesh.position.y = p.originalPos.y + offset;
            else if (p.moveAxis === 'z') p.mesh.position.z = p.originalPos.z + offset;
          }
          if (p.type === 'spinning' && p.spinSpeed) {
            p.mesh.rotation.y += p.spinSpeed * dt;
          }
          if (p.type === 'falling' && p.fallTimer && p.fallTimer > 0 && p.fallTimer <= 0.5) {
            p.mesh.position.x = p.originalPos.x + (Math.random() - 0.5) * 0.15;
            p.mesh.position.z = p.originalPos.z + (Math.random() - 0.5) * 0.15;
          }
        }

        // Coin collection
        for (const c of level.coins) {
          if (c.collected || !c.mesh) continue;
          c.mesh.rotation.y += 2 * dt;
          c.mesh.position.y = c.y + Math.sin(time * 3) * 0.3;
          const dx = body.pos.x - c.mesh.position.x;
          const dy = body.pos.y + 1 - c.mesh.position.y;
          const dz = body.pos.z - c.mesh.position.z;
          if (dx * dx + dy * dy + dz * dz < 2.5) {
            c.collected = true;
            c.mesh.visible = false;
            coinsRef.current++;
            setCoins(coinsRef.current);
          }
        }
      }

      // Death plane
      if (body.pos.y < -25) respawn();

      // Update player mesh
      if (playerRef.current) {
        playerRef.current.root.position.copy(body.pos);
        playerRef.current.root.rotation.y = body.rot;
        const anim = getAnimState(body.vel.x, body.vel.z, body.vel.y, body.grounded, sprint);
        animateHumanoid(playerRef.current, anim, time, dt);
      }

      updateThirdPersonCamera(camera, body.pos, cameraAngleRef.current, cameraPitchRef.current, CAMERA_DIST, CAMERA_HEIGHT, dt);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (playerRef.current) disposeHumanoid(playerRef.current);
    };
  }, [currentUser, userProfile, respawn]);

  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-gray-900" style={{ touchAction: 'none' }}>
      {/* HUD */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
        <div className="bg-black/60 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-white/10 space-y-1">
          <div className="flex items-center gap-2 text-sm font-mono">
            <Timer size={14} className="text-cyan-400" />
            <span className="text-cyan-400 font-bold">{formatTime(timer)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Star size={14} className="text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-400">{coins}/{totalCoins}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Stage {stage}/4</span>
            <span>·</span>
            <span>Deaths: {deaths}</span>
          </div>
        </div>
        <button onClick={resetLevel} className="bg-black/60 backdrop-blur-md text-white p-2 rounded-xl border border-white/10 hover:bg-white/10" title="Restart">
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute top-4 left-16 right-40 z-40">
        <div className="h-2 bg-black/40 rounded-full overflow-hidden backdrop-blur-md border border-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-green-400 to-cyan-400 rounded-full"
            animate={{ width: `${(stage / 4) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Finish screen */}
      <AnimatePresence>
        {finished && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-gray-900/90 border border-yellow-500/30 rounded-2xl p-8 max-w-sm text-center"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
            >
              <Trophy size={48} className="text-yellow-400 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">Obby Complete!</h2>
              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-center gap-2 text-cyan-400">
                  <Timer size={18} />
                  <span className="font-mono text-lg">{formatTime(timer)}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-yellow-400">
                  <Star size={18} className="fill-yellow-400" />
                  <span>{coins}/{totalCoins} coins</span>
                </div>
                <div className="text-gray-400 text-sm">{deaths} deaths</div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {[1, 2, 3].map(s => (
                    <CheckCircle2 key={s} size={20} className={deaths <= s * 3 ? 'text-yellow-400 fill-yellow-400/20' : 'text-gray-600'} />
                  ))}
                </div>
              </div>
              <button
                onClick={resetLevel}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl hover:from-green-400 hover:to-emerald-500"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls hint */}
      <AnimatePresence>
        {showControls && !finished && (
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md text-white text-xs px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span>WASD: Move</span><span>·</span><span>Space: Jump</span><span>·</span><span>Shift: Sprint</span><span>·</span><span>Click: Look</span>
            <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-white ml-2">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile jump button */}
      <div className="absolute bottom-4 right-4 z-40 md:hidden">
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
