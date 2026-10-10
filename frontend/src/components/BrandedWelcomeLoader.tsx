import React, { useState, useEffect, useMemo } from 'react';

export interface BrandedWelcomeLoaderProps {
  schoolName: string;
  userName?: string;
  subtitle?: string;
  logoUrl?: string;
  onComplete?: () => void;
  minDurationMs?: number;
  maxDurationMs?: number;
}

/**
 * BrandedWelcomeLoader - Institutional Welcome Screen
 * 
 * Features:
 * - Centered authenticated school logo with robust fallback (no broken image icons).
 * - Three concentric rotating rings using lime-green #9ee925 with ambient glow.
 * - Dynamic greeting:
 *   - School Admin: "Hello Admin, Welcome to {School Name}"
 *   - Teacher:      "Hello {Teacher Name}, Welcome to {School Name}"
 * - Accessible letter-by-letter greeting with word preservation.
 * - Full reduced-motion compliance via CSS & matchMedia.
 * - Self-dismissing lifecycle with smooth exit dissolve.
 */
export const BrandedWelcomeLoader: React.FC<BrandedWelcomeLoaderProps> = ({
  schoolName,
  userName,
  subtitle = 'Institutional Administration Portal · Secure Session',
  logoUrl,
  onComplete,
  minDurationMs = 1900,
  maxDurationMs = 2800,
}) => {
  const [fadingOut, setFadingOut] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [fallbackImgError, setFallbackImgError] = useState(false);

  const cleanSchoolName = schoolName?.trim() || 'School';
  const cleanUserName = userName?.trim();
  const prefix = `Hello ${cleanUserName || 'Admin'}, Welcome to `;
  const fullGreeting = `${prefix}${cleanSchoolName}`;

  // Break text into words, then characters, keeping school name highlighted independently
  const words = useMemo(() => {
    const prefixWords = prefix.trim().split(/\s+/).map((word) => ({ word, isSchoolPart: false }));
    const schoolWords = cleanSchoolName.split(/\s+/).map((word) => ({ word, isSchoolPart: true }));
    const allWordDefs = [...prefixWords, ...schoolWords];

    let globalCharIndex = 0;
    return allWordDefs.map((def) => {
      const chars = def.word.split('').map((char) => {
        const delay = +(0.12 + globalCharIndex * 0.028).toFixed(4);
        globalCharIndex++;
        return { char, delay };
      });
      // Account for space between words in global index
      globalCharIndex++;
      return { word: def.word, chars, isSchoolPart: def.isSchoolPart };
    });
  }, [prefix, cleanSchoolName]);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Transition timing: start fade-out at minDuration, finish and unmount by minDuration + 350ms
    const activeDuration = prefersReducedMotion ? Math.min(minDurationMs, 1200) : minDurationMs;
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, activeDuration);

    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, activeDuration + 350);

    // Hard fail-safe timeout
    const maxTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, maxDurationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
      clearTimeout(maxTimer);
    };
  }, [minDurationMs, maxDurationMs, onComplete]);

  return (
    <div
      className={`as-welcome-overlay ${fadingOut ? 'as-welcome-fade-out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={fullGreeting}
    >
      {/* Screen reader only announcement */}
      <span className="sr-only">{fullGreeting}</span>

      <div className="as-welcome-content">
        {/* Central Logo with Three Rotating #9ee925 Circular Rings */}
        <div className="as-welcome-rings-stage">
          {/* Ring 1 - Outer ring */}
          <div className="as-welcome-ring as-welcome-ring-outer" aria-hidden="true" />
          {/* Ring 2 - Middle ring */}
          <div className="as-welcome-ring as-welcome-ring-middle" aria-hidden="true" />
          {/* Ring 3 - Inner ring */}
          <div className="as-welcome-ring as-welcome-ring-inner" aria-hidden="true" />

          {/* Central Logo Badge */}
          <div className="as-welcome-logo-badge" aria-hidden="true">
            {!imgError && logoUrl ? (
              <img
                src={logoUrl}
                alt={cleanSchoolName}
                className="as-welcome-logo-img"
                onError={() => setImgError(true)}
              />
            ) : !fallbackImgError ? (
              <img
                src="/attendo-school-logo.png"
                alt="Institutional Crest"
                className="as-welcome-logo-img"
                onError={() => setFallbackImgError(true)}
              />
            ) : (
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ee925"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="as-welcome-fallback-svg"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            )}
          </div>
        </div>

        {/* Animated Letter-by-Letter Greeting */}
        <div className="as-welcome-greeting-wrap" aria-hidden="true">
          <h1 className="as-welcome-greeting-title">
            {words.map((w, wIdx) => (
              <span
                key={`word-${wIdx}`}
                className={`as-welcome-word ${w.isSchoolPart ? 'as-welcome-school-word' : ''}`}
              >
                {w.chars.map((c, cIdx) => (
                  <span
                    key={`char-${wIdx}-${cIdx}`}
                    className="as-welcome-char"
                    style={{ animationDelay: `${c.delay}s` }}
                  >
                    {c.char}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <p className="as-welcome-subtitle">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BrandedWelcomeLoader;
