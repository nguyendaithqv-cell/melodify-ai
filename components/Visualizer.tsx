
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ audioElement, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fixed: animationRef initialized with null to satisfy the 1-argument requirement for useRef in this environment
  const animationRef = useRef<number | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return;

    // Fixed: Added sampleRate to AudioContext constructor as per Gemini best practices and to ensure a valid object argument
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    const source = audioCtx.createMediaElementSource(audioElement);
    const analyzer = audioCtx.createAnalyser();
    
    analyzer.fftSize = 256;
    source.connect(analyzer);
    analyzer.connect(audioCtx.destination);
    analyzerRef.current = analyzer;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Gradient effect
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
        
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioCtx.close();
    };
  }, [audioElement]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-32 rounded-lg bg-black/20"
      width={600}
      height={128}
    />
  );
};

export default Visualizer;
