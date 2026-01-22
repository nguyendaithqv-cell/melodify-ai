
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ audioElement, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    const source = audioCtx.createMediaElementSource(audioElement);
    const analyzer = audioCtx.createAnalyser();
    
    analyzer.fftSize = 128; // Tăng độ nhạy cho Visualizer
    source.connect(analyzer);
    analyzer.connect(audioCtx.destination);

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        
        // Hiệu ứng Gradient từ tím sang xanh
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#6366f1'); // Indigo
        gradient.addColorStop(1, '#a855f7'); // Purple
        
        ctx.fillStyle = gradient;
        
        // Vẽ các thanh bo tròn
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, 5);
        ctx.fill();
        
        x += barWidth + 4;
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
      className="w-full h-full opacity-80"
      width={600}
      height={96}
    />
  );
};

export default Visualizer;
