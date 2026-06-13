'use client';

import { useEffect, useRef } from 'react';

type SpectrumSnapshot = {
  data: number[];
  sampleRate: number;
};

type AudioWaveformProps = {
  active: boolean;
  playing: boolean;
  progress: number;
  onSeek: (percent: number) => void;
  getSpectrumSnapshot: () => SpectrumSnapshot | null;
  compact?: boolean;
};

const MIN_FREQ = 28;
const MAX_FREQ = 18000;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const deterministicIdle = (index: number) => {
  const lowRoll = Math.sin(index * 0.19) * 0.5 + 0.5;
  const detail = Math.sin(index * 1.73) * Math.cos(index * 0.41);
  return clamp(0.06 + lowRoll * 0.16 + Math.abs(detail) * 0.1);
};

const frequencyToIndex = (frequency: number, sampleRate: number, bins: number) => {
  const nyquist = sampleRate / 2;
  return clamp(frequency / nyquist, 0, 1) * Math.max(0, bins - 1);
};

const readBin = (data: number[], position: number) => {
  const lower = Math.floor(position);
  const upper = Math.min(data.length - 1, lower + 1);
  const mix = position - lower;
  return ((data[lower] || 0) * (1 - mix) + (data[upper] || 0) * mix) / 255;
};

const barFrequency = (index: number, barCount: number) => {
  const ratio = index / Math.max(1, barCount - 1);
  return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, ratio);
};

// Realza graves/medios y deja que los agudos solo "salten" si el audio
// realmente trae energia ahi (como el analizador de un EQ tipo Pro-Q3).
const bandWeight = (index: number, barCount: number) => {
  const ratio = index / Math.max(1, barCount - 1);
  if (ratio < 0.23) return 1.26;
  if (ratio < 0.68) return 1.02;
  return 0.72;
};

export default function AudioWaveform({
  active,
  playing,
  progress,
  onSeek,
  getSpectrumSnapshot,
  compact = false
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barCount = compact ? 40 : 156;
  const levelsRef = useRef<number[]>(Array.from({ length: barCount }, (_, index) => deterministicIdle(index)));
  const peaksRef = useRef<number[]>(Array.from({ length: barCount }, () => 0));
  const tickRef = useRef(0);

  // El loop de animacion lee estos valores desde un ref para no depender de
  // ellos en el array del efecto. Si `progress`/`playing` estuvieran en las
  // dependencias, cada tick de progreso reiniciaria el requestAnimationFrame
  // y la fila recien activada podria no volver a arrancar el loop.
  const liveRef = useRef({ playing, progress, getSpectrumSnapshot });
  liveRef.current = { playing, progress, getSpectrumSnapshot };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      const { playing, progress, getSpectrumSnapshot } = liveRef.current;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      if (!compact) {
        const gradientBg = ctx.createLinearGradient(0, 0, 0, height);
        gradientBg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradientBg.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = gradientBg;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      tickRef.current += playing ? 0.085 : 0.018;
      const snapshot = active && playing ? getSpectrumSnapshot() : null;
      const hasEnergy = !!snapshot?.data.some((value) => value > 2);
      const nextLevels = levelsRef.current;

      for (let index = 0; index < barCount; index++) {
        let target = deterministicIdle(index) * (compact ? 0.14 : 0.34);

        if (snapshot?.data.length && hasEnergy) {
          const frequency = barFrequency(index, barCount);
          const center = frequencyToIndex(frequency, snapshot.sampleRate, snapshot.data.length);
          const spread = index < barCount * 0.23 ? 3.8 : index < barCount * 0.69 ? 2.4 : 1.35;
          const raw =
            readBin(snapshot.data, Math.max(0, center - spread)) * 0.22 +
            readBin(snapshot.data, center) * 0.56 +
            readBin(snapshot.data, Math.min(snapshot.data.length - 1, center + spread)) * 0.22;

          // Exponente >1: las bandas sin energia se quedan abajo y las que
          // si tienen contenido "se elevan" con mas contraste, al estilo
          // de un analizador de espectro en tiempo real.
          const shaped = Math.pow(clamp(raw * bandWeight(index, barCount)), 0.82);
          target = clamp(shaped);
        } else if (active && playing) {
          const bassShape = Math.max(0, 1 - index / (barCount * 0.33));
          const midShape = Math.max(0, 1 - Math.abs(index - barCount * 0.46) / (barCount * 0.3));
          const highShape = Math.max(0, 1 - Math.abs(index - barCount * 0.81) / (barCount * 0.22));
          const t = tickRef.current;
          target = clamp(
            deterministicIdle(index) * 0.16 +
            bassShape * Math.abs(Math.sin(t * 1.85 + index * 0.09)) * 0.62 +
            midShape * Math.abs(Math.sin(t * 3.15 + index * 0.17)) * 0.42 +
            highShape * Math.abs(Math.sin(t * 5.4 + index * 0.29)) * 0.28
          );
        }

        const previous = nextLevels[index] || 0;
        const attack = target > previous ? 0.78 : 0.24;
        nextLevels[index] = previous + (target - previous) * attack;
        peaksRef.current[index] = Math.max(nextLevels[index], (peaksRef.current[index] || 0) - 0.012);
      }

      const gap = Math.max(1 * dpr, Math.min(3 * dpr, (width / barCount) * 0.26));
      const barWidth = Math.max(1.5 * dpr, (width - gap * (barCount - 1)) / barCount);
      const bottomPad = compact ? 1 * dpr : 9 * dpr;
      const playedX = (clamp(progress, 0, 100) / 100) * width;

      for (let index = 0; index < barCount; index++) {
        const level = nextLevels[index] || 0;
        const peak = peaksRef.current[index] || 0;
        const x = index * (barWidth + gap);
        const barHeight = Math.max((compact ? 1.2 : 3) * dpr, level * (height - bottomPad) * 0.95);
        const y = height - bottomPad - barHeight;
        const isPlayed = active && x <= playedX;

        const barGradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isPlayed) {
          barGradient.addColorStop(0, 'rgba(255, 232, 157, 0.96)');
          barGradient.addColorStop(0.5, 'rgba(211, 174, 76, 0.86)');
          barGradient.addColorStop(1, 'rgba(127, 97, 32, 0.34)');
          if (!compact) {
            ctx.shadowColor = 'rgba(211, 174, 76, 0.24)';
            ctx.shadowBlur = playing ? 7 * dpr : 3 * dpr;
          }
        } else {
          barGradient.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
          barGradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = barGradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, Math.min(2 * dpr, barWidth / 2));
        ctx.fill();

        if (!compact && playing && peak > level + 0.08) {
          const peakY = height - bottomPad - peak * (height - bottomPad) * 0.95;
          ctx.fillStyle = isPlayed ? 'rgba(255, 239, 185, 0.52)' : 'rgba(255,255,255,0.24)';
          ctx.fillRect(x, peakY, barWidth, Math.max(1 * dpr, 1.5));
        }
      }

      ctx.shadowBlur = 0;
      if (active && !compact) {
        ctx.fillStyle = 'rgba(214, 176, 74, 0.38)';
        ctx.fillRect(0, height - 2 * dpr, playedX, 2 * dpr);
      }
    };

    // Solo el track activo necesita animarse cuadro a cuadro; el resto
    // dibuja su forma idle una vez (y al cambiar de tamano).
    if (active) {
      const loop = () => {
        render();
        frame = window.requestAnimationFrame(loop);
      };
      loop();
      return () => window.cancelAnimationFrame(frame);
    }

    render();
    const resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [active, compact, barCount]);

  const seek = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    onSeek(((clientX - rect.left) / rect.width) * 100);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`audio-waveform audio-spectrum ${compact ? 'audio-waveform-compact' : ''}`}
      aria-label="Analizador de espectro del preview"
      role="img"
      onClick={(event) => seek(event.clientX)}
    />
  );
}
