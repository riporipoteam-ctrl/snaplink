import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useAuth } from '../../contexts/AuthContext';
import { Timer, Trophy, RotateCcw, ArrowUp, Star, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createHumanoid, animateHumanoid, generateAvatarConfig, disposeHumanoid,
  createRenderer, updateThirdPersonCamera,
  createInputState, getMovementFromInput, getAnimState,
  createPlatform,
  type HumanoidParts, type InputState, type PhysicsBody,
} from './shared';

const GRAVITY = -35;
const MOVE_SPEED = 18;
const SPRINT_SPEED = 30;
const JUMP_FORCE = 14;
const WALL_JUMP_FORCE = 16;
const WALL_SLIDE_SPEED = -3;

interface Building {
  x: number; z: number; w: number; d: number; h: number;
  mesh?: THREE.Mesh;
  color: number;
}

interface Checkpoint {
  pos: THREE.Vector3;
  mesh?: THREE.Mesh;
  reached: boolean;
  height: number;
}

interface Zipline {
  start: THREE.Vector3;
  end: THREE.Vector3;
  mesh?: THREE.Line;
}

function generateCity(): { buildings: Building[]; checkpoints: Checkpoint[]; ziplines: Zipline[] } {
  const buildings: Building[] = [];
  const checkpoints: Checkpoint[] = [];
  const ziplines: Zipline[] = [];
  const colors = [0x1a1a2e, 0x16213e, 0x0f3460, 0x1a1a3e, 0x2a1a3e, 0x1a2a3e];

  // Ground level buildings (starter area)
  buildings.push({ x: 0, z: 0, w: 12, d: 12, h: 3, color: 0x2a2a4e }); // Start
  buildings.push({ x: 15, z: 0, w: 8, d: 8, h: 8, color: colors[0] });
  buildings.push({ x: 15, z: 15, w: 10, d: 10, h: 14, color: colors[1] });
  buildings.push({ x: 0, z: 20, w: 8, d: 8, h: 20, color: colors[2] });

  checkpoints.push({ pos: new THREE.Vector3(0, 4, 0), reached: false, height: 3 });

  // Mid-level parkour
  buildings.push({ x: -12, z: 25, w: 6, d: 6, h: 26, color: colors[3] });
  buildings.push({ x: -20, z: 18, w: 8, d: 8, h: 32, color: colors[4] });
  buildings.push({ x: -28, z: 10, w: 10, d: 6, h: 38, color: colors[0] });
  buildings.push({ x: -20, z: 0, w: 6, d: 10, h: 44, color: colors[1] });

  checkpoints.push({ pos: new THREE.Vector3(-20, 33, 18), reached: false, height: 32 });

  // Zipline bridge
  ziplines.push({
    start: new THREE.Vector3(-20, 45, 0),
    end: new THREE.Vector3(-5, 35, -20),
  });

  // Upper section
  buildings.push({ x: -5, z: -20, w: 10, d: 10, h: 34, color: colors[2] });
  buildings.push({ x: 8, z: -28, w: 6, d: 8, h: 42, color: colors[3] });
  buildings.push({ x: 20, z: -25, w: 8, d: 8, h: 50, color: colors[4] });
  buildings.push({ x: 25, z: -12, w: 10, d: 6, h: 56, color: colors[0] });

  checkpoints.push({ pos: new THREE.Vector3(20, 51, -25), reached: false, height: 50 });

  // Another zipline
  ziplines.push({
    start: new THREE.Vector3(25, 57, -12),
    end: new THREE.Vector3(35, 50, 10),
  });

  // Highrise section
  buildings.push({ x: 35, z: 10, w: 8, d: 8, h: 48, color: colors[1] });
  buildings.push({ x: 40, z: 25, w: 6, d: 10, h: 58, color: colors[2] });
  buildings.push({ x: 30, z: 35, w: 10, d: 8, h: 65, color: colors[3] });
  buildings.push({ x: 18, z: 40, w: 8, d: 8, h: 72, color: colors[4] });

  checkpoints.push({ pos: new THREE.Vector3(18, 73, 40), reached: false, height: 72 });

  // Final tower
  buildings.push({ x: 5, z: 45, w: 12, d: 12, h: 80, color: 0x3a1a5e });

  // Final checkpoint (top of world)
  checkpoints.push({ pos: new THREE.Vector3(5, 81, 45), reached: false, height: 80 });

  // Small connector platforms between buildings
  const connectors = [
    { x: 8, z: 8, w: 3, h: 1, d: 3, y: 5 },
    { x: 10, z: 15, w: 3, h: 1, d: 3, y: 10 },
    { x: -6, z: 22, w: 3, h: 1, d: 3, y: 18 },
    { x: -16, z: 22, w: 3, h: 1, d: 3, y: 24 },
    { x: -24, z: 14, w: 3, h: 1, d: 3, y: 30 },
    { x: -24, z: 5, w: 3, h: 1, d: 3, y: 36 },
    { x: 2, z: -12, w: 3, h: 1, d: 3, y: 34 },
    { x: 14, z: -26, w: 3, h: 1, d: 3, y: 40 },
    { x: 22, z: -18, w: 3, h: 1, d: 3, y: 48 },
    { x: 37, z: 18, w: 3, h: 1, d: 3, y: 52 },
    { x: 36, z: 30, w: 3, h: 1, d: 3, y: 58 },
    { x: 24, z: 38, w: 3, h: 1, d: 3, y: 66 },
    { x: 12, z: 43, w: 3, h: 1, d: 3, y: 74 },
  ];
  connectors.forEach(c => {
    buildings.push({ x: c.x, z: c.z, w: c.w, d: c.d, h: c.y + c.h, color: 0x00ccaa });
  });

  return { buildings, checkpoints, ziplines };
}

export function ParkourCity() {
  const { currentUser, userProfile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HumanoidParts | null>(null);
  const physicsRef = useRef<PhysicsBody>({ pos: new THREE.Vector3(0, 4, 0), vel: new THREE.Vector3(), rot: 0, grounded: true });
  const inputRef = useRef<InputState>(createInputState());
  const cameraAngleRef = useRef(0);
  const cameraPitchRef = useRef(0.25);
  const animFrameRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());
  const checkpointPosRef = useRef(new THREE.Vector3(0, 4, 0));
  const cityRef = useRef<ReturnType<typeof generateCity> | null>(null);
  const wallContactRef = useRef<{ normal: THREE.Vector3; time: number } | null>(null);

  const [timer, setTimer] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const [currentCheckpoint, setCurrentCheckpoint] = useState(0);
  const [totalCheckpoints, setTotalCheckpoints] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [wallSliding, setWallSliding] = useState(false);

  const timerRef = useRef(0);
  const maxHeightRef = useRef(0);
  const finishedRef = useRef(false);

  const respawn = useCallback(() => {
    const body = physicsRef.current;
    body.pos.copy(checkpointPosRef.current);
    body.vel.set(0, 0, 0);
    body.grounded = false;
  }, []);

  const resetGame = useCallback(() => {
    const body = physicsRef.current;
    body.pos.set(0, 4, 0);
    body.vel.set(0, 0, 0);
    checkpointPosRef.current.set(0, 4, 0);
    timerRef.current = 0;
    maxHeightRef.current = 0;
    finishedRef.current = false;
    setTimer(0); setMaxHeight(0); setCurrentCheckpoint(0); setFinished(false);
    if (cityRef.current) cityRef.current.checkpoints.forEach(c => c.reached = false);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !currentUser || !userProfile) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.003);

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 500);
    const renderer = createRenderer(container);

    // Lighting
    scene.add(new THREE.AmbientLight(0x334466, 0.8));
    scene.add(new THREE.HemisphereLight(0x2244aa, 0x0a0a1a, 0.5));
    const dir = new THREE.DirectionalLight(0x6688cc, 0.6);
    dir.position.set(40, 100, 30);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.far = 250;
    dir.shadow.camera.left = -80; dir.shadow.camera.right = 80;
    dir.shadow.camera.top = 100; dir.shadow.camera.bottom = -10;
    scene.add(dir);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.3;
      const r = 200 + Math.random() * 100;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 50;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaaaaff, size: 0.3 })));

    // Ground
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a18, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(300, 60, 0x0044ff, 0x000822);
    grid.position.y = 0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.2;
    scene.add(grid);

    // Generate city
    const city = generateCity();
    cityRef.current = city;
    setTotalCheckpoints(city.checkpoints.length);

    // Build buildings
    city.buildings.forEach(b => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.4, metalness: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      b.mesh = mesh;

      // Building edges
      const edgeColor = b.color === 0x00ccaa ? 0x00ffcc : 0x2244aa;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.4 })
      );
      edges.position.copy(mesh.position);
      scene.add(edges);

      // Windows for larger buildings
      if (b.h > 15 && b.w > 5) {
        const winMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.7 });
        const rows = Math.floor(b.h / 5);
        const cols = Math.max(Math.floor(b.w / 3), 1);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (Math.random() > 0.6) continue;
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), winMat);
            win.position.set(b.x - b.w / 2 + 2 + c * 3, 3 + r * 5, b.z + b.d / 2 + 0.01);
            scene.add(win);
          }
        }
      }

      // Neon accent on top
      if (b.h > 8) {
        const accent = new THREE.Mesh(
          new THREE.BoxGeometry(b.w + 0.2, 0.2, b.d + 0.2),
          new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.5 })
        );
        accent.position.set(b.x, b.h, b.z);
        scene.add(accent);
      }
    });

    // Checkpoints
    city.checkpoints.forEach((cp, i) => {
      const ringGeo = new THREE.TorusGeometry(2, 0.15, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.4 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(cp.pos);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      cp.mesh = ring;

      const light = new THREE.PointLight(0x00ff88, 0.5, 8);
      light.position.copy(cp.pos);
      scene.add(light);
    });

    // Ziplines
    city.ziplines.forEach(zl => {
      const points = [zl.start, zl.end];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffcc00 });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      zl.mesh = line;

      // Zipline posts
      [zl.start, zl.end].forEach(p => {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 3, 6),
          new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
        );
        post.position.set(p.x, p.y - 1.5, p.z);
        scene.add(post);
      });
    });

    // Height markers (every 20 units)
    for (let h = 20; h <= 80; h += 20) {
      const markerGeo = new THREE.PlaneGeometry(3, 1);
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 42;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, 128, 42);
      ctx.fillStyle = '#00ccff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${h}m`, 64, 30);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      const marker = new THREE.Mesh(markerGeo, mat);
      marker.position.set(-10, h, -10);
      scene.add(marker);
    }

    // Player
    const config = generateAvatarConfig(currentUser.uid, userProfile.displayName || 'Player', userProfile.role || 'user', userProfile.photoURL, userProfile.level, userProfile.username, !!userProfile.isPremium);
    const player = createHumanoid(config);
    player.root.position.set(0, 4, 0);
    scene.add(player.root);
    playerRef.current = player;

    // Input
    const input = inputRef.current;
    const onKeyDown = (e: KeyboardEvent) => { if (!(e.target instanceof HTMLInputElement)) input.keys.add(e.code); };
    const onKeyUp = (e: KeyboardEvent) => input.keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        cameraAngleRef.current -= e.movementX * 0.003;
        cameraPitchRef.current = Math.max(-0.5, Math.min(1.2, cameraPitchRef.current + e.movementY * 0.003));
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
          cameraPitchRef.current = Math.max(-0.5, Math.min(1.2, cameraPitchRef.current + (t.clientY - input.cameraTouch.lastY) * 0.005));
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

    const clock = clockRef.current;
    clock.start();

    let onZipline: Zipline | null = null;
    let ziplineT = 0;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      if (!finishedRef.current) {
        timerRef.current += dt;
        if (Math.floor(timerRef.current * 10) % 3 === 0) setTimer(timerRef.current);
      }

      const body = physicsRef.current;

      // Zipline movement
      if (onZipline) {
        ziplineT += dt * 0.5;
        if (ziplineT >= 1) {
          body.pos.copy(onZipline.end);
          body.vel.set(0, -2, 0);
          onZipline = null;
          body.grounded = false;
        } else {
          body.pos.lerpVectors(onZipline.start, onZipline.end, ziplineT);
          body.vel.set(0, 0, 0);
        }
      } else {
        const { moveX, moveZ, jump, sprint } = getMovementFromInput(input);
        const speed = sprint ? SPRINT_SPEED : MOVE_SPEED;
        const sin = Math.sin(cameraAngleRef.current);
        const cos = Math.cos(cameraAngleRef.current);
        const wmx = moveX * cos - moveZ * sin;
        const wmz = moveX * sin + moveZ * cos;

        body.vel.x = wmx * speed;
        body.vel.z = wmz * speed;

        // Wall detection and wall jump
        let wallSlide = false;
        let wallNormal: THREE.Vector3 | null = null;

        for (const b of city.buildings) {
          if (!b.mesh) continue;
          const hw = b.w / 2;
          const hd = b.d / 2;
          const bx = b.x;
          const bz = b.z;

          // Check if player is beside the building wall
          const margin = 0.8;
          if (body.pos.y > 0 && body.pos.y < b.h &&
              body.pos.x > bx - hw - margin && body.pos.x < bx + hw + margin &&
              body.pos.z > bz - hd - margin && body.pos.z < bz + hd + margin) {

            // Determine which face
            const distLeft = Math.abs(body.pos.x - (bx - hw));
            const distRight = Math.abs(body.pos.x - (bx + hw));
            const distFront = Math.abs(body.pos.z - (bz + hd));
            const distBack = Math.abs(body.pos.z - (bz - hd));
            const minDist = Math.min(distLeft, distRight, distFront, distBack);

            if (minDist < margin) {
              // Standing on top check
              if (body.pos.y >= b.h - 0.5 && body.vel.y <= 0 &&
                  body.pos.x > bx - hw && body.pos.x < bx + hw &&
                  body.pos.z > bz - hd && body.pos.z < bz + hd) {
                body.pos.y = b.h;
                body.vel.y = 0;
                body.grounded = true;
                continue;
              }

              // Wall slide & wall jump
              if (!body.grounded && body.vel.y < 0) {
                if (minDist === distLeft) wallNormal = new THREE.Vector3(-1, 0, 0);
                else if (minDist === distRight) wallNormal = new THREE.Vector3(1, 0, 0);
                else if (minDist === distFront) wallNormal = new THREE.Vector3(0, 0, 1);
                else wallNormal = new THREE.Vector3(0, 0, -1);

                wallSlide = true;
                body.vel.y = Math.max(body.vel.y, WALL_SLIDE_SPEED);
                wallContactRef.current = { normal: wallNormal, time: time };

                // Push away from wall slightly
                body.pos.x += wallNormal.x * 0.02;
                body.pos.z += wallNormal.z * 0.02;
              }
            }

            // Collision pushout
            if (body.pos.x > bx - hw - 0.3 && body.pos.x < bx + hw + 0.3 &&
                body.pos.z > bz - hd - 0.3 && body.pos.z < bz + hd + 0.3 &&
                body.pos.y < b.h) {
              const pushX = body.pos.x < bx ? bx - hw - 0.35 : bx + hw + 0.35;
              const pushZ = body.pos.z < bz ? bz - hd - 0.35 : bz + hd + 0.35;
              if (Math.abs(body.pos.x - pushX) < Math.abs(body.pos.z - pushZ)) {
                body.pos.x = pushX;
              } else {
                body.pos.z = pushZ;
              }
            }
          }
        }

        setWallSliding(wallSlide);

        // Jump / wall jump
        if (jump) {
          if (body.grounded) {
            body.vel.y = JUMP_FORCE;
            body.grounded = false;
          } else if (wallContactRef.current && time - wallContactRef.current.time < 0.3) {
            body.vel.y = WALL_JUMP_FORCE;
            body.vel.x += wallContactRef.current.normal.x * 15;
            body.vel.z += wallContactRef.current.normal.z * 15;
            wallContactRef.current = null;
            body.grounded = false;
          }
        }

        body.vel.y += GRAVITY * dt;
        body.pos.x += body.vel.x * dt;
        body.pos.y += body.vel.y * dt;
        body.pos.z += body.vel.z * dt;

        // Ground
        if (body.pos.y <= 0) {
          body.pos.y = 0;
          body.vel.y = 0;
          body.grounded = true;
        }

        // Face direction
        const mLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (mLen > 0.1) {
          const tgt = Math.atan2(wmx, wmz);
          let diff = tgt - body.rot;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          body.rot += diff * 10 * dt;
        }

        // Zipline pickup
        for (const zl of city.ziplines) {
          if (body.pos.distanceToSquared(zl.start) < 6 && !onZipline) {
            onZipline = zl;
            ziplineT = 0;
          }
        }
      }

      // Death plane
      if (body.pos.y < -5) respawn();

      // Track max height
      if (body.pos.y > maxHeightRef.current) {
        maxHeightRef.current = Math.round(body.pos.y);
        setMaxHeight(maxHeightRef.current);
      }

      // Checkpoints
      for (let i = 0; i < city.checkpoints.length; i++) {
        const cp = city.checkpoints[i];
        if (cp.reached) continue;
        if (body.pos.distanceToSquared(cp.pos) < 16) {
          cp.reached = true;
          checkpointPosRef.current.copy(cp.pos);
          setCurrentCheckpoint(i + 1);

          if (cp.mesh) {
            (cp.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xffdd00);
            (cp.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xffdd00);
          }

          if (i === city.checkpoints.length - 1 && !finishedRef.current) {
            finishedRef.current = true;
            setFinished(true);
          }
        }
      }

      // Rotate checkpoints
      city.checkpoints.forEach(cp => {
        if (cp.mesh) cp.mesh.rotation.y += dt;
      });

      // Update player
      if (playerRef.current) {
        playerRef.current.root.position.copy(body.pos);
        playerRef.current.root.rotation.y = body.rot;
        const anim = onZipline ? 'fall' : (wallSliding ? 'fall' : getAnimState(body.vel.x, body.vel.z, body.vel.y, body.grounded, false));
        animateHumanoid(playerRef.current, anim, time, dt);
      }

      updateThirdPersonCamera(camera, body.pos, cameraAngleRef.current, cameraPitchRef.current, 18, 10, dt);
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
        <div className="bg-black/60 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-cyan-500/20 space-y-1 min-w-[140px]">
          <div className="flex items-center gap-2 text-sm">
            <Timer size={14} className="text-cyan-400" />
            <span className="font-mono text-cyan-400 font-bold">{formatTime(timer)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ArrowUp size={14} className="text-yellow-400" />
            <span className="text-yellow-400">{maxHeight}m</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <MapPin size={12} />
            <span>Checkpoint {currentCheckpoint}/{totalCheckpoints}</span>
          </div>
        </div>

        {wallSliding && (
          <motion.div
            className="bg-blue-500/20 border border-blue-500/30 text-blue-400 px-2 py-1 rounded-lg text-xs font-bold text-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            WALL SLIDE
          </motion.div>
        )}

        <button onClick={resetGame} className="bg-black/60 backdrop-blur-md text-white p-2 rounded-xl border border-white/10 hover:bg-white/10">
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Height progress */}
      <div className="absolute top-4 left-16 z-40 h-48">
        <div className="relative w-3 h-full bg-black/40 rounded-full overflow-hidden backdrop-blur-md border border-white/5">
          <motion.div
            className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-full"
            animate={{ height: `${Math.min(100, (maxHeight / 80) * 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="text-center mt-1 text-[10px] text-gray-500">80m</div>
      </div>

      {/* Finish */}
      <AnimatePresence>
        {finished && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-gray-900/90 border border-cyan-500/30 rounded-2xl p-8 max-w-sm text-center"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
            >
              <Trophy size={48} className="text-cyan-400 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">Summit Reached!</h2>
              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-center gap-2 text-cyan-400">
                  <Timer size={18} />
                  <span className="font-mono text-lg">{formatTime(timer)}</span>
                </div>
                <div className="text-yellow-400">Peak: {maxHeight}m</div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {[1, 2, 3].map(s => (
                    <Star key={s} size={20} className={timer < s * 120 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                  ))}
                </div>
              </div>
              <button onClick={resetGame} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-6 py-2.5 rounded-xl">
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <AnimatePresence>
        {showControls && !finished && (
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md text-white text-xs px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span>WASD: Move</span><span>·</span><span>Space: Jump/Wall Jump</span><span>·</span><span>Shift: Sprint</span>
            <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-white ml-2">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile jump */}
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
