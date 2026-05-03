import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Video, MonitorUp, MessageSquare, Heart, Share2, Users, X, Send, Flag, Volume2, VolumeX, Lock, Globe, Eye, Radio, Clock, ChevronDown, Check, Mic, MicOff, VideoOff, PictureInPicture2 } from 'lucide-react';
import { createPeerConnection } from '../lib/webrtc';
import { Avatar } from '../components/ui/Avatar';
import { ReportModal } from '../components/ui/ReportModal';
import { useAuth } from '../contexts/AuthContext';
import { VerificationBadge, UserBadges } from '../components/ui/VerificationBadge';
import { LevelBadge } from '../components/ui/LevelBadge';
import { getReadOnlyReason, isReadOnlyUser } from '../lib/accessControl';

const STREAM_CATEGORIES = [
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'chat', label: 'Just Chatting', emoji: '💬' },
  { id: 'coding', label: 'Coding', emoji: '💻' },
  { id: 'fitness', label: 'Fitness', emoji: '💪' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'education', label: 'Education', emoji: '📚' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export function LiveStreams() {
  const { userProfile } = useAuth();
  const readOnlyReason = getReadOnlyReason(userProfile);
  const isReadOnlyAccount = isReadOnlyUser(userProfile);
  const blockedUserIds = userProfile?.blockedUserIds || [];
  const [streams, setStreams] = useState<any[]>([]);
  const [endedStreams, setEndedStreams] = useState<any[]>([]);
  const [activeStream, setActiveStream] = useState<any | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [streamType, setStreamType] = useState<'camera' | 'screen' | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('chat');
  const [isPrivate, setIsPrivate] = useState(false);

  // Preview state (before going live)
  const [showPreview, setShowPreview] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewType, setPreviewType] = useState<'camera' | 'screen' | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  // Viewer controls
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [isPiP, setIsPiP] = useState(false);

  // Broadcaster controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  // WebRTC refs for broadcasting
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerUnsubsRef = useRef<Map<string, () => void>>(new Map());
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const viewerSessionIdRef = useRef<string | null>(null);

  // Stream timer
  const [streamDuration, setStreamDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'live' | 'replays'>('live');

  // Link copied
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch live streams
  useEffect(() => {
    const q = query(collection(db, 'livestreams'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const streamsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const currentUid = auth.currentUser?.uid;
      setStreams(
        streamsData.filter((s) => s.isLive && (!s.isPrivate || s.hostId === currentUid) && !blockedUserIds.includes(s.hostId))
      );
      setEndedStreams(
        streamsData
          .filter((s) => !s.isLive && (!s.isPrivate || s.hostId === currentUid) && !blockedUserIds.includes(s.hostId))
          .slice(0, 20)
      );

      if (activeStream) {
        const updatedStream = streamsData.find(s => s.id === activeStream.id);
        if (updatedStream) {
          setActiveStream(updatedStream);
        } else if (activeStream.hostId !== auth.currentUser?.uid) {
          setActiveStream(null);
        }
      }
    }, (error) => {
      try { handleFirestoreError(error, OperationType.LIST, 'livestreams'); } catch(e) {}
    });
    return () => unsubscribe();
  }, [activeStream, blockedUserIds]);

  // Fetch comments for active stream
  useEffect(() => {
    if (activeStream) {
      const q = query(collection(db, `livestreams/${activeStream.id}/comments`), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        try { handleFirestoreError(error, OperationType.LIST, `livestreams/${activeStream.id}/comments`); } catch(e) {}
      });
      return () => unsubscribe();
    }
  }, [activeStream?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Stream duration timer
  useEffect(() => {
    if (isBroadcasting) {
      timerRef.current = setInterval(() => {
        setStreamDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setStreamDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isBroadcasting]);

  // Preview video setup
  useEffect(() => {
    if (previewVideoRef.current && previewStream) {
      previewVideoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Viewer remote video setup
  useEffect(() => {
    if (viewerVideoRef.current && remoteStream) {
      viewerVideoRef.current.srcObject = remoteStream;
      viewerVideoRef.current.muted = isMuted;
      viewerVideoRef.current.volume = isMuted ? 0 : volume / 100;
      viewerVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, isMuted, volume]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      // Only stop previewStream if it's a different object than localStream
      if (previewStream && previewStream !== localStream) previewStream.getTracks().forEach(track => track.stop());
      peerConnectionsRef.current.forEach(pc => pc.close());
      viewerUnsubsRef.current.forEach(unsub => unsub());
    };
  }, [localStream, previewStream]);

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && localStream) {
      node.srcObject = localStream;
    }
  }, [localStream]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Open preview before going live
  const openPreview = async (type: 'camera' | 'screen') => {
    if (isReadOnlyAccount) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }
    try {
      let mediaStream: MediaStream;
      if (type === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) {
          alert("Camera/Mic not supported on this browser.");
          return;
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } else {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert("Screen sharing not supported on this browser.");
          return;
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        let micStream: MediaStream | null = null;

        try {
          if (navigator.mediaDevices?.getUserMedia) {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
        } catch {
          // Screen share still works without a mic track; we just won't have live narration.
        }

        mediaStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...(micStream?.getAudioTracks() || []),
        ]);
      }
      setPreviewStream(mediaStream);
      setPreviewType(type);
      setShowPreview(true);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        alert(`${type === 'screen' ? 'Screen sharing' : 'Camera/Mic'} access blocked.`);
      } else {
        alert(`${type === 'screen' ? 'Screen sharing' : 'Camera/Mic'} failed.`);
      }
    }
  };

  const cancelPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    setShowPreview(false);
    setPreviewType(null);
  };

  // Go live from preview
  const goLive = async () => {
    if (!title.trim()) return alert('Please enter a title');
    if (!previewStream || !previewType) return;

    // Store in ref so onSnapshot closures always have the live stream
    localStreamRef.current = previewStream;
    setLocalStream(previewStream);
    setStreamType(previewType);
    setIsBroadcasting(true);
    setShowPreview(false);
    // Don't null previewStream - cleanup effect would stop the shared tracks

    previewStream.getTracks().forEach(track => {
      track.addEventListener('ended', () => stopStream());
    });

    try {
      const streamDoc = await addDoc(collection(db, 'livestreams'), {
        title,
        description,
        category,
        isPrivate,
        hostId: auth.currentUser?.uid,
        hostName: auth.currentUser?.displayName,
        hostPhotoURL: auth.currentUser?.photoURL,
        type: previewType,
        isLive: true,
        viewers: 0,
        likes: 0,
        createdAt: serverTimestamp()
      });

      const streamId = streamDoc.id;

      setActiveStream({
        id: streamId, title, description, category, isPrivate,
        hostId: auth.currentUser?.uid, hostName: auth.currentUser?.displayName,
        hostPhotoURL: auth.currentUser?.photoURL, type: previewType, isLive: true, viewers: 0, likes: 0,
      });

      // Listen for viewer join requests (WebRTC signaling)
      const viewersCol = collection(db, `livestreams/${streamId}/viewers`);
      const viewerUnsub = onSnapshot(viewersCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const viewerId = change.doc.id;
            const viewerData = change.doc.data();

            // Skip if already connected
            if (peerConnectionsRef.current.has(viewerId)) return;

            const pc = createPeerConnection();
            peerConnectionsRef.current.set(viewerId, pc);

            // Add local tracks to this peer connection using ref (always current)
            const stream = localStreamRef.current;
            if (stream) {
              stream.getTracks().forEach(track => pc.addTrack(track, stream));
            }

            // Collect ICE candidates
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                addDoc(collection(db, `livestreams/${streamId}/viewers/${viewerId}/hostCandidates`), event.candidate.toJSON());
              }
            };

            // Set remote description (viewer's offer)
            if (viewerData.offer) {
              await pc.setRemoteDescription(new RTCSessionDescription(viewerData.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await updateDoc(doc(db, `livestreams/${streamId}/viewers`, viewerId), {
                answer: { sdp: answer.sdp, type: answer.type }
              });
            }

            // Listen for viewer's ICE candidates
            const candidateUnsub = onSnapshot(
              collection(db, `livestreams/${streamId}/viewers/${viewerId}/viewerCandidates`),
              (snap) => {
                snap.docChanges().forEach((c) => {
                  if (c.type === 'added') {
                    pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));
                  }
                });
              }
            );

            viewerUnsubsRef.current.set(viewerId, candidateUnsub);
          }

          if (change.type === 'removed') {
            const viewerId = change.doc.id;
            const pc = peerConnectionsRef.current.get(viewerId);
            pc?.close();
            peerConnectionsRef.current.delete(viewerId);
            viewerUnsubsRef.current.get(viewerId)?.();
            viewerUnsubsRef.current.delete(viewerId);
          }
        });
      });

      viewerUnsubsRef.current.set('__main__', viewerUnsub);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'livestreams');
      stopStream();
    }
  };

  const stopStream = async () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    localStreamRef.current = null;

    // Clean up all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    viewerUnsubsRef.current.forEach(unsub => unsub());
    viewerUnsubsRef.current.clear();

    setIsBroadcasting(false);
    setStreamType(null);
    setIsMicMuted(false);
    setIsCamOff(false);
    setRemoteStream(null);

    if (activeStream && activeStream.hostId === auth.currentUser?.uid) {
      try {
        await updateDoc(doc(db, 'livestreams', activeStream.id), {
          isLive: false, endedAt: serverTimestamp(), duration: streamDuration,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'livestreams');
      }
    }
    setActiveStream(null);
  };

  const joinStream = async (stream: any) => {
    // Private stream access check
    if (stream.isPrivate && stream.hostId !== auth.currentUser?.uid) {
      try {
        const followDoc = await getDoc(doc(db, 'follows', `${auth.currentUser?.uid}_${stream.hostId}`));
        if (!followDoc.exists()) {
          alert('This is a private stream. You must follow the host to watch.');
          return;
        }
      } catch {
        alert('Unable to verify access to this private stream.');
        return;
      }
    }

    setActiveStream(stream);
    setHasLiked(false);

    try {
      await updateDoc(doc(db, 'livestreams', stream.id), { viewers: increment(1) });

      // Set up WebRTC viewer connection
      const pc = createPeerConnection();
      peerConnectionsRef.current.set('viewer', pc);
      const pendingHostCandidates: RTCIceCandidate[] = [];

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      const viewerId = auth.currentUser?.uid
        ? `${auth.currentUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        : `anon_${Date.now()}`;
      viewerSessionIdRef.current = viewerId;

      // Collect ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(db, `livestreams/${stream.id}/viewers/${viewerId}/viewerCandidates`), event.candidate.toJSON());
        }
      };

      // Create offer
      // We need to add a transceiver to receive media
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Store viewer offer in Firestore
      await setDoc(doc(db, `livestreams/${stream.id}/viewers`, viewerId), {
        offer: { sdp: offer.sdp, type: offer.type },
        joinedAt: Date.now(),
      });

      // Listen for host's answer
      const viewerDocUnsub = onSnapshot(doc(db, `livestreams/${stream.id}/viewers`, viewerId), async (snap) => {
        const data = snap.data();
        if (data?.answer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          while (pendingHostCandidates.length > 0) {
            const candidate = pendingHostCandidates.shift();
            if (!candidate) continue;
            try {
              await pc.addIceCandidate(candidate);
            } catch (error) {
              console.warn('Failed to apply queued host candidate:', error);
            }
          }
        }
      });

      // Listen for host's ICE candidates
      const hostCandidateUnsub = onSnapshot(
        collection(db, `livestreams/${stream.id}/viewers/${viewerId}/hostCandidates`),
        async (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              if (pc.currentRemoteDescription) {
                try {
                  await pc.addIceCandidate(candidate);
                } catch (error) {
                  console.warn('Failed to add host candidate:', error);
                }
              } else {
                pendingHostCandidates.push(candidate);
              }
            }
          }
        }
      );

      viewerUnsubsRef.current.set('viewerDoc', viewerDocUnsub);
      viewerUnsubsRef.current.set('hostCandidates', hostCandidateUnsub);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'livestreams');
    }
  };

  const leaveStream = async () => {
    // Clean up WebRTC viewer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    viewerUnsubsRef.current.forEach(unsub => unsub());
    viewerUnsubsRef.current.clear();
    setRemoteStream(null);

    if (activeStream && activeStream.hostId !== auth.currentUser?.uid) {
      try {
        // Clean up viewer signaling doc
        const viewerId = viewerSessionIdRef.current;
        if (viewerId) {
          try {
            await deleteDoc(doc(db, `livestreams/${activeStream.id}/viewers`, viewerId));
          } catch {}
        }
        await updateDoc(doc(db, 'livestreams', activeStream.id), { viewers: increment(-1) });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'livestreams');
      }
    }
    setActiveStream(null);
    setHasLiked(false);
    setIsPiP(false);
    setIsFullscreen(false);
    viewerSessionIdRef.current = null;
  };

  const handleLike = async () => {
    if (!activeStream || hasLiked) return;
    setHasLiked(true);
    try {
      await updateDoc(doc(db, 'livestreams', activeStream.id), { likes: increment(1) });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'livestreams');
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activeStream) return;
    if (isReadOnlyAccount) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }
    try {
      await addDoc(collection(db, `livestreams/${activeStream.id}/comments`), {
        text: newComment,
        userId: auth.currentUser?.uid,
        userName: auth.currentUser?.displayName,
        userPhotoURL: auth.currentUser?.photoURL,
        userBadges: userProfile?.badges || [],
        userHiddenBadges: userProfile?.hiddenBadges || [],
        isVerified: !!userProfile?.isVerified,
        level: userProfile?.level || 1,
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `livestreams/${activeStream.id}/comments`);
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => { track.enabled = isMicMuted; });
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => { track.enabled = isCamOff; });
      setIsCamOff(!isCamOff);
    }
  };

  const copyStreamLink = () => {
    if (activeStream) {
      navigator.clipboard.writeText(`${window.location.origin}/live/${activeStream.id}`).catch(() => {});
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        const video = document.querySelector('video[data-stream-video]') as HTMLVideoElement;
        if (video) {
          await video.requestPictureInPicture();
          setIsPiP(true);
        }
      }
    } catch {
      // PiP not supported
    }
  };

  const getCategoryInfo = (id: string) => STREAM_CATEGORIES.find(c => c.id === id) || STREAM_CATEGORIES[STREAM_CATEGORIES.length - 1];

  // ============================
  // ACTIVE STREAM VIEW
  // ============================
  if (activeStream) {
    const isHost = activeStream.hostId === auth.currentUser?.uid;

    return (
      <div className={`fixed inset-0 bg-black z-50 flex ${isFullscreen ? '' : 'flex-col md:flex-row'}`}>
        {/* Video Area */}
        <div className={`relative bg-gray-900 flex items-center justify-center ${showChat && !isFullscreen ? 'flex-1' : 'w-full h-full'}`}>
          {isBroadcasting ? (
            <video
              ref={videoCallbackRef}
              data-stream-video
              autoPlay
              muted
              playsInline
              className={`w-full h-full ${isCamOff ? 'hidden' : 'object-contain'}`}
            />
          ) : remoteStream && remoteStream.getTracks().length > 0 ? (
            <video
              ref={viewerVideoRef}
              data-stream-video
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-white text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
              </motion.div>
              <p className="text-lg font-medium">Connecting to {activeStream.hostName}'s stream...</p>
              <p className="text-sm text-gray-400 mt-1">Establishing WebRTC connection</p>
            </div>
          )}

          {isCamOff && isBroadcasting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Avatar src={auth.currentUser?.photoURL || undefined} alt={auth.currentUser?.displayName || ''} className="h-24 w-24 mx-auto mb-3" />
                <p className="text-white font-medium">Camera is off</p>
              </div>
            </div>
          )}

          {/* Top overlay */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 flex justify-between items-start">
            <div className="flex items-center space-x-3 bg-black/40 backdrop-blur-sm rounded-full pr-4 p-1">
              <Avatar src={activeStream.hostPhotoURL} alt={activeStream.hostName} className="h-10 w-10" />
              <div>
                <p className="text-white font-bold text-sm">{activeStream.hostName}</p>
                <div className="flex items-center space-x-2">
                  <span className="text-red-500 text-xs font-bold flex items-center">
                    <span className="w-2 h-2 rounded-full bg-red-500 mr-1 animate-pulse" />
                    LIVE
                  </span>
                  {activeStream.category && (
                    <span className="text-gray-300 text-xs">{getCategoryInfo(activeStream.category).emoji} {getCategoryInfo(activeStream.category).label}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isBroadcasting && (
                <div className="bg-red-500/80 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center text-white text-sm font-mono">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  {formatDuration(streamDuration)}
                </div>
              )}
              <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center text-white text-sm">
                <Users className="h-4 w-4 mr-1" />
                {activeStream.viewers || 0}
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center text-white text-sm">
                <Heart className="h-4 w-4 mr-1" />
                {activeStream.likes || 0}
              </div>
              {activeStream.isPrivate && (
                <div className="bg-amber-500/80 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center text-white text-xs">
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  Private
                </div>
              )}
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {!isHost && (
                  <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <button onClick={() => setIsMuted(!isMuted)} className="text-white">
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => { setVolume(parseInt(e.target.value)); if (isMuted) setIsMuted(false); }}
                      className="w-20 h-1 accent-white cursor-pointer"
                    />
                  </div>
                )}

                {isHost && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleMic}
                      className={`p-2.5 rounded-full ${isMicMuted ? 'bg-red-500' : 'bg-white/20'} text-white backdrop-blur-sm`}
                    >
                      {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </motion.button>
                    {streamType === 'camera' && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleCam}
                        className={`p-2.5 rounded-full ${isCamOff ? 'bg-red-500' : 'bg-white/20'} text-white backdrop-blur-sm`}
                      >
                        {isCamOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                      </motion.button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {!isHost && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleLike}
                    className={`p-2.5 rounded-full backdrop-blur-sm text-white transition-colors ${hasLiked ? 'bg-pink-500/80' : 'bg-black/40 hover:bg-black/60'}`}
                  >
                    <Heart className={`h-5 w-5 ${hasLiked ? 'fill-current' : ''}`} />
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={copyStreamLink}
                  className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
                >
                  {linkCopied ? <Check className="h-5 w-5 text-green-400" /> : <Share2 className="h-5 w-5" />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePiP}
                  className={`p-2.5 rounded-full backdrop-blur-sm text-white ${isPiP ? 'bg-blue-500/80' : 'bg-black/40 hover:bg-black/60'}`}
                >
                  <PictureInPicture2 className="h-5 w-5" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowChat(!showChat)}
                  className={`p-2.5 rounded-full backdrop-blur-sm text-white ${showChat ? 'bg-blue-500/80' : 'bg-black/40 hover:bg-black/60'}`}
                >
                  <MessageSquare className="h-5 w-5" />
                </motion.button>

                {!isHost && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsReportModalOpen(true)}
                    className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
                  >
                    <Flag className="h-5 w-5" />
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={isHost ? stopStream : leaveStream}
                  className="px-4 py-2 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 transition-colors"
                >
                  {isHost ? 'End Stream' : 'Leave'}
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <AnimatePresence>
          {showChat && !isFullscreen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 flex flex-col h-1/3 md:h-full overflow-hidden"
            >
              <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <h3 className="text-white font-bold text-sm">Live Chat</h3>
                  <span className="text-gray-500 text-xs">({comments.length})</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {comments.length === 0 && (
                  <div className="text-center text-gray-600 py-8 text-xs">
                    No messages yet. Say hi! 👋
                  </div>
                )}
                {comments.map(comment => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start space-x-2"
                  >
                    <Avatar src={comment.userPhotoURL} alt={comment.userName} className="h-6 w-6 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="mr-1.5 inline-flex items-center gap-1 text-blue-400 text-xs font-bold">
                        <span>{comment.userName}</span>
                        {comment.isVerified && <VerificationBadge className="w-3 h-3" />}
                        <UserBadges badges={comment.userBadges} hiddenBadges={comment.userHiddenBadges} badgeSize="w-3 h-3" />
                        <LevelBadge level={comment.level || 1} compact className="scale-[0.82] origin-left" />
                      </span>
                      <span className="text-white text-xs break-words">{comment.text}</span>
                    </div>
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleComment} className="p-3 border-t border-gray-800 flex space-x-2 shrink-0">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Say something..."
                  className="flex-1 bg-gray-800 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetId={activeStream.id}
          targetType="livestream"
        />
      </div>
    );
  }

  // ============================
  // PREVIEW MODAL (before going live)
  // ============================
  if (showPreview) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
        >
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-white font-bold text-lg flex items-center">
              <Radio className="h-5 w-5 mr-2 text-red-500" />
              Stream Preview
            </h2>
            <button onClick={cancelPreview} className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="aspect-video bg-gray-950 relative">
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full flex items-center">
              <Eye className="h-3 w-3 mr-1.5" />
              Preview - Not Live Yet
            </div>
          </div>

          <div className="p-4 space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Stream Title *"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your stream about?"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />

            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  {STREAM_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                  isPrivate
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-green-500/20 border-green-500/50 text-green-400'
                }`}
              >
                {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                <span>{isPrivate ? 'Private' : 'Public'}</span>
              </button>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={cancelPreview}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goLive}
                disabled={!title.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Radio className="h-4 w-4 mr-2" />
                Go Live
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============================
  // MAIN BROWSE VIEW
  // ============================
  return (
    <div className="pb-20 md:pb-0 min-h-screen bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold dark:text-white">Live Streams</h1>
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'live'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className="flex items-center">
                <Radio className="h-3.5 w-3.5 mr-1.5" />
                Live
              </span>
            </button>
            <button
              onClick={() => setActiveTab('replays')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'replays'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className="flex items-center">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Replays
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Start Stream Card */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <h2 className="text-xl font-bold mb-1">Go Live</h2>
            <p className="text-white/70 text-sm mb-4">Share your screen or camera with your followers</p>
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Stream Title"
                className="w-full bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <div className="flex space-x-2 pt-1">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openPreview('camera')}
                  className="flex-1 flex items-center justify-center bg-white text-red-500 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Camera & Mic
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openPreview('screen')}
                  className="flex-1 flex items-center justify-center bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-white/30 transition-colors"
                >
                  <MonitorUp className="h-4 w-4 mr-2" />
                  Screen Share
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'live' ? (
        <div className="px-4 pb-4">
          <h2 className="text-lg font-bold dark:text-white mb-3 flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
            Live Now
            {streams.length > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({streams.length})</span>}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {streams.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <Video className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No one is live right now</p>
                <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">Be the first to go live!</p>
              </div>
            ) : (
              streams.filter(s => !s.isPrivate).map((stream, idx) => (
                <motion.div
                  key={stream.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                  onClick={() => joinStream(stream)}
                >
                  <div className="aspect-video bg-gray-900 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                    <Video className="h-10 w-10 text-gray-700 relative z-10 group-hover:scale-110 transition-transform" />
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center z-10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white mr-1 animate-pulse" />
                      LIVE
                    </div>
                    {stream.category && (
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full z-10">
                        {getCategoryInfo(stream.category).emoji} {getCategoryInfo(stream.category).label}
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center z-10">
                      <Users className="h-3 w-3 mr-1" />
                      {stream.viewers || 0}
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center z-10">
                      <Heart className="h-3 w-3 mr-1" />
                      {stream.likes || 0}
                    </div>
                  </div>
                  <div className="p-3 flex items-start space-x-3">
                    <Avatar src={stream.hostPhotoURL} alt={stream.hostName} className="h-9 w-9 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm dark:text-white line-clamp-1">{stream.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{stream.hostName}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <h2 className="text-lg font-bold dark:text-white mb-3 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-gray-400" />
            Recent Replays
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {endedStreams.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <Clock className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No replays available</p>
                <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">Past streams will appear here</p>
              </div>
            ) : (
              endedStreams.map((stream, idx) => (
                <motion.div
                  key={stream.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                  <div className="aspect-video bg-gray-900 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                    <Video className="h-10 w-10 text-gray-700 relative z-10" />
                    <div className="absolute top-2 left-2 bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center z-10">
                      <Clock className="h-3 w-3 mr-1" />
                      {stream.duration ? formatDuration(stream.duration) : 'Ended'}
                    </div>
                    {stream.category && (
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full z-10">
                        {getCategoryInfo(stream.category).emoji} {getCategoryInfo(stream.category).label}
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center z-10">
                      <Heart className="h-3 w-3 mr-1" />
                      {stream.likes || 0}
                    </div>
                  </div>
                  <div className="p-3 flex items-start space-x-3">
                    <Avatar src={stream.hostPhotoURL} alt={stream.hostName} className="h-9 w-9 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm dark:text-white line-clamp-1">{stream.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{stream.hostName}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
