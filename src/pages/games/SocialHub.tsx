import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { doc, setDoc, onSnapshot, collection, deleteDoc, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Send, X, Users as UsersIcon, Heart, Sparkles, MessageCircle, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createSnaplinkAvatar, animateHumanoid, generateAvatarConfig, disposeHumanoid,
  createSkybox, createGround, setupLighting, createFloatingParticles, animateParticles,
  createNeonBuilding, createTree, createStreetLamp,
  createRenderer, updateThirdPersonCamera,
  createInputState, getMovementFromInput, getAnimState,
  updatePhysics, updateTrackedPlayers,
  type HumanoidParts, type AnimState, type PlayerState, type TrackedPlayer, type InputState, type PhysicsBody,
} from './shared';

const WORLD_SIZE = 250;
const CAMERA_DISTANCE = 14;
const CAMERA_HEIGHT = 8;
const SYNC_INTERVAL = 150;

export function SocialHub() {
  const { currentUser, userProfile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playerRef = useRef<HumanoidParts | null>(null);
  const physicsRef = useRef<PhysicsBody>({ pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), rot: 0, grounded: true });
  const inputRef = useRef<InputState>(createInputState());
  const cameraAngleRef = useRef(0);
  const cameraPitchRef = useRef(0.3);
  const trackedPlayersRef = useRef(new Map<string, TrackedPlayer>());
  const remotePlayersRef = useRef<PlayerState[]>([]);
  const playerCountRef = useRef(1);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animFrameRef = useRef(0);
  const lastSyncRef = useRef(0);
  const clockRef = useRef(new THREE.Clock());
  const chatOpenRef = useRef(false);
  const currentEmoteRef = useRef<AnimState>('idle');

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; displayName: string; text: string; timestamp: number }[]>([]);
  const [playerCount, setPlayerCount] = useState(1);
  const [currentEmote, setCurrentEmote] = useState<AnimState>('idle');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    const syncFullscreen = () => {
      const fullscreenElement = document.fullscreenElement;
      const containsGame = !!(fullscreenElement && containerRef.current && fullscreenElement.contains(containerRef.current));
      setIsFullscreen(containsGame);
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
    };
  }, []);

  // ===== BUILD WORLD =====
  const buildWorld = useCallback((scene: THREE.Scene) => {
    createSkybox(scene, 0x070714);
    createGround(scene, WORLD_SIZE, 0x0d0d1a, 0x00ffcc);
    setupLighting(scene, 0x00ffcc);

    // Neon buildings — cyberpunk city layout
    const buildingColors = [0x00ffcc, 0xff00ff, 0xff6600, 0x00aaff, 0xffaa00, 0xff4488, 0xaa44ff, 0x44ff88];
    const buildingConfigs = [
      { x: -40, z: -40, w: 16, h: 45, d: 16 }, { x: 40, z: -40, w: 14, h: 55, d: 14 },
      { x: -40, z: 40, w: 18, h: 38, d: 12 }, { x: 40, z: 40, w: 12, h: 62, d: 16 },
      { x: 0, z: -65, w: 20, h: 50, d: 15 }, { x: 65, z: 0, w: 15, h: 42, d: 20 },
      { x: -65, z: 0, w: 14, h: 48, d: 18 }, { x: 0, z: 65, w: 22, h: 36, d: 14 },
      { x: -80, z: -80, w: 18, h: 60, d: 18 }, { x: 80, z: -80, w: 16, h: 40, d: 20 },
      { x: -80, z: 80, w: 14, h: 52, d: 16 }, { x: 80, z: 80, w: 20, h: 44, d: 14 },
      { x: -25, z: -90, w: 12, h: 35, d: 12 }, { x: 25, z: 90, w: 15, h: 30, d: 15 },
      { x: -100, z: -30, w: 16, h: 55, d: 16 }, { x: 100, z: 30, w: 14, h: 48, d: 18 },
      { x: -50, z: -100, w: 18, h: 42, d: 14 }, { x: 50, z: 100, w: 12, h: 58, d: 16 },
      { x: -110, z: 60, w: 20, h: 38, d: 20 }, { x: 110, z: -60, w: 16, h: 65, d: 14 },
    ];
    buildingConfigs.forEach((b, i) => {
      createNeonBuilding(scene, b.x, b.z, b.w, b.h, b.d, buildingColors[i % buildingColors.length]);
    });

    // Trees
    const treePositions = [
      [15, 20], [-15, 20], [15, -20], [-15, -20], [0, 30], [30, 0], [-30, 0], [0, -30],
      [50, 50], [-50, 50], [50, -50], [-50, -50], [25, -55], [-25, 55], [70, 35], [-70, -35],
    ];
    treePositions.forEach(([x, z]) => createTree(scene, x, z, 0.8 + Math.random() * 0.6));

    // Street lamps
    for (let i = -8; i <= 8; i++) {
      createStreetLamp(scene, i * 14, -8);
      createStreetLamp(scene, i * 14, 8);
      createStreetLamp(scene, -8, i * 14);
      createStreetLamp(scene, 8, i * 14);
    }

    // Central fountain
    const fountainBase = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 6, 1.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x1a1a3e, metalness: 0.8, roughness: 0.2 })
    );
    fountainBase.position.y = 0.75;
    fountainBase.receiveShadow = true;
    scene.add(fountainBase);

    const waterMat = new THREE.MeshStandardMaterial({ color: 0x00ccff, transparent: true, opacity: 0.5, emissive: 0x004488, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.3 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.3, 24), waterMat);
    water.position.y = 1.4;
    scene.add(water);

    const fountainPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a2a4e, metalness: 0.6, roughness: 0.3 })
    );
    fountainPillar.position.y = 3;
    scene.add(fountainPillar);

    const fountainTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 0.5 })
    );
    fountainTop.position.y = 5.2;
    scene.add(fountainTop);

    // Road markings
    const roadGeo = new THREE.PlaneGeometry(8, WORLD_SIZE * 1.8);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.9 });
    const roadH = new THREE.Mesh(roadGeo, roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.y = 0.02;
    scene.add(roadH);
    const roadV = roadH.clone();
    roadV.rotation.z = Math.PI / 2;
    scene.add(roadV);

    // Road stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
    for (let i = -20; i <= 20; i++) {
      const stripeH = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.2), stripeMat);
      stripeH.rotation.x = -Math.PI / 2;
      stripeH.position.set(i * 6, 0.03, 0);
      scene.add(stripeH);
      const stripeV = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3), stripeMat);
      stripeV.rotation.x = -Math.PI / 2;
      stripeV.position.set(0, 0.03, i * 6);
      scene.add(stripeV);
    }

    // Benches around fountain
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const bx = Math.cos(angle) * 10;
      const bz = Math.sin(angle) * 10;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1), benchMat);
      bench.position.set(bx, 0.3, bz);
      bench.rotation.y = angle + Math.PI / 2;
      bench.castShadow = true;
      scene.add(bench);
    }

    // Particles
    return createFloatingParticles(scene, 200, WORLD_SIZE);
  }, []);

  // ===== INIT =====
  useEffect(() => {
    if (!containerRef.current || !currentUser || !userProfile) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500);
    cameraRef.current = camera;
    const renderer = createRenderer(container);
    rendererRef.current = renderer;

    const particles = buildWorld(scene);
    particlesRef.current = particles;

    // Create player avatar
    const config = generateAvatarConfig(
      currentUser.uid,
      userProfile.displayName || 'Player',
      userProfile.role || 'user',
      userProfile.photoURL,
      userProfile.level,
      userProfile.username,
      !!userProfile.isPremium || (!!userProfile.premiumUntil && new Date(userProfile.premiumUntil) > new Date()),
    );
    const player = createSnaplinkAvatar(config);
    player.root.position.set(0, 0, 15);
    scene.add(player.root);
    playerRef.current = player;
    physicsRef.current.pos.set(0, 0, 15);

    // Input
    const input = inputRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      input.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => input.keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        cameraAngleRef.current -= e.movementX * 0.003;
        cameraPitchRef.current = Math.max(-0.5, Math.min(1.2, cameraPitchRef.current + e.movementY * 0.003));
      }
    };
    const onClick = () => {
      if (!chatOpenRef.current) renderer.domElement.requestPointerLock();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    // Touch controls
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (touch.clientX < window.innerWidth / 2) {
        input.joystick.active = true;
        input.joystick.startX = touch.clientX;
        input.joystick.startY = touch.clientY;
        input.joystick.dx = 0;
        input.joystick.dy = 0;
      } else {
        input.cameraTouch.active = true;
        input.cameraTouch.lastX = touch.clientX;
        input.cameraTouch.lastY = touch.clientY;
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
      input.joystick.active = false;
      input.joystick.dx = 0;
      input.joystick.dy = 0;
      input.cameraTouch.active = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Gameloop
    const clock = clockRef.current;
    clock.start();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      const { moveX, moveZ, jump, sprint } = getMovementFromInput(input);
      const body = physicsRef.current;
      updatePhysics(body, moveX, moveZ, jump, sprint, cameraAngleRef.current, dt, WORLD_SIZE);

      // Update player mesh
      if (playerRef.current) {
        playerRef.current.root.position.copy(body.pos);
        playerRef.current.root.rotation.y = body.rot;
        const emote = currentEmoteRef.current;
        const anim = emote !== 'idle' ? emote : getAnimState(body.vel.x, body.vel.z, body.vel.y, body.grounded, sprint);
        animateHumanoid(playerRef.current, anim, time, dt);
      }

      // Camera
      updateThirdPersonCamera(camera, body.pos, cameraAngleRef.current, cameraPitchRef.current, CAMERA_DISTANCE, CAMERA_HEIGHT, dt);

      // Particles
      if (particlesRef.current) animateParticles(particlesRef.current, time);

      // Tracked players
      const count = updateTrackedPlayers(trackedPlayersRef.current, scene, currentUser.uid, remotePlayersRef.current, dt, time) + 1;
      if (playerCountRef.current !== count) {
        playerCountRef.current = count;
        setPlayerCount(count);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      trackedPlayersRef.current.forEach(tp => disposeHumanoid(tp.humanoid));
      trackedPlayersRef.current.clear();
      remotePlayersRef.current = [];
      if (playerRef.current) disposeHumanoid(playerRef.current);
    };
  }, [currentUser, userProfile, buildWorld]);

  // ===== FIRESTORE SYNC =====
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    const unsub = onSnapshot(collection(db, 'game_positions'), snap => {
      const players: PlayerState[] = [];
      snap.forEach(d => {
        const data = d.data() as PlayerState;
        players.push(data);
      });
      remotePlayersRef.current = players;
      trackedPlayersRef.current.forEach((_, uid) => {
        const tp = trackedPlayersRef.current.get(uid);
        if (tp) {
          const updated = players.find(p => p.uid === uid);
          if (updated) {
            tp.targetPos.set(updated.x, updated.y, updated.z);
            tp.targetRotY = updated.rotY;
            tp.data = updated;
          }
        }
      });
      // Add new players from snapshot
      const scene = sceneRef.current;
      if (!scene) return;
      const now = Date.now();
      for (const p of players) {
        if (p.uid === currentUser.uid) continue;
        if (now - p.lastUpdate > 12000) continue;
        if (!trackedPlayersRef.current.has(p.uid)) {
          const config = generateAvatarConfig(p.uid, p.displayName, p.role, p.photoURL, p.level, p.username, p.isPremium);
          const humanoid = createSnaplinkAvatar(config);
          humanoid.root.position.set(p.x, p.y, p.z);
          humanoid.root.rotation.y = p.rotY;
          scene.add(humanoid.root);
          trackedPlayersRef.current.set(p.uid, {
            data: p,
            humanoid,
            targetPos: new THREE.Vector3(p.x, p.y, p.z),
            targetRotY: p.rotY,
          });
        }
      }
      const nextCount = trackedPlayersRef.current.size + 1;
      if (playerCountRef.current !== nextCount) {
        playerCountRef.current = nextCount;
        setPlayerCount(nextCount);
      }
    });

    // Sync own position
    const interval = setInterval(() => {
      const body = physicsRef.current;
      const now = Date.now();
      if (now - lastSyncRef.current < SYNC_INTERVAL) return;
      lastSyncRef.current = now;
      const vel = body.vel;
      const anim = getAnimState(vel.x, vel.z, vel.y, body.grounded, false);
      setDoc(doc(db, 'game_positions', currentUser.uid), {
        uid: currentUser.uid,
        displayName: userProfile.displayName || 'Player',
        username: userProfile.username || '',
        photoURL: userProfile.photoURL || '',
        role: userProfile.role || 'user',
        level: userProfile.level || 1,
        isPremium: !!userProfile.isPremium || (!!userProfile.premiumUntil && new Date(userProfile.premiumUntil) > new Date()),
        x: Math.round(body.pos.x * 10) / 10,
        y: Math.round(body.pos.y * 10) / 10,
        z: Math.round(body.pos.z * 10) / 10,
        rotY: Math.round(body.rot * 100) / 100,
        animState: currentEmoteRef.current !== 'idle' ? currentEmoteRef.current : anim,
        lastUpdate: now,
      }, { merge: true }).catch(() => {});
    }, SYNC_INTERVAL);

    // Chat listener
    const chatUnsub = onSnapshot(
      query(collection(db, 'game_chat'), orderBy('timestamp', 'desc'), limit(50)),
      snap => {
        const msgs: typeof chatMessages = [];
        snap.forEach(d => {
          const data = d.data();
          msgs.push({ id: d.id, displayName: data.displayName, text: data.text, timestamp: data.timestamp });
        });
        setChatMessages(msgs.reverse());
      }
    );

    return () => {
      unsub();
      chatUnsub();
      clearInterval(interval);
      remotePlayersRef.current = [];
      deleteDoc(doc(db, 'game_positions', currentUser.uid)).catch(() => {});
    };
  }, [currentUser, userProfile]);

  const sendChat = async () => {
    if (!chatInput.trim() || !currentUser || !userProfile) return;
    const text = chatInput.trim().slice(0, 200);
    setChatInput('');
    try {
      await addDoc(collection(db, 'game_chat'), {
        uid: currentUser.uid,
        displayName: userProfile.displayName || 'Player',
        text,
        timestamp: Date.now(),
      });
    } catch {}
  };

  const emoteList: { icon: React.ReactNode; label: string; anim: AnimState }[] = [
    { icon: <Heart size={16} />, label: 'Dance', anim: 'dance' },
    { icon: <Sparkles size={16} />, label: 'Wave', anim: 'wave' },
    { icon: <span className="text-[11px] font-bold">S</span>, label: 'Sit', anim: 'sit' },
  ];

  const toggleFullscreen = () => {
    const fullscreenElement = document.fullscreenElement;
    const containsGame = !!(fullscreenElement && containerRef.current && fullscreenElement.contains(containerRef.current));

    if (!containsGame) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-gray-900" style={{ touchAction: 'none' }}>
      {/* HUD */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
        <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 border border-white/10">
          <UsersIcon size={14} className="text-green-400" />
          <span>{playerCount} online</span>
        </div>
        <button onClick={toggleFullscreen} className="bg-black/50 backdrop-blur-md text-white p-2 rounded-lg border border-white/10 hover:bg-white/10">
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Emotes */}
      <div className="absolute bottom-20 right-4 z-40 flex flex-col gap-2">
        {emoteList.map(e => (
          <motion.button
            key={e.label}
            className={`p-2.5 rounded-xl border text-white text-xs font-medium ${
              currentEmote === e.anim ? 'bg-purple-500/60 border-purple-400' : 'bg-black/50 border-white/10 hover:bg-white/10'
            } backdrop-blur-md`}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentEmote(prev => { const v = prev === e.anim ? 'idle' : e.anim; currentEmoteRef.current = v; return v; })}
            title={e.label}
          >
            {e.icon}
          </motion.button>
        ))}
      </div>

      {/* Chat toggle */}
      <button
        onClick={() => { const v = !chatOpen; chatOpenRef.current = v; setChatOpen(v); }}
        className="absolute bottom-20 left-4 z-40 bg-black/50 backdrop-blur-md text-white p-2.5 rounded-xl border border-white/10 hover:bg-white/10"
      >
        <MessageCircle size={18} />
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            className="absolute bottom-32 left-4 z-40 w-72 bg-black/70 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <span className="text-white text-xs font-bold">World Chat</span>
              <button onClick={() => { chatOpenRef.current = false; setChatOpen(false); }} className="text-gray-400 hover:text-white"><X size={14} /></button>
            </div>
            <div className="h-48 overflow-y-auto p-2 space-y-1 text-xs">
              {chatMessages.map(m => (
                <div key={m.id} className="text-gray-300"><span className="font-bold text-purple-400">{m.displayName}:</span> {m.text}</div>
              ))}
              {chatMessages.length === 0 && <p className="text-gray-600 text-center py-8">No messages yet</p>}
            </div>
            <div className="flex gap-1.5 p-2 border-t border-white/10">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 bg-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg focus:outline-none placeholder-gray-500"
              />
              <button onClick={sendChat} className="bg-purple-500 text-white p-1.5 rounded-lg hover:bg-purple-400"><Send size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls hint */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md text-white text-xs px-4 py-2 rounded-xl border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-3">
              <span>WASD/Arrows: Move</span>
              <span>·</span>
              <span>Space: Jump</span>
              <span>·</span>
              <span>Shift: Sprint</span>
              <span>·</span>
              <span>Click: Look around</span>
              <button onClick={() => setShowControls(false)} className="ml-2 text-gray-400 hover:text-white"><X size={12} /></button>
            </div>
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
