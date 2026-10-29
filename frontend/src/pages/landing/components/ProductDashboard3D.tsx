import React, { useState } from 'react';
import {
  Users,
  ClipboardCheck,
  GraduationCap,
  Layers,
  Clock,
  ShieldCheck,
  Wifi,
  Lock,
  CheckCircle2,
  School
} from 'lucide-react';

interface StudentRosterItem {
  id: string;
  roll: string;
  name: string;
  classSection: string;
  time: string;
  status: 'present' | 'late' | 'absent';
  rfidCard: string;
}

const INITIAL_ROSTER: StudentRosterItem[] = [
  { id: '1', roll: '10*', name: 'Aa**av Sh**ma', classSection: '10-A', time: '08:14 AM', status: 'present', rfidCard: 'RF-88**' },
  { id: '2', roll: '10*', name: 'An**ya Mu*****ee', classSection: '10-A', time: '08:16 AM', status: 'present', rfidCard: 'RF-88**' },
  { id: '3', roll: '10*', name: 'De**aj S*n', classSection: '10-A', time: '08:32 AM', status: 'late', rfidCard: 'RF-88**' },
  { id: '4', roll: '10*', name: 'Is**ta Pa**l', classSection: '10-A', time: '—', status: 'absent', rfidCard: 'RF-88**' },
  { id: '5', roll: '10*', name: 'Ro**an Ve**a', classSection: '10-A', time: '08:21 AM', status: 'present', rfidCard: 'RF-88**' },
];

export const ProductDashboard3D: React.FC = () => {
  const [roster, setRoster] = useState<StudentRosterItem[]>(INITIAL_ROSTER);
  const [lastScanMessage, setLastScanMessage] = useState('RFID Gate 01 Verified · Parent SMS Dispatched for Aa**av Sh**ma');

  const presentCount = roster.filter(s => s.status === 'present').length;
  const lateCount = roster.filter(s => s.status === 'late').length;
  const absentCount = roster.filter(s => s.status === 'absent').length;
  const samplePercentage = (((presentCount + lateCount) / roster.length) * 100).toFixed(1);

  const toggleStatus = (id: string) => {
    setRoster(prev =>
      prev.map(item => {
        if (item.id === id) {
          const nextStatus: StudentRosterItem['status'] =
            item.status === 'present' ? 'late' : item.status === 'late' ? 'absent' : 'present';
          setLastScanMessage(`Updated ${item.name} to ${nextStatus.toUpperCase()} · Live parent SMS queued`);
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  return (
    <div className="lp-hero-monitor" id="dav-attendance-monitor">
      {/* Browser Bar */}
      <div className="lp-monitor-window-bar">
        <div className="lp-window-dots">
          <span className="lp-window-dot red" />
          <span className="lp-window-dot yellow" />
          <span className="lp-window-dot green" />
        </div>
        <div style={{ color: '#E2E8F0', fontWeight: 600 }}>
          https://portal.dav.attendoschool.online/live-attendance
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34D399', fontSize: 11 }}>
          <ShieldCheck size={14} />
          <span>256-Bit SSL Secured</span>
        </div>
      </div>

      <div className="lp-monitor-body">
        {/* D.A.V. School Header (NO DAV LOGO IMAGE, Clean School Crest Badge) */}
        <div className="lp-monitor-school-header">
          <div className="lp-school-header-left">
            <div className="lp-school-crest-badge" title="Campus Portal">
              <School size={20} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                D.A.V. Public Senior Secondary School
              </div>
              <div style={{ fontSize: 12, color: 'var(--lp-text-muted)' }}>
                CBSE Affiliation #19302 · Academic Session 2026–27 · Sector 14 Campus
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#047857',
                background: '#ECFDF5',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid #A7F3D0'
              }}
            >
              <CheckCircle2 size={13} />
              <span>Gate 01 Active</span>
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: 'var(--lp-text-muted)',
                background: 'var(--lp-bg-warm)',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid var(--lp-border-subtle)'
              }}
            >
              <Clock size={12} />
              <span>08:45 AM Today</span>
            </span>
          </div>
        </div>

        {/* Flat KPI Row */}
        <div className="lp-kpi-row-flat">
          <div className="lp-kpi-card-flat">
            <div className="label">Total Enrolled</div>
            <div className="value">1,284</div>
            <div className="sub">D.A.V. Verified SIS</div>
          </div>
          <div className="lp-kpi-card-flat">
            <div className="label">Today's Attendance</div>
            <div className="value">{samplePercentage}%</div>
            <div className="sub">{presentCount + 1238} Present · {absentCount + 30} Absent</div>
          </div>
          <div className="lp-kpi-card-flat">
            <div className="label">Faculty on Duty</div>
            <div className="value">78 / 82</div>
            <div className="sub">95.1% Staff Active</div>
          </div>
          <div className="lp-kpi-card-flat">
            <div className="label">Class Sections</div>
            <div className="value">36</div>
            <div className="sub">All Rooms Scheduled</div>
          </div>
        </div>

        {/* Live Attendance Table with Confidential Masked Data (**) */}
        <div style={{ border: '1px solid var(--lp-border-subtle)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--lp-bg-warm)',
              borderBottom: '1px solid var(--lp-border-subtle)',
              fontSize: 12
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--lp-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardCheck size={14} style={{ color: 'var(--lp-brand-green)' }} />
              <span>Live Roll Call: Class 10-A (Morning Session)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#B45309', fontWeight: 600, fontSize: 11 }}>
              <Lock size={12} />
              <span>PII Masked with ** for Confidentiality</span>
            </div>
          </div>

          <table className="lp-flat-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Roll</th>
                <th style={{ textAlign: 'left' }}>Student Name</th>
                <th style={{ textAlign: 'left' }}>Class</th>
                <th style={{ textAlign: 'left' }}>Gate Time</th>
                <th style={{ textAlign: 'left' }}>RFID UID</th>
                <th style={{ textAlign: 'right' }}>Status (Click to Test)</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(item => (
                <tr key={item.id}>
                  <td className="lp-masked-data">{item.roll}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="lp-masked-data">{item.name}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.classSection}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{item.time}</td>
                  <td className="lp-masked-data" style={{ fontSize: 11, color: 'var(--lp-text-muted)' }}>
                    {item.rfidCard}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => toggleStatus(item.id)}
                      className={`lp-status-btn ${item.status}`}
                      title="Click to toggle status"
                    >
                      {item.status === 'present' ? '✓ Present' : item.status === 'late' ? '⏱ Late' : '✕ Absent'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Live Notification Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0B192C',
            color: '#F8FAFC',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wifi size={14} style={{ color: '#34D399' }} />
            <span style={{ fontWeight: 600 }}>{lastScanMessage}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#34D399', background: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: 4 }}>
            SMS Dispatched
          </span>
        </div>
      </div>
    </div>
  );
};
