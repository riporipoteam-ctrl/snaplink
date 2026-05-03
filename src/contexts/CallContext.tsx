import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { createPeerConnection, createCallOffer, answerCall, cleanupCall, finishCallSession, listenForIncomingCalls, playRingtone } from '../lib/webrtc';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { createNotification } from '../lib/notifications';
import { appendCallEventMessage, type CallEventStatus } from '../lib/chatCallEvents';
import { clearInAppAttention, triggerInAppAttention } from '../lib/browserNotifications';

export interface CallInfo {
  chatId: string;
  displayName: string;
  photoURL?: string;
  type: 'voice' | 'video';
  targetUserId?: string;
  callId?: string; // Firestore call document ID
  isIncoming?: boolean;
}

interface CallContextType {
  callState: 'idle' | 'ringing' | 'active';
  callInfo: CallInfo | null;
  callTimer: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isMinimized: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (info: CallInfo) => void;
  acceptCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleMinimize: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'active'>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const cleanupSignalingRef = useRef<(() => void) | null>(null);
  const callDocListenerRef = useRef<(() => void) | null>(null);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const callIdRef = useRef<string | null>(null);
  const incomingListenerRef = useRef<(() => void) | null>(null);
  const disconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endCallCleanupRef = useRef<(shouldDeleteCallDoc?: boolean) => void>(() => {});
  const callStateRef = useRef(callState);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callInfoRef = useRef<CallInfo | null>(null);
  const callAnsweredRef = useRef(false);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }, []);

  const clearCallDocListener = useCallback(() => {
    callDocListenerRef.current?.();
    callDocListenerRef.current = null;
  }, []);

  const setCallDocListener = useCallback((listener: () => void) => {
    clearCallDocListener();
    callDocListenerRef.current = listener;
  }, [clearCallDocListener]);

  const clearDisconnectTimeout = useCallback(() => {
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }
  }, []);

  // Timer for active calls
  useEffect(() => {
    if (callState === 'active') {
      callTimerRef.current = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (callState === 'idle') setCallTimer(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callState]);

  // Keep callStateRef in sync
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callInfoRef.current = callInfo;
  }, [callInfo]);

  useEffect(() => {
    if (callState !== 'ringing') {
      stopRingtone();
      clearInAppAttention();
    }
  }, [callState, stopRingtone]);

  const appendCallEvent = useCallback((info: CallInfo | null, status: CallEventStatus) => {
    if (!userProfile || !info?.chatId || !info.callId) return;

    void appendCallEventMessage({
      chatId: info.chatId,
      callId: info.callId,
      status,
      callType: info.type,
      senderId: userProfile.uid,
      senderName: userProfile.displayName,
      senderPhotoURL: userProfile.photoURL || null,
    });
  }, [userProfile]);

  // Listen for incoming calls — subscribe once, use ref for callState
  useEffect(() => {
    const userId = userProfile?.uid;
    incomingListenerRef.current?.();
    incomingListenerRef.current = null;
    if (!userId) return;

    incomingListenerRef.current = listenForIncomingCalls(
      userId,
      async (callId, payload) => {
        // Don't interrupt existing calls
        if (callStateRef.current !== 'idle') return;

        // Get caller info
        let callerName = 'Unknown';
        let callerPhoto = '';
        try {
          const callerDoc = await getDoc(doc(db, 'users', payload.callerId));
          if (callerDoc.exists()) {
            callerName = callerDoc.data().displayName || 'Unknown';
            callerPhoto = callerDoc.data().photoURL || '';
          }
        } catch {}

        callIdRef.current = callId;
        const incomingInfo: CallInfo = {
          chatId: payload.chatId || callId,
          displayName: callerName,
          photoURL: callerPhoto,
          type: payload.callType,
          targetUserId: payload.callerId,
          callId,
          isIncoming: true,
        };
        callInfoRef.current = incomingInfo;
        setCallInfo(incomingInfo);
        setCallState('ringing');
        callAnsweredRef.current = false;
        triggerInAppAttention({
          title: `${callerName} is calling`,
          durationMs: 30000,
          vibration: [320, 180, 320, 180, 900],
          mode: 'call',
        });

        // Play ringtone
        stopRingtone();
        ringtoneRef.current = playRingtone();
        setCallDocListener(
          onSnapshot(doc(db, 'calls', callId), (snap) => {
            const data = snap.data();

            if (data?.status === 'active') {
              stopRingtone();
              callAnsweredRef.current = true;
              if (callStateRef.current !== 'active') {
                callStateRef.current = 'active';
                setCallState('active');
              }
            }

            if (!snap.exists() || data?.status === 'ended') {
              endCallCleanupRef.current(false);
            }
          })
        );
      }
    );

    return () => {
      incomingListenerRef.current?.();
      incomingListenerRef.current = null;
    };
  }, [setCallDocListener, stopRingtone, userProfile?.uid]); // Subscribe when auth is ready, use callStateRef for checks

  const endCallCleanup = useCallback((shouldDeleteCallDoc = true) => {
    stopRingtone();
    clearDisconnectTimeout();
    clearCallDocListener();

    // Stop local media tracks using ref (avoids stale closure)
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    // Close peer connection
    pcRef.current?.close();
    pcRef.current = null;

    // Cleanup signaling listeners
    cleanupSignalingRef.current?.();
    cleanupSignalingRef.current = null;

    // Clean up Firestore call doc
    if (callIdRef.current) {
      const currentCallId = callIdRef.current;
      callIdRef.current = null;
      if (shouldDeleteCallDoc) {
        void cleanupCall(currentCallId);
      }
    }

    callAnsweredRef.current = false;
    callInfoRef.current = null;
    callStateRef.current = 'idle';
    setCallState('idle');
    setCallInfo(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsMinimized(false);
  }, [clearCallDocListener, clearDisconnectTimeout, stopRingtone]);

  endCallCleanupRef.current = endCallCleanup;

  const closeCallSession = useCallback((options: {
    notifyRemote?: boolean;
    reason?: 'ended' | 'missed' | 'declined' | 'failed';
    eventStatus?: CallEventStatus;
    deleteCallDoc?: boolean;
  } = {}) => {
    const callId = callIdRef.current;
    const info = callInfoRef.current;

    if (options.eventStatus) {
      appendCallEvent(info, options.eventStatus);
    }

    if (callId && options.notifyRemote && auth.currentUser) {
      void finishCallSession(callId, auth.currentUser.uid, options.reason || 'ended');
      endCallCleanup(false);
      return;
    }

    endCallCleanup(options.deleteCallDoc ?? false);
  }, [appendCallEvent, endCallCleanup]);

  const attachCallDocListener = useCallback((callId: string) => {
    setCallDocListener(
      onSnapshot(doc(db, 'calls', callId), (snap) => {
        const data = snap.data();

        if (data?.status === 'active') {
          stopRingtone();
          callAnsweredRef.current = true;
          if (callStateRef.current !== 'active') {
            callStateRef.current = 'active';
            setCallState('active');
          }
        }

        if (!snap.exists() || data?.status === 'ended') {
          endCallCleanup(false);
        }
      })
    );
  }, [endCallCleanup, setCallDocListener, stopRingtone]);

  const handlePeerConnectionStateChange = useCallback((pc: RTCPeerConnection) => {
    if (pc.connectionState === 'connected') {
      clearDisconnectTimeout();
      return;
    }

    if (pc.connectionState === 'disconnected') {
      if (disconnectTimeoutRef.current) return;

      disconnectTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          closeCallSession({
            notifyRemote: true,
            reason: callAnsweredRef.current ? 'ended' : 'failed',
          });
        }
      }, 5000);

      return;
    }

    clearDisconnectTimeout();

    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      closeCallSession({
        notifyRemote: true,
        reason: callAnsweredRef.current ? 'ended' : 'failed',
      });
    }
  }, [clearDisconnectTimeout, closeCallSession]);

  const startCall = useCallback(async (info: CallInfo) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: info.type === 'video',
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Create peer connection
      const pc = createPeerConnection();
      pcRef.current = pc;

      // Set up remote stream - use event.streams[0] directly for proper playback
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Add local tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Generate call ID and create offer
      const callId = `${user.uid}_${info.chatId}_${Date.now()}`;
      callIdRef.current = callId;

      const nextCallInfo: CallInfo = { ...info, callId, isIncoming: false };
      callInfoRef.current = nextCallInfo;
      setCallInfo(nextCallInfo);
      setCallState('ringing');
      setIsMuted(false);
      setIsVideoOff(false);
      setIsMinimized(false);
      callAnsweredRef.current = false;

      // Play outgoing ringtone
      stopRingtone();
      ringtoneRef.current = playRingtone();

      const calleeId = info.targetUserId || info.chatId;
      const cleanup = await createCallOffer(callId, pc, user.uid, calleeId, info.type, info.chatId);
      cleanupSignalingRef.current = cleanup;
      attachCallDocListener(callId);
      appendCallEvent(nextCallInfo, 'started');

      if (info.targetUserId && userProfile) {
        await createNotification({
          type: 'call',
          title: info.type === 'video' ? `${userProfile.displayName} started a video call` : `${userProfile.displayName} started a voice call`,
          message: info.type === 'video' ? 'Tap to open SnapLink and answer the video call.' : 'Tap to open SnapLink and answer the voice call.',
          sourceUserId: userProfile.uid,
          targetUserId: info.targetUserId,
          linkTo: '/messages',
          dedupeKey: `call-${callId}`,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null,
          },
          chatId: info.chatId,
        });
      }

      // Handle connection state
      pc.onconnectionstatechange = () => {
        handlePeerConnectionStateChange(pc);
      };
    } catch (error) {
      console.error('Error starting call:', error);
      endCallCleanup();
    }
  }, [appendCallEvent, attachCallDocListener, endCallCleanup, handlePeerConnectionStateChange, stopRingtone, userProfile]);

  const acceptCall = useCallback(async () => {
    if (!callInfo?.callId || !callInfo.isIncoming) return;

    try {
      stopRingtone();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callInfo.type === 'video',
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      pcRef.current = pc;

      // Set up remote stream - use event.streams[0] directly for proper playback
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const cleanup = await answerCall(callInfo.callId, pc);
      cleanupSignalingRef.current = cleanup;

      attachCallDocListener(callInfo.callId);
      clearDisconnectTimeout();
      callAnsweredRef.current = true;
      callStateRef.current = 'active';
      setCallState('active');
      appendCallEvent(callInfo, 'answered');

      pc.onconnectionstatechange = () => {
        handlePeerConnectionStateChange(pc);
      };
    } catch (error) {
      console.error('Error accepting call:', error);
      endCallCleanup();
    }
  }, [appendCallEvent, attachCallDocListener, callInfo, clearDisconnectTimeout, endCallCleanup, handlePeerConnectionStateChange, stopRingtone]);

  const endCall = useCallback(() => {
    const currentInfo = callInfoRef.current;
    if (!currentInfo) {
      endCallCleanup(true);
      return;
    }

    if (callStateRef.current === 'ringing' && currentInfo.isIncoming) {
      closeCallSession({
        notifyRemote: true,
        reason: 'declined',
        eventStatus: 'declined',
      });
      return;
    }

    if (callStateRef.current === 'ringing') {
      closeCallSession({
        notifyRemote: true,
        reason: 'missed',
        eventStatus: 'missed',
      });
      return;
    }

    closeCallSession({
      notifyRemote: true,
      reason: 'ended',
      eventStatus: 'ended',
    });
  }, [closeCallSession, endCallCleanup]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted(prev => !prev);
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    setIsVideoOff(prev => !prev);
  }, [localStream]);

  const toggleMinimize = useCallback(() => setIsMinimized(prev => !prev), []);

  return (
    <CallContext.Provider value={{
      callState, callInfo, callTimer, isMuted, isVideoOff, isMinimized,
      localStream, remoteStream,
      startCall, acceptCall, endCall, toggleMute, toggleVideo, toggleMinimize,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
