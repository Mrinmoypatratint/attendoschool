import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Building2,
  User,
  Mail,
  Phone,
  Calendar,
  Loader2,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { api } from '../../api';

export const LandingDemo: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    schoolName: '',
    contactPerson: '',
    email: '',
    phone: '',
    institutionType: 'K-12 School',
    preferredDate: '',
    message: ''
  });

  const [loading, setLoading] = useState(false);
  const [successBooking, setSuccessBooking] = useState<{ id: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.schoolName.trim()) {
      setErrorMessage('Please provide your school or institution name.');
      return;
    }
    if (!formData.contactPerson.trim()) {
      setErrorMessage('Please enter the primary contact person.');
      return;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrorMessage('Please provide a valid work or school email address.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 8) {
      setErrorMessage('Please enter a valid phone number for demo scheduling.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.post('/demo-request', formData);
      if (res.data?.success) {
        setSuccessBooking({
          id: res.data.bookingId || 'DEMO-CONFIRMED',
          message: res.data.message || 'Thank you! Your demo request has been registered.'
        });
      } else {
        setErrorMessage(res.data?.message || 'Unable to schedule demo. Please try again.');
      }
    } catch (err: any) {
      try {
        const rawRes = await fetch('http://localhost:5000/api/demo-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await rawRes.json();
        if (data.success) {
          setSuccessBooking({
            id: data.bookingId || 'DEMO-CONFIRMED',
            message: data.message || 'Thank you! Your demo request has been registered.'
          });
          return;
        }
      } catch (fallbackErr) {
        // Continue to error message
      }

      setErrorMessage(
        err?.response?.data?.message ||
          'Failed to submit demo request. Please contact support@attendoschool.online directly.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="c360-section" id="demo" style={{ background: '#FFFFFF' }}>
      <div className="c360-container">
        {/* Campus360 Dark CTA Banner with Top Gradient Accent */}
        <div className="c360-cta-banner">
          <div className="c360-cta-banner-line" />
          <div className="c360-cta-glow" />

          <h2 className="c360-cta-title">
            Stop struggling with paper registers.<br />
            Start running a modern campus.
          </h2>

          <p className="c360-cta-desc">
            See gate RFID attendance, classroom roll calls, and automated parent SMS notifications running on one platform, sized to your school.
          </p>

          <div className="c360-cta-btn-group">
            {/* GREEN LOGIN BUTTON (Strict user requirement) */}
            <button
              type="button"
              className="c360-btn-login-green c360-hero-btn-lg"
              onClick={() => navigate('/login')}
              id="cta-login-btn"
            >
              <UserCheck size={17} />
              <span>Login to Existing Account</span>
            </button>

            <button
              type="button"
              className="c360-btn-primary c360-hero-btn-lg"
              style={{ background: '#FFFFFF', color: '#0F172A', boxShadow: '0 4px 20px rgba(255,255,255,0.2)' }}
              onClick={() => {
                const el = document.getElementById('demo-form');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Schedule a Demo</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Embedded Walkthrough Form Card */}
        <div className="c360-demo-form-card" id="demo-form">
          <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid var(--color-border-default)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 6px 0' }}>
              Request a 20-Minute Campus Walkthrough
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', margin: 0 }}>
              Our implementation team will walk your school leadership through gate RFID hardware, teacher mobile entry, and parent SMS delivery.
            </p>
          </div>

          {successBooking ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#ECFDF5',
                borderRadius: 14,
                border: '1px solid #A7F3D0'
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#059669',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}
              >
                <CheckCircle2 size={30} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#065F46', marginBottom: 8 }}>
                Demo Request Registered Successfully
              </h3>
              <p style={{ fontSize: 14, color: '#047857', maxWidth: 460, margin: '0 auto 16px auto', lineHeight: 1.6 }}>
                {successBooking.message}
              </p>
              <div style={{ display: 'inline-block', background: '#FFFFFF', padding: '6px 14px', borderRadius: 6, border: '1px solid #A7F3D0', fontSize: 12.5, fontWeight: 700, color: '#065F46' }}>
                Booking ID: {successBooking.id}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="c360-form-grid">
                {/* School Name */}
                <div className="c360-form-group">
                  <label className="c360-label" htmlFor="schoolName">
                    School / Institution Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="schoolName"
                    name="schoolName"
                    value={formData.schoolName}
                    onChange={handleChange}
                    placeholder="e.g. D.A.V. Model Senior Secondary"
                    className="c360-input"
                    required
                  />
                </div>

                {/* Contact Person */}
                <div className="c360-form-group">
                  <label className="c360-label" htmlFor="contactPerson">
                    Principal / Contact Person <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="contactPerson"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    placeholder="e.g. Dr. R. Sharma (Principal)"
                    className="c360-input"
                    required
                  />
                </div>

                {/* Email Address */}
                <div className="c360-form-group">
                  <label className="c360-label" htmlFor="email">
                    Official Email Address <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. principal@school****.edu"
                    className="c360-input"
                    required
                  />
                </div>

                {/* Phone Number */}
                <div className="c360-form-group">
                  <label className="c360-label" htmlFor="phone">
                    Mobile / Contact Number <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. +91 98765 43210"
                    className="c360-input"
                    required
                  />
                </div>

                {/* Institution Type */}
                <div className="c360-form-group">
                  <label className="c360-label" htmlFor="institutionType">
                    Institution Type
                  </label>
                  <select
                    id="institutionType"
                    name="institutionType"
                    value={formData.institutionType}
                    onChange={handleChange}
                    className="c360-select"
                  >
                    <option value="K-12 School">K-12 School (CBSE / ICSE / State)</option>
                    <option value="Senior Secondary">Senior Secondary School (10+2)</option>
                    <option value="College / University">College / University</option>
                    <option value="Coaching Academy">Coaching &amp; Competitive Academy</option>
                    <option value="Other">Other Educational Organization</option>
                  </select>
                </div>

                {/* Preferred Date */}
                <div className="c360-form-group">
                  <label className="c360-label" htmlFor="preferredDate">
                    Preferred Demo Date
                  </label>
                  <input
                    type="date"
                    id="preferredDate"
                    name="preferredDate"
                    min={minDate}
                    value={formData.preferredDate}
                    onChange={handleChange}
                    className="c360-input"
                  />
                </div>

                {/* Message */}
                <div className="c360-form-group full">
                  <label className="c360-label" htmlFor="message">
                    Campus Requirements or Questions (Optional)
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="e.g. We require smart RFID turnstile scanners for 1,200 students with instant parent SMS alerts."
                    className="c360-textarea"
                    rows={3}
                  />
                </div>
              </div>

              {errorMessage && (
                <div
                  style={{
                    background: '#FEF2F2',
                    color: '#991B1B',
                    border: '1px solid #FECACA',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    marginTop: 16
                  }}
                  role="alert"
                >
                  {errorMessage}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: '1px solid var(--color-border-default)',
                  flexWrap: 'wrap',
                  gap: 14
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                  <ShieldCheck size={15} style={{ color: '#059669' }} />
                  <span>Free consultation for schools · No credit card required</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="c360-btn-primary c360-hero-btn-lg"
                  id="submit-demo-form-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Scheduling Demo...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Request</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
