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

  const [activeTab, setActiveTab] = useState<'general' | 'sms' | 'payment' | 'system'>('general');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
          ) : (
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
