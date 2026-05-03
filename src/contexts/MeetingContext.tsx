import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { createPeerConnection } from '../lib/webrtc';

const MEETING_ROOM_ID = 'team-room';

export interface MeetingParticipant {
  uid: string;
  displayName: string;
  photoURL?: string;
  role?: 'user' | 'admin' | 'member' | 'moderator';
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  joinedAt?: unknown;
  updatedAt?: unknown;
}

interface MeetingContextType {
  inMeeting: boolean;
  isMinimized: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  participants: MeetingParticipant[];
  participantCount: number;
  startMeeting: () => Promise<void>;
  endMeeting: () => Promise<void>;
  toggleMinimize: () => void;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

function meetingRoomDoc() {
  return doc(db, 'meeting_rooms', MEETING_ROOM_ID);
}

function meetingParticipantsCollection() {
  return collection(db, 'meeting_rooms', MEETING_ROOM_ID, 'participants');
}

function meetingParticipantDoc(uid: string) {
  return doc(db, 'meeting_rooms', MEETING_ROOM_ID, 'participants', uid);
}

function meetingSignalsCollection() {
  return collection(db, 'meeting_rooms', MEETING_ROOM_ID, 'signals');
}

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();

  const [inMeeting, setInMeeting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const meetingUnsubsRef = useRef<Array<() => void>>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const cleanupPeer = useCallback((remoteUid: string) => {
    const peerConnection = peerConnectionsRef.current.get(remoteUid);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(remoteUid);
    }
    pendingCandidatesRef.current.delete(remoteUid);
    setRemoteStreams((prev) => {
      if (!(remoteUid in prev)) return prev;
      const next = { ...prev };
      delete next[remoteUid];
      return next;
    });
  }, []);

  const persistParticipantState = useCallback(async (overrides: Partial<MeetingParticipant> = {}) => {
    if (!userProfile?.uid) return;

    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];

    await setDoc(
      meetingParticipantDoc(userProfile.uid),
      {
        uid: userProfile.uid,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || '',
        role: userProfile.role,
        isMicOn: overrides.isMicOn ?? (audioTrack ? audioTrack.enabled : isMicOn),
        isCameraOn: overrides.isCameraOn ?? (videoTrack ? videoTrack.enabled : isCameraOn),
        isScreenSharing: overrides.isScreenSharing ?? !!screenStreamRef.current,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, [isCameraOn, isMicOn, userProfile]);

  const sendSignal = useCallback(async (
    targetUid: string,
    type: 'offer' | 'answer' | 'ice',
    payload: { description?: { type: RTCSdpType; sdp: string | null }; candidate?: RTCIceCandidateInit }
  ) => {
    if (!userProfile?.uid) return;

    await addDoc(meetingSignalsCollection(), {
      from: userProfile.uid,
      to: targetUid,
      type,
      description: payload.description || null,
      candidate: payload.candidate || null,
      createdAt: Date.now(),
    });
  }, [userProfile?.uid]);

  const flushPendingCandidates = useCallback(async (remoteUid: string, pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(remoteUid) || [];
    while (pending.length > 0) {
      const candidate = pending.shift();
      if (!candidate) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('Failed to apply queued meeting ICE candidate:', error);
      }
    }
    pendingCandidatesRef.current.set(remoteUid, pending);
  }, []);

  const syncPeerConnectionTracks = useCallback(async (pc: RTCPeerConnection) => {
    const activeVideoTrack = screenStreamRef.current?.getVideoTracks()[0] || localStreamRef.current?.getVideoTracks()[0] || null;
    const activeAudioTrack = localStreamRef.current?.getAudioTracks()[0] || null;

    const videoSender = pc.getSenders().find((sender) => sender.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(activeVideoTrack);
    } else if (activeVideoTrack) {
      const sourceStream = screenStreamRef.current || localStreamRef.current;
      if (sourceStream) pc.addTrack(activeVideoTrack, sourceStream);
    }

    const audioSender = pc.getSenders().find((sender) => sender.track?.kind === 'audio');
    if (audioSender) {
      await audioSender.replaceTrack(activeAudioTrack);
    } else if (activeAudioTrack && localStreamRef.current) {
      pc.addTrack(activeAudioTrack, localStreamRef.current);
    }
  }, []);

  const syncAllPeerConnections = useCallback(async () => {
    await Promise.all(
      Array.from(peerConnectionsRef.current.values()).map((pc) => syncPeerConnectionTracks(pc))
    );
  }, [syncPeerConnectionTracks]);

  const getOrCreatePeerConnection = useCallback(async (remoteUid: string) => {
    const existing = peerConnectionsRef.current.get(remoteUid);
    if (existing) return existing;

    const pc = createPeerConnection();

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams((prev) => ({ ...prev, [remoteUid]: stream }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(remoteUid, 'ice', { candidate: event.candidate.toJSON() }).catch((error) => {
          console.warn('Failed to send meeting ICE candidate:', error);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeer(remoteUid);
      }
    };

    await syncPeerConnectionTracks(pc);
    peerConnectionsRef.current.set(remoteUid, pc);
    return pc;
  }, [cleanupPeer, sendSignal, syncPeerConnectionTracks]);

  const processSignal = useCallback(async (signalDocSnap: any) => {
    const signal = signalDocSnap.data();
    const remoteUid = signal.from as string;
    const pc = await getOrCreatePeerConnection(remoteUid);

    try {
      if (signal.type === 'offer' && signal.description) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
        await flushPendingCandidates(remoteUid, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(remoteUid, 'answer', {
          description: { type: answer.type, sdp: answer.sdp },
        });
      } else if (signal.type === 'answer' && signal.description && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
        await flushPendingCandidates(remoteUid, pc);
      } else if (signal.type === 'ice' && signal.candidate) {
        if (pc.currentRemoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          const pending = pendingCandidatesRef.current.get(remoteUid) || [];
          pending.push(signal.candidate);
          pendingCandidatesRef.current.set(remoteUid, pending);
        }
      }
    } catch (error) {
      console.warn('Failed to process meeting signal:', error);
    } finally {
      deleteDoc(signalDocSnap.ref).catch(() => {});
    }
  }, [flushPendingCandidates, getOrCreatePeerConnection, sendSignal]);

  const subscribeToMeetingRoom = useCallback((uid: string) => {
    const participantsUnsub = onSnapshot(meetingParticipantsCollection(), async (snapshot) => {
      const nextParticipants = snapshot.docs
        .map((participantDocSnap) => participantDocSnap.data() as MeetingParticipant)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      setParticipants(nextParticipants);

      const remoteParticipantIds = new Set<string>(
        nextParticipants
          .map((participant) => participant.uid)
          .filter((participantId): participantId is string => typeof participantId === 'string' && participantId !== uid)
      );

      for (const existingRemoteUid of Array.from(peerConnectionsRef.current.keys()) as string[]) {
        if (!remoteParticipantIds.has(existingRemoteUid)) {
          cleanupPeer(existingRemoteUid);
        }
      }

      for (const participant of nextParticipants) {
        if (!participant.uid || participant.uid === uid) continue;
        if (peerConnectionsRef.current.has(participant.uid)) continue;
        if (uid < participant.uid) {
          const pc = await getOrCreatePeerConnection(participant.uid);
          if (!pc.currentLocalDescription && pc.signalingState === 'stable') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendSignal(participant.uid, 'offer', {
              description: { type: offer.type, sdp: offer.sdp },
            });
          }
        }
      }
    });

    const signalsUnsub = onSnapshot(
      query(meetingSignalsCollection(), where('to', '==', uid)),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            processSignal(change.doc);
          }
        });
      }
    );

    meetingUnsubsRef.current.push(participantsUnsub, signalsUnsub);
  }, [cleanupPeer, getOrCreatePeerConnection, processSignal, sendSignal]);

  const startMeeting = useCallback(async () => {
    if (!userProfile?.uid) return;
    if (userProfile.role !== 'admin' && userProfile.role !== 'member') return;
    if (inMeeting) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      screenStreamRef.current = null;
      setLocalStream(stream);
      setScreenStream(null);
      setRemoteStreams({});
      setIsMicOn(true);
      setIsCameraOn(true);
      setIsScreenSharing(false);
      setInMeeting(true);
      setIsMinimized(false);

      await setDoc(meetingRoomDoc(), {
        id: MEETING_ROOM_ID,
        updatedAt: serverTimestamp(),
        active: true,
      }, { merge: true });

      await persistParticipantState({
        isMicOn: true,
        isCameraOn: true,
        isScreenSharing: false,
      });

      subscribeToMeetingRoom(userProfile.uid);
    } catch (error: any) {
      console.error('Error accessing meeting media devices:', error);
      if (error.name === 'NotAllowedError') {
        alert('Camera/Mic access is blocked. If you are in an iframe, please open the app in a new tab.');
      } else {
        alert('Camera/Mic is not supported on this device/browser.');
      }
    }
  }, [inMeeting, persistParticipantState, subscribeToMeetingRoom, userProfile]);

  const endMeeting = useCallback(async () => {
    meetingUnsubsRef.current.forEach((unsubscribe) => unsubscribe());
    meetingUnsubsRef.current = [];

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;

    if (userProfile?.uid) {
      deleteDoc(meetingParticipantDoc(userProfile.uid)).catch(() => {});

      try {
        const signalSnapshot = await getDocs(meetingSignalsCollection());
        await Promise.all(
          signalSnapshot.docs
            .filter((signalDocSnap) => {
              const data = signalDocSnap.data();
              return data.from === userProfile.uid || data.to === userProfile.uid;
            })
            .map((signalDocSnap) => deleteDoc(signalDocSnap.ref))
        );
      } catch {
        // Signal cleanup is best-effort only.
      }
    }

    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams({});
    setParticipants([]);
    setInMeeting(false);
    setIsMinimized(false);
    setIsMicOn(true);
    setIsCameraOn(true);
    setIsScreenSharing(false);
  }, [userProfile?.uid]);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const toggleMic = useCallback(async () => {
    const nextAudioEnabled = !(localStreamRef.current?.getAudioTracks()[0]?.enabled ?? true);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextAudioEnabled;
    });
    setIsMicOn(nextAudioEnabled);
    await persistParticipantState({ isMicOn: nextAudioEnabled });
  }, [persistParticipantState]);

  const toggleCamera = useCallback(async () => {
    const nextVideoEnabled = !(localStreamRef.current?.getVideoTracks()[0]?.enabled ?? true);
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = nextVideoEnabled;
    });
    setIsCameraOn(nextVideoEnabled);
    await persistParticipantState({ isCameraOn: nextVideoEnabled });
  }, [persistParticipantState]);

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    await syncAllPeerConnections();
    await persistParticipantState({ isScreenSharing: false });
  }, [persistParticipantState, syncAllPeerConnections]);

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      await stopScreenShare();
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert('Screen sharing is not supported on this browser or device.');
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const [videoTrack] = stream.getVideoTracks();
      if (!videoTrack) return;

      videoTrack.onended = () => {
        stopScreenShare().catch(() => {});
      };

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      await syncAllPeerConnections();
      await persistParticipantState({ isScreenSharing: true });
    } catch (error: any) {
      console.error('Error sharing screen:', error);
      if (error.name === 'NotAllowedError') {
        alert('Screen sharing access is blocked. If you are in an iframe, please open the app in a new tab.');
      } else {
        alert('Screen sharing failed or is not supported on this device/browser.');
      }
    }
  }, [persistParticipantState, stopScreenShare, syncAllPeerConnections]);

  useEffect(() => {
    return () => {
      endMeeting().catch(() => {});
    };
  }, [endMeeting]);

  return (
    <MeetingContext.Provider value={{
      inMeeting,
      isMinimized,
      localStream,
      screenStream,
      remoteStreams,
      participants,
      participantCount: participants.length,
      startMeeting,
      endMeeting,
      toggleMinimize,
      toggleMic,
      toggleCamera,
      toggleScreenShare,
      isMicOn,
      isCameraOn,
      isScreenSharing,
    }}>
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const context = useContext(MeetingContext);
  if (context === undefined) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
}
