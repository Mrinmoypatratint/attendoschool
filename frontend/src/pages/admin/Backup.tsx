import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Database, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import BackupControls from '../../components/BackupControls';

export default function Backup() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="w-full max-w-none m-0 pb-10" style={{ width: '100%', maxWidth: 'none', margin: 0, padding: '24px 24px 40px', boxSizing: 'border-box' }}>
      <Link
        to="/dashboard"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: '#e11d48',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 12
        }}
      >
        <ArrowLeft size={16} /> <span>Dashboard</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.2)'
        }}>
          <Database size={22} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text, #1c1f2e)' }}>
            Backups &amp; Data Security
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
            System snapshot management, disaster recovery archives, and backup audit logs.
          </p>
        </div>
      </div>

      {!isSuperAdmin ? (
        <div style={{
          padding: '24px',
          borderRadius: 12,
          background: 'var(--card, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'var(--card-subtle, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted-foreground, #64748b)',
            flexShrink: 0
          }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text, #1c1f2e)' }}>
              Super Admin Access Restricted
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
              Only the platform Super Admin can take or download encrypted backups. Contact your system platform administrator for disaster recovery copies.
            </p>
          </div>
        </div>
      ) : (
        <BackupControls panel />
      )}
    </div>
  );
}
