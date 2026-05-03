import React, { useEffect, useRef } from 'react';
import { useMeeting } from '../../contexts/MeetingContext';
import { useAuth } from '../../contexts/AuthContext';
import { Mic, MicOff, MonitorUp, Users, Video, VideoOff, X, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Avatar } from './Avatar';
import { useSpeakingActivity } from '../../hooks/useSpeakingActivity';

function MeetingStreamTile({
  title,
  stream,
  muted = false,
  isMicOn = true,
  isVideoOn = true,
  isScreenShare = false,
  photoURL,
}: {
  title: string;
  stream: MediaStream | null;
  muted?: boolean;
  isMicOn?: boolean;
  isVideoOn?: boolean;
  isScreenShare?: boolean;
  photoURL?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isSpeaking, level } = useSpeakingActivity(stream, isMicOn);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.muted = true;
    if (stream) {
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (!audioRef.current || muted) return;
    audioRef.current.srcObject = stream;
    audioRef.current.muted = false;
    if (stream) {
      audioRef.current.play().catch(() => {});
    }
  }, [muted, stream]);

  const hasVideoTrack = !!stream?.getVideoTracks().length;

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-black shadow-2xl transition-all ${isSpeaking ? 'border-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.5),0_0_32px_rgba(16,185,129,0.25)]' : 'border-gray-800'}`}>
      {stream && !muted && <audio ref={audioRef} autoPlay playsInline />}
      {isSpeaking && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200 backdrop-blur-sm">
          <span>Speaking</span>
          <div className="flex items-end gap-0.5">
            {[0.7, 1, 0.8].map((factor, index) => (
              <motion.span
                key={`${title}-level-${index}`}
                animate={{ height: [4, Math.max(8, Math.round(level * 18 * factor)), 4] }}
                transition={{ duration: 0.55, repeat: Infinity, delay: index * 0.08 }}
                className="block w-1 rounded-full bg-emerald-300"
              />
            ))}
          </div>
        </div>
      )}
      {stream && hasVideoTrack && (isVideoOn || isScreenShare) ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`h-full w-full ${isScreenShare ? 'object-contain bg-black' : 'object-cover'}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 p-6 text-center">
          <Avatar src={photoURL} alt={title} className="h-20 w-20" animated={false} />
          <div>
            <div className="text-lg font-bold text-white">{title}</div>
            <div className="mt-1 text-sm text-gray-400">{isScreenShare ? 'Screen share is unavailable' : 'Camera is off'}</div>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${isMicOn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
          {isMicOn ? <Mic className="mr-1 h-3 w-3" /> : <MicOff className="mr-1 h-3 w-3" />}
          {isMicOn ? 'Mic on' : 'Muted'}
        </span>
        {isScreenShare && (
          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
            <MonitorUp className="mr-1 h-3 w-3" />
            Sharing
          </span>
        )}
      </div>
    </div>
  );
}

export function MeetingWidget() {
  const {
    inMeeting,
    isMinimized,
    localStream,
    screenStream,
    remoteStreams,
    participants,
    endMeeting,
    toggleMinimize,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    isMicOn,
    isCameraOn,
    isScreenSharing,
  } = useMeeting();
  const { userProfile } = useAuth();

  if (!inMeeting || !userProfile) return null;

  const otherParticipants = participants.filter((participant) => participant.uid !== userProfile.uid);
  const localParticipant = participants.find((participant) => participant.uid === userProfile.uid);
  const activeScreenParticipant = participants.find((participant) => participant.isScreenSharing);
  const activeScreenStream = activeScreenParticipant
    ? activeScreenParticipant.uid === userProfile.uid
      ? screenStream
      : remoteStreams[activeScreenParticipant.uid] || null
    : null;

  const gridParticipants = participants.filter((participant) => !activeScreenParticipant || participant.uid !== activeScreenParticipant.uid);

  if (isMinimized) {
    const minimizedStream = activeScreenStream || screenStream || localStream;
    const minimizedTitle = activeScreenParticipant?.uid === userProfile.uid
      ? `${userProfile.displayName} screen`
      : activeScreenParticipant?.displayName || userProfile.displayName;

    return (
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed bottom-20 right-4 md:bottom-4 md:right-4 w-72 bg-gray-900 rounded-xl shadow-2xl overflow-hidden z-50 border border-gray-700"
      >
        <div className="relative aspect-video bg-black">
          <MeetingStreamTile
            title={minimizedTitle}
            stream={minimizedStream}
            muted={activeScreenParticipant?.uid === userProfile.uid}
            isMicOn={activeScreenParticipant?.uid === userProfile.uid ? isMicOn : (activeScreenParticipant?.isMicOn ?? true)}
            isVideoOn={activeScreenParticipant?.uid === userProfile.uid ? isCameraOn : (activeScreenParticipant?.isCameraOn ?? true)}
            isScreenShare={!!activeScreenParticipant}
            photoURL={activeScreenParticipant?.uid === userProfile.uid ? userProfile.photoURL : activeScreenParticipant?.photoURL}
          />
        </div>
        <div className="bg-gray-800 p-2 flex items-center justify-between">
          <div className="flex space-x-1">
            <button onClick={() => { void toggleMic(); }} className={`p-1.5 rounded-full ${isMicOn ? 'text-white hover:bg-gray-700' : 'text-red-500 bg-red-500/20'}`}>
              {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button onClick={() => { void toggleCamera(); }} className={`p-1.5 rounded-full ${isCameraOn ? 'text-white hover:bg-gray-700' : 'text-red-500 bg-red-500/20'}`}>
              {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex space-x-1">
            <button onClick={toggleMinimize} className="p-1.5 rounded-full text-white hover:bg-gray-700">
              <Maximize2 className="h-4 w-4" />
            </button>
            <button onClick={() => { void endMeeting(); }} className="p-1.5 rounded-full text-white bg-red-600 hover:bg-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        <div>
          <h2 className="text-white font-bold text-lg">Team Meeting</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            {participants.length} participant{participants.length === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={toggleMinimize} className="text-gray-400 hover:text-white p-2">
          <Minimize2 className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {activeScreenParticipant && activeScreenStream ? (
          <div className="grid h-full grid-rows-[minmax(0,1fr)_220px] gap-4">
            <MeetingStreamTile
              title={activeScreenParticipant.uid === userProfile.uid ? `${userProfile.displayName} screen` : `${activeScreenParticipant.displayName} screen`}
              stream={activeScreenStream}
              muted={activeScreenParticipant.uid === userProfile.uid}
              isMicOn={activeScreenParticipant.uid === userProfile.uid ? isMicOn : activeScreenParticipant.isMicOn}
              isVideoOn
              isScreenShare
              photoURL={activeScreenParticipant.uid === userProfile.uid ? userProfile.photoURL : activeScreenParticipant.photoURL}
            />

            <div className="grid h-full gap-4 overflow-x-auto md:grid-cols-3" style={{ gridAutoColumns: 'minmax(220px, 1fr)' }}>
              <MeetingStreamTile
                title={`${userProfile.displayName} (You)`}
                stream={localStream}
                muted
                isMicOn={isMicOn}
                isVideoOn={isCameraOn}
                photoURL={userProfile.photoURL}
              />
              {gridParticipants
                .filter((participant) => participant.uid !== userProfile.uid)
                .map((participant) => (
                  <React.Fragment key={participant.uid}>
                    <MeetingStreamTile
                      title={participant.displayName}
                      stream={remoteStreams[participant.uid] || null}
                      isMicOn={participant.isMicOn}
                      isVideoOn={participant.isCameraOn}
                      photoURL={participant.photoURL}
                    />
                  </React.Fragment>
                ))}
            </div>
          </div>
        ) : (
          <div className="grid h-full gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MeetingStreamTile
              title={`${userProfile.displayName} (You)`}
              stream={localStream}
              muted
              isMicOn={isMicOn}
              isVideoOn={isCameraOn}
              photoURL={userProfile.photoURL}
            />
            {otherParticipants.map((participant) => (
              <React.Fragment key={participant.uid}>
                <MeetingStreamTile
                  title={participant.displayName}
                  stream={remoteStreams[participant.uid] || null}
                  isMicOn={participant.isMicOn}
                  isVideoOn={participant.isCameraOn}
                  photoURL={participant.photoURL}
                />
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-950 p-6 flex items-center justify-center space-x-4 border-t border-gray-800">
        <button onClick={() => { void toggleMic(); }} className={`p-4 rounded-full transition-colors ${isMicOn ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
          {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>
        <button onClick={() => { void toggleCamera(); }} className={`p-4 rounded-full transition-colors ${isCameraOn ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
          {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </button>
        <button onClick={() => { void toggleScreenShare(); }} className={`p-4 rounded-full transition-colors ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}>
          <MonitorUp className="h-6 w-6" />
        </button>
        <button onClick={() => { void endMeeting(); }} className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors ml-8">
          <X className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
