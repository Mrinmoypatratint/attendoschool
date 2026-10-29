import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Calendar,
  ClipboardCheck,
  Bell,
  Database,
  Layers,
  Cpu,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

interface LayerData {
  id: string;
  tag: string;
  title: string;
  description: string;
  metrics: string[];
  icon: React.ReactNode;
  accentColor: string;
  depthZ: number;
}

const LAYERS: LayerData[] = [
  {
    id: 'layer-security',
    tag: 'Layer 01 · Foundation',
    title: 'Multi-Tenant Security & Isolated Database Engine',
    description:
      'Engineered with dedicated schema-level PostgreSQL isolation, ensuring student and institutional data is strictly partitioned. Compliant with 256-bit encryption standards and automated daily snapshots.',
    metrics: ['PostgreSQL Schema Isolation', 'Daily Automated Backups', 'Zero Cross-Tenant Leakage'],
    icon: <Database size={18} />,
    accentColor: '#1D4ED8',
    depthZ: 0
  },
  {
    id: 'layer-calendar',
    tag: 'Layer 02 · Operational Logic',
    title: 'Academic Calendar & Dynamic Timetable Matrix',
    description:
      'Automates multi-term sessions, clash-free teacher allocations, room scheduling, and official holiday calendars. Streamlines end-of-year promotions with 1-click batch processing.',
    metrics: ['Conflict-Free Schedules', 'Working Day Calculator', 'Bulk Student Promotion'],
    icon: <Calendar size={18} />,
    accentColor: '#0284C7',
    depthZ: 60
  },
  {
    id: 'layer-attendance',
    tag: 'Layer 03 · Core Gateway',
    title: 'High-Throughput RFID & Biometric Attendance Ingestion',
    description:
      'Processes hundreds of student gate card taps per minute with zero bottleneck. Reconciles early checkouts, late morning arrivals, and teacher period rolls automatically.',
    metrics: ['Sub-Second RFID Sync', '1-Tap Teacher Roll Call', 'Automated Leave Reconciliation'],
    icon: <ClipboardCheck size={18} />,
    accentColor: '#059669',
    depthZ: 120
  },
  {
    id: 'layer-comms',
    tag: 'Layer 04 · Experience Layer',
    title: 'Real-Time Parent SMS & Stakeholder Notification Dispatch',
    description:
      'Instantaneously delivers verified gate check-in alerts to parents via SMS and push notifications. Enables campus-wide emergency broadcasts and verifiable delivery audit logs.',
    metrics: ['Instant Parent SMS', 'Broadcast Announcements', '100% Delivery Audit Trail'],
    icon: <Bell size={18} />,
    accentColor: '#6366F1',
    depthZ: 180
  }
];

export const ExplodedLayers3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0.4);
  const [activeLayer, setActiveLayer] = useState<string>('layer-attendance');

  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      if (rect.top < windowHeight && rect.bottom > 0) {
        // Compute 0 to 1 progress while this section passes through viewport
        const totalDistance = windowHeight + rect.height;
        const currentProgress = (windowHeight - rect.top) / totalDistance;
        setScrollProgress(Math.max(0, Math.min(1, currentProgress)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Multiplier for exploded view separation based on scroll
  const explosionMultiplier = 0.6 + scrollProgress * 1.0;

  return (
    <div ref={containerRef} className="lp-exploded-stage-wrap">
      {/* Interactive Layer Selector Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 32,
          flexWrap: 'wrap'
        }}
      >
        {LAYERS.map(l => (
          <button
            key={l.id}
            type="button"
            onClick={() => setActiveLayer(l.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeLayer === l.id ? l.accentColor : 'var(--lp-border-subtle)',
              background: activeLayer === l.id ? '#FFFFFF' : 'var(--lp-bg-warm)',
              color: activeLayer === l.id ? 'var(--lp-text-primary)' : 'var(--lp-text-muted)',
              boxShadow: activeLayer === l.id ? '0 4px 12px rgba(15, 23, 42, 0.08)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ color: l.accentColor }}>{l.icon}</span>
            <span>{l.tag.split('·')[0].trim()}</span>
          </button>
        ))}
      </div>

      {/* Exploded 3D Canvas */}
      <div
        className="lp-exploded-stack"
        style={{
          transform: `rotateX(${(16 - scrollProgress * 10).toFixed(1)}deg) rotateY(${(-10 + scrollProgress * 6).toFixed(1)}deg)`
        }}
      >
        {LAYERS.map((layer, idx) => {
          const isSelected = activeLayer === layer.id;
          // Calculate dynamic Z separation
          const dynamicZ = layer.depthZ * explosionMultiplier;
          const dynamicY = idx * 64 - scrollProgress * 40;

          return (
            <div
              key={layer.id}
              className="lp-exploded-layer"
              onClick={() => setActiveLayer(layer.id)}
              style={{
                transform: `translate3d(0, ${dynamicY}px, ${dynamicZ}px)`,
                zIndex: idx + 1,
                borderLeft: `4px solid ${layer.accentColor}`,
                backgroundColor: isSelected ? '#FFFFFF' : '#FAFBFC',
                boxShadow: isSelected
                  ? `0 24px 50px -10px rgba(15, 23, 42, 0.16), 0 0 0 1px ${layer.accentColor}`
                  : '0 8px 24px -4px rgba(15, 23, 42, 0.06)',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                <div className="lp-layer-tag">
                  <span style={{ color: layer.accentColor }}>{layer.icon}</span>
                  <span>{layer.tag}</span>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: layer.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>Depth: +{Math.round(dynamicZ)}px</span>
                </div>
              </div>

              <div className="lp-layer-title">{layer.title}</div>
              <div className="lp-layer-detail">{layer.description}</div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid var(--lp-border-light)',
                  flexWrap: 'wrap'
                }}
              >
                {layer.metrics.map(m => (
                  <div
                    key={m}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--lp-text-secondary)'
                    }}
                  >
                    <CheckCircle2 size={13} style={{ color: 'var(--lp-brand-green)' }} />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
