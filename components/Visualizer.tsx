
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bars = 60;
    const barData = new Array(bars).fill(0).map(() => Math.random() * 50);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / bars;
      
      for (let i = 0; i < bars; i++) {
        // Tạo chuyển động sóng mượt mà
        if (isPlaying) {
          barData[i] = Math.max(10, (barData[i] + (Math.random() - 0.5) * 15) % 80);
        } else {
          barData[i] *= 0.9;
        }

        const height = barData[i];
        const x = i * barWidth;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#f97316'); // Orange 500
        gradient.addColorStop(1, '#ef4444'); // Red 500

        ctx.fillStyle = gradient;
        
        // Vẽ thanh bo tròn từ giữa
        const centerY = canvas.height / 2;
        ctx.beginPath();
        ctx.roundRect(x + 2, centerY - height / 2, barWidth - 4, height, 4);
        ctx.fill();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
      width={800}
      height={100}
    />
  );
};

export default Visualizer;
