'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type AudioWaveformProps = {
  src: string;
  active: boolean;
  playing: boolean;
  progress: number;
  onSeek: (percent: number) => void;
  getFrequencySnapshot: () => number[];
};

const BAR_COUNT = 112;

const emptyBars = Array.from({ length: BAR_COUNT }, () => 0.08);

const average = (values: Float32Array, from: number, to: number) => {
  let total = 0;
  let peak = 0;
  const end = Math.max(from + 1, to);

  for (let i = from; i < end; i++) {
    const value = Math.abs(values[i] || 0);
    total += value * value;
    if (value > peak) peak = value;
  }

  const rms = Math.sqrt(total / (end - from));
  return Math.min(1, peak * 0.62 + rms * 1.35);
};

const normalizeBars = (bars: number[]) => {
  const max = Math.max(...bars, 0.01);
  return bars.map((value) => Math.max(0.06, Math.min(1, value / max)));
};

export default function AudioWaveform({
  src,
  active,
  playing,
  progress,
  onSeek,
  getFrequencySnapshot
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barsRef = useRef<number[]>(emptyBars);
  const liveEnergyRef = useRef<number[]>(emptyBars);
  const [bars, setBars] = useState<number[]>(emptyBars);

  const audioContext = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    return AudioContextClass ? new AudioContextClass() : null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!src || !audioContext) {
        setBars(emptyBars);
        barsRef.current = emptyBars;
        return;
      }

      try {
        const response = await fetch(src, { mode: 'cors' });
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const channel = decoded.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(channel.length / BAR_COUNT));
        const nextBars = normalizeBars(
          Array.from({ length: BAR_COUNT }, (_, index) => {
            const from = index * blockSize;
            const to = index === BAR_COUNT - 1 ? channel.length : from + blockSize;
            return average(channel, from, to);
          })
        );

        if (!cancelled) {
          barsRef.current = nextBars;
          setBars(nextBars);
        }
      } catch {
        if (!cancelled) {
          barsRef.current = emptyBars;
          setBars(emptyBars);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [audioContext, src]);

  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const rawFrequency = active && playing ? getFrequencySnapshot() : [];
      if (rawFrequency.length) {
        const bucketSize = Math.max(1, Math.floor(rawFrequency.length / BAR_COUNT));
        liveEnergyRef.current = liveEnergyRef.current.map((previous, index) => {
          const from = index * bucketSize;
          const bucket = rawFrequency.slice(from, from + bucketSize);
          const value = bucket.reduce((sum, item) => sum + item, 0) / Math.max(1, bucket.length) / 255;
          return previous * 0.72 + value * 0.28;
        });
      } else {
        liveEnergyRef.current = liveEnergyRef.current.map((value) => value * 0.9);
      }

      const gap = Math.max(2, Math.floor(width / BAR_COUNT * 0.28));
      const barWidth = Math.max(2, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
      const playedIndex = Math.round((Math.min(100, Math.max(0, progress)) / 100) * BAR_COUNT);

      barsRef.current.forEach((value, index) => {
        const live = active && playing ? liveEnergyRef.current[index] || 0 : 0;
        const mixed = Math.min(1, value * (1 + live * 0.72));
        const barHeight = Math.max(6 * dpr, mixed * height * 0.92);
        const x = index * (barWidth + gap);
        const y = (height - barHeight) / 2;
        const isPlayed = active && index <= playedIndex;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isPlayed) {
          gradient.addColorStop(0, 'rgba(245, 220, 139, 0.98)');
          gradient.addColorStop(0.52, 'rgba(201, 168, 76, 0.9)');
          gradient.addColorStop(1, 'rgba(201, 168, 76, 0.38)');
          ctx.shadowColor = 'rgba(201, 168, 76, 0.35)';
          ctx.shadowBlur = active && playing ? 10 * dpr : 4 * dpr;
        } else {
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0.16)');
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, Math.min(3 * dpr, barWidth / 2));
        ctx.fill();
      });

      frame = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [active, getFrequencySnapshot, playing, progress]);

  const seek = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    onSeek(percent);
  };

  return (
    <canvas
      ref={canvasRef}
      className="audio-waveform"
      aria-label="Waveform del preview"
      role="img"
      onClick={(event) => seek(event.clientX)}
    />
  );
}
