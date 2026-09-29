import React, { useState, useEffect } from 'react';
import { SystemSettings } from './types';
import { apiRequest } from '../api';

export const PlatformSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: 'AttendoSchool Technologies Inc.',
    companyGstin: '19AAACB1234P1Z5',
    companyAddress: 'Campus 4, Tech Park Boulevard, Bengaluru, Karnataka',
    companyPhone: '+91 90000 00000',
    companyEmail: 'support@attendoschool.com',
    companyGstRate: 18,
    smsProvider: 'mock',
    smsSenderId: 'ATTNDO',
    razorpayKeyId: 'rzp_test_mock12345',
    razorpayWebhookSecret: 'whsec_mock12345',
    sessionTimeoutMinutes: 60,
    enforceStrongPasswords: true,
    rateLimitPerMinute: 120,
    maintenanceMode: false
  });

  const [activeTab, setActiveTab] = useState<'general' | 'sms' | 'payment' | 'system' | 'smtp'>('general');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showSmtpPass, setShowSmtpPass] = useState<boolean>(false);
  const [smtpTesting, setSmtpTesting] = useState<boolean>(false);
  const [smtpTestMsg, setSmtpTestMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState<string>('rajbsmv@gmail.com');

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SystemSettings>('/super-admin/settings').catch(() => null);
      if (data) setSettings((prev) => ({ ...prev, ...data }));
    } catch (err: any) {
      setError(err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      await apiRequest('/super-admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      setSaveSuccess('Platform settings and system parameters updated successfully.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="super-admin-content-inner">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Platform Configuration & Gateway Settings</h2>
          <p className="section-subtitle">
            Configure institutional billing parameters, GST compliance tokens, SMS notification gateways, and system-wide security thresholds.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saveSuccess}
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '20px 0', borderBottom: '1px solid #e2e8f0' }}>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'general' ? '700' : '500',
            color: activeTab === 'general' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'general' ? '2px solid #4f46e5' : '2px solid transparent'
          }}
          onClick={() => setActiveTab('general')}
        >
          Company & Tax Legal Identity
        </button>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'payment' ? '700' : '500',
            color: activeTab === 'payment' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'payment' ? '2px solid #4f46e5' : '2px solid transparent'
          }}
          onClick={() => setActiveTab('payment')}
        >
          Payment Gateway (Razorpay)
        </button>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'sms' ? '700' : '500',
            color: activeTab === 'sms' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'sms' ? '2px solid #4f46e5' : '2px solid transparent'
          }}
          onClick={() => setActiveTab('sms')}
        >
          SMS & Parent Alerts Gateway
        </button>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'system' ? '700' : '500',
            color: activeTab === 'system' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'system' ? '2px solid #4f46e5' : '2px solid transparent'
          }}
          onClick={() => setActiveTab('system')}
        >
          Security & Maintenance
        </button>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'smtp' ? '700' : '500',
            color: activeTab === 'smtp' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'smtp' ? '2px solid #4f46e5' : '2px solid transparent'
          }}
          onClick={() => setActiveTab('smtp')}
        >
          📧 Email & SMTP Gateway (Superadmin)
        </button>
      </div>

      <form onSubmit={handleSaveSettings}>
        <div className="card" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading settings...
            </div>
          ) : activeTab === 'general' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                  Platform Company Legal Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    GSTIN Registration Number
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.companyGstin}
                    onChange={(e) => setSettings({ ...settings, companyGstin: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    GST Rate Applied (%)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.companyGstRate}
                    onChange={(e) => setSettings({ ...settings, companyGstRate: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                  Official Registered Address
                </label>
                <textarea
                  rows={2}
                  className="form-control"
                  value={settings.companyAddress}
                  onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Support Contact Phone
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.companyPhone}
                    onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Support Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={settings.companyEmail}
                    onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'payment' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.razorpayKeyId}
                  onChange={(e) => setSettings({ ...settings, razorpayKeyId: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                  Razorpay Webhook Secret
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={settings.razorpayWebhookSecret}
                  onChange={(e) => setSettings({ ...settings, razorpayWebhookSecret: e.target.value })}
                />
              </div>

              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b' }}>
                Webhook listener active at: <code>http://localhost:5000/api/webhooks/razorpay</code>. Auto-verifies cryptographic HMAC SHA256 signatures before provisioning licenses.
              </div>
            </div>
          ) : activeTab === 'sms' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                  SMS Dispatch Provider
                </label>
                <select
                  className="form-control"
                  value={settings.smsProvider}
                  onChange={(e) => setSettings({ ...settings, smsProvider: e.target.value })}
                >
                  <option value="mock">Local Development / Mock Gateway</option>
                  <option value="msg91">MSG91 Enterprise DLT</option>
                  <option value="twilio">Twilio Cloud Programmable SMS</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                  Default Approved Sender ID / Header
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-control"
                  value={settings.smsSenderId}
                  onChange={(e) => setSettings({ ...settings, smsSenderId: e.target.value.toUpperCase() })}
                />
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Standard 6-character TRAI DLT approved principal entity header.
                </div>
              </div>
            </div>
          ) : activeTab === 'system' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Session Inactivity Timeout (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    className="form-control"
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Global Rate Limit (Req / Minute)
                  </label>
                  <input
                    type="number"
                    min={30}
                    className="form-control"
                    value={settings.rateLimitPerMinute}
                    onChange={(e) => setSettings({ ...settings, rateLimitPerMinute: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="enforcePw"
                  checked={settings.enforceStrongPasswords}
                  onChange={(e) => setSettings({ ...settings, enforceStrongPasswords: e.target.checked })}
                />
                <label htmlFor="enforcePw" style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                  Enforce strong password policy for all school administrators & teachers
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="maintenanceMode"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                />
                <label htmlFor="maintenanceMode" style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                  Platform Maintenance Mode (Restricts access to Super Admins only)
                </label>
              </div>
            </div>
          ) : (
            /* TAB: SMTP EMAIL GATEWAY (SUPERADMIN ONLY) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#1e293b', fontWeight: '700', fontSize: '14px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Central SMTP Email Gateway (Restricted to Superadmin)
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                  Only the <b>Superadmin</b> has access to view, update, and secure the underlying SMTP username and password credentials. School accounts use this central gateway to deliver automated student absence alerts while managing their own sender identities and notifications.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    SMTP Host Server
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. smtp.gmail.com"
                    value={settings.smtpHost || 'smtp.gmail.com'}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Port
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="587"
                    value={settings.smtpPort || 587}
                    onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Encryption
                  </label>
                  <select
                    className="form-control"
                    value={settings.smtpEncryption || 'STARTTLS'}
                    onChange={(e) => setSettings({ ...settings, smtpEncryption: e.target.value as any })}
                  >
                    <option value="STARTTLS">STARTTLS (587)</option>
                    <option value="SSL/TLS">SSL/TLS (465)</option>
                    <option value="NONE">None / Plain</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    SMTP Username / Login Email <span style={{ color: '#4f46e5' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. notifications@schoolsaas.com"
                    value={settings.smtpUsername || ''}
                    onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    SMTP Password / App Password <span style={{ color: '#4f46e5' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      className="form-control"
                      placeholder="••••••••••••"
                      value={settings.smtpPassword || ''}
                      onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                    >
                      {showSmtpPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Default Sender Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="attendance@attendoschool.com"
                    value={settings.smtpSenderEmail || ''}
                    onChange={(e) => setSettings({ ...settings, smtpSenderEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>
                    Default Sender Display Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="AttendoSchool System Notifications"
                    value={settings.smtpSenderName || ''}
                    onChange={(e) => setSettings({ ...settings, smtpSenderName: e.target.value })}
                  />
                </div>
              </div>

              {/* Brevo HTTPS Gateway (Port 443 — Render & Cloud Egress Immune) */}
              <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
                    HTTPS REST Email Gateway (Port 443 — Render Cloud Ready)
                  </div>
                  <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontWeight: '600', border: '1px solid #86efac' }}>
                    ACTIVE (Bypasses Port 587/465 Cloud Blocks)
                  </span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#14532d', lineHeight: '1.45' }}>
                  Cloud deployment platforms like Render Free tier block outbound TCP on ports 25, 465, and 587. AttendoSchool automatically dispatches emails via <b>Brevo HTTPS REST API (Port 443)</b> with guaranteed deliverability, DKIM signing, and zero port blockage.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#166534' }}>
                      Brevo API Key (xkeysib-...)
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="xkeysib-..."
                      value={settings.brevoApiKey || ''}
                      onChange={(e) => setSettings({ ...settings, brevoApiKey: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#166534' }}>
                      Verified Brevo Sender Email
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. rajbsmv@gmail.com"
                      value={settings.brevoSenderEmail || ''}
                      onChange={(e) => setSettings({ ...settings, brevoSenderEmail: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* SMTP Test Console for Superadmin */}
              <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '10px' }}>
                <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '8px', color: '#1e293b' }}>
                  Superadmin Test SMTP Dispatch
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="recipient@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    style={{ flex: 1, minWidth: '240px' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={smtpTesting}
                    onClick={async () => {
                      setSmtpTesting(true);
                      setSmtpTestMsg(null);
                      try {
                        const res: any = await apiRequest('/super-admin/smtp/test', {
                          method: 'POST',
                          body: JSON.stringify({
                            recipientEmail: testEmail,
                            host: settings.smtpHost,
                            port: settings.smtpPort,
                            username: settings.smtpUsername,
                            password: settings.smtpPassword,
                            encryption: settings.smtpEncryption,
                            senderEmail: settings.smtpSenderEmail,
                            senderName: settings.smtpSenderName
                          })
                        });
                        setSmtpTestMsg({ success: true, message: res.message || 'Test email dispatched successfully!' });
                      } catch (err: any) {
                        setSmtpTestMsg({ success: false, message: err.message || 'SMTP connection failed' });
                      } finally {
                        setSmtpTesting(false);
                      }
                    }}
                  >
                    {smtpTesting ? 'Testing...' : 'Send Test Verification Email'}
                  </button>
                </div>
                {smtpTestMsg && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: smtpTestMsg.success ? '#166534' : '#991b1b', fontWeight: '500' }}>
                    {smtpTestMsg.success ? '✔ ' : '✖ '} {smtpTestMsg.message}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ minWidth: '140px' }}
            >
              {saving ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
