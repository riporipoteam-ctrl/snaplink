import { useEffect, useState } from 'react';

interface SpeakingActivityState {
  isSpeaking: boolean;
  level: number;
}

export function useSpeakingActivity(
  stream: MediaStream | null,
  enabled = true,
  threshold = 0.04
): SpeakingActivityState {
  const [state, setState] = useState<SpeakingActivityState>({ isSpeaking: false, level: 0 });

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let cancelled = false;

    const resetState = () => {
      if (!cancelled) {
        setState({ isSpeaking: false, level: 0 });
      }
    };

    if (!enabled || !stream) {
      resetState();
      return () => {
        cancelled = true;
      };
    }

    const activeAudioTracks = stream
      .getAudioTracks()
      .filter((track) => track.readyState === 'live' && track.enabled);

    if (activeAudioTracks.length === 0) {
      resetState();
      return () => {
        cancelled = true;
      };
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      resetState();
      return () => {
        cancelled = true;
      };
    }

    try {
      audioContext = new AudioContextCtor();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      const speakingStream = new MediaStream(activeAudioTracks);
      source = audioContext.createMediaStreamSource(speakingStream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.fftSize);

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }

      intervalId = setInterval(() => {
        if (!analyser || cancelled) return;

        analyser.getByteTimeDomainData(buffer);

        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const normalized = (buffer[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / buffer.length);
        const level = Math.min(rms * 8, 1);
        const isSpeaking = level > threshold;

        setState((previous) => {
          if (Math.abs(previous.level - level) < 0.02 && previous.isSpeaking === isSpeaking) {
            return previous;
          }

          return { isSpeaking, level };
        });
      }, 120);
    } catch {
      resetState();
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      source?.disconnect();
      analyser?.disconnect();
      audioContext?.close().catch(() => {});
    };
  }, [enabled, stream, threshold]);

  return state;
}
