import React, { useEffect, useRef, useState } from 'react';

interface ThreeDBackgroundProps {
  dark?: boolean;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  baseRadius: number;
  color: string;
  pulseSpeed: number;
  pulsePhase: number;
}

export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({ dark = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mouseTargetRef = useRef({ x: 0, y: 0 });
  const mouseSmoothRef = useRef({ x: 0, y: 0 });
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseTargetRef.current = {
        x: (e.clientX - cx) / cx,
        y: (e.clientY - cy) / cy
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Particle Palette
    const darkPalette = [
      'rgba(59, 130, 246, 0.8)',   // Blue
      'rgba(14, 165, 233, 0.8)',   // Cyan
      'rgba(16, 185, 129, 0.75)',  // Emerald
      'rgba(139, 92, 246, 0.75)',  // Purple
      'rgba(245, 158, 11, 0.7)'    // Amber
    ];

    const lightPalette = [
      'rgba(37, 99, 235, 0.65)',   // Sapphire
      'rgba(2, 132, 199, 0.65)',   // Sky
      'rgba(5, 150, 105, 0.6)',    // Green
      'rgba(124, 58, 237, 0.6)',   // Violet
      'rgba(217, 119, 6, 0.55)'    // Warm gold
    ];

    const currentPalette = dark ? darkPalette : lightPalette;
    const particleCount = Math.min(65, Math.floor((width * height) / 18000));
    const particles: Particle3D[] = [];

    const fieldDepth = 900;
    const fov = 400;

    for (let i = 0; i < particleCount; i++) {
      const r = Math.random() * 2.2 + 1.2;
      particles.push({
        x: (Math.random() - 0.5) * width * 1.4,
        y: (Math.random() - 0.5) * height * 1.4,
        z: Math.random() * fieldDepth - fieldDepth / 2,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        vz: (Math.random() - 0.5) * 0.6,
        radius: r,
        baseRadius: r,
        color: currentPalette[Math.floor(Math.random() * currentPalette.length)]!,
        pulseSpeed: 0.02 + Math.random() * 0.02,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }

    let angleY = 0;
    let angleX = 0;

    const render = () => {
      // Smooth mouse follow
      mouseSmoothRef.current.x += (mouseTargetRef.current.x - mouseSmoothRef.current.x) * 0.04;
      mouseSmoothRef.current.y += (mouseTargetRef.current.y - mouseSmoothRef.current.y) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // Subtle base rotation + mouse tilt
      angleY += 0.0015;
      const targetRotY = angleY + mouseSmoothRef.current.x * 0.35;
      const targetRotX = mouseSmoothRef.current.y * 0.25;

      const cosY = Math.cos(targetRotY);
      const sinY = Math.sin(targetRotY);
      const cosX = Math.cos(targetRotX);
      const sinX = Math.sin(targetRotX);

      const cx = width / 2;
      const cy = height / 2;

      // Project 3D particles to 2D
      const projected = particles.map(p => {
        // Move
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Boundary wrap in 3D box
        const boundX = (width * 1.4) / 2;
        const boundY = (height * 1.4) / 2;
        const boundZ = fieldDepth / 2;

        if (p.x < -boundX) p.x = boundX;
        if (p.x > boundX) p.x = -boundX;
        if (p.y < -boundY) p.y = boundY;
        if (p.y > boundY) p.y = -boundY;
        if (p.z < -boundZ) p.z = boundZ;
        if (p.z > boundZ) p.z = -boundZ;

        // 3D rotation
        // Rotate around Y
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.z * cosY + p.x * sinY;

        // Rotate around X
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.y * sinX;

        // Perspective projection
        const distance = fov / (fov + z2 + fieldDepth / 2 + 100);
        const projX = cx + x1 * distance;
        const projY = cy + y1 * distance;
        const scale = Math.max(0.1, distance);

        p.pulsePhase += p.pulseSpeed;
        const currentRadius = p.baseRadius * (1 + Math.sin(p.pulsePhase) * 0.25) * scale * 1.8;

        return {
          p,
          projX,
          projY,
          scale,
          z: z2,
          radius: currentRadius
        };
      });

      // Sort by Z for proper depth ordering
      projected.sort((a, b) => b.z - a.z);

      // Draw connecting 3D vectors
      const maxDist = 135;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i]!;
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j]!;
          const dx = a.projX - b.projX;
          const dy = a.projY - b.projY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.28 * Math.min(a.scale, b.scale);
            ctx.beginPath();
            ctx.moveTo(a.projX, a.projY);
            ctx.lineTo(b.projX, b.projY);
            ctx.strokeStyle = dark
              ? `rgba(99, 102, 241, ${alpha})`
              : `rgba(37, 99, 235, ${alpha * 0.9})`;
            ctx.lineWidth = Math.max(0.4, 1.2 * a.scale);
            ctx.stroke();
          }
        }
      }

      // Draw projected nodes
      for (const item of projected) {
        if (item.projX < -50 || item.projX > width + 50 || item.projY < -50 || item.projY > height + 50) {
          continue;
        }

        ctx.beginPath();
        ctx.arc(item.projX, item.projY, Math.max(1, item.radius), 0, Math.PI * 2);
        ctx.fillStyle = item.p.color;
        ctx.shadowBlur = dark ? 8 * item.scale : 4 * item.scale;
        ctx.shadowColor = item.p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dark]);

  return (
    <div className="as-3d-backdrop-container" aria-hidden="true">
      {/* Ambient background photo layer with atmospheric blur and smooth depth */}
      <div 
        className="as-3d-backdrop-image"
        style={{
          backgroundImage: 'url(/campus_hero_reference.jpg)',
          opacity: dark ? 0.24 : 0.18
        }}
      />

      {/* Optional ambient video layer */}
      <video
        className="as-3d-video-layer"
        src="/media/login-school.mp4"
        poster="/campus_hero_reference.jpg"
        autoPlay
        muted
        loop
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
        style={{ opacity: videoLoaded ? 0.35 : 0 }}
      />

      {/* Radiant ambient glow orbs behind the 3D canvas */}
      <div className="as-ambient-orb orb-primary" />
      <div className="as-ambient-orb orb-secondary" />
      <div className="as-ambient-orb orb-tertiary" />

      {/* Interactive 3D Canvas */}
      <canvas ref={canvasRef} className="as-3d-canvas-elem" />

      {/* Smooth geometric grid overlay */}
      <div className="as-3d-grid-overlay" />
    </div>
  );
};
