import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Feather, Pause, Play, Quote, CheckCircle2 } from 'lucide-react';

export interface DynamicQuote {
  text: string;
  author: string;
  context?: string;
}

export const DYNAMIC_EDUCATIONAL_QUOTES: DynamicQuote[] = [
  {
    text: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela",
    context: "Nobel Peace Laureate"
  },
  {
    text: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
    context: "Visionary & Teacher"
  },
  {
    text: "The beautiful thing about learning is that no one can take it away from you.",
    author: "B.B. King",
    context: "Cultural Icon"
  },
  {
    text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.",
    author: "Malcolm X",
    context: "Educator & Activist"
  },
  {
    text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.",
    author: "Benjamin Franklin",
    context: "Polymath & Inventor"
  },
  {
    text: "Knowledge is power. Information is liberating. Education is the premise of progress.",
    author: "Kofi Annan",
    context: "UN Secretary-General"
  },
  {
    text: "The roots of education are bitter, but the fruit is sweet.",
    author: "Aristotle",
    context: "Classical Philosopher"
  },
  {
    text: "An investment in knowledge pays the best interest.",
    author: "Benjamin Franklin",
    context: "Founding Scholar"
  },
  {
    text: "Develop a passion for learning. If you do, you will never cease to grow.",
    author: "Anthony J. D'Angelo",
    context: "Educational Thinker"
  }
];

export const HandwritingQuoteTyping: React.FC = () => {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDoneTyping, setIsDoneTyping] = useState(false);

  const currentQuote = DYNAMIC_EDUCATIONAL_QUOTES[quoteIdx];
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamic Typewriter Logic
  useEffect(() => {
    if (isPaused) return;

    const fullText = currentQuote.text;

    if (!isDeleting) {
      // Typing phase
      if (displayedText.length < fullText.length) {
        const nextChar = fullText.slice(0, displayedText.length + 1);
        const typingSpeed = 38 + Math.random() * 24; // natural human handwriting variance
        typingTimerRef.current = setTimeout(() => {
          setDisplayedText(nextChar);
        }, typingSpeed);
      } else {
        // Finished typing full quote: mark done and pause for 4.5 seconds
        setIsDoneTyping(true);
        typingTimerRef.current = setTimeout(() => {
          setIsDeleting(true);
          setIsDoneTyping(false);
        }, 4500);
      }
    } else {
      // Deleting phase
      if (displayedText.length > 0) {
        const reduced = fullText.slice(0, displayedText.length - 2);
        typingTimerRef.current = setTimeout(() => {
          setDisplayedText(reduced);
        }, 16);
      } else {
        // Finished deleting: move to next quote
        setIsDeleting(false);
        setIsDoneTyping(false);
        setQuoteIdx(prev => (prev + 1) % DYNAMIC_EDUCATIONAL_QUOTES.length);
      }
    }

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [displayedText, isDeleting, isPaused, quoteIdx, currentQuote.text]);

  const handleNextQuote = () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setIsDeleting(false);
    setIsDoneTyping(false);
    setDisplayedText('');
    setQuoteIdx(prev => (prev + 1) % DYNAMIC_EDUCATIONAL_QUOTES.length);
  };

  const togglePause = () => {
    setIsPaused(p => !p);
  };

  return (
    <div className="as-handwriting-container">
      {/* Top Header Badge */}
      <div className="as-hw-badge-row">
        <div className="as-hw-badge">
          <Feather size={13} className="as-hw-feather-icon" />
          <span>Handwritten Educational Wisdom</span>
        </div>

        <div className="as-hw-controls">
          <button
            type="button"
            className="as-hw-btn"
            onClick={togglePause}
            title={isPaused ? "Resume handwriting animation" : "Pause handwriting animation"}
            aria-label="Pause handwriting animation"
          >
            {isPaused ? <Play size={11} /> : <Pause size={11} />}
          </button>
          <button
            type="button"
            className="as-hw-btn"
            onClick={handleNextQuote}
            title="Next inspiring educational quote"
            aria-label="Next inspiring educational quote"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Handwriting Blackboard / Parchment Card */}
      <div className="as-hw-card">
        {/* Decorative opening quote watermark */}
        <Quote size={36} className="as-hw-quote-watermark" />

        {/* Dynamic Typing Text Container */}
        <div className="as-hw-text-area">
          <span className="as-hw-text">
            “{displayedText}
          </span>
          {/* Animated blinking ink cursor */}
          <span className="as-hw-cursor" aria-hidden="true">|</span>
        </div>

        {/* Author Signature Line with handwriting style */}
        <div className={`as-hw-author-row ${isDoneTyping || displayedText.length > 20 ? 'visible' : ''}`}>
          <div className="as-hw-signature-wrap">
            <span className="as-hw-dash">—</span>
            <span className="as-hw-author">{currentQuote.author}</span>
            {currentQuote.context && (
              <span className="as-hw-context">{currentQuote.context}</span>
            )}
          </div>
          <div className="as-hw-ink-flourish" />
        </div>
      </div>

      {/* Educational Platform Key Pillars Showcase */}
      <div className="as-hw-pillars-grid">
        <div className="as-hw-pillar">
          <CheckCircle2 size={13} className="as-hw-pillar-icon" />
          <span>Biometric & RFID Cloud Attendance</span>
        </div>
        <div className="as-hw-pillar">
          <CheckCircle2 size={13} className="as-hw-pillar-icon" />
          <span>Real-time Academic & SIS Insights</span>
        </div>
        <div className="as-hw-pillar">
          <CheckCircle2 size={13} className="as-hw-pillar-icon" />
          <span>Automated Parent SMS & Email Alerts</span>
        </div>
      </div>
    </div>
  );
};
