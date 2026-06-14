'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '../providers/PlayerProvider';

type SpectrumSnapshot = {
  data: Uint8Array;
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

const bandEdges = (index: number, barCount: number) => {
  const lowRatio = Math.max(0, index - 0.48) / Math.max(1, barCount - 1);
  const highRatio = Math.min(barCount - 1, index + 0.48) / Math.max(1, barCount - 1);
  return {
    low: MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, lowRatio),
    high: MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, highRatio)
  };
};

// getByteFrequencyData YA entrega valores en escala dB (mapeados entre
// minDecibels/maxDecibels del AnalyserNode), asi que data[bin]/255 es de por si
// perceptual. Integramos esa energia por banda con ventana Hann y mezclamos
// promedio (estabilidad) + pico (viveza), como un analizador real. No se vuelve
// a aplicar log: eso aplastaria la senal hacia el piso.
const readBand = (data: Uint8Array, sampleRate: number, lowFrequency: number, highFrequency: number) => {
  const from = Math.floor(frequencyToIndex(lowFrequency, sampleRate, data.length));
  const to = Math.max(from + 1, Math.ceil(frequencyToIndex(highFrequency, sampleRate, data.length)));
  let total = 0;
  let weightTotal = 0;
  let peak = 0;

  for (let bin = from; bin <= Math.min(data.length - 1, to); bin++) {
    const ratio = to === from ? 0.5 : (bin - from) / (to - from);
    const windowWeight = 0.5 - 0.5 * Math.cos(Math.PI * 2 * ratio);
    const value = (data[bin] || 0) / 255;
    total += value * windowWeight;
    weightTotal += windowWeight;
    if (value > peak) peak = value;
  }

  const avg = total / Math.max(0.0001, weightTotal);
  return clamp(avg * 0.62 + peak * 0.38);
};

// Modo barras: realza graves/medios (estetica del visualizador clasico, sin el
// spectral tilt que usa la curva FabFilter).
const bandWeight = (index: number, barCount: number) => {
  const ratio = index / Math.max(1, barCount - 1);
  if (ratio < 0.23) return 1.24;
  if (ratio < 0.68) return 1.06;
  return 0.84;
};

export default function AudioWaveform({
  active,
  playing,
  progress,
  onSeek,
  getSpectrumSnapshot,
  compact = false
}: AudioWaveformProps) {
  const { spectrumMode } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barCount = compact ? 40 : 156;
  const levelsRef = useRef<number[]>(Array.from({ length: barCount }, (_, index) => deterministicIdle(index) * 0.14));
  const peaksRef = useRef<number[]>(Array.from({ length: barCount }, () => 0));

  // El loop de animacion lee estos valores desde un ref para no depender de
  // ellos en el array del efecto. Si `progress`/`playing` estuvieran en las
  // dependencias, cada tick de progreso reiniciaria el requestAnimationFrame
  // y la fila recien activada podria no volver a arrancar el loop.
  const liveRef = useRef({ playing, progress, getSpectrumSnapshot, spectrumMode });
  liveRef.current = { playing, progress, getSpectrumSnapshot, spectrumMode };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      const { playing, progress, getSpectrumSnapshot, spectrumMode } = liveRef.current;
      const rect = canvas.getBoundingClientRect();
      // Capamos el DPR: en pantallas retina (2-3x) dibujar a resolucion nativa
      // multiplica el trabajo del canvas y satura la CPU (audio cruje). 2 basta.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

      const snapshot = active && playing ? getSpectrumSnapshot() : null;
      const hasEnergy = !!snapshot?.data.some((value) => value > 2);
      const nextLevels = levelsRef.current;

      for (let index = 0; index < barCount; index++) {
        const ratio = index / Math.max(1, barCount - 1);
        let target = deterministicIdle(index) * (compact ? 0.08 : spectrumMode === 'curve' ? 0.13 : 0.16);

        if (snapshot?.data.length && hasEnergy) {
          const { low, high } = bandEdges(index, barCount);
          const raw = readBand(snapshot.data, snapshot.sampleRate, low, high);
          const gated = raw < 0.02 ? 0 : raw;

          if (spectrumMode === 'curve') {
            // Spectral tilt: el audio real trae mucha mas energia en graves, asi
            // que sin compensar se ve como una loma de bajo cayendo a la nada. La
            // inclinacion sube los agudos y equilibra el espectro en todo el
            // rango, que es lo que da el "look" de FabFilter / Logic.
            const tilt = 0.7 + ratio * 1.5;
            target = clamp(Math.pow(clamp(gated * tilt * 1.12), 0.6));
          } else {
            // Modo barras clasico: realza graves con ganancia para llenar.
            target = clamp(Math.pow(clamp(gated * bandWeight(index, barCount) * 1.32), 0.62));
          }
        }

        // Ataque rapido; caida dependiente de frecuencia (graves pesados/lentos,
        // agudos secos). Da la inercia organica de un analizador profesional.
        const previous = nextLevels[index] || 0;
        const release = ratio < 0.23 ? 0.16 : ratio < 0.68 ? 0.2 : 0.26;
        const attack = target > previous ? (hasEnergy ? 0.85 : 0.2) : release;
        nextLevels[index] = previous + (target - previous) * attack;
        const peakFall = ratio < 0.23 ? 0.007 : 0.011;
        peaksRef.current[index] = Math.max(nextLevels[index], (peaksRef.current[index] || 0) - peakFall);
      }

      if (spectrumMode === 'curve') {
        const bottomPad = compact ? 1 * dpr : 7 * dpr;
        const topPad = compact ? 2 * dpr : 6 * dpr;
        const baseY = height - bottomPad;
        const usableH = Math.max(1, height - bottomPad - topPad);
        const minH = (compact ? 1 : 2) * dpr;
        const stepX = width / Math.max(1, barCount - 1);
        const playedX = active ? (clamp(progress, 0, 100) / 100) * width : 0;

        const yFor = (level: number) => baseY - Math.max(minH, clamp(level) * usableH);

        // Curva superior suave: cada segmento pasa por el punto medio entre dos
        // muestras (quadratic), eliminando los picos duros entre puntos -> linea
        // continua como la de un analizador pro, no barras.
        const appendCurve = (values: number[]) => {
          for (let i = 1; i < barCount; i++) {
            const xPrev = (i - 1) * stepX;
            const yPrev = yFor(values[i - 1] || 0);
            const xCur = i * stepX;
            const yCur = yFor(values[i] || 0);
            ctx.quadraticCurveTo(xPrev, yPrev, (xPrev + xCur) / 2, (yPrev + yCur) / 2);
          }
          ctx.lineTo(width, yFor(values[barCount - 1] || 0));
        };

        const fillArea = (values: number[], grad: CanvasGradient) => {
          ctx.beginPath();
          ctx.moveTo(0, baseY);
          ctx.lineTo(0, yFor(values[0] || 0));
          appendCurve(values);
          ctx.lineTo(width, baseY);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        };

        const strokeCurve = (values: number[]) => {
          ctx.beginPath();
          ctx.moveTo(0, yFor(values[0] || 0));
          appendCurve(values);
          ctx.stroke();
        };

        // 1) Relleno bajo la curva (degradado dorado tenue, todo el ancho)
        const baseFill = ctx.createLinearGradient(0, topPad, 0, baseY);
        baseFill.addColorStop(0, 'rgba(255, 228, 150, 0.28)');
        baseFill.addColorStop(0.55, 'rgba(211, 174, 76, 0.12)');
        baseFill.addColorStop(1, 'rgba(211, 174, 76, 0.015)');
        fillArea(nextLevels, baseFill);

        // 2) Realce de la parte ya reproducida (mas brillante, recortada a playedX)
        if (active && playedX > 0.5) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, playedX, height);
          ctx.clip();
          const playedFill = ctx.createLinearGradient(0, topPad, 0, baseY);
          playedFill.addColorStop(0, 'rgba(255, 234, 165, 0.5)');
          playedFill.addColorStop(0.55, 'rgba(214, 178, 80, 0.24)');
          playedFill.addColorStop(1, 'rgba(214, 178, 80, 0.03)');
          fillArea(nextLevels, playedFill);
          ctx.restore();
        }

        // 3) Peak-hold: traza tenue que cae lento por encima (firma del analizador)
        if (active && !compact) {
          ctx.strokeStyle = 'rgba(255, 239, 185, 0.3)';
          ctx.lineWidth = 1 * dpr;
          ctx.lineJoin = 'round';
          strokeCurve(peaksRef.current);
        }

        // 4) Linea superior del espectro (tenue completa)
        ctx.strokeStyle = 'rgba(255, 226, 150, 0.5)';
        ctx.lineWidth = (compact ? 1.1 : 1.6) * dpr;
        ctx.lineJoin = 'round';
        strokeCurve(nextLevels);

        // 5) Linea superior brillante con glow en la parte reproducida
        if (active && playedX > 0.5) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, playedX, height);
          ctx.clip();
          if (!compact && playing) {
            ctx.shadowColor = 'rgba(255, 214, 110, 0.55)';
            ctx.shadowBlur = 10 * dpr;
          }
          ctx.strokeStyle = 'rgba(255, 238, 172, 0.98)';
          ctx.lineWidth = (compact ? 1.3 : 2) * dpr;
          ctx.lineJoin = 'round';
          strokeCurve(nextLevels);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // 6) Cabeza de reproduccion (linea vertical sutil, ayuda al seek)
        if (active && !compact && playedX > 0.5) {
          ctx.fillStyle = 'rgba(255, 236, 170, 0.45)';
          ctx.fillRect(playedX - 0.5 * dpr, topPad, 1 * dpr, baseY - topPad);
        }
      } else {
        // ===== Modo barras (visualizador clasico) =====
        const bottomPad = compact ? 1 * dpr : 9 * dpr;
        const gap = Math.max(1 * dpr, Math.min(3 * dpr, (width / barCount) * 0.26));
        const barWidth = Math.max(1.5 * dpr, (width - gap * (barCount - 1)) / barCount);
        const playedX = active ? (clamp(progress, 0, 100) / 100) * width : 0;
        const radius = Math.min(2 * dpr, barWidth / 2);
        const minBarH = (compact ? 1.2 : 3) * dpr;

        // Gradientes creados UNA vez (no por barra): crear 156 gradientes por
        // frame saturaba la CPU y hacia crujir el audio. Son de altura completa,
        // las barras los comparten.
        const playedGrad = ctx.createLinearGradient(0, 0, 0, height - bottomPad);
        playedGrad.addColorStop(0, 'rgba(255, 232, 157, 0.96)');
        playedGrad.addColorStop(0.5, 'rgba(211, 174, 76, 0.86)');
        playedGrad.addColorStop(1, 'rgba(127, 97, 32, 0.34)');
        const idleGrad = ctx.createLinearGradient(0, 0, 0, height - bottomPad);
        idleGrad.addColorStop(0, 'rgba(214, 178, 92, 0.62)');
        idleGrad.addColorStop(0.5, 'rgba(176, 138, 58, 0.4)');
        idleGrad.addColorStop(1, 'rgba(120, 92, 40, 0.16)');

        for (let index = 0; index < barCount; index++) {
          const level = nextLevels[index] || 0;
          const x = index * (barWidth + gap);
          const barHeight = Math.max(minBarH, level * (height - bottomPad) * 0.95);
          const y = height - bottomPad - barHeight;
          const isPlayed = active && x <= playedX;

          ctx.fillStyle = isPlayed ? playedGrad : idleGrad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, radius);
          ctx.fill();
        }

        // Linea de pico: una sola pasada de rectangulos finos (sin sombra)
        if (!compact && playing) {
          ctx.fillStyle = 'rgba(255, 233, 170, 0.4)';
          for (let index = 0; index < barCount; index++) {
            const level = nextLevels[index] || 0;
            const peak = peaksRef.current[index] || 0;
            if (peak <= level + 0.08) continue;
            const x = index * (barWidth + gap);
            const peakY = height - bottomPad - peak * (height - bottomPad) * 0.95;
            ctx.fillRect(x, peakY, barWidth, Math.max(1 * dpr, 1.5));
          }
        }

        if (active && !compact) {
          ctx.fillStyle = 'rgba(214, 176, 74, 0.38)';
          ctx.fillRect(0, height - 2 * dpr, playedX, 2 * dpr);
        }
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
  }, [active, compact, barCount, spectrumMode]);

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
