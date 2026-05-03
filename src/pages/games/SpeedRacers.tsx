import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useAuth } from '../../contexts/AuthContext';
import { Timer, Trophy, RotateCcw, Gauge, Flag, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createRenderer } from './shared';

// ============= TRACK GENERATION =============
interface TrackPoint {
  pos: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  width: number;
}

function generateTrackPoints(): TrackPoint[] {
  const points: TrackPoint[] = [];
  const segments = 120;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Figure-8 inspired track with elevation changes
    const baseRadius = 80;
    const x = baseRadius * Math.sin(t) + 30 * Math.sin(t * 2);
    const z = baseRadius * Math.cos(t) * 0.8 + 20 * Math.cos(t * 3);
    const y = 8 * Math.sin(t * 2) + 4 * Math.sin(t * 4);
    points.push({
      pos: new THREE.Vector3(x, y, z),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      width: 14 + 4 * Math.sin(t * 3),
    });
  }
  // Compute forward and right vectors
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const fwd = new THREE.Vector3().subVectors(next.pos, points[i].pos).normalize();
    points[i].forward = fwd;
    points[i].right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  }
  return points;
}

function buildTrackMesh(scene: THREE.Scene, track: TrackPoint[]) {
  // Road surface
  const roadGeo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < track.length; i++) {
    const p = track[i];
    const left = new THREE.Vector3().copy(p.right).multiplyScalar(-p.width / 2).add(p.pos);
    const right = new THREE.Vector3().copy(p.right).multiplyScalar(p.width / 2).add(p.pos);
    verts.push(left.x, left.y, left.z, right.x, right.y, right.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, i / track.length * 10, 1, i / track.length * 10);
    if (i < track.length - 1) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  // Close loop
  const last = (track.length - 1) * 2;
  indices.push(last, last + 1, 0, last + 1, 1, 0);

  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  scene.add(road);

  // Road stripes
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.7 });
  for (let i = 0; i < track.length; i += 4) {
    const p = track[i];
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), stripeMat);
    stripe.position.copy(p.pos).add(new THREE.Vector3(0, 0.05, 0));
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = -Math.atan2(p.forward.z, p.forward.x);
    scene.add(stripe);
  }

  // Barriers (neon rails)
  const barrierColors = [0x00ffcc, 0xff00ff];
  for (let side = 0; side < 2; side++) {
    const positions: number[] = [];
    for (let i = 0; i <= track.length; i++) {
      const p = track[i % track.length];
      const offset = side === 0 ? -1 : 1;
      const pt = new THREE.Vector3().copy(p.right).multiplyScalar(offset * (p.width / 2 + 0.5)).add(p.pos);
      pt.y += 0.8;
      positions.push(pt.x, pt.y, pt.z);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: barrierColors[side], transparent: true, opacity: 0.6 });
    scene.add(new THREE.Line(lineGeo, lineMat));
  }

  // Start/finish line
  const startP = track[0];
  const startLine = new THREE.Mesh(
    new THREE.BoxGeometry(startP.width, 0.1, 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  startLine.position.copy(startP.pos).add(new THREE.Vector3(0, 0.1, 0));
  scene.add(startLine);

  // Checkered pattern on start line
  const checkerMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (let x = 0; x < 6; x++) {
    for (let z = 0; z < 2; z++) {
      if ((x + z) % 2 === 0) continue;
      const sq = new THREE.Mesh(new THREE.BoxGeometry(startP.width / 6, 0.12, 1), checkerMat);
      sq.position.set(
        startP.pos.x + (x - 2.5) * (startP.width / 6),
        startP.pos.y + 0.12,
        startP.pos.z + (z - 0.5)
      );
      scene.add(sq);
    }
  }
}

// ============= VEHICLE =============
function createVehicle(scene: THREE.Scene, color: number): THREE.Group {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(2.2, 0.7, 4.2);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x2288ff, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.0, -0.3);
  group.add(cabin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const wheelPositions = [[-1.1, 0.35, 1.3], [1.1, 0.35, 1.3], [-1.1, 0.35, -1.3], [1.1, 0.35, -1.3]];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    group.add(wheel);
  });

  // Headlights
  const lightGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
  [[-0.7, 0.5, 2.15], [0.7, 0.5, 2.15]].forEach(([lx, ly, lz]) => {
    const hl = new THREE.Mesh(lightGeo, lightMat);
    hl.position.set(lx, ly, lz);
    group.add(hl);
  });

  // Tail lights
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  [[-0.7, 0.5, -2.15], [0.7, 0.5, -2.15]].forEach(([lx, ly, lz]) => {
    const tl = new THREE.Mesh(lightGeo, tailMat);
    tl.position.set(lx, ly, lz);
    group.add(tl);
  });

  // Neon underglow
  const glowLight = new THREE.PointLight(color, 1.5, 8);
  glowLight.position.set(0, 0.1, 0);
  group.add(glowLight);

  // Exhaust particles position
  scene.add(group);
  return group;
}

// ============= NITRO PICKUP =============
function createNitroPickup(scene: THREE.Scene, x: number, y: number, z: number): THREE.Mesh {
  const geo = new THREE.OctahedronGeometry(0.8, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x0066ff, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + 1.5, z);
  mesh.castShadow = true;
  scene.add(mesh);
  const glow = new THREE.PointLight(0x00ccff, 0.5, 6);
  glow.position.copy(mesh.position);
  scene.add(glow);
  return mesh;
}

export function SpeedRacers() {
  const { currentUser, userProfile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());

  const [speed, setSpeed] = useState(0);
  const [lap, setLap] = useState(0);
  const [totalLaps] = useState(3);
  const [lapTime, setLapTime] = useState(0);
  const [bestLap, setBestLap] = useState(Infinity);
  const [totalTime, setTotalTime] = useState(0);
  const [nitro, setNitro] = useState(0);
  const [finished, setFinished] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [started, setStarted] = useState(false);

  const lapRef = useRef(0);
  const lapTimeRef = useRef(0);
  const bestLapRef = useRef(Infinity);
  const totalTimeRef = useRef(0);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  const resetRace = useCallback(() => {
    lapRef.current = 0;
    lapTimeRef.current = 0;
    bestLapRef.current = Infinity;
    totalTimeRef.current = 0;
    finishedRef.current = false;
    startedRef.current = false;
    setLap(0); setLapTime(0); setBestLap(Infinity); setTotalTime(0);
    setFinished(false); setStarted(false); setCountdown(3); setNitro(0);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !currentUser || !userProfile) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070714);
    scene.fog = new THREE.FogExp2(0x070714, 0.004);

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 500);
    const renderer = createRenderer(container);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0x222244, 0.8));
    scene.add(new THREE.HemisphereLight(0x1a1a4e, 0x050510, 0.5));
    const dir = new THREE.DirectionalLight(0x8888ff, 0.6);
    dir.position.set(50, 80, 30);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.far = 250;
    dir.shadow.camera.left = -120; dir.shadow.camera.right = 120;
    dir.shadow.camera.top = 120; dir.shadow.camera.bottom = -120;
    scene.add(dir);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.4;
      const r = 200 + Math.random() * 100;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) + 50;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 })));

    // Ground
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x0d0d1a, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(500, 80, 0x00ffcc, 0x001a15);
    grid.position.y = -4.99;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.15;
    scene.add(grid);

    // Build track
    const track = generateTrackPoints();
    buildTrackMesh(scene, track);

    // Nitro pickups
    const nitros: { mesh: THREE.Mesh; collected: boolean; respawnTimer: number }[] = [];
    for (let i = 0; i < track.length; i += 15) {
      const p = track[i];
      const mesh = createNitroPickup(scene, p.pos.x, p.pos.y, p.pos.z);
      nitros.push({ mesh, collected: false, respawnTimer: 0 });
    }

    // Player vehicle
    const vehicle = createVehicle(scene, 0xff4444);
    vehicle.position.copy(track[0].pos);
    vehicle.position.y += 1;

    // Vehicle state
    let vSpeed = 0; // current forward speed
    let trackIdx = 0; // closest track point index
    let lateralOffset = 0; // offset from center of track
    let nitroLevel = 0;
    let nitroActive = false;
    let countdownVal = 3;
    let countdownTimer = 0;
    let gameStarted = false;

    // Input
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => { if (!(e.target instanceof HTMLInputElement)) keys.add(e.code); };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

    let touchAccel = false, touchBrake = false, touchLeft = false, touchRight = false, touchNitro = false;

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

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

      // Countdown
      if (!gameStarted) {
        countdownTimer += dt;
        const newCountdown = 3 - Math.floor(countdownTimer);
        if (newCountdown !== countdownVal) {
          countdownVal = newCountdown;
          setCountdown(countdownVal);
        }
        if (countdownTimer >= 4) {
          gameStarted = true;
          startedRef.current = true;
          setStarted(true);
        }
      }

      if (gameStarted && !finishedRef.current) {
        totalTimeRef.current += dt;
        lapTimeRef.current += dt;
        if (Math.floor(totalTimeRef.current * 10) % 3 === 0) {
          setTotalTime(totalTimeRef.current);
          setLapTime(lapTimeRef.current);
        }

        // Input
        const accel = keys.has('KeyW') || keys.has('ArrowUp') || touchAccel;
        const brake = keys.has('KeyS') || keys.has('ArrowDown') || touchBrake;
        const left = keys.has('KeyA') || keys.has('ArrowLeft') || touchLeft;
        const right = keys.has('KeyD') || keys.has('ArrowRight') || touchRight;
        const useNitro = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Space') || touchNitro;

        // Acceleration
        const maxSpeed = nitroActive ? 85 : 55;
        const accelRate = 35;
        const brakeRate = 50;
        const friction = 15;

        if (accel) vSpeed = Math.min(maxSpeed, vSpeed + accelRate * dt);
        else if (brake) vSpeed = Math.max(-20, vSpeed - brakeRate * dt);
        else vSpeed -= Math.sign(vSpeed) * friction * dt;
        if (Math.abs(vSpeed) < 0.5 && !accel && !brake) vSpeed = 0;

        // Nitro
        if (useNitro && nitroLevel > 0) {
          nitroActive = true;
          nitroLevel = Math.max(0, nitroLevel - dt * 30);
          setNitro(nitroLevel);
        } else {
          nitroActive = false;
        }

        // Move along track
        const moveAmount = vSpeed * dt;
        let dist = 0;
        while (dist < Math.abs(moveAmount)) {
          const step = Math.sign(moveAmount);
          trackIdx = ((trackIdx + step) + track.length) % track.length;
          const p = track[trackIdx];
          const next = track[(trackIdx + 1) % track.length];
          dist += p.pos.distanceTo(next.pos);
        }

        // Lateral movement (steering)
        const steerSpeed = 25;
        if (left) lateralOffset -= steerSpeed * dt;
        if (right) lateralOffset += steerSpeed * dt;
        const p = track[trackIdx];
        const maxLateral = p.width / 2 - 1.5;
        lateralOffset = Math.max(-maxLateral, Math.min(maxLateral, lateralOffset));
        lateralOffset *= 0.98; // slight centering

        // Position vehicle
        const targetPos = new THREE.Vector3().copy(p.pos).add(
          new THREE.Vector3().copy(p.right).multiplyScalar(lateralOffset)
        );
        targetPos.y += 1;
        vehicle.position.lerp(targetPos, 10 * dt);

        // Orient vehicle
        const lookTarget = new THREE.Vector3().copy(vehicle.position).add(p.forward);
        vehicle.lookAt(lookTarget);

        // Lap detection
        if (trackIdx < 5 && trackIdx > 0) {
          const wasNear = trackIdx === 1;
          if (wasNear && lapRef.current >= 0) {
            const lapT = lapTimeRef.current;
            if (lapT > 5) { // prevent double-counting
              lapRef.current++;
              setLap(lapRef.current);
              if (lapT < bestLapRef.current) {
                bestLapRef.current = lapT;
                setBestLap(lapT);
              }
              lapTimeRef.current = 0;

              if (lapRef.current >= 3) {
                finishedRef.current = true;
                setFinished(true);
              }
            }
          }
        }

        // Nitro pickups
        for (const n of nitros) {
          if (n.collected) {
            n.respawnTimer -= dt;
            if (n.respawnTimer <= 0) {
              n.collected = false;
              n.mesh.visible = true;
            }
            continue;
          }
          n.mesh.rotation.y += 2 * dt;
          n.mesh.position.y = n.mesh.position.y + Math.sin(time * 3 + n.mesh.position.x) * 0.002;
          const dist2 = vehicle.position.distanceToSquared(n.mesh.position);
          if (dist2 < 12) {
            n.collected = true;
            n.mesh.visible = false;
            n.respawnTimer = 8;
            nitroLevel = Math.min(100, nitroLevel + 25);
            setNitro(nitroLevel);
          }
        }

        setSpeed(Math.abs(Math.round(vSpeed)));
      }

      // Camera (chase cam)
      const p = track[trackIdx];
      const camTarget = new THREE.Vector3().copy(vehicle.position);
      const camOffset = new THREE.Vector3().copy(p.forward).multiplyScalar(-12).add(new THREE.Vector3(0, 6, 0));
      const camPos = new THREE.Vector3().copy(camTarget).add(camOffset);
      camera.position.lerp(camPos, 5 * dt);
      camera.lookAt(vehicle.position.x, vehicle.position.y + 1, vehicle.position.z);

      renderer.render(scene, camera);
    };
    animate();

    // Expose touch controls via refs stored on container
    const touchControlDiv = container.querySelector('.touch-controls');
    const onTouchStartBtn = (btn: string) => {
      if (btn === 'accel') touchAccel = true;
      if (btn === 'brake') touchBrake = true;
      if (btn === 'left') touchLeft = true;
      if (btn === 'right') touchRight = true;
      if (btn === 'nitro') touchNitro = true;
    };
    const onTouchEndBtn = (btn: string) => {
      if (btn === 'accel') touchAccel = false;
      if (btn === 'brake') touchBrake = false;
      if (btn === 'left') touchLeft = false;
      if (btn === 'right') touchRight = false;
      if (btn === 'nitro') touchNitro = false;
    };
    (container as any)._touchStart = onTouchStartBtn;
    (container as any)._touchEnd = onTouchEndBtn;

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [currentUser, userProfile]);

  const formatTime = (t: number) => {
    if (!isFinite(t) || t <= 0) return '--:--.--';
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleTouch = (btn: string, start: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    if (start) (container as any)._touchStart?.(btn);
    else (container as any)._touchEnd?.(btn);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-gray-900" style={{ touchAction: 'none' }}>
      {/* Countdown */}
      <AnimatePresence>
        {!started && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            exit={{ opacity: 0 }}
          >
            <motion.div
              key={countdown}
              className="text-8xl font-black text-white drop-shadow-lg"
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {countdown > 0 ? countdown : 'GO!'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
        <div className="bg-black/60 backdrop-blur-md text-white px-3 py-2 rounded-xl border border-white/10 space-y-1 min-w-[140px]">
          <div className="flex items-center gap-2">
            <Gauge size={14} className="text-red-400" />
            <span className="font-mono text-lg font-bold text-red-400">{speed}</span>
            <span className="text-xs text-gray-400">km/h</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Flag size={12} className="text-green-400" />
            <span>Lap {Math.min(lap + 1, totalLaps)}/{totalLaps}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Timer size={12} className="text-cyan-400" />
            <span className="font-mono text-cyan-400">{formatTime(lapTime)}</span>
          </div>
          <div className="text-xs text-gray-500">
            Best: <span className="text-yellow-400 font-mono">{formatTime(bestLap)}</span>
          </div>
          <div className="text-xs text-gray-500">
            Total: <span className="font-mono">{formatTime(totalTime)}</span>
          </div>
        </div>

        {/* Nitro bar */}
        <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-blue-400" />
            <span className="text-white text-xs font-bold">NITRO</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
              animate={{ width: `${nitro}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        <button onClick={resetRace} className="bg-black/60 backdrop-blur-md text-white p-2 rounded-xl border border-white/10 hover:bg-white/10" title="Restart">
          <RotateCcw size={18} />
        </button>
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
              <h2 className="text-2xl font-black text-white mb-2">Race Complete!</h2>
              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-center gap-2">
                  <Timer size={16} className="text-cyan-400" />
                  <span className="font-mono text-lg text-white">{formatTime(totalTime)}</span>
                </div>
                <div className="text-yellow-400 text-sm">
                  Best Lap: <span className="font-mono">{formatTime(bestLap)}</span>
                </div>
              </div>
              <button
                onClick={resetRace}
                className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold px-6 py-2.5 rounded-xl hover:from-red-400 hover:to-orange-400"
              >
                Race Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls hint */}
      {started && !finished && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/50 backdrop-blur-md text-white text-xs px-4 py-2 rounded-xl border border-white/10 hidden md:flex items-center gap-3">
          <span>W/↑: Accelerate</span><span>·</span><span>S/↓: Brake</span><span>·</span><span>A/D: Steer</span><span>·</span><span>Shift/Space: Nitro</span>
        </div>
      )}

      {/* Mobile touch controls */}
      <div className="absolute bottom-4 left-4 right-4 z-40 md:hidden touch-controls">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 text-white text-lg active:bg-white/30 flex items-center justify-center"
                onTouchStart={() => handleTouch('left', true)}
                onTouchEnd={() => handleTouch('left', false)}
              >◀</button>
              <button
                className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 text-white text-lg active:bg-white/30 flex items-center justify-center"
                onTouchStart={() => handleTouch('right', true)}
                onTouchEnd={() => handleTouch('right', false)}
              >▶</button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="w-14 h-14 bg-blue-500/30 backdrop-blur-md rounded-xl border border-blue-400/30 text-white active:bg-blue-500/50 flex items-center justify-center"
              onTouchStart={() => handleTouch('nitro', true)}
              onTouchEnd={() => handleTouch('nitro', false)}
            ><Zap size={20} /></button>
            <button
              className="w-14 h-14 bg-red-500/30 backdrop-blur-md rounded-xl border border-red-400/30 text-white active:bg-red-500/50 flex items-center justify-center"
              onTouchStart={() => handleTouch('brake', true)}
              onTouchEnd={() => handleTouch('brake', false)}
            >🛑</button>
            <button
              className="w-14 h-14 bg-green-500/30 backdrop-blur-md rounded-xl border border-green-400/30 text-white active:bg-green-500/50 flex items-center justify-center"
              onTouchStart={() => handleTouch('accel', true)}
              onTouchEnd={() => handleTouch('accel', false)}
            >🏎️</button>
          </div>
        </div>
      </div>
    </div>
  );
}
