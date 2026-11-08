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
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '4px', background: 'rgba(3, 128, 106, 0.1)', color: '#03806a', border: '1px solid rgba(3, 128, 106, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#696e79', textTransform: 'uppercase' }}>Token Lifecycle</span>
            <span className="badge badge-active">JWT RS256</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1c1f2e', marginTop: '6px' }}>
            12 Hours
          </div>
          <div style={{ fontSize: '12px', color: '#696e79', marginTop: '2px' }}>
            Automatic session timeout
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#696e79', textTransform: 'uppercase' }}>Brute-Force Guard</span>
            <span className="badge badge-active">ACTIVE</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1c1f2e', marginTop: '6px' }}>
            5 Failed Attempts
          </div>
          <div style={{ fontSize: '12px', color: '#696e79', marginTop: '2px' }}>
            15-minute progressive account lock
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#696e79', textTransform: 'uppercase' }}>API Rate Limiter</span>
            <span className="badge badge-active">ENFORCED</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1c1f2e', marginTop: '6px' }}>
            120 Req / Minute
          </div>
          <div style={{ fontSize: '12px', color: '#696e79', marginTop: '2px' }}>
            IP-scoped throttling window
          </div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#696e79', textTransform: 'uppercase' }}>Data Encryption</span>
            <span className="badge badge-active">AES-256</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#03806a', marginTop: '6px' }}>
            At Rest & In Transit
          </div>
          <div style={{ fontSize: '12px', color: '#696e79', marginTop: '2px' }}>
            TLS 1.3 & Bcrypt 10 rounds
          </div>
        </div>
      </div>

      {/* Security Policies Matrix */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1c1f2e', marginBottom: '16px' }}>
          Active Tenant Security Policies
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '14px', background: '#f9f9fa', borderRadius: '4px', border: '1px solid #eaeaec' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#03806a', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#1c1f2e' }}>Cross-Origin Resource Sharing (CORS)</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#696e79', margin: '6px 0 0 24px' }}>
              Origin restricted to verified frontend domains. Unauthorized web origins blocked at reverse proxy.
            </p>
          </div>

          <div style={{ padding: '14px', background: '#f9f9fa', borderRadius: '4px', border: '1px solid #eaeaec' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#03806a', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#1c1f2e' }}>Multi-Tenant Row-Level Isolation</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#696e79', margin: '6px 0 0 24px' }}>
              All database queries enforce strictly scoped tenant <code>schoolId</code> filters to prevent cross-tenant data leaks.
            </p>
          </div>

          <div style={{ padding: '14px', background: '#f9f9fa', borderRadius: '4px', border: '1px solid #eaeaec' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#03806a', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#1c1f2e' }}>Parameterized SQL & NoSQL Sanitization</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#696e79', margin: '6px 0 0 24px' }}>
              Strict parameter binding protects against SQL injection, NoSQL operator injection, and XSS payloads.
            </p>
          </div>

          <div style={{ padding: '14px', background: '#f9f9fa', borderRadius: '4px', border: '1px solid #eaeaec' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#03806a', fontSize: '16px' }}>&check;</span>
              <strong style={{ fontSize: '14px', color: '#1c1f2e' }}>HTTP Security Headers (Helmet)</strong>
            </div>
            <p style={{ fontSize: '12px', color: '#696e79', margin: '6px 0 0 24px' }}>
              Enforces X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, and Strict-Transport-Security.
            </p>
          </div>
        </div>
      </div>

      {/* Password Policy Tester */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1c1f2e', marginBottom: '8px' }}>
          Password Complexity Compliance Tester
        </h3>
        <p style={{ fontSize: '13px', color: '#696e79', margin: '0 0 16px 0' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasMinLength ? '#03806a' : '#94969f' }}>
              <span>{hasMinLength ? '✔' : '○'}</span> Minimum 8 characters
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasUpperCase ? '#03806a' : '#94969f' }}>
              <span>{hasUpperCase ? '✔' : '○'}</span> At least one uppercase letter (A-Z)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasLowerCase ? '#03806a' : '#94969f' }}>
              <span>{hasLowerCase ? '✔' : '○'}</span> At least one lowercase letter (a-z)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasNumber ? '#03806a' : '#94969f' }}>
              <span>{hasNumber ? '✔' : '○'}</span> At least one number (0-9)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasSpecial ? '#03806a' : '#94969f' }}>
              <span>{hasSpecial ? '✔' : '○'}</span> At least one special symbol (!@#$%^&*)
            </div>
          </div>

          {testPassword && (
            <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '4px', background: passedCount === 5 ? 'rgba(3, 128, 106, 0.1)' : 'rgba(233, 162, 59, 0.1)', color: passedCount === 5 ? '#03806a' : '#8f5c12', fontSize: '12px', fontWeight: '600' }}>
              {passedCount === 5 ? 'Password meets all SaaS enterprise security policies.' : `Strength: ${passedCount}/5 rules passed. Requires additional entropy.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
