'use client';

import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

type AudioWaveformProps = {
  src: string;
  active: boolean;
  progress: number;
  onSeek: (percent: number) => void;
};

export default function AudioWaveform({ src, active, progress, onSeek }: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const seekingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !src) return;

    const waveSurfer = WaveSurfer.create({
      container,
      url: src,
      height: 'auto',
      waveColor: 'rgba(255, 255, 255, 0.27)',
      progressColor: 'rgba(214, 176, 74, 0.96)',
      cursorColor: 'transparent',
      cursorWidth: 0,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      barHeight: 1.18,
      barAlign: 'bottom',
      barMinHeight: 3,
      normalize: true,
      interact: true,
      dragToSeek: { debounceTime: 40 },
      hideScrollbar: true,
      fillParent: true,
      backend: 'WebAudio',
      fetchParams: {
        mode: 'cors',
        credentials: 'omit'
      }
    });

    waveSurferRef.current = waveSurfer;

    const stopInteraction = waveSurfer.on('interaction', (time) => {
      const duration = waveSurfer.getDuration();
      if (!duration) return;
      seekingRef.current = true;
      onSeek((time / duration) * 100);
      window.setTimeout(() => {
        seekingRef.current = false;
      }, 80);
    });

    return () => {
      stopInteraction();
      waveSurfer.destroy();
      if (waveSurferRef.current === waveSurfer) {
        waveSurferRef.current = null;
      }
    };
  }, [onSeek, src]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !active || seekingRef.current) return;

    const duration = waveSurfer.getDuration();
    if (!duration) return;

    waveSurfer.setTime((Math.min(100, Math.max(0, progress)) / 100) * duration);
  }, [active, progress]);

  return <div ref={containerRef} className="audio-waveform" aria-label="Waveform del preview" />;
}
