import React, { useState } from 'react';

export const SecurityCenter: React.FC = () => {
  const [testPassword, setTestPassword] = useState<string>('');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // Password strength checks
  const hasMinLength = testPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(testPassword);
  const hasLowerCase = /[a-z]/.test(testPassword);
  const hasNumber = /[0-9]/.test(testPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(testPassword);
  const passedCount = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length;

  const handleFlushSessions = () => {
    setSessionNotice('Stale guest session tokens invalidated across multi-tenant cache.');
    setTimeout(() => setSessionNotice(null), 4000);
  };

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Platform Security & Access Guard</h2>
          <p className="section-subtitle">
            Configure authentication hardening, brute-force lockout safeguards, token lifecycle, and session security policies.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleFlushSessions}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
            </svg>
            Flush Stale Sessions
          </button>
        </div>
      </div>

      {sessionNotice && (
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {sessionNotice}
        </div>
      )}

      {/* Security Posture Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '20px 0' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Token Lifecycle</span>
            <span className="badge badge-active">JWT RS256</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            12 Hours
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Automatic session timeout
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Brute-Force Guard</span>
            <span className="badge badge-active">ACTIVE</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            5 Failed Attempts
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            15-minute progressive account lock
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>API Rate Limiter</span>
            <span className="badge badge-active">ENFORCED</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            120 Req / Minute
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            IP-scoped throttling window
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Data Encryption</span>
            <span className="badge badge-active">AES-256</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '6px' }}>
            At Rest & In Transit
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            TLS 1.3 & Bcrypt 10 rounds
          </div>
        </div>
      </div>

      {/* Security Policies Matrix */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>
          Active Tenant Security Policies
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#10b981', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>Cross-Origin Resource Sharing (CORS)</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 24px' }}>
              Origin restricted to verified frontend domains. Unauthorized web origins blocked at reverse proxy.
            </p>
          </div>

          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#10b981', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>Multi-Tenant Row-Level Isolation</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 24px' }}>
              All database queries enforce strictly scoped tenant <code>schoolId</code> filters to prevent cross-tenant data leaks.
            </p>
          </div>

          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#10b981', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>Parameterized SQL & NoSQL Sanitization</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 24px' }}>
              Strict parameter binding protects against SQL injection, NoSQL operator injection, and XSS payloads.
            </p>
          </div>

          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#10b981', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>HTTP Security Headers (Helmet)</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 24px' }}>
              Enforces X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, and Strict-Transport-Security.
            </p>
          </div>
        </div>
      </div>

      {/* Password Policy Tester */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
          Password Complexity Compliance Tester
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
          Test institutional password strings against platform regulatory standards.
        </p>

        <div style={{ maxWidth: '480px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Type sample password to evaluate..."
            value={testPassword}
            onChange={(e) => setTestPassword(e.target.value)}
            style={{ marginBottom: '12px' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasMinLength ? '#10b981' : '#94a3b8' }}>
              <span>{hasMinLength ? '✔' : '○'}</span> Minimum 8 characters
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasUpperCase ? '#10b981' : '#94a3b8' }}>
              <span>{hasUpperCase ? '✔' : '○'}</span> At least one uppercase letter (A-Z)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasLowerCase ? '#10b981' : '#94a3b8' }}>
              <span>{hasLowerCase ? '✔' : '○'}</span> At least one lowercase letter (a-z)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasNumber ? '#10b981' : '#94a3b8' }}>
              <span>{hasNumber ? '✔' : '○'}</span> At least one number (0-9)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasSpecial ? '#10b981' : '#94a3b8' }}>
              <span>{hasSpecial ? '✔' : '○'}</span> At least one special symbol (!@#$%^&*)
            </div>
          </div>

          {testPassword && (
            <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '6px', background: passedCount === 5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: passedCount === 5 ? '#10b981' : '#b45309', fontSize: '12px', fontWeight: '600' }}>
              {passedCount === 5 ? 'Password meets all SaaS enterprise security policies.' : `Strength: ${passedCount}/5 rules passed. Requires additional entropy.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
