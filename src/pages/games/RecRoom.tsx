import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, Minimize2, X, Play, AlertTriangle, Gamepad2, Wifi, WifiOff, Smartphone } from 'lucide-react';

// Firebase Realtime Database — fetch bridge URL
const FIREBASE_RTDB = 'https://makespace-b55f6-default-rtdb.firebaseio.com';
const BRIDGE_KEY = 'game-bridge';
const LOCAL_BRIDGE = 'ws://localhost:3100';

type GameState = 'lobby' | 'connecting' | 'launching' | 'playing' | 'error';
type BridgeStatus = { status: string; url: string | null; updatedAt: string; gameRunning: boolean; clients: number } | null;

// Detect mobile
const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

export function RecRoom() {
  const { currentUser, userProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameCountRef = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const [gameState, setGameState] = useState<GameState>('lobby');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [fps, setFps] = useState(0);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>(null);
  const [bridgeLoading, setBridgeLoading] = useState(true);

  // ============ FETCH BRIDGE URL FROM FIREBASE ============
  const fetchBridgeUrl = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${FIREBASE_RTDB}/${BRIDGE_KEY}.json`);
      const data = await res.json();
      setBridgeStatus(data);
      setBridgeLoading(false);
      if (data?.status === 'online' && data?.url) {
        return data.url;
      }
      return null;
    } catch {
      setBridgeLoading(false);
      return null;
    }
  }, []);

  // Poll bridge status every 10s while in lobby
  useEffect(() => {
    fetchBridgeUrl();
    const interval = setInterval(fetchBridgeUrl, 10000);
    return () => clearInterval(interval);
  }, [fetchBridgeUrl]);

  // ============ CONNECT ============
  const connectToGame = useCallback(async () => {
    setGameState('connecting');
    setError('');
    setStatusMsg('Finding game server...');

    // Try remote tunnel URL first, then local
    let url = await fetchBridgeUrl();
    if (!url) {
      setStatusMsg('Trying local connection...');
      url = LOCAL_BRIDGE;
    }

    setStatusMsg(`Connecting to ${url.includes('trycloudflare') ? 'cloud server' : 'local server'}...`);

    const ws = new WebSocket(url);
    ws.binaryType = 'blob';

    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        setGameState('error');
        setError('Connection timed out. The game server may be offline.\n\nMake sure the Game Bridge is running on your PC.');
      }
    }, 15000);

    ws.onopen = () => {
      clearTimeout(timeout);
      setStatusMsg('Connected! Starting game...');
      ws.send(JSON.stringify({
        type: 'init',
        user: {
          uid: currentUser?.uid || '',
          username: userProfile?.username || currentUser?.displayName || 'Player',
          displayName: userProfile?.displayName || currentUser?.displayName || 'Player',
          photoURL: userProfile?.photoURL || currentUser?.photoURL || '',
        }
      }));
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        try {
          const bitmap = await createImageBitmap(event.data);
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
              }
              ctx.drawImage(bitmap, 0, 0);
            }
          }
          bitmap.close();
          frameCountRef.current++;
          const now = Date.now();
          if (now - lastFpsTime.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastFpsTime.current = now;
          }
          if (gameState !== 'playing') setGameState('playing');
        } catch { /* skip bad frame */ }
      } else {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'status') {
            if (msg.status === 'playing') { setGameState('playing'); setStatusMsg(''); }
            else { setGameState('launching'); setStatusMsg(msg.status); }
          } else if (msg.type === 'error') { setError(msg.message); setGameState('error'); }
        } catch { /* ignore */ }
      }
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      if (gameState === 'playing') { setGameState('error'); setError('Connection lost.'); }
      else if (gameState === 'connecting' || gameState === 'launching') {
        setGameState('error');
        setError('Lost connection to Game Bridge.');
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      setGameState('error');
      setError('Could not connect to Game Bridge.\n\nThe server might be offline or your PC is turned off.');
    };

    wsRef.current = ws;
  }, [currentUser, userProfile, fetchBridgeUrl, gameState]);

  // ============ DISCONNECT ============
  const disconnect = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setGameState('lobby');
    setFps(0);
    setPointerLocked(false);
    if (document.pointerLockElement) document.exitPointerLock();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // ============ DESKTOP KEYBOARD/MOUSE INPUT ============
  useEffect(() => {
    if (gameState !== 'playing' || isMobile) return;
    const canvas = canvasRef.current;
    const ws = wsRef.current;
    if (!canvas || !ws) return;

    const send = (msg: Record<string, unknown>) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      send({ type: 'mousemove', x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, dx: e.movementX, dy: e.movementY, locked: !!document.pointerLockElement });
    };
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      if (!document.pointerLockElement) canvas.requestPointerLock();
      send({ type: 'mousedown', button: e.button });
    };
    const onMouseUp = (e: MouseEvent) => { e.preventDefault(); send({ type: 'mouseup', button: e.button }); };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); send({ type: 'wheel', deltaY: e.deltaY > 0 ? 1 : -1 }); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { if (document.pointerLockElement) document.exitPointerLock(); setShowOverlay(true); return; }
      if (e.code === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
      e.preventDefault(); send({ type: 'keydown', code: e.code });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'F11') return;
      e.preventDefault(); send({ type: 'keyup', code: e.code });
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setPointerLocked(locked);
      if (locked) setShowOverlay(false);
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [gameState]);

  // ============ MOBILE TOUCH INPUT ============
  useEffect(() => {
    if (gameState !== 'playing' || !isMobile) return;
    const canvas = canvasRef.current;
    const ws = wsRef.current;
    if (!canvas || !ws) return;

    const send = (msg: Record<string, unknown>) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    // Right half of screen = camera look (drag)
    // Left half = movement (virtual joystick handled by overlay buttons)
    let lookTouchId: number | null = null;
    let lastLookX = 0, lastLookY = 0;

    const onTouchStart = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        // Right half = look
        if (x > rect.width / 2 && lookTouchId === null) {
          lookTouchId = touch.identifier;
          lastLookX = touch.clientX;
          lastLookY = touch.clientY;
        }
        // Left half = tap to interact
        if (x <= rect.width / 2) {
          send({ type: 'touch-tap' });
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === lookTouchId) {
          const dx = (touch.clientX - lastLookX) * 2;
          const dy = (touch.clientY - lastLookY) * 2;
          lastLookX = touch.clientX;
          lastLookY = touch.clientY;
          send({ type: 'touch-move', dx, dy });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === lookTouchId) lookTouchId = null;
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [gameState]);

  // ============ FULLSCREEN ============
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // ============ VIRTUAL JOYSTICK COMPONENT (MOBILE) ============
  const VirtualControls = () => {
    const ws = wsRef.current;
    const send = (msg: Record<string, unknown>) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    const pressKey = (code: string) => send({ type: 'virtual-key', code, down: true });
    const releaseKey = (code: string) => send({ type: 'virtual-key', code, down: false });

    const btnClass = "w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-lg font-bold active:bg-white/30 select-none touch-manipulation";

    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* D-pad — bottom left */}
        <div className="absolute bottom-20 left-4 pointer-events-auto">
          <div className="relative w-44 h-44">
            <button className={`${btnClass} absolute top-0 left-1/2 -translate-x-1/2`}
              onTouchStart={() => pressKey('KeyW')} onTouchEnd={() => releaseKey('KeyW')}>W</button>
            <button className={`${btnClass} absolute bottom-0 left-1/2 -translate-x-1/2`}
              onTouchStart={() => pressKey('KeyS')} onTouchEnd={() => releaseKey('KeyS')}>S</button>
            <button className={`${btnClass} absolute left-0 top-1/2 -translate-y-1/2`}
              onTouchStart={() => pressKey('KeyA')} onTouchEnd={() => releaseKey('KeyA')}>A</button>
            <button className={`${btnClass} absolute right-0 top-1/2 -translate-y-1/2`}
              onTouchStart={() => pressKey('KeyD')} onTouchEnd={() => releaseKey('KeyD')}>D</button>
          </div>
        </div>

        {/* Action buttons — bottom right */}
        <div className="absolute bottom-20 right-4 flex flex-col gap-3 pointer-events-auto">
          <button className={btnClass}
            onTouchStart={() => pressKey('Space')} onTouchEnd={() => releaseKey('Space')}>⬆</button>
          <button className={btnClass}
            onTouchStart={() => send({ type: 'mousedown', button: 0 })} onTouchEnd={() => send({ type: 'mouseup', button: 0 })}>👆</button>
          <button className={btnClass}
            onTouchStart={() => pressKey('KeyE')} onTouchEnd={() => releaseKey('KeyE')}>E</button>
        </div>

        {/* Top controls */}
        <div className="absolute top-3 left-3 pointer-events-auto flex gap-2">
          <button className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/10"
            onClick={() => setShowOverlay(true)}>
            <X size={18} />
          </button>
          <button className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/10"
            onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>
    );
  };

  // ============ LOBBY VIEW ============
  if (gameState === 'lobby') {
    const isOnline = bridgeStatus?.status === 'online';
    const lastUpdate = bridgeStatus?.updatedAt ? new Date(bridgeStatus.updatedAt) : null;
    const isStale = lastUpdate ? (Date.now() - lastUpdate.getTime()) > 60000 : true;
    const actuallyOnline = isOnline && !isStale;

    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <motion.div className="relative z-10 max-w-lg w-full text-center space-y-5"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

          <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
            <Gamepad2 size={48} className="text-white" />
          </div>

          <div>
            <h1 className="text-4xl font-black text-white mb-1">Rec Room</h1>
            <p className="text-indigo-300 text-sm font-medium">by RipoTeam</p>
          </div>

          <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
            Play Rec Room from anywhere — your phone, laptop, any browser. Streamed live by RipoTeam.
          </p>

          {/* Server status */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            bridgeLoading ? 'bg-gray-700/50 text-gray-400' :
            actuallyOnline ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
            'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
          }`}>
            {bridgeLoading ? (
              <><div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" /> Checking server...</>
            ) : actuallyOnline ? (
              <><Wifi size={14} /> Server Online{bridgeStatus!.clients > 0 ? ` · ${bridgeStatus!.clients} playing` : ''}</>
            ) : (
              <><WifiOff size={14} /> Server Starting Up...</>
            )}
          </div>

          <motion.button
            className={`font-bold text-lg px-10 py-4 rounded-2xl shadow-xl flex items-center gap-3 mx-auto transition-all ${
              actuallyOnline
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-500/25 hover:shadow-green-500/40'
                : 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white/80'
            }`}
            whileHover={{ scale: actuallyOnline ? 1.03 : 1 }}
            whileTap={{ scale: actuallyOnline ? 0.97 : 1 }}
            onClick={actuallyOnline ? connectToGame : undefined}
          >
            <Play size={24} fill="white" />
            {actuallyOnline ? 'Play Now' : 'Waiting for Server...'}
          </motion.button>

          {!actuallyOnline && !bridgeLoading && (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 text-center space-y-2">
              <p className="text-gray-400 text-xs leading-relaxed">
                The game server is currently spinning up. This page auto-refreshes every 10 seconds.
              </p>
              <div className="flex items-center justify-center gap-2 text-indigo-400 text-[10px]">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                  animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
                Auto-checking...
              </div>
            </div>
          )}

          {isMobile && (
            <div className="flex items-center justify-center gap-2 text-indigo-400 text-xs">
              <Smartphone size={14} />
              Mobile controls available
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ============ CONNECTING / LAUNCHING ============
  if (gameState === 'connecting' || gameState === 'launching') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900 gap-4">
        <motion.div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
        <h2 className="text-white text-lg font-bold">{gameState === 'connecting' ? 'Connecting...' : 'Launching...'}</h2>
        <p className="text-gray-400 text-sm text-center max-w-sm">{statusMsg}</p>
        <button onClick={disconnect} className="text-gray-500 hover:text-gray-300 text-xs mt-4">Cancel</button>
      </div>
    );
  }

  // ============ ERROR ============
  if (gameState === 'error') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gray-900 gap-4 p-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle size={32} className="text-red-400" />
        </div>
        <h2 className="text-white text-lg font-bold">Connection Failed</h2>
        <p className="text-gray-400 text-sm max-w-md text-center whitespace-pre-line">{error}</p>
        <div className="flex gap-3 mt-2">
          <motion.button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm"
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={connectToGame}>
            Try Again
          </motion.button>
          <button onClick={() => setGameState('lobby')} className="text-gray-400 hover:text-white px-4 py-2.5 text-sm">Back</button>
        </div>
      </div>
    );
  }

  // ============ PLAYING ============
  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden"
      style={{ cursor: pointerLocked ? 'none' : 'default' }}>

      <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ imageRendering: 'auto' }} />

      {/* Mobile touch controls */}
      {isMobile && <VirtualControls />}

      {/* Desktop: click-to-play overlay */}
      {!isMobile && (
        <AnimatePresence>
          {!pointerLocked && !showOverlay && (
            <motion.div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => canvasRef.current?.requestPointerLock()}>
              <div className="bg-black/60 backdrop-blur-sm text-white px-6 py-3 rounded-xl text-sm font-medium">
                Click to play — ESC for menu
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* FPS HUD */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${fps > 0 ? 'bg-green-400' : 'bg-red-400'}`} />
          {fps} FPS
        </div>
      </div>

      {/* Overlay menu */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-gray-800/90 border border-gray-700/50 rounded-2xl p-6 max-w-sm w-full space-y-3 mx-4"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <h3 className="text-white text-lg font-bold text-center">Game Menu</h3>
              <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm"
                onClick={() => { setShowOverlay(false); if (!isMobile) canvasRef.current?.requestPointerLock(); }}>
                Resume
              </button>
              <button className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                onClick={toggleFullscreen}>
                {isFullscreen ? <><Minimize2 size={16} /> Exit Fullscreen</> : <><Maximize2 size={16} /> Fullscreen</>}
              </button>
              <button className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                onClick={disconnect}>
                <X size={16} /> Disconnect
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default RecRoom;
