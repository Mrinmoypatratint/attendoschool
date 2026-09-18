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
    badge: '🎓 Modern Campus'
  }
];

const EDUCATIONAL_GLYPHS = ['🎓', '📖', '⚛️', '✨', '💡', '📐', 'A+', 'π', 'Σ', '🔬', '🌍'];

export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({ dark = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseTargetRef = useRef({ x: 0, y: 0 });
  const mouseSmoothRef = useRef({ x: 0, y: 0 });

  // Dynamic Background Photo Slideshow State
  const [activeSlide, setActiveSlide] = useState(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSlideTimer = () => {
    if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % EDUCATIONAL_SCENES.length);
    }, 8500);
  };

  useEffect(() => {
    startSlideTimer();
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, []);

  const handleSelectSlide = (idx: number) => {
    setActiveSlide(idx);
    startSlideTimer();
  };

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

    // Highly vibrant, luminous color palettes
    const darkPalette = [
      'rgba(96, 165, 250, 0.95)',   // Radiant Sapphire
      'rgba(56, 189, 248, 0.95)',   // Bright Sky Cyan
      'rgba(52, 211, 153, 0.92)',   // Vivid Emerald
      'rgba(192, 132, 252, 0.92)',  // Bright Purple
      'rgba(251, 146, 60, 0.95)',   // Glowing Coral
      'rgba(250, 204, 21, 0.95)'    // Golden Amber
    ];

    const lightPalette = [
      'rgba(37, 99, 235, 0.85)',
      'rgba(2, 132, 199, 0.85)',
      'rgba(5, 150, 105, 0.85)',
      'rgba(147, 51, 234, 0.85)',
      'rgba(234, 88, 12, 0.85)'
    ];

    const currentPalette = dark ? darkPalette : lightPalette;
    const count = Math.min(55, Math.floor((width * height) / 22000) + 20);
    const nodes: Node3D[] = [];

    const fieldDepth = 800;
    const fov = 380;

    for (let i = 0; i < count; i++) {
      const isGlyph = i < 18; // 18 floating educational glyphs
      nodes.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * fieldDepth - fieldDepth / 2,
        vx: (Math.random() - 0.5) * 0.38,
        vy: (Math.random() - 0.5) * 0.38,
        vz: (Math.random() - 0.5) * 0.45,
        radius: isGlyph ? 16 : Math.random() * 2.8 + 1.6,
        color: currentPalette[Math.floor(Math.random() * currentPalette.length)]!,
        glyph: isGlyph ? EDUCATIONAL_GLYPHS[i % EDUCATIONAL_GLYPHS.length] : undefined,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.022 + Math.random() * 0.02
      });
    }

    let angleY = 0;

    const render = () => {
      // Smooth mouse follow with damping
      mouseSmoothRef.current.x += (mouseTargetRef.current.x - mouseSmoothRef.current.x) * 0.05;
      mouseSmoothRef.current.y += (mouseTargetRef.current.y - mouseSmoothRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Continuous subtle ambient rotation + mouse tilt
      angleY += 0.0012;
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
        const scale = Math.max(0.12, distance);

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
      const maxDist = 150;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i]!;
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j]!;
          const dx = a.projX - b.projX;
          const dy = a.projY - b.projY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.42 * Math.min(a.scale, b.scale);
            ctx.beginPath();
            ctx.moveTo(a.projX, a.projY);
            ctx.lineTo(b.projX, b.projY);
            ctx.strokeStyle = dark
              ? `rgba(165, 180, 252, ${alpha})`
              : `rgba(37, 99, 235, ${alpha * 0.9})`;
            ctx.lineWidth = Math.max(0.7, 1.6 * a.scale);
            ctx.stroke();
          }
        }
      }

      // Draw nodes & educational glyphs with crisp luminescent rendering
      for (const item of projected) {
        if (item.projX < -60 || item.projX > width + 60 || item.projY < -60 || item.projY > height + 60) {
          continue;
        }

        const alpha = Math.min(1, Math.max(0.25, (item.scale - 0.1) * 2.6));

        if (item.node.glyph) {
          // Draw floating educational emoji/symbol with clear glow
          const fontSize = Math.max(15, Math.floor(25 * item.scale));
          ctx.save();
          ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = dark ? Math.min(1, alpha * 0.98) : 0.9;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
          ctx.shadowBlur = 12 * item.scale;
          ctx.fillText(item.node.glyph, item.projX, item.projY);
          ctx.restore();
        } else {
          // Draw bright glowing particle node
          const r = Math.max(1.8, item.node.radius * item.scale * (1 + Math.sin(item.node.pulsePhase) * 0.25));
          ctx.save();
          ctx.beginPath();
          ctx.arc(item.projX, item.projY, r, 0, Math.PI * 2);
          ctx.fillStyle = item.node.color;
          ctx.shadowBlur = dark ? 14 * item.scale : 7 * item.scale;
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
    <>
      <div className="as-3d-backdrop-container" aria-hidden="true">
        {/* Dynamic Educational Background Photo Slides (Vivid, crisp, NO heavy blur) */}
        {EDUCATIONAL_SCENES.map((scene, idx) => (
          <div
            key={scene.id}
            className={`as-3d-slide ${idx === activeSlide ? 'active' : ''}`}
            style={{ backgroundImage: `url(${scene.image})` }}
          />
        ))}

        {/* Subtle vignette gradient to preserve crisp photo details while maintaining card readability */}
        <div className="as-3d-vignette-overlay" />

        {/* Luminous ambient floating light orbs */}
        <div className="as-ambient-orb orb-1" />
        <div className="as-ambient-orb orb-2" />
        <div className="as-ambient-orb orb-3" />

        {/* 3D Education Canvas Layer - on top of photos for crisp clarity */}
        <canvas ref={canvasRef} className="as-3d-canvas-elem" />

        {/* Geometric grid overlay */}
        <div className="as-3d-grid-overlay" />
      </div>

      {/* Interactive Background Scene Navigation Dots (3-4 dots with live preview) */}
      <nav className="as-scene-indicator-bar" aria-label="Educational Scene Selector">
        <span className="as-scene-label">SCENE</span>
        {EDUCATIONAL_SCENES.map((scene, idx) => (
          <button
            key={scene.id}
            type="button"
            className={`as-scene-dot ${idx === activeSlide ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectSlide(idx);
            }}
            title={`Switch to ${scene.title}`}
            aria-label={`Background: ${scene.title}`}
          >
            <span className="as-scene-dot-inner" />
            <span className="as-scene-tooltip">{scene.badge}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
