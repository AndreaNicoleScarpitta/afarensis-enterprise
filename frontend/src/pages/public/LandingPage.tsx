import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import WaitlistModal from '../../components/public/WaitlistModal';
import { ContactModal } from '../../components/public/ContactModal';
import { SampleOutputModal } from '../../components/public/SampleOutputModal';
import { usePageSEO } from '../../hooks/usePageSEO';

const designSystem = {
  colors: {
    primary: '#1e40af',
    primaryLight: '#dbeafe',
    secondary: '#059669',
    accent: '#0891b2',
    neutral: {
      white: '#ffffff',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray800: '#1f2937',
      gray900: '#111827',
    },
  },
  typography: {
    fontFamily: {
      primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      heading: '"Montserrat", "Inter", sans-serif',
    },
    fontSize: {
      xs: '12px', sm: '14px', base: '16px', lg: '18px', xl: '20px',
      '2xl': '24px', '3xl': '30px', '4xl': '36px', '5xl': '48px',
    },
  },
  spacing: {
    xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px',
    '2xl': '48px', '3xl': '64px', '4xl': '96px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
};

const pulseKeyframes = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@media (max-width: 768px) {
  .landing-hero-buttons {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .landing-hero-buttons a,
  .landing-hero-buttons button {
    width: 100% !important;
    text-align: center !important;
    justify-content: center !important;
  }
  .landing-stats-grid {
    grid-template-columns: 1fr !important;
  }
  .landing-failure-grid {
    grid-template-columns: 1fr !important;
  }
  .landing-footer-grid {
    grid-template-columns: 1fr !important;
    gap: 32px !important;
  }
  .landing-hero h1 {
    font-size: 30px !important;
  }
  .landing-section-padding {
    padding-left: 20px !important;
    padding-right: 20px !important;
  }
  .landing-crl-stats {
    flex-direction: column !important;
  }
  .landing-who-grid {
    grid-template-columns: 1fr !important;
  }
}
`;

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showSampleOutput, setShowSampleOutput] = useState(false);

  usePageSEO({
    title: 'External Control Arm Validation Infrastructure for Rare Disease Sponsors',
    description: 'Synthetic Ascension builds validation infrastructure for externally controlled trials. Statistically defensible, regulatorily auditable evidence for rare disease sponsors — before your submission reaches a reviewer.',
    canonicalPath: '/',
    keywords: 'external control arm, externally controlled trial, rare disease clinical trials, regulatory validation, FDA submission, PICO validation, clinical evidence infrastructure, synthetic control arm, natural history comparator, quantitative bias analysis, ECA validation, comparability assessment, orphan drug development, accelerated approval, single-arm trial design, real-world evidence, biostatistics infrastructure',
  });

  // Auto-open waitlist modal when navigating to /waitlist
  useEffect(() => {
    if (location.pathname === '/waitlist') {
      setShowWaitlist(true);
    }
  }, [location.pathname]);

  const sectionStyle = (bg: string = designSystem.colors.neutral.white): React.CSSProperties => ({
    padding: '96px 32px',
    background: bg,
  });

  const containerStyle: React.CSSProperties = {
    maxWidth: '1100px',
    margin: '0 auto',
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: designSystem.typography.fontFamily.heading,
    color: designSystem.colors.neutral.gray900,
    fontWeight: 700,
  };

  const bodyTextStyle: React.CSSProperties = {
    fontFamily: designSystem.typography.fontFamily.primary,
    color: designSystem.colors.neutral.gray600,
    fontSize: designSystem.typography.fontSize.lg,
    lineHeight: 1.7,
  };

  return (
    <>
      <style>{pulseKeyframes}</style>

      <div style={{ fontFamily: designSystem.typography.fontFamily.primary, color: designSystem.colors.neutral.gray800 }}>

        {/* ===== HEADER ===== */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb', padding: '12px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="Synthetic Ascension" style={{ height: '36px', width: '36px' }} />
            <span style={{
              fontSize: '20px', fontWeight: 700, color: '#6366f1',
              fontFamily: designSystem.typography.fontFamily.heading,
            }}>
              Synthetic Ascension
            </span>
          </Link>
          <button
            onClick={() => setShowWaitlist(true)}
            style={{
              padding: '10px 24px', background: designSystem.colors.primary,
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Join the Waitlist
          </button>
        </header>

        {/* ===== HERO ===== */}
        <section className="landing-hero" style={{
          ...sectionStyle(), paddingTop: '160px', paddingBottom: '96px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Watermark */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', width: '700px', height: '700px',
            backgroundImage: 'url(/logo.png)', backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            opacity: 0.04, pointerEvents: 'none',
          }} />

          <div className="landing-section-padding" style={{ ...containerStyle, position: 'relative', zIndex: 1 }}>
            <p style={{
              fontSize: '14px', fontWeight: 700, color: designSystem.colors.primary,
              textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '16px',
            }}>
              EVIDENCE INFRASTRUCTURE
            </p>
            <h1 style={{
              ...headingStyle, fontSize: '48px', lineHeight: 1.15,
              marginBottom: '24px', maxWidth: '800px',
            }}>
              Your external control arm isn&apos;t ready. We can prove it &mdash; before the FDA does.
            </h1>
            <p style={{
              fontSize: '18px', fontWeight: 500, color: designSystem.colors.neutral.gray700,
              marginBottom: '12px',
            }}>
              For VPs of Clinical Development at rare disease sponsors.
            </p>
            <p style={{
              ...bodyTextStyle, maxWidth: '680px', marginBottom: '40px',
            }}>
              Afarensis is the validation infrastructure that stress-tests your external control
              arm before submission &mdash; surfacing the gaps that lead to Complete Response Letters,
              so your regulatory package holds up to FDA scrutiny.
            </p>
            <div className="landing-hero-buttons" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowSampleOutput(true)}
                style={{
                  padding: '14px 32px', background: designSystem.colors.primary,
                  color: '#fff', border: 'none', borderRadius: '8px',
                  fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                  boxShadow: designSystem.shadows.md,
                }}
              >
                Get Sample Report
              </button>
              <Link
                to="/memo"
                style={{
                  padding: '14px 32px', background: 'transparent',
                  color: designSystem.colors.primary, border: `2px solid ${designSystem.colors.primary}`,
                  borderRadius: '8px', fontSize: '16px', fontWeight: 600,
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}
              >
                Read the Founding Memo &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ===== CRL CARD ===== */}
        <section style={sectionStyle(designSystem.colors.neutral.gray50)}>
          <div className="landing-section-padding" style={containerStyle}>
            <div style={{
              background: '#fff', borderRadius: '16px', padding: '40px',
              boxShadow: designSystem.shadows.lg, border: '1px solid #e5e7eb',
              maxWidth: '800px', margin: '0 auto',
            }}>
              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '20px', padding: '6px 16px', marginBottom: '24px',
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: '#ef4444', display: 'inline-block',
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>
                  Active Enforcement
                </span>
              </div>

              <h3 style={{ ...headingStyle, fontSize: '28px', marginBottom: '8px' }}>
                FDA Complete Response Letter
              </h3>
              <p style={{ fontSize: '16px', fontWeight: 600, color: designSystem.colors.neutral.gray700, marginBottom: '4px' }}>
                REGENXBIO &mdash; RGX-121
              </p>
              <p style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400, marginBottom: '20px' }}>
                February 7, 2026
              </p>
              <p style={{ ...bodyTextStyle, marginBottom: '32px' }}>
                The FDA issued a Complete Response Letter for RGX-121, a gene therapy for Hunter
                syndrome, citing insufficient external control arm validation. The comparator
                population matching, statistical methodology, and evidence traceability did not
                meet regulatory expectations &mdash; despite meaningful clinical signal.
              </p>

              {/* Stats */}
              <div className="landing-crl-stats" style={{ display: 'flex', gap: '24px' }}>
                <div style={{
                  flex: 1, background: designSystem.colors.neutral.gray50,
                  borderRadius: '12px', padding: '24px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '36px', fontWeight: 700, color: designSystem.colors.primary, margin: '0 0 8px' }}>
                    1.1%
                  </p>
                  <p style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, margin: 0 }}>
                    Hunter syndrome prevalence per 100,000 live male births
                  </p>
                </div>
                <div style={{
                  flex: 1, background: designSystem.colors.neutral.gray50,
                  borderRadius: '12px', padding: '24px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '36px', fontWeight: 700, color: designSystem.colors.primary, margin: '0 0 8px' }}>
                    643
                  </p>
                  <p style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, margin: 0 }}>
                    Estimated US patients with severe phenotype
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PROBLEM ===== */}
        <section style={sectionStyle()}>
          <div className="landing-section-padding" style={containerStyle}>
            <h2 style={{ ...headingStyle, fontSize: '36px', marginBottom: '24px', maxWidth: '700px' }}>
              External control arms are failing at the validation layer.
            </h2>
            <p style={{ ...bodyTextStyle, maxWidth: '750px', marginBottom: '20px' }}>
              Sponsors are building external control arms without the infrastructure to validate
              them. The data exists. The statistical methods exist. But the systematic validation
              process that connects raw evidence to regulatory-grade claims does not.
            </p>
            <p style={{ ...bodyTextStyle, maxWidth: '750px' }}>
              The result is predictable: Complete Response Letters, advisory committee failures,
              and delayed approvals for therapies that patients need. The problem is not clinical.
              It is infrastructural.
            </p>
          </div>
        </section>

        {/* ===== STATS ===== */}
        <section style={sectionStyle(designSystem.colors.neutral.gray50)}>
          <div className="landing-section-padding" style={containerStyle}>
            <div className="landing-stats-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px',
            }}>
              {[
                { value: '16.1%', label: 'of FDA submissions using external controls received Complete Response Letters in 2024', citation: 'FDA CDER Annual Report, 2024' },
                { value: '$800K', label: 'average direct cost of a Complete Response Letter resubmission', citation: 'Tufts CSDD, 2023' },
                { value: '2028', label: 'projected year when >30% of rare disease submissions will use external controls', citation: 'McKinsey & Company, 2024' },
              ].map((stat, i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: '16px', padding: '40px 32px',
                  textAlign: 'center', boxShadow: designSystem.shadows.sm,
                  border: '1px solid #e5e7eb',
                }}>
                  <p style={{
                    fontSize: '48px', fontWeight: 700, color: designSystem.colors.primary,
                    margin: '0 0 16px', fontFamily: designSystem.typography.fontFamily.heading,
                  }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: '16px', color: designSystem.colors.neutral.gray600, marginBottom: '12px', lineHeight: 1.5 }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: '12px', color: designSystem.colors.neutral.gray400, fontStyle: 'italic', margin: 0 }}>
                    {stat.citation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FAILURE MODES ===== */}
        <section style={sectionStyle()}>
          <div className="landing-section-padding" style={containerStyle}>
            <h2 style={{ ...headingStyle, fontSize: '36px', marginBottom: '48px', textAlign: 'center' }}>
              Three structural failure modes
            </h2>
            <div className="landing-failure-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px',
            }}>
              {[
                {
                  num: '01',
                  title: 'Population Mismatch',
                  desc: 'External comparators are drawn from populations that differ systematically from the trial population in baseline characteristics, disease severity, or treatment history. Propensity score methods cannot correct what they cannot measure.',
                },
                {
                  num: '02',
                  title: 'Statistical Fragility',
                  desc: 'Treatment effect estimates are sensitive to analytic choices — matching algorithms, covariate sets, outcome definitions — but sensitivity analyses are rarely comprehensive. The FDA sees the fragility before the sponsor does.',
                },
                {
                  num: '03',
                  title: 'Traceability Gaps',
                  desc: 'There is no auditable chain from data source to regulatory claim. Assumptions are implicit. Decisions are undocumented. When the FDA asks "why this comparator?" the answer is often reconstructed, not recorded.',
                },
              ].map((mode, i) => (
                <div key={i} style={{
                  background: designSystem.colors.neutral.gray50, borderRadius: '16px',
                  padding: '32px', border: '1px solid #e5e7eb',
                }}>
                  <p style={{
                    fontSize: '14px', fontWeight: 700, color: designSystem.colors.primary,
                    marginBottom: '12px',
                  }}>
                    {mode.num}
                  </p>
                  <h3 style={{ ...headingStyle, fontSize: '20px', marginBottom: '12px' }}>
                    {mode.title}
                  </h3>
                  <p style={{ fontSize: '15px', color: designSystem.colors.neutral.gray600, lineHeight: 1.7, margin: 0 }}>
                    {mode.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== WHAT WE BUILD ===== */}
        <section style={sectionStyle(designSystem.colors.neutral.gray50)}>
          <div className="landing-section-padding" style={containerStyle}>
            <h2 style={{ ...headingStyle, fontSize: '36px', marginBottom: '24px' }}>
              The Afarensis evidence validation engine
            </h2>
            <p style={{ ...bodyTextStyle, maxWidth: '750px', marginBottom: '20px' }}>
              Afarensis is not a data platform. It is not a statistical package. It is the
              validation infrastructure that sits between your external control arm and the
              FDA&apos;s expectations.
            </p>
            <p style={{ ...bodyTextStyle, maxWidth: '750px', marginBottom: '32px' }}>
              The platform ingests your comparator definition and systematically validates
              every embedded claim: population comparability, covariate balance, outcome
              alignment, statistical sensitivity, and regulatory traceability. It produces
              a structured evidence package — auditable, version-controlled, and reproducible
              — that can be submitted alongside your clinical study report.
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '20px', maxWidth: '750px',
            }}>
              {[
                'Population comparability analysis',
                'Covariate balance assessment',
                'Propensity score validation',
                'Sensitivity & robustness testing',
                'Regulatory traceability chain',
                'Structured evidence packaging',
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: designSystem.colors.primaryLight, color: designSystem.colors.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, flexShrink: 0,
                  }}>
                    &#10003;
                  </span>
                  <span style={{ fontSize: '15px', color: designSystem.colors.neutral.gray700 }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== WHO THIS IS FOR ===== */}
        <section style={sectionStyle()}>
          <div className="landing-section-padding" style={containerStyle}>
            <h2 style={{ ...headingStyle, fontSize: '36px', marginBottom: '32px' }}>
              Who this is for
            </h2>
            <div className="landing-who-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start' }}>
              <div>
                <p style={{ ...bodyTextStyle, marginBottom: '24px' }}>
                  Afarensis is built for teams that are already committed to an external control
                  arm strategy and need to ensure their evidence package will survive regulatory review.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    'You have a Phase 2/3 rare disease program',
                    'You are using or planning an external control arm',
                    'You have experienced or are concerned about CRL risk',
                    'Your regulatory team needs auditable validation',
                    'You want to stress-test your comparator before submission',
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: '#dcfce7', color: '#16a34a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700, flexShrink: 0, marginTop: '2px',
                      }}>
                        &#10003;
                      </span>
                      <span style={{ fontSize: '16px', color: designSystem.colors.neutral.gray700, lineHeight: 1.5 }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{
                background: designSystem.colors.neutral.gray50, borderRadius: '16px',
                padding: '40px', border: '1px solid #e5e7eb', textAlign: 'center',
              }}>
                <h3 style={{ ...headingStyle, fontSize: '22px', marginBottom: '16px' }}>
                  See what Afarensis produces
                </h3>
                <p style={{ fontSize: '15px', color: designSystem.colors.neutral.gray500, marginBottom: '24px' }}>
                  Download a sample validation report showing how we stress-test an external control arm.
                </p>
                <button
                  onClick={() => setShowSampleOutput(true)}
                  style={{
                    padding: '14px 32px', background: designSystem.colors.primary,
                    color: '#fff', border: 'none', borderRadius: '8px',
                    fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Get Sample Report
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== WHY NOW ===== */}
        <section style={sectionStyle(designSystem.colors.neutral.gray50)}>
          <div className="landing-section-padding" style={containerStyle}>
            <h2 style={{ ...headingStyle, fontSize: '36px', marginBottom: '48px' }}>
              Why now
            </h2>
            <div style={{ maxWidth: '700px' }}>
              {[
                { date: 'February 2026', text: 'FDA issues CRL to REGENXBIO for RGX-121 citing external control arm deficiencies' },
                { date: 'Q4 2025', text: 'FDA CDER releases updated guidance on external control design requirements' },
                { date: '2024', text: '16.1% CRL rate for submissions using external controls — highest in five years' },
                { date: '2023-2024', text: 'Three advisory committee rejections cite insufficient comparator validation' },
                { date: '2028 (projected)', text: 'More than 30% of rare disease submissions expected to use external controls' },
              ].map((event, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '24px', marginBottom: '32px',
                  paddingLeft: '24px', borderLeft: `3px solid ${designSystem.colors.primary}`,
                }}>
                  <div style={{ minWidth: '140px' }}>
                    <p style={{
                      fontSize: '14px', fontWeight: 700, color: designSystem.colors.primary,
                      margin: 0, whiteSpace: 'nowrap',
                    }}>
                      {event.date}
                    </p>
                  </div>
                  <p style={{ fontSize: '16px', color: designSystem.colors.neutral.gray600, margin: 0, lineHeight: 1.6 }}>
                    {event.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== TALK TO US ===== */}
        <section style={sectionStyle()}>
          <div className="landing-section-padding" style={{ ...containerStyle, textAlign: 'center' }}>
            <h2 style={{ ...headingStyle, fontSize: '36px', marginBottom: '16px' }}>
              Talk to us
            </h2>
            <p style={{ ...bodyTextStyle, maxWidth: '600px', margin: '0 auto 32px' }}>
              If your external control arm is heading toward submission, we should talk.
              We&apos;ll show you exactly where the validation gaps are.
            </p>
            <button
              onClick={() => setShowContact(true)}
              style={{
                padding: '14px 32px', background: designSystem.colors.primary,
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                marginBottom: '16px', boxShadow: designSystem.shadows.md,
              }}
            >
              Contact Us
            </button>
            <br />
            <Link
              to="/memo"
              style={{
                fontSize: '16px', color: designSystem.colors.primary,
                fontWeight: 600, textDecoration: 'none',
              }}
            >
              Read the Founding Memo &rarr;
            </Link>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer style={{
          background: designSystem.colors.neutral.gray900, color: '#fff',
          padding: '64px 32px 0',
        }}>
          <div className="landing-section-padding" style={containerStyle}>
            <div className="landing-footer-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '48px', marginBottom: '48px',
            }}>
              {/* Company */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <img src="/logo.png" alt="Synthetic Ascension" style={{ height: '28px', width: '28px', filter: 'brightness(2)' }} />
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                    Synthetic Ascension
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400, lineHeight: 1.6 }}>
                  Evidence validation infrastructure for external control arms.
                </p>
              </div>

              {/* Quick Access */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: designSystem.colors.neutral.gray300, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                  Quick Access
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link to="/memo" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400, textDecoration: 'none' }}>
                    Founding Memo
                  </Link>
                  <button
                    onClick={() => setShowContact(true)}
                    style={{
                      background: 'none', border: 'none', color: designSystem.colors.neutral.gray400,
                      fontSize: '14px', cursor: 'pointer', padding: 0, textAlign: 'left',
                    }}
                  >
                    Contact Us
                  </button>
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: designSystem.colors.neutral.gray300, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                  Capabilities
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['Population Matching', 'Covariate Balance', 'Sensitivity Analysis', 'Evidence Packaging'].map((item, i) => (
                    <span key={i} style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400 }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Resources & Contact */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: designSystem.colors.neutral.gray300, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                  Resources
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  <Link to="/memo" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400, textDecoration: 'none' }}>
                    Founding Memo
                  </Link>
                  <Link to="/privacy" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400, textDecoration: 'none' }}>
                    Privacy Policy
                  </Link>
                  <Link to="/terms" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400, textDecoration: 'none' }}>
                    Terms of Service
                  </Link>
                </div>

                <h4 style={{ fontSize: '14px', fontWeight: 700, color: designSystem.colors.neutral.gray300, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Contact
                </h4>
                <p style={{ fontSize: '14px', color: designSystem.colors.neutral.gray400, marginBottom: '8px' }}>
                  Spokane, WA
                </p>
                <button
                  onClick={() => setShowContact(true)}
                  style={{
                    background: 'none', border: 'none', color: designSystem.colors.primary,
                    fontSize: '14px', cursor: 'pointer', padding: 0, fontWeight: 600,
                  }}
                >
                  Send us a message
                </button>
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{
              borderTop: '1px solid #374151', padding: '24px 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '12px',
            }}>
              <p style={{ fontSize: '13px', color: designSystem.colors.neutral.gray500, margin: 0 }}>
                &copy; {new Date().getFullYear()} Synthetic Ascension. All rights reserved.
              </p>
              <div style={{ display: 'flex', gap: '24px' }}>
                <Link to="/privacy" style={{ fontSize: '13px', color: designSystem.colors.neutral.gray500, textDecoration: 'none' }}>
                  Privacy Policy
                </Link>
                <Link to="/terms" style={{ fontSize: '13px', color: designSystem.colors.neutral.gray500, textDecoration: 'none' }}>
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <WaitlistModal isOpen={showWaitlist} onClose={() => setShowWaitlist(false)} leadSource="landing_page" />
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} leadSource="landing_page" />
      <SampleOutputModal isOpen={showSampleOutput} onClose={() => setShowSampleOutput(false)} leadsource="landing_page" />
    </>
  );
}
