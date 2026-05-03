import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Maximize2, Minimize2, Gamepad2 } from 'lucide-react';
import { SocialHub } from './games/SocialHub';
import { useAuth } from '../contexts/AuthContext';

export function MakeSpaceHub() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoLaunchVisible, setAutoLaunchVisible] = useState(true);

  useEffect(() => {
    const syncFullscreen = () => {
      const fullscreenActive = document.fullscreenElement === pageRef.current;
      setIsFullscreen(fullscreenActive);
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setAutoLaunchVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  const requestFullscreen = async () => {
    if (!pageRef.current || document.fullscreenElement === pageRef.current) return;

    try {
      await pageRef.current.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      setIsFullscreen(document.fullscreenElement === pageRef.current);
    }
  };

  useEffect(() => {
    void requestFullscreen();
  }, []);

  const exitExperience = async () => {
    if (document.fullscreenElement === pageRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore exit failures and still navigate away.
      }
    }
    navigate('/');
  };

  const handleReenterFullscreen = async () => {
    if (document.fullscreenElement === pageRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        // Leave the state as-is if the browser blocks it.
      }
      return;
    }

    await requestFullscreen();
  };

  return (
    <div
      ref={pageRef}
      className="relative h-full w-full overflow-hidden bg-black"
      onPointerDownCapture={() => {
        if (!document.fullscreenElement) {
          void requestFullscreen();
        }
      }}
    >
      <SocialHub />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-white shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={exitExperience}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/15"
              title="Exit MakeSpace"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-200/75">
                <Gamepad2 className="h-3.5 w-3.5" />
                MakeSpace
              </div>
              <div className="text-sm font-semibold">{userProfile?.displayName || 'SnapLink Player'}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                {userProfile?.username ? <span>@{userProfile.username}</span> : null}
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">
                  LV {userProfile?.level || 1}
                </span>
                {userProfile?.role ? (
                  <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 font-semibold capitalize text-cyan-100">
                    {userProfile.role}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReenterFullscreen}
            className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition-colors hover:bg-black/70"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? 'Windowed' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {autoLaunchVisible && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[70] flex justify-center px-4">
          <div className="rounded-full border border-cyan-400/20 bg-black/65 px-4 py-2 text-xs font-medium text-cyan-100 shadow-lg backdrop-blur-md">
            Entering SnapLink City. Tap or click once if your browser blocks fullscreen.
          </div>
        </div>
      )}
    </div>
  );
}
