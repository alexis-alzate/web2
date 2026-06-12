'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type PlayerTrack = {
  beatId: string;
  slug: string;
  title: string;
  genre: string | null;
  coverUrl: string;
  previewUrl: string;
  price: number;
};

type RepeatMode = 'off' | 'all' | 'one';

type PlayerContextValue = {
  track: PlayerTrack | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  hasNext: boolean;
  hasPrev: boolean;
  toggle: (track: PlayerTrack) => void;
  togglePlayPause: () => void;
  close: () => void;
  setQueue: (tracks: PlayerTrack[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  seekToPercent: (percent: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const trackRef = useRef<PlayerTrack | null>(null);
  const repeatRef = useRef<RepeatMode>('off');

  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [queueVersion, setQueueVersion] = useState(0);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const playTrack = useCallback((newTrack: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = newTrack.previewUrl;
    audio.play();
    setTrack(newTrack);
    setIsPlaying(true);
    setProgress(0);
  }, []);

  const advance = useCallback((direction: 1 | -1) => {
    const queue = queueRef.current;
    const current = trackRef.current;
    if (!queue.length || !current) return;

    const index = queue.findIndex((t) => t.beatId === current.beatId);
    if (index === -1) return;

    let nextIndex = index + direction;
    if (nextIndex < 0) {
      if (repeatRef.current === 'all') nextIndex = queue.length - 1;
      else return;
    } else if (nextIndex >= queue.length) {
      if (repeatRef.current === 'all') nextIndex = 0;
      else return;
    }

    playTrack(queue[nextIndex]);
  }, [playTrack]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnded = () => {
      if (repeatRef.current === 'one') {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      const queue = queueRef.current;
      const current = trackRef.current;
      const index = current ? queue.findIndex((t) => t.beatId === current.beatId) : -1;
      const hasNextTrack = index !== -1 && (index < queue.length - 1 || repeatRef.current === 'all');
      if (hasNextTrack) {
        advance(1);
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [advance]);

  const toggle = useCallback((newTrack: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (trackRef.current?.beatId === newTrack.beatId) {
      if (audio.paused) {
        audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }

    playTrack(newTrack);
  }, [playTrack]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !trackRef.current) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    audio?.pause();
    setTrack(null);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const setQueue = useCallback((tracks: PlayerTrack[]) => {
    queueRef.current = tracks;
    setQueueVersion((v) => v + 1);
  }, []);

  const playNext = useCallback(() => advance(1), [advance]);
  const playPrevious = useCallback(() => advance(-1), [advance]);

  const setVolume = useCallback((value: number) => {
    const audio = audioRef.current;
    const clamped = Math.min(1, Math.max(0, value));
    setVolumeState(clamped);
    if (audio) {
      audio.volume = clamped;
      audio.muted = clamped === 0;
    }
    setMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    setMuted((prev) => {
      const next = !prev;
      if (audio) audio.muted = next;
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const seekToPercent = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const clamped = Math.min(100, Math.max(0, percent));
    audio.currentTime = (clamped / 100) * audio.duration;
    setProgress(clamped);
  }, []);

  const { hasNext, hasPrev } = useMemo(() => {
    const queue = queueRef.current;
    const currentIndex = track ? queue.findIndex((t) => t.beatId === track.beatId) : -1;
    return {
      hasNext: currentIndex !== -1 && (currentIndex < queue.length - 1 || repeat === 'all') && queue.length > 1,
      hasPrev: currentIndex !== -1 && (currentIndex > 0 || repeat === 'all') && queue.length > 1
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, repeat, queueVersion]);

  return (
    <PlayerContext.Provider
      value={{
        track,
        isPlaying,
        progress,
        volume,
        muted,
        repeat,
        hasNext,
        hasPrev,
        toggle,
        togglePlayPause,
        close,
        setQueue,
        playNext,
        playPrevious,
        setVolume,
        toggleMute,
        cycleRepeat,
        seekToPercent
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer debe usarse dentro de PlayerProvider');
  return ctx;
}
