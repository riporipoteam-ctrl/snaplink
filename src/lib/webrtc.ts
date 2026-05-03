// WebRTC utility with Firestore signaling
import { db } from './firebase';
import { doc, collection, setDoc, onSnapshot, addDoc, getDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(ICE_SERVERS);
}

// Create a call document and set the offer
export async function createCallOffer(
  callId: string,
  pc: RTCPeerConnection,
  callerId: string,
  calleeId: string,
  callType: 'voice' | 'video',
  chatId?: string
): Promise<() => void> {
  const callDoc = doc(db, 'calls', callId);
  const offerCandidates = collection(callDoc, 'offerCandidates');
  const answerCandidates = collection(callDoc, 'answerCandidates');
  const pendingRemoteCandidates: RTCIceCandidate[] = [];

  // Collect ICE candidates for caller
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  await setDoc(callDoc, {
    callerId,
    calleeId,
    chatId: chatId || null,
    callType,
    offer: { sdp: offerDescription.sdp, type: offerDescription.type },
    status: 'ringing',
    createdAt: Date.now(),
  });

  // Listen for answer
  const unsubAnswer = onSnapshot(callDoc, async (snapshot) => {
    const data = snapshot.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      const answerDescription = new RTCSessionDescription(data.answer);
      await pc.setRemoteDescription(answerDescription);
      while (pendingRemoteCandidates.length > 0) {
        const candidate = pendingRemoteCandidates.shift();
        if (!candidate) continue;
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.warn('Failed to apply queued answer ICE candidate:', error);
        }
      }
    }
  });

  // Listen for remote ICE candidates
  const unsubCandidates = onSnapshot(answerCandidates, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        if (pc.currentRemoteDescription) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (error) {
            console.warn('Failed to add answer ICE candidate:', error);
          }
        } else {
          pendingRemoteCandidates.push(candidate);
        }
      }
    }
  });

  return () => {
    unsubAnswer();
    unsubCandidates();
  };
}

// Answer an incoming call
export async function answerCall(
  callId: string,
  pc: RTCPeerConnection
): Promise<() => void> {
  const callDoc = doc(db, 'calls', callId);
  const offerCandidates = collection(callDoc, 'offerCandidates');
  const answerCandidates = collection(callDoc, 'answerCandidates');
  const pendingRemoteCandidates: RTCIceCandidate[] = [];

  // Collect ICE candidates for callee
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  const callData = (await getDoc(callDoc)).data();
  if (!callData?.offer) throw new Error('No offer found');

  await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  await updateDoc(callDoc, {
    answer: { sdp: answerDescription.sdp, type: answerDescription.type },
    status: 'active',
  });

  // Listen for remote ICE candidates
  const unsubCandidates = onSnapshot(offerCandidates, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        if (pc.currentRemoteDescription) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (error) {
            console.warn('Failed to add offer ICE candidate:', error);
          }
        } else {
          pendingRemoteCandidates.push(candidate);
        }
      }
    }

    while (pc.currentRemoteDescription && pendingRemoteCandidates.length > 0) {
      const candidate = pendingRemoteCandidates.shift();
      if (!candidate) continue;
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Failed to apply queued offer ICE candidate:', error);
      }
    }
  });

  return () => {
    unsubCandidates();
  };
}

// Clean up call document
export async function cleanupCall(callId: string) {
  try {
    const callDoc = doc(db, 'calls', callId);
    // Delete subcollections
    const offerCandidatesSnap = await getDocs(collection(callDoc, 'offerCandidates'));
    offerCandidatesSnap.forEach((d) => deleteDoc(d.ref));
    const answerCandidatesSnap = await getDocs(collection(callDoc, 'answerCandidates'));
    answerCandidatesSnap.forEach((d) => deleteDoc(d.ref));
    await deleteDoc(callDoc);
  } catch (e) {
    console.error('Error cleaning up call:', e);
  }
}

export async function finishCallSession(
  callId: string,
  endedBy: string,
  endedReason: 'ended' | 'missed' | 'declined' | 'failed' = 'ended'
) {
  const callDoc = doc(db, 'calls', callId);
  try {
    await updateDoc(callDoc, {
      status: 'ended',
      endedBy,
      endedReason,
      endedAt: Date.now(),
    });
  } catch (error) {
    console.warn('Unable to mark call as ended before cleanup:', error);
  }

  window.setTimeout(() => {
    void cleanupCall(callId);
  }, 4500);
}

// Listen for incoming calls
export function listenForIncomingCalls(
  userId: string,
  onIncomingCall: (
    callId: string,
    payload: {
      callerId: string;
      callType: 'voice' | 'video';
      chatId?: string;
    }
  ) => void
): () => void {
  const callsRef = collection(db, 'calls');
  // We must listen for all calls and filter client-side
  const unsub = onSnapshot(callsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        if (data.calleeId === userId && data.status === 'ringing') {
          onIncomingCall(change.doc.id, {
            callerId: data.callerId,
            callType: data.callType,
            chatId: data.chatId,
          });
        }
      }
    });
  });
  return unsub;
}

// Generate a ringtone using Web Audio API
export function playRingtone(): { stop: () => void } {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let stopped = false;

  const playTone = (frequency: number, startTime: number, duration: number) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  let interval: ReturnType<typeof setInterval>;

  const ring = () => {
    if (stopped) return;
    const now = audioCtx.currentTime;
    // Classic phone ring pattern: two short tones
    playTone(440, now, 0.15);
    playTone(480, now + 0.02, 0.15);
    playTone(440, now + 0.2, 0.15);
    playTone(480, now + 0.22, 0.15);
  };

  ring();
  interval = setInterval(ring, 2000); // Ring every 2 seconds

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      audioCtx.close();
    },
  };
}
