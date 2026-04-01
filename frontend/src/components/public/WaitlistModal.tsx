import React, { useState, useEffect } from 'react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadSource?: string;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function WaitlistModal({ isOpen, onClose, leadSource = 'landing_page' }: WaitlistModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    companySize: '',
    useCases: '',
    requirements: '',
    timeline: '',
    designPartner: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && window.gtag) {
      window.gtag('event', 'form_view', { form_name: 'waitlist', lead_source: leadSource });
    }
  }, [isOpen, leadSource]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v2/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          organization: formData.organization,
          companySize: formData.companySize,
          useCases: formData.useCases,
          requirements: formData.requirements,
          timeline: formData.timeline,
          designPartner: formData.designPartner,
          leadSource: leadSource,
        }),
      });
      if (!res.ok) throw new Error('Submission failed');

      if (window.gtag) {
        window.gtag('event', 'form_submit', { form_name: 'waitlist', lead_source: leadSource });
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: '"Inter", sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  };

  if (submitted) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 10000,
        padding: '16px',
      }}>
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '48px',
          maxWidth: '600px', width: '100%', textAlign: 'center',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#dcfce7', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
            Welcome to the waitlist!
          </h2>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '32px' }}>
            We'll be in touch soon with early access details.
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '12px 32px', background: '#1e40af', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '16px',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 10000,
      padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '0',
        maxWidth: '600px', width: '100%', maxHeight: '90vh',
        overflow: 'auto', position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
          borderRadius: '16px 16px 0 0',
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Join the Waitlist
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
              Get early access to Synthetic Ascendancy
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', color: '#9ca3af', fontSize: '24px', lineHeight: 1,
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 32px 32px' }}>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
              color: '#dc2626', fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {/* Basic Information */}
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '16px', marginTop: 0 }}>
            Basic Information
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Name *</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Your full name"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email *</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="you@company.com"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Organization</label>
            <input
              name="organization"
              value={formData.organization}
              onChange={handleChange}
              placeholder="Your organization"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Company Size</label>
            <select
              name="companySize"
              value={formData.companySize}
              onChange={handleChange}
              style={{ ...inputStyle, appearance: 'auto' as const }}
            >
              <option value="">Select size</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-1000">201-1,000 employees</option>
              <option value="1000+">1,000+ employees</option>
            </select>
          </div>

          {/* Project Details */}
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>
            Project Details
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              Primary Use Cases
              <span
                title="Describe how you plan to use Synthetic Ascendancy"
                style={{ marginLeft: '6px', cursor: 'help', color: '#9ca3af' }}
              >
                &#9432;
              </span>
            </label>
            <textarea
              name="useCases"
              value={formData.useCases}
              onChange={handleChange}
              placeholder="e.g., External control arm validation, synthetic data generation..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Specific Requirements</label>
            <textarea
              name="requirements"
              value={formData.requirements}
              onChange={handleChange}
              placeholder="Any specific requirements or constraints..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Expected Timeline</label>
            <select
              name="timeline"
              value={formData.timeline}
              onChange={handleChange}
              style={{ ...inputStyle, appearance: 'auto' as const }}
            >
              <option value="">Select timeline</option>
              <option value="immediate">Immediate (within 1 month)</option>
              <option value="quarter">This quarter</option>
              <option value="half-year">Within 6 months</option>
              <option value="exploring">Just exploring</option>
            </select>
          </div>

          <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              name="designPartner"
              checked={formData.designPartner}
              onChange={handleChange}
              id="designPartner"
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="designPartner" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
              I'm interested in being a design partner
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '14px', background: submitting ? '#93c5fd' : '#1e40af',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {submitting ? 'Submitting...' : 'Join Waitlist'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WaitlistModal;
