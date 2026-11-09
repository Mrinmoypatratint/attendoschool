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
    maintenanceMode: false,
    emailEnabled: true,
    emailServiceEnabled: true
  });

  const [activeTab, setActiveTab] = useState<'general' | 'sms' | 'payment' | 'system' | 'smtp'>('general');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [togglingMail, setTogglingMail] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showSmtpPass, setShowSmtpPass] = useState<boolean>(false);
  const [smtpTesting, setSmtpTesting] = useState<boolean>(false);
  const [smtpTestMsg, setSmtpTestMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState<string>('rajbsmv@gmail.com');

  const handleToggleMailService = async (targetState?: boolean) => {
    setTogglingMail(true);
    setError(null);
    try {
      const desiredState = targetState !== undefined ? targetState : (settings.emailEnabled === false);
      const res: any = await apiRequest('/super-admin/mail-service/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled: desiredState })
      });
      setSettings(prev => ({
        ...prev,
        emailEnabled: desiredState,
        emailServiceEnabled: desiredState
      }));
      setSaveSuccess(res?.message || `Mail service ${desiredState ? 'enabled' : 'disabled'} successfully.`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to toggle mail service status');
    } finally {
      setTogglingMail(false);
    }
  };

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
        <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: '4px', background: "var(--secondary)", color: "var(--success)", border: "1px solid var(--border)", fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saveSuccess}
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '4px', background: "var(--secondary)", color: "var(--destructive)", border: "1px solid var(--border)" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '20px 0', borderBottom: "1px solid var(--border)" }}>
        <button
          className="btn-tab"
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'general' ? '700' : '500',
            color: activeTab === 'general' ? "var(--primary)" : "var(--muted-foreground)",
            borderBottom: activeTab === 'general' ? "2px solid var(--border)" : '2px solid transparent'
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
            color: activeTab === 'payment' ? "var(--primary)" : "var(--muted-foreground)",
            borderBottom: activeTab === 'payment' ? "2px solid var(--border)" : '2px solid transparent'
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
            color: activeTab === 'sms' ? "var(--primary)" : "var(--muted-foreground)",
            borderBottom: activeTab === 'sms' ? "2px solid var(--border)" : '2px solid transparent'
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
            color: activeTab === 'system' ? "var(--primary)" : "var(--muted-foreground)",
            borderBottom: activeTab === 'system' ? "2px solid var(--border)" : '2px solid transparent'
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
            color: activeTab === 'smtp' ? "var(--primary)" : "var(--muted-foreground)",
            borderBottom: activeTab === 'smtp' ? "2px solid var(--border)" : '2px solid transparent'
          }}
          onClick={() => setActiveTab('smtp')}
        >
          📧 Mail Service & SMTP Gateway (Superadmin)
        </button>
      </div>

      <form onSubmit={handleSaveSettings}>
        <div className="card" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: "var(--muted-foreground)" }}>
              Loading settings...
            </div>
          ) : activeTab === 'general' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
                  Razorpay Webhook Secret
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={settings.razorpayWebhookSecret}
                  onChange={(e) => setSettings({ ...settings, razorpayWebhookSecret: e.target.value })}
                />
              </div>

              <div style={{ padding: '14px', background: "var(--card)", borderRadius: '4px', border: "1px solid var(--border)", fontSize: '13px', color: "var(--muted-foreground)" }}>
                Webhook listener active at: <code>http://localhost:5000/api/webhooks/razorpay</code>. Auto-verifies cryptographic HMAC SHA256 signatures before provisioning licenses.
              </div>
            </div>
          ) : activeTab === 'sms' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
                  Default Approved Sender ID / Header
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-control"
                  value={settings.smsSenderId}
                  onChange={(e) => setSettings({ ...settings, smsSenderId: e.target.value.toUpperCase() })}
                />
                <div style={{ fontSize: '12px', color: "var(--muted-foreground)", marginTop: '4px' }}>
                  Standard 6-character TRAI DLT approved principal entity header.
                </div>
              </div>
            </div>
          ) : activeTab === 'system' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                <label htmlFor="enforcePw" style={{ fontSize: '14px', color: "var(--muted-foreground)", fontWeight: '500' }}>
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
                <label htmlFor="maintenanceMode" style={{ fontSize: '14px', color: "var(--muted-foreground)", fontWeight: '500' }}>
                  Platform Maintenance Mode (Restricts access to Super Admins only)
                </label>
              </div>
            </div>
          ) : (
            /* TAB: SMTP EMAIL GATEWAY (SUPERADMIN ONLY) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>
              
              {/* MASTER MAIL SERVICE ON/OFF TOGGLE BOX */}
              <div style={{
                background: settings.emailEnabled !== false ? "var(--secondary)" : "var(--card)",
                borderRadius: '4px',
                border: `1.5px solid ${settings.emailEnabled !== false ? "var(--border)" : "var(--border)"}`,
                padding: '20px',
                boxShadow: 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: '700',
                        letterSpacing: '0.03em',
                        background: settings.emailEnabled !== false ? "var(--secondary)" : "var(--secondary)",
                        color: settings.emailEnabled !== false ? "var(--success)" : "var(--destructive)",
                        border: `1px solid ${settings.emailEnabled !== false ? "var(--border)" : "var(--border)"}`
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: settings.emailEnabled !== false ? "var(--success)" : "var(--destructive)",
                          boxShadow: settings.emailEnabled !== false ? "none" : 'none'
                        }}></span>
                        {settings.emailEnabled !== false ? 'MAIL SERVICE IS ACTIVE' : 'MAIL SERVICE IS DISABLED / PAUSED'}
                      </span>
                      <span style={{ fontSize: '11px', color: "var(--muted-foreground)", fontWeight: '500' }}>
                        (Superadmin Master Switch)
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: settings.emailEnabled !== false ? "var(--success)" : "var(--destructive)" }}>
                      {settings.emailEnabled !== false ? 'Automated & Transactional Email Dispatch Enabled' : 'All Outbound Emails Suspended System-Wide'}
                    </h4>

                    <p style={{ margin: 0, fontSize: '13px', color: settings.emailEnabled !== false ? "var(--success)" : "var(--destructive)", lineHeight: '1.5' }}>
                      {settings.emailEnabled !== false
                        ? 'Student absence alerts, parent notifications, invoice payment receipts, account credentials, and password resets will be delivered automatically via your configured SMTP / Brevo relay.'
                        : 'No outbound emails will be dispatched to parents, teachers, students, or administrators. Notifications are safely bypassed without interrupting school workflows or throwing unhandled errors.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={togglingMail || loading}
                      onClick={() => handleToggleMailService(settings.emailEnabled === false)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 18px',
                        borderRadius: '4px',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: togglingMail ? 'not-allowed' : 'pointer',
                        border: 'none',
                        color: "var(--background)",
                        background: settings.emailEnabled !== false ? "var(--destructive)" : "var(--success)",
                        boxShadow: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {togglingMail ? (
                        <span>Updating Status...</span>
                      ) : settings.emailEnabled !== false ? (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                          Disable Mail Service
                        </>
                      ) : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Enable Mail Service
                        </>
                      )}
                    </button>
                    <span style={{ fontSize: '11px', color: "var(--muted-foreground)" }}>
                      Click for instant platform-wide toggle
                    </span>
                  </div>
                </div>

                {/* Explicit Radio Choice */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${settings.emailEnabled !== false ? "var(--border)" : "var(--border)"}`, display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: "var(--foreground)", cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="emailMasterServiceStatus"
                      checked={settings.emailEnabled !== false}
                      onChange={() => setSettings({ ...settings, emailEnabled: true, emailServiceEnabled: true })}
                    />
                    <span>Active (Deliver Emails)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: "var(--foreground)", cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="emailMasterServiceStatus"
                      checked={settings.emailEnabled === false}
                      onChange={() => setSettings({ ...settings, emailEnabled: false, emailServiceEnabled: false })}
                    />
                    <span>Disabled (Pause All Emails)</span>
                  </label>
                </div>
              </div>

              <div style={{ background: "var(--card)", padding: '16px', borderRadius: '4px', border: "1px solid var(--border)" }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: "var(--foreground)", fontWeight: '700', fontSize: '14px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d55" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Central SMTP Email Gateway (Restricted to Superadmin)
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: "var(--muted-foreground)", lineHeight: '1.5' }}>
                  Only the <b>Superadmin</b> has access to view, update, and secure the underlying SMTP username and password credentials. School accounts use this central gateway to deliver automated student absence alerts while managing their own sender identities and notifications.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
                    SMTP Username / Login Email <span style={{ color: "var(--primary)" }}>*</span>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
                    SMTP Password / App Password <span style={{ color: "var(--primary)" }}>*</span>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: "var(--muted-foreground)" }}>
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
              <div style={{ background: "var(--secondary)", padding: '16px', borderRadius: '4px', border: "1px solid var(--border)", marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13.5px', color: "var(--success)", display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: "var(--success)" }}></span>
                    HTTPS REST Email Gateway (Port 443 — Render Cloud Ready)
                  </div>
                  <span style={{ fontSize: '11px', background: "var(--secondary)", color: "var(--success)", padding: '3px 8px', borderRadius: '4px', fontWeight: '600', border: "1px solid var(--border)" }}>
                    ACTIVE (Bypasses Port 587/465 Cloud Blocks)
                  </span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: "var(--success)", lineHeight: '1.45' }}>
                  Cloud deployment platforms like Render Free tier block outbound TCP on ports 25, 465, and 587. AttendoSchool automatically dispatches emails via <b>Brevo HTTPS REST API (Port 443)</b> with guaranteed deliverability, DKIM signing, and zero port blockage.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: "var(--success)" }}>
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
                    {settings.brevoApiKey?.startsWith('xsmtpsib-') && (
                      <div style={{ marginTop: '6px', padding: '8px 12px', background: "var(--card)", border: "1px solid var(--border)", borderRadius: '4px', fontSize: '12px', color: "var(--warning)", lineHeight: '1.45' }}>
                        ⚠️ <b>Brevo SMTP Key Detected:</b> You entered an SMTP password (starts with <code>xsmtpsib-</code>). For cloud HTTPS delivery on Render (Port 443), please generate an <b>API Key</b> (starts with <code>xkeysib-</code>) in Brevo &rarr; <b>SMTP & API</b> &rarr; <b>API Keys</b> tab.
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: "var(--success)" }}>
                      Verified Brevo Sender Email
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. info.sahayog24x7@gmail.com"
                      value={settings.brevoSenderEmail || ''}
                      onChange={(e) => setSettings({ ...settings, brevoSenderEmail: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* SMTP Test Console for Superadmin */}
              <div style={{ background: "var(--secondary)", padding: '16px', borderRadius: '4px', border: "1px solid var(--border)", marginTop: '10px' }}>
                <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '8px', color: "var(--foreground)" }}>
                  Superadmin Test SMTP Dispatch
                </div>
                {settings.emailEnabled === false && (
                  <div style={{ margin: '0 0 12px 0', padding: '10px 12px', borderRadius: '4px', background: "var(--card)", color: "var(--destructive)", border: "1px solid var(--border)", fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span><b>Notice:</b> Mail service is currently set to DISABLED. Please toggle Mail Service to Active above to test verification email delivery.</span>
                  </div>
                )}
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
                            senderName: settings.smtpSenderName,
                            brevoApiKey: settings.brevoApiKey,
                            brevoSenderEmail: settings.brevoSenderEmail,
                            brevoSenderName: settings.brevoSenderName
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
                  <div style={{ marginTop: '10px', fontSize: '13px', color: smtpTestMsg.success ? "var(--success)" : "var(--destructive)", fontWeight: '500' }}>
                    {smtpTestMsg.success ? '✔ ' : '✖ '} {smtpTestMsg.message}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: "1px solid var(--border)", display: 'flex', justifyContent: 'flex-end' }}>
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
