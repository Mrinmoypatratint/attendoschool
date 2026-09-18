import React, { useEffect, useState, useRef } from 'react';

export type MascotMood = 'idle' | 'focus-email' | 'focus-password' | 'peeking' | 'success' | 'error';

interface AnimatedMascotProps {
  mood?: MascotMood;
  isPasswordVisible?: boolean;
  isSubmitting?: boolean;
  hasError?: boolean;
  textLength?: number;
}

export const AnimatedMascot: React.FC<AnimatedMascotProps> = ({
  mood = 'idle',
  isPasswordVisible = false,
  isSubmitting = false,
  hasError = false,
  textLength = 0
}) => {
  const [blink, setBlink] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Periodic natural blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Eye tracking mouse when idle
  useEffect(() => {
    if (mood !== 'idle') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (window.innerWidth / 2);
      const deltaY = (e.clientY - centerY) / (window.innerHeight / 2);

      // Clamp pupil movement to natural bounds (-4.5px to +4.5px)
      setPupilOffset({
        x: Math.max(-4.5, Math.min(4.5, deltaX * 4.5)),
        y: Math.max(-3, Math.min(3, deltaY * 3))
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mood]);

  // Dynamic eye positioning based on mood and character typing
  let currentPupilX = pupilOffset.x;
  let currentPupilY = pupilOffset.y;

  if (mood === 'focus-email') {
    // Look down at input field, and track horizontally as user types
    const clampedLength = Math.min(Math.max(textLength, 0), 28);
    const ratio = clampedLength / 28; // 0 to 1
    currentPupilX = -3.2 + ratio * 6.4; // -3.2 (left) to +3.2 (right)
    currentPupilY = 4.2;
  } else if (mood === 'focus-password') {
    if (isPasswordVisible) {
      // Peeking: eyes glance downward-right curiously toward password
      currentPupilX = 2.8;
      currentPupilY = 3.2;
    } else {
      currentPupilX = 0;
      currentPupilY = 0;
    }
  }

  // Determine hands position:
  // - If password is focused and visible -> 'peeking' (one hand drops, one eye peeks)
  // - If password is focused and NOT visible -> 'covering' (both hands over eyes)
  // - Else -> hands down
  const isCovering = mood === 'focus-password' && !isPasswordVisible;
  const isPeeking = mood === 'focus-password' && isPasswordVisible;

  return (
    <div
      ref={containerRef}
      className={`as-mascot-container ${hasError ? 'mascot-error' : ''} ${isSubmitting ? 'mascot-submitting' : ''}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 160"
        className="as-mascot-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Head & Skin Gradient */}
          <linearGradient id="mascotSkin" x1="100" y1="35" x2="100" y2="125" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>

          {/* Academic Blazer Gradient */}
          <linearGradient id="mascotBlazer" x1="100" y1="120" x2="100" y2="160" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>

          {/* Graduation Cap Gradient */}
          <linearGradient id="mascotCap" x1="100" y1="10" x2="100" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Eye clip paths */}
          <clipPath id="leftEyeClip">
            <ellipse cx="80" cy="80" rx="11" ry="14" />
          </clipPath>
          <clipPath id="rightEyeClip">
            <ellipse cx="120" cy="80" rx="11" ry="14" />
          </clipPath>

          {/* Hand Drop Shadow */}
          <filter id="handShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* ── TORSO & ACADEMIC COLLAR ── */}
        <g className="mascot-body">
          {/* Blazer Torso */}
          <path
            d="M 52 160 C 52 128 72 120 100 120 C 128 120 148 128 148 160 Z"
            fill="url(#mascotBlazer)"
          />

          {/* White Shirt Collar */}
          <path d="M 85 120 L 100 134 L 115 120 L 100 124 Z" fill="#ffffff" />

          {/* Institutional Emerald Tie */}
          <path d="M 97 125 L 103 125 L 104 142 L 100 146 L 96 142 Z" fill="#10b981" />

          {/* Attendo Badge on Blazer */}
          <circle cx="72" cy="138" r="4.5" fill="#f59e0b" />
          <path d="M 70.5 138 L 71.5 139.5 L 73.5 136.5" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
        </g>

        {/* ── HEAD & EARS ── */}
        <g className={`mascot-head ${mood === 'focus-email' ? 'head-tilt-down' : ''}`}>
          {/* Left Ear */}
          <ellipse cx="50" cy="82" rx="7" ry="9" fill="url(#mascotSkin)" />
          <ellipse cx="50" cy="82" rx="4" ry="5" fill="#fbcfe8" opacity="0.6" />

          {/* Right Ear */}
          <ellipse cx="150" cy="82" rx="7" ry="9" fill="url(#mascotSkin)" />
          <ellipse cx="150" cy="82" rx="4" ry="5" fill="#fbcfe8" opacity="0.6" />

          {/* Main Face */}
          <rect x="52" y="44" width="96" height="78" rx="38" fill="url(#mascotSkin)" />

          {/* Rosy Blush Cheeks */}
          <ellipse cx="68" cy="94" rx="7" ry="4" fill="#fb7185" opacity="0.35" />
          <ellipse cx="132" cy="94" rx="7" ry="4" fill="#fb7185" opacity="0.35" />

          {/* Eyebrows */}
          <g className="mascot-brows">
            {hasError ? (
              <>
                <path d="M 70 65 Q 80 69 88 67" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M 112 67 Q 120 69 130 65" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
              </>
            ) : isSubmitting ? (
              <>
                <path d="M 72 63 Q 80 60 88 64" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M 112 64 Q 120 60 128 63" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M 72 64 Q 80 61 88 63" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
                <path d="M 112 63 Q 120 61 128 64" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </g>

          {/* ── EYES ── */}
          {/* Left Eye */}
          <g className="mascot-eye left-eye">
            <ellipse cx="80" cy="80" rx="11" ry="14" fill="#ffffff" />
            <g clipPath="url(#leftEyeClip)">
              {/* Pupil */}
              <circle
                cx={80 + currentPupilX}
                cy={80 + currentPupilY}
                r="6.5"
                fill="#1e3a8a"
                className="mascot-pupil-transition"
              />
              {/* Iris inner ring */}
              <circle
                cx={80 + currentPupilX}
                cy={80 + currentPupilY}
                r="4.5"
                fill="#2563eb"
                className="mascot-pupil-transition"
              />
              {/* Sparkle highlight */}
              <circle
                cx={80 + currentPupilX - 2}
                cy={80 + currentPupilY - 2.5}
                r="2.2"
                fill="#ffffff"
                className="mascot-pupil-transition"
              />
              <circle
                cx={80 + currentPupilX + 2.2}
                cy={80 + currentPupilY + 2.2}
                r="1"
                fill="#ffffff"
                className="mascot-pupil-transition"
              />
            </g>
            {/* Eyelid for Blinking */}
            <rect
              x="67"
              y="64"
              width="26"
              height={blink ? "30" : "0"}
              fill="url(#mascotSkin)"
              className="mascot-eyelid"
            />
          </g>

          {/* Right Eye */}
          <g className="mascot-eye right-eye">
            <ellipse cx="120" cy="80" rx="11" ry="14" fill="#ffffff" />
            <g clipPath="url(#rightEyeClip)">
              {/* Pupil */}
              <circle
                cx={120 + currentPupilX}
                cy={80 + currentPupilY}
                r="6.5"
                fill="#1e3a8a"
                className="mascot-pupil-transition"
              />
              {/* Iris inner ring */}
              <circle
                cx={120 + currentPupilX}
                cy={80 + currentPupilY}
                r="4.5"
                fill="#2563eb"
                className="mascot-pupil-transition"
              />
              {/* Sparkle highlight */}
              <circle
                cx={120 + currentPupilX - 2}
                cy={80 + currentPupilY - 2.5}
                r="2.2"
                fill="#ffffff"
                className="mascot-pupil-transition"
              />
              <circle
                cx={120 + currentPupilX + 2.2}
                cy={80 + currentPupilY + 2.2}
                r="1"
                fill="#ffffff"
                className="mascot-pupil-transition"
              />
            </g>
            {/* Eyelid for Blinking */}
            <rect
              x="107"
              y="64"
              width="26"
              height={blink ? "30" : "0"}
              fill="url(#mascotSkin)"
              className="mascot-eyelid"
            />
          </g>

          {/* Cute Nose */}
          <ellipse cx="100" cy="89" rx="2.5" ry="1.8" fill="#d97706" />

          {/* Expressive Mouth */}
          <g className="mascot-mouth">
            {isSubmitting ? (
              // Big joyful open smile
              <path d="M 92 97 Q 100 112 108 97 Z" fill="#b91c1c" />
            ) : hasError ? (
              // Slight sad curve
              <path d="M 94 102 Q 100 97 106 102" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
            ) : isPeeking ? (
              // Playful smirk / 'o'
              <circle cx="100" cy="100" r="3.2" fill="#92400e" />
            ) : (
              // Gentle cheerful smile
              <path d="M 93 98 Q 100 105 107 98" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
            )}
          </g>

          {/* ── GRADUATION MORTARBOARD CAP ── */}
          <g className="mascot-cap">
            {/* Cap Base Ring */}
            <ellipse cx="100" cy="46" rx="28" ry="7" fill="#0f172a" />

            {/* Cap Diamond Top */}
            <polygon
              points="100,16 148,30 100,42 52,30"
              fill="url(#mascotCap)"
              stroke="#334155"
              strokeWidth="0.8"
            />

            {/* Center Cap Button */}
            <circle cx="100" cy="29" r="3.5" fill="#f59e0b" />

            {/* Golden Tassel String & Bob */}
            <path
              d="M 100 29 C 114 30 128 35 130 46"
              stroke="#fbbf24"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
              className="mascot-tassel"
            />
            <rect x="127" y="46" width="6" height="9" rx="2" fill="#f59e0b" />
          </g>
        </g>

        {/* ── HANDS / PAWS (COVERS EYES ON PASSWORD) ── */}
        {/* Left Hand */}
        <g
          filter="url(#handShadow)"
          className={`mascot-hand mascot-hand-left ${
            isCovering ? 'hand-covering-left' : isPeeking ? 'hand-peeking-left' : 'hand-down-left'
          }`}
        >
          <ellipse cx="80" cy="80" rx="14" ry="12" fill="url(#mascotSkin)" />
          {/* Finger Lines */}
          <path d="M 74 76 Q 77 82 78 87" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 80 75 Q 81 82 82 87" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 86 76 Q 85 82 85 87" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        {/* Right Hand */}
        <g
          filter="url(#handShadow)"
          className={`mascot-hand mascot-hand-right ${
            isCovering ? 'hand-covering-right' : isPeeking ? 'hand-peeking-right' : 'hand-down-right'
          }`}
        >
          <ellipse cx="120" cy="80" rx="14" ry="12" fill="url(#mascotSkin)" />
          {/* Finger Lines */}
          <path d="M 114 76 Q 115 82 115 87" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 120 75 Q 119 82 118 87" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 126 76 Q 123 82 122 87" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};
