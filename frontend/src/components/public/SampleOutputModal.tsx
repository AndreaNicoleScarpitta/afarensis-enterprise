import React, { useState, useEffect } from 'react';
import { X, Download, FileText, CheckCircle } from 'lucide-react';

interface SampleOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadsource?: string;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const FREE_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'inbox.com',
];

export function SampleOutputModal({ isOpen, onClose, leadsource = 'landing_page' }: SampleOutputModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

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
      window.gtag('event', 'form_view', {
        form_name: 'sample_download',
        lead_source: leadsource,
      });
    }
  }, [isOpen, leadsource]);

  if (!isOpen) return null;

  const isFreeDomain = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase();
    return FREE_DOMAINS.includes(domain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isFreeDomain(formData.email)) {
      setError('Please use your business email address. Free email providers are not accepted.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/sample-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          lead_source: leadsource,
        }),
      });

      if (!res.ok) throw new Error('Submission failed');

      const data = await res.json();
      setDownloadUrl(data.download_token ? `/api/sample-download/file?token=${data.download_token}` : '/sample-report.pdf');

      if (window.gtag) {
        window.gtag('event', 'form_submit', {
          form_name: 'sample_download',
          lead_source: leadsource,
        });
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 10000,
        padding: '16px',
      }}>
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '48px',
          maxWidth: '480px', width: '100%', textAlign: 'center',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#dcfce7', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px',
          }}>
            <Download size={32} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
            Your report is ready
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
            Click below to download the sample validation report.
          </p>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 32px', background: '#1e40af', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '16px',
              fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
              marginBottom: '12px',
            }}
          >
            <Download size={18} />
            Download PDF
          </a>
          <br />
          <button
            onClick={onClose}
            style={{
              marginTop: '12px', padding: '10px 24px', background: 'transparent',
              color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '8px',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
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
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 10000,
      padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '0',
        maxWidth: '480px', width: '100%', maxHeight: '90vh',
        overflow: 'auto', position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#dbeafe', display: 'flex', alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText size={20} color="#1e40af" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>
                Get Sample Report
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
                See a worked validation example
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', color: '#9ca3af',
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Info box */}
          <div style={{
            background: '#f0f9ff', border: '1px solid #bae6fd',
            borderRadius: '10px', padding: '16px', marginBottom: '24px',
            display: 'flex', gap: '12px', alignItems: 'flex-start',
          }}>
            <FileText size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '13px', color: '#0c4a6e', margin: 0, lineHeight: 1.5 }}>
              This sample report demonstrates how Afarensis validates external control arm claims
              against regulatory standards, including propensity scoring, covariate balance,
              and sensitivity analysis outputs.
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
              color: '#dc2626', fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Full Name *</label>
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
            <label style={labelStyle}>Business Email *</label>
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

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Phone Number *</label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="+1 (555) 000-0000"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '14px', background: submitting ? '#93c5fd' : '#1e40af',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '16px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'background-color 0.2s',
            }}
          >
            <Download size={18} />
            {submitting ? 'Processing...' : 'Download Sample Report'}
          </button>

          <p style={{
            fontSize: '11px', color: '#9ca3af', textAlign: 'center',
            marginTop: '16px', marginBottom: 0, lineHeight: 1.5,
          }}>
            By submitting, you agree to our Privacy Policy. We will not share your information
            with third parties.
          </p>
        </form>
      </div>
    </div>
  );
}
