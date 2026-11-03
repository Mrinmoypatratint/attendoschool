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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-8 font-sans transition-colors">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2.5 mb-2">
          <img
            src="/attendo-school-logo.png"
            alt="AttendoSchool"
            className="w-9 h-9 rounded-lg object-contain"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Attendo<span className="text-blue-600">School</span>
          </span>
        </div>
        <p className="m-0 text-[13px] text-slate-500 dark:text-slate-400">
          {tokenData?.schoolName || 'Institutional Campus Management Portal'}
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-950/5 overflow-hidden transition-colors">
        {/* Card Header Strip */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div>
            <span className="inline-block text-[11px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 mb-0.5">
              Account Activation
            </span>
            <h2 className="m-0 text-lg font-bold text-slate-900 dark:text-white">
              Set Your Password
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md text-xs font-semibold border border-blue-200 dark:border-blue-900/40">
            <ShieldCheck size={14} />
            {displayRole}
          </span>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-7">
          {loading && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin" />
              <p className="m-0 text-sm">Verifying security token...</p>
            </div>
          )}

          {!loading && !valid && (
            <div className="text-center py-4">
              <div className="w-13 h-13 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 inline-flex items-center justify-center mb-4 border border-rose-200 dark:border-rose-900/40">
                <AlertCircle size={28} />
              </div>
              <h3 className="m-0 mb-2 text-base font-bold text-rose-800 dark:text-rose-300">
                Setup Link Expired or Invalid
              </h3>
              <p className="m-0 mb-6 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer shadow-sm transition-colors"
              >
                Return to Login <ArrowRight size={16} />
              </button>
            </div>
          )}

          {!loading && valid && success && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center mb-4 border border-emerald-200 dark:border-emerald-900/40">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="m-0 mb-2 text-lg font-bold text-emerald-800 dark:text-emerald-300">
                Password Set Successfully!
              </h3>
              <p className="m-0 mb-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Your account password has been established. You can now use your email (<b>{tokenData?.email}</b>) to log in to the school portal.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0 py-3 px-5 rounded-lg text-sm font-semibold cursor-pointer shadow-md shadow-blue-600/20 transition-all"
              >
                Proceed to Login <ArrowRight size={16} />
              </button>
            </div>
          )}

          {!loading && valid && !success && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Recipient summary banner */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 px-4 mb-1 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {tokenData?.name ? tokenData.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {tokenData?.name || tokenData?.email}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {tokenData?.email}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 px-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-lg text-rose-700 dark:text-rose-300 text-[13px] flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password Input */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Choose New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter at least 8 characters..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full py-2.5 pr-10 pl-3.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 flex items-center transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter your password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full py-2.5 pr-10 pl-3.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 flex items-center transition-colors"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Security Checklist */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-lg p-3 px-3.5 my-1 text-xs">
                <div className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Password Requirements:</div>
                <div className={`flex items-center gap-1.5 mb-1 ${pwCheck.hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  <Check size={14} className={pwCheck.hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'} />
                  <span>Minimum 8 characters in length</span>
                </div>
                <div className={`flex items-center gap-1.5 mb-1 ${pwCheck.hasUpperCase ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  <Check size={14} className={pwCheck.hasUpperCase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'} />
                  <span>At least 1 Capital letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 mb-1 ${pwCheck.hasLowerCase ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  <Check size={14} className={pwCheck.hasLowerCase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'} />
                  <span>At least 1 small letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 mb-1 ${pwCheck.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  <Check size={14} className={pwCheck.hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'} />
                  <span>At least 1 number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 mb-1 ${pwCheck.hasSpecialChar ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  <Check size={14} className={pwCheck.hasSpecialChar ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'} />
                  <span>At least 1 special character (e.g. !@#$%^&*)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  <Check size={14} className={passwordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'} />
                  <span>Passwords match</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`w-full flex items-center justify-center gap-2 text-white border-0 py-3 px-5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                  isFormValid && !submitting
                    ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-blue-600/20'
                    : 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-80'
                }`}
              >
                {submitting ? 'Saving Password...' : 'Activate Account & Set Password'}
              </button>
            </form>
          )}
        </div>

        {/* Card Footer */}
        <div className="p-3.5 px-6 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
          Need assistance? Contact your school administrator office.
        </div>
      </div>
    </div>
  );
}
