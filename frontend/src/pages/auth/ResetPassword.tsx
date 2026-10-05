import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Mail, Check, Building2, School } from 'lucide-react';
import { api } from '../../api';
import { validatePassword } from '../../utils/passwordPolicy';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Robust parameter extractor supporting HashRouter query, window.location.search, and hash string
  const getParam = (key: string): string => {
    const fromRouter = searchParams.get(key);
    if (fromRouter) return fromRouter.trim();

    if (typeof window !== 'undefined') {
      if (window.location.search) {
        const fromSearch = new URLSearchParams(window.location.search).get(key);
        if (fromSearch) return fromSearch.trim();
      }
      if (window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.slice(window.location.hash.indexOf('?'));
        const fromHash = new URLSearchParams(hashQuery).get(key);
        if (fromHash) return fromHash.trim();
      }
    }
    return '';
  };

  const token = getParam('token');
  const emailParam = getParam('email');

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState<boolean | null>(null);
  const [tokenData, setTokenData] = useState<{
    email: string;
    name: string;
    role: string;
    schoolName: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      const activeToken = token || getParam('token');
      if (!activeToken) {
        setValid(false);
        setErrorMessage('No password setup token was provided. Please use the secure link sent to your email.');
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/verify-reset-token', { params: { token: activeToken } });
        setValid(true);
        setTokenData(res.data);
      } catch (err: any) {
        setValid(false);
        setErrorMessage(
          err?.response?.data?.message ||
            'This setup link is invalid, expired, or has already been used. Please contact your school administrator to receive a new link.'
        );
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  // Password Strength Rules
  const pwCheck = validatePassword(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = pwCheck.valid && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const activeToken = token || getParam('token');
      await api.post('/auth/reset-password', {
        token: activeToken,
        newPassword
      });
      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabelMap: Record<string, string> = {
    STUDENT: 'Student Portal',
    TEACHER: 'Faculty Member',
    SCHOOL_ADMIN: 'School Administrator',
    SUPER_ADMIN: 'System Super Admin'
  };

  const displayRole = tokenData?.role ? (roleLabelMap[tokenData.role] || tokenData.role) : 'Student Portal';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <img
            src="/attendo-school-logo.png"
            alt="AttendoSchool"
            style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }}
            onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }}
          />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
            Attendo<span style={{ color: '#2563eb' }}>School</span>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          {tokenData?.schoolName || 'Institutional Campus Management Portal'}
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
        overflow: 'hidden'
      }}>
        {/* Card Header Strip */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#2563eb',
              marginBottom: 2
            }}>
              Account Activation
            </span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Set Your Password
            </h2>
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid #dbeafe'
          }}>
            <ShieldCheck size={14} />
            {displayRole}
          </span>
        </div>

        {/* Card Body */}
        <div style={{ padding: '28px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
              <div style={{
                width: 32,
                height: 32,
                border: '3px solid #e2e8f0',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                margin: '0 auto 16px auto',
                animation: 'spin 0.8s linear infinite'
              }} />
              <p style={{ margin: 0, fontSize: 14 }}>Verifying security token...</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!loading && !valid && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <AlertCircle size={28} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: '#991b1b' }}>
                Setup Link Expired or Invalid
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Return to Login <ArrowRight size={16} />
              </button>
            </div>
          )}

          {!loading && valid && success && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                border: '1px solid #bbf7d0'
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#166534' }}>
                Password Set Successfully!
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
                Your account password has been established. You can now use your email (<b>{tokenData?.email}</b>) to log in to the school portal.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}
              >
                Proceed to Login <ArrowRight size={16} />
              </button>
            </div>
          )}

          {!loading && valid && !success && (
            <form onSubmit={handleSubmit}>
              {/* Recipient summary banner */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14
                }}>
                  {tokenData?.name ? tokenData.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                    {tokenData?.name || tokenData?.email}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {tokenData?.email}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  color: '#b91c1c',
                  fontSize: 13,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password Input */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Choose New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter at least 8 characters..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 14,
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter your password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Security Checklist */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #f1f5f9',
                borderRadius: 6,
                padding: '12px 14px',
                marginBottom: 24,
                fontSize: 12
              }}>
                <div style={{ fontWeight: 600, color: '#475569', marginBottom: 8 }}>Password Requirements:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: pwCheck.hasMinLength ? '#16a34a' : '#94a3b8' }}>
                  <Check size={14} style={{ color: pwCheck.hasMinLength ? '#16a34a' : '#cbd5e1' }} />
                  <span>Minimum 8 characters in length</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: pwCheck.hasUpperCase ? '#16a34a' : '#94a3b8' }}>
                  <Check size={14} style={{ color: pwCheck.hasUpperCase ? '#16a34a' : '#cbd5e1' }} />
                  <span>At least 1 Capital letter (A-Z)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: pwCheck.hasLowerCase ? '#16a34a' : '#94a3b8' }}>
                  <Check size={14} style={{ color: pwCheck.hasLowerCase ? '#16a34a' : '#cbd5e1' }} />
                  <span>At least 1 small letter (a-z)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: pwCheck.hasNumber ? '#16a34a' : '#94a3b8' }}>
                  <Check size={14} style={{ color: pwCheck.hasNumber ? '#16a34a' : '#cbd5e1' }} />
                  <span>At least 1 number (0-9)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: pwCheck.hasSpecialChar ? '#16a34a' : '#94a3b8' }}>
                  <Check size={14} style={{ color: pwCheck.hasSpecialChar ? '#16a34a' : '#cbd5e1' }} />
                  <span>At least 1 special character (e.g. !@#$%^&*)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: passwordsMatch ? '#16a34a' : '#94a3b8' }}>
                  <Check size={14} style={{ color: passwordsMatch ? '#16a34a' : '#cbd5e1' }} />
                  <span>Passwords match</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isFormValid || submitting}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: isFormValid ? '#2563eb' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isFormValid && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s',
                  boxShadow: isFormValid ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
                }}
              >
                {submitting ? 'Saving Password...' : 'Activate Account & Set Password'}
              </button>
            </form>
          )}
        </div>

        {/* Card Footer */}
        <div style={{
          padding: '14px 24px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: 12,
          color: '#64748b'
        }}>
          Need assistance? Contact your school administrator office.
        </div>
      </div>
    </div>
  );
}
