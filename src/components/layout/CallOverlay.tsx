import React, { useRef, useEffect, useState } from 'react';
import { PhoneOff, Phone, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Minimize2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCall } from '../../contexts/CallContext';
import { Avatar } from '../ui/Avatar';
import { useSpeakingActivity } from '../../hooks/useSpeakingActivity';

export function CallOverlay() {
  const { callState, callInfo, callTimer, isMuted, isVideoOff, isMinimized, localStream, remoteStream, acceptCall, endCall, toggleMute, toggleVideo, toggleMinimize } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const { isSpeaking: isLocalSpeaking, level: localLevel } = useSpeakingActivity(localStream, !!localStream && !isMuted);
  const { isSpeaking: isRemoteSpeaking, level: remoteLevel } = useSpeakingActivity(remoteStream, !!remoteStream && callState === 'active');

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = isSpeakerMuted;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, isSpeakerMuted, isMinimized]);

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSpeakingBars = (level: number, keyPrefix: string) => (
    <div className="flex items-end gap-0.5">
      {[0.7, 1, 0.8].map((factor, index) => (
        <motion.span
          key={`${keyPrefix}-${index}`}
          animate={{ height: [4, Math.max(8, Math.round(level * 18 * factor)), 4] }}
          transition={{ duration: 0.55, repeat: Infinity, delay: index * 0.08 }}
          className="block w-1 rounded-full bg-emerald-300"
        />
      ))}
    </div>
  );

  if (callState === 'idle' || !callInfo) return null;

  const isIncoming = callInfo.isIncoming && callState === 'ringing';

  // Minimized floating pill
  if (isMinimized) {
    return (
      <>
        {callState === 'active' && remoteStream && (
          <audio ref={remoteAudioRef} autoPlay playsInline />
        )}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed bottom-20 right-4 z-[200] bg-green-500 rounded-full shadow-2xl px-4 py-3 flex items-center space-x-3 cursor-pointer"
          onClick={toggleMinimize}
        >
          <div className="relative">
            <Avatar src={callInfo.photoURL} alt={callInfo.displayName} className={`h-10 w-10 border-2 ${isRemoteSpeaking ? 'border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.45)]' : 'border-white/40'}`} animated={false} />
            {callState === 'ringing' && (
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-white/50"
              />
            )}
          </div>
          <div className="text-white">
            <p className="text-sm font-bold leading-tight">{callInfo.displayName}</p>
            <p className="text-xs text-white/80">
              {callState === 'ringing' ? (callInfo.type === 'video' ? 'Video Calling...' : 'Calling...') : formatCallTime(callTimer)}
            </p>
            {callState === 'active' && isRemoteSpeaking && (
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-black/20 px-2 py-1 text-[11px] font-semibold text-white/90">
                <span>Speaking</span>
                {renderSpeakingBars(remoteLevel, 'min-call-remote')}
              </div>
            )}
          </div>
          <Maximize2 className="h-4 w-4 text-white/70 ml-1" />
          <button
            onClick={(e) => { e.stopPropagation(); endCall(); }}
            className="p-2 bg-red-500 rounded-full text-white ml-1"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </motion.div>
      </>
    );
  }

  // Full-screen call overlay
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center"
      >
        {/* Minimize button */}
        <button
          onClick={toggleMinimize}
          className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          title="Minimize"
        >
          <Minimize2 className="h-5 w-5" />
        </button>

        {/* Remote video (fullscreen background) */}
        {callInfo.type === 'video' && callState === 'active' && remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {callState === 'active' && isRemoteSpeaking && (
          <div className="absolute left-6 top-6 z-20 inline-flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-emerald-200 backdrop-blur-sm">
            <span>{callInfo.displayName} is speaking</span>
            {renderSpeakingBars(remoteLevel, 'call-remote')}
          </div>
        )}

        {/* Hidden remote audio element so voice calls and audio-only video calls can actually be heard */}
        {callState === 'active' && remoteStream && (
          <audio ref={remoteAudioRef} autoPlay playsInline />
        )}

        {/* Local video (small PiP) */}
        {callInfo.type === 'video' && callState === 'active' && localStream && !isVideoOff && (
          <div className={`absolute top-20 right-6 w-36 h-48 rounded-2xl overflow-hidden shadow-2xl border-2 z-20 transition-all ${isLocalSpeaking ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.35)]' : 'border-white/20'}`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            {isLocalSpeaking && (
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 backdrop-blur-sm">
                <span>You</span>
                {renderSpeakingBars(localLevel, 'call-local')}
              </div>
            )}
          </div>
        )}

        {/* Avatar + status (shown when no video or ringing) */}
        {(callState === 'ringing' || callInfo.type === 'voice' || (callState === 'active' && !remoteStream?.getTracks().some(t => t.kind === 'video' && t.enabled))) && (
          <div className="text-center mb-8 relative z-10">
            {/* Ringing pulse rings */}
            {callState === 'ringing' && (
              <>
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-green-400"
                />
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-green-400"
                />
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 1.0 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-green-400"
                />
              </>
            )}

            <motion.div
              animate={callState === 'ringing' ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Avatar src={callInfo.photoURL} alt={callInfo.displayName} className={`h-32 w-32 mx-auto mb-4 border-4 shadow-2xl transition-all ${isRemoteSpeaking ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.35)]' : 'border-white/20'}`} animated={false} />
            </motion.div>
            <h2 className="text-white text-2xl font-bold mb-1">{callInfo.displayName}</h2>
            <p className="text-gray-400 text-lg">
              {callState === 'ringing' ? (
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {isIncoming ? (callInfo.type === 'video' ? '📹 Incoming Video Call...' : '📞 Incoming Call...') : (callInfo.type === 'video' ? '📹 Video Calling...' : '📞 Calling...')}
                </motion.span>
              ) : (
                formatCallTime(callTimer)
              )}
            </p>
            {callState === 'active' && (
              <div className="mt-2 flex flex-col items-center gap-2">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-green-400 text-sm"
                >
                  Connected
                </motion.p>
                {isRemoteSpeaking && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    <span>Speaking</span>
                    {renderSpeakingBars(remoteLevel, 'call-avatar-remote')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Call controls */}
        <div className="absolute bottom-12 flex items-center space-x-6 z-20">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-white/20'} text-white transition-colors`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </motion.button>

          {callInfo.type === 'video' && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleVideo}
              className={`p-4 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-white/20'} text-white transition-colors`}
              title={isVideoOff ? 'Enable Camera' : 'Disable Camera'}
            >
              {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSpeakerMuted((prev) => !prev)}
            className="p-4 rounded-full bg-white/20 text-white"
            title={isSpeakerMuted ? 'Enable Speaker' : 'Mute Speaker'}
          >
            {isSpeakerMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </motion.button>

          {/* Accept button for incoming calls */}
          {isIncoming && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={acceptCall}
              className="p-5 rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30"
              title="Accept Call"
            >
              <Phone className="h-7 w-7" />
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={endCall}
            className="p-5 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30"
            title={isIncoming ? 'Decline' : 'End Call'}
          >
            <PhoneOff className="h-7 w-7" />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
