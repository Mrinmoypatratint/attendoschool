import React, { useState, useEffect, useRef } from 'react';

interface ThreeDBackgroundProps {
  dark?: boolean;
}

interface Node3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  glyph?: string;
  pulsePhase: number;
  pulseSpeed: number;
}

export interface EducationalScene {
  id: string;
  image: string;
  title: string;
  badge: string;
}

export const EDUCATIONAL_SCENES: EducationalScene[] = [
  {
    id: 'library',
    image: '/educational_library.jpg',
    title: 'University Grand Library',
    badge: '📚 Grand Library'
  },
  {
    id: 'lab',
    image: '/educational_lab.jpg',
    title: 'Modern Science & STEM Lab',
    badge: '🔬 STEM Laboratory'
  },
  {
    id: 'books',
    image: '/educational_books.jpg',
    title: 'Academic Literature & Study',
    badge: '📖 Classical Study'
  },
  {
    id: 'campus',
    image: '/educational-hero-bg.jpg',
    title: 'Smart Educational Campus',
    badge: '🎓 Academic Campus'
  }
];

const EDUCATIONAL_GLYPHS = ['🎓', '📖', '⚛️', '✨', '💡', '📐', 'A+', 'π', 'Σ', '🔬', '🌍'];

export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({ dark = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseTargetRef = useRef({ x: 0, y: 0 });
  const mouseSmoothRef = useRef({ x: 0, y: 0 });

  // Dynamic Background Photo Slideshow State
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % EDUCATIONAL_SCENES.length);
    }, 9000); // Crossfades every 9 seconds

    return () => clearInterval(slideTimer);
  }, []);

  // 3D Canvas Perspective Projection Engine
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

    // Color palettes
    const darkPalette = [
      'rgba(59, 130, 246, 0.85)',   // Sapphire
      'rgba(14, 165, 233, 0.85)',   // Sky Cyan
      'rgba(16, 185, 129, 0.8)',    // Emerald
      'rgba(168, 85, 247, 0.8)',    // Purple
      'rgba(249, 115, 22, 0.85)',   // Radiant Coral
      'rgba(245, 158, 11, 0.8)'     // Amber
    ];

    const lightPalette = [
      'rgba(37, 99, 235, 0.7)',
      'rgba(2, 132, 199, 0.7)',
      'rgba(5, 150, 105, 0.7)',
      'rgba(147, 51, 234, 0.7)',
      'rgba(234, 88, 12, 0.7)'
    ];

    const currentPalette = dark ? darkPalette : lightPalette;
    const count = Math.min(50, Math.floor((width * height) / 24000) + 18);
    const nodes: Node3D[] = [];

    const fieldDepth = 800;
    const fov = 380;

    for (let i = 0; i < count; i++) {
      const isGlyph = i < 15;
      nodes.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * fieldDepth - fieldDepth / 2,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        vz: (Math.random() - 0.5) * 0.45,
        radius: isGlyph ? 14 : Math.random() * 2.2 + 1.1,
        color: currentPalette[Math.floor(Math.random() * currentPalette.length)]!,
        glyph: isGlyph ? EDUCATIONAL_GLYPHS[i % EDUCATIONAL_GLYPHS.length] : undefined,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.02
      });
    }

    let angleY = 0;

    const render = () => {
      // Smooth mouse follow with damping
      mouseSmoothRef.current.x += (mouseTargetRef.current.x - mouseSmoothRef.current.x) * 0.05;
      mouseSmoothRef.current.y += (mouseTargetRef.current.y - mouseSmoothRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Continuous subtle ambient rotation + mouse tilt
      angleY += 0.001;
      const targetRotY = angleY + mouseSmoothRef.current.x * 0.35;
      const targetRotX = mouseSmoothRef.current.y * 0.25;

      const cosY = Math.cos(targetRotY);
      const sinY = Math.sin(targetRotY);
      const cosX = Math.cos(targetRotX);
      const sinX = Math.sin(targetRotX);

      const cx = width / 2;
      const cy = height / 2;

      // Project 3D nodes to 2D
      const projected = nodes.map(n => {
        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;

        // Wrap around boundary box
        const boundX = (width * 1.5) / 2;
        const boundY = (height * 1.5) / 2;
        const boundZ = fieldDepth / 2;

        if (n.x < -boundX) n.x = boundX;
        if (n.x > boundX) n.x = -boundX;
        if (n.y < -boundY) n.y = boundY;
        if (n.y > boundY) n.y = -boundY;
        if (n.z < -boundZ) n.z = boundZ;
        if (n.z > boundZ) n.z = -boundZ;

        // 3D rotation matrix
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.z * cosY + n.x * sinY;
        const y1 = n.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + n.y * sinX;

        const distance = fov / (fov + z2 + fieldDepth / 2 + 100);
        const projX = cx + x1 * distance;
        const projY = cy + y1 * distance;
        const scale = Math.max(0.1, distance);

        n.pulsePhase += n.pulseSpeed;

        return {
          node: n,
          projX,
          projY,
          scale,
          z: z2
        };
      });

      // Sort by Z for realistic depth
      projected.sort((a, b) => b.z - a.z);

      // Draw constellation connection vectors
      const maxDist = 135;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i]!;
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j]!;
          const dx = a.projX - b.projX;
          const dy = a.projY - b.projY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.2 * Math.min(a.scale, b.scale);
            ctx.beginPath();
            ctx.moveTo(a.projX, a.projY);
            ctx.lineTo(b.projX, b.projY);
            ctx.strokeStyle = dark
              ? `rgba(99, 102, 241, ${alpha})`
              : `rgba(37, 99, 235, ${alpha * 0.85})`;
            ctx.lineWidth = Math.max(0.4, 1.1 * a.scale);
            ctx.stroke();
          }
        }
      }

      // Draw nodes & educational glyphs
      for (const item of projected) {
        if (item.projX < -60 || item.projX > width + 60 || item.projY < -60 || item.projY > height + 60) {
          continue;
        }

        const alpha = Math.min(1, Math.max(0.2, (item.scale - 0.1) * 2.5));

        if (item.node.glyph) {
          // Draw floating educational emoji/symbol
          const fontSize = Math.max(10, Math.floor(18 * item.scale));
          ctx.save();
          ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = dark ? alpha * 0.72 : alpha * 0.58;
          ctx.fillText(item.node.glyph, item.projX, item.projY);
          ctx.restore();
        } else {
          // Draw glowing node
          const r = Math.max(1, item.node.radius * item.scale * (1 + Math.sin(item.node.pulsePhase) * 0.2));
          ctx.save();
          ctx.beginPath();
          ctx.arc(item.projX, item.projY, r, 0, Math.PI * 2);
          ctx.fillStyle = item.node.color;
          ctx.shadowBlur = dark ? 8 * item.scale : 4 * item.scale;
          ctx.shadowColor = item.node.color;
          ctx.fill();
          ctx.restore();
        }
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
      {/* Dynamic Background Image Crossfade Layers */}
      {EDUCATIONAL_SCENES.map((scene, idx) => (
        <div
          key={scene.id}
          className={`as-3d-slide ${idx === activeSlide ? 'active' : ''}`}
          style={{ backgroundImage: `url(${scene.image})` }}
        />
      ))}

      {/* Luminous ambient floating light orbs */}
      <div className="as-ambient-orb orb-1" />
      <div className="as-ambient-orb orb-2" />
      <div className="as-ambient-orb orb-3" />

      {/* 3D Education Canvas Layer */}
      <canvas ref={canvasRef} className="as-3d-canvas-elem" />

      {/* Geometric grid overlay */}
      <div className="as-3d-grid-overlay" />

      {/* Subtle Bottom Scene Navigation Pill */}
      <div className="as-scene-indicator-bar">
        {EDUCATIONAL_SCENES.map((scene, idx) => (
          <button
            key={scene.id}
            type="button"
            className={`as-scene-dot ${idx === activeSlide ? 'active' : ''}`}
            onClick={() => setActiveSlide(idx)}
            title={`Switch background to ${scene.title}`}
            aria-label={`Background: ${scene.title}`}
          >
            <span className="as-scene-dot-inner" />
            <span className="as-scene-tooltip">{scene.badge}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
