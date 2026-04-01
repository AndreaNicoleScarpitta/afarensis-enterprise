import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ContactModal } from '../../components/public/ContactModal';
import { usePageSEO } from '../../hooks/usePageSEO';

const designSystem = {
  colors: {
    primary: '#1e40af',
    primaryLight: '#dbeafe',
    neutral: {
      white: '#ffffff',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray800: '#1f2937',
      gray900: '#111827',
    },
  },
};

interface MemoPageProps {
  onOpenContact?: () => void;
}

export function MemoPage({ onOpenContact }: MemoPageProps) {
  const [showContact, setShowContact] = useState(false);

  usePageSEO({
    title: 'Founding Memo — Why External Control Arm Validation Infrastructure Must Exist',
    description: 'The founding thesis behind Synthetic Ascendancy: why externally controlled trials fail at the validation layer and what infrastructure is needed to fix it for rare disease sponsors.',
    canonicalPath: '/memo',
    keywords: 'external control arm, rare disease, clinical trial validation, founding memo, externally controlled trial, regulatory infrastructure, FDA submission, natural history comparator',
    ogTitle: 'Founding Memo | Synthetic Ascendancy',
    ogDescription: 'Why external control arm validation infrastructure must exist — the founding thesis behind Synthetic Ascendancy.',
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'view_founding_memo', {
        event_category: 'engagement',
        event_label: 'founding_memo',
      });
    }
  }, []);

  const handleOpenWaitlist = () => {
    if (onOpenContact) {
      onOpenContact();
    } else {
      setShowContact(true);
    }
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: designSystem.colors.neutral.gray900,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginTop: '48px',
    marginBottom: '24px',
    fontFamily: '"Montserrat", "Inter", sans-serif',
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: '18px',
    lineHeight: 1.8,
    color: designSystem.colors.neutral.gray600,
    marginBottom: '20px',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const emphasisStyle: React.CSSProperties = {
    color: designSystem.colors.neutral.gray700,
    fontWeight: 600,
  };

  return (
    <>
      <div style={{ minHeight: '100vh', background: designSystem.colors.neutral.white }}>
        {/* Sticky Header */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo.png" alt="Synthetic Ascendancy" style={{ height: '32px', width: '32px' }} />
              <span style={{
                fontSize: '18px',
                fontWeight: 700,
                color: designSystem.colors.primary,
                fontFamily: '"Montserrat", "Inter", sans-serif',
              }}>
                Synthetic Ascendancy
              </span>
            </Link>
            <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Link to="/how-it-works" style={{
                textDecoration: 'none', fontSize: '14px', fontWeight: 500,
                color: designSystem.colors.neutral.gray600,
              }}>
                How It Works
              </Link>
              <Link to="/memo" style={{
                textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                color: designSystem.colors.primary,
                borderBottom: `2px solid ${designSystem.colors.primary}`,
                paddingBottom: '2px',
              }}>
                Founding Memo
              </Link>
            </nav>
          </div>
          <button
            onClick={handleOpenWaitlist}
            style={{
              padding: '10px 24px',
              background: designSystem.colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Join the Waitlist
          </button>
        </header>

        {/* Watermark */}
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          backgroundImage: 'url(/logo.png)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          opacity: 0.04,
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Content */}
        <main style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '64px 32px 96px',
          position: 'relative',
          zIndex: 1,
        }}>
          <p style={{
            fontSize: '14px',
            fontWeight: 700,
            color: designSystem.colors.primary,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            marginBottom: '8px',
          }}>
            SYNTHETIC ASCENSION
          </p>

          <h1 style={{
            fontSize: '36px',
            fontWeight: 700,
            color: designSystem.colors.neutral.gray900,
            marginBottom: '48px',
            fontFamily: '"Montserrat", "Inter", sans-serif',
            lineHeight: 1.2,
          }}>
            A Founding Memo
          </h1>

          {/* THE PATIENT WHO DOESN'T EXIST */}
          <h2 style={sectionHeadingStyle}>THE PATIENT WHO DOESN&apos;T EXIST</h2>
          <p style={bodyStyle}>
            I grew up watching someone I love fight a disease that most doctors will never see.
            Not because she was unlucky, though she was, but because rare diseases are defined
            by their scarcity. The clinical infrastructure built for common conditions does not
            scale down. It scales out, or it doesn&apos;t exist at all.
          </p>
          <p style={bodyStyle}>
            When a disease affects fewer than 200,000 people in the United States, the standard
            tools of drug development begin to break. <span style={emphasisStyle}>Randomized controlled trials require
            large, homogeneous populations.</span> Rare diseases offer neither. The patients are few,
            geographically scattered, and clinically heterogeneous. Recruiting a control arm is
            not just expensive. It is often ethically untenable.
          </p>
          <p style={bodyStyle}>
            And so the field has turned to a workaround: the external control arm. Use historical
            or real-world data to construct a synthetic comparator group. Skip the randomization.
            Compare outcomes against patients who were treated elsewhere, at another time, under
            different conditions.
          </p>
          <p style={bodyStyle}>
            It is an elegant idea. <span style={emphasisStyle}>But it is failing.</span>
          </p>

          {/* THE PROBLEM IS INFRASTRUCTURAL */}
          <h2 style={sectionHeadingStyle}>THE PROBLEM IS INFRASTRUCTURAL</h2>
          <p style={bodyStyle}>
            On February 7, 2026, the FDA issued a Complete Response Letter to REGENXBIO for
            RGX-121, a gene therapy for Hunter syndrome. The therapy had shown meaningful
            clinical signal. But the external control arm used to contextualize those results
            could not withstand regulatory scrutiny.
          </p>
          <p style={bodyStyle}>
            The rejection was not about the therapy. <span style={emphasisStyle}>It was about the evidence
            infrastructure surrounding it.</span> The comparator population was insufficiently
            matched. The statistical methods lacked sensitivity analysis. The validation
            layer between raw data and regulatory claim did not exist in any auditable form.
          </p>
          <p style={bodyStyle}>
            This is not an isolated event. It is a structural pattern. External control arms
            are being used more frequently, in more submissions, across more therapeutic
            areas. But the infrastructure to validate them has not kept pace.
          </p>

          {/* WHY EXTERNAL CONTROLS EXIST */}
          <h2 style={sectionHeadingStyle}>WHY EXTERNAL CONTROLS EXIST</h2>
          <p style={bodyStyle}>
            The FDA has acknowledged, repeatedly, that traditional randomization is not always
            feasible. For rare diseases, pediatric indications, and conditions with high
            unmet need, single-arm trials with external comparators represent a pragmatic path
            to approval.
          </p>
          <p style={bodyStyle}>
            The regulatory framework supports this. <span style={emphasisStyle}>ICH E10 allows external controls
            when randomization is impractical.</span> The 21st Century Cures Act expanded the
            use of real-world evidence. FDA draft guidance documents have outlined expectations
            for external control arm design.
          </p>
          <p style={bodyStyle}>
            But support and infrastructure are not the same thing. The FDA has said what it
            wants. It has not built the tools to help sponsors deliver it. And so each
            submission reinvents the process from scratch, with varying levels of rigor.
          </p>

          {/* WHY NO INFRASTRUCTURE EXISTS */}
          <h2 style={sectionHeadingStyle}>WHY NO INFRASTRUCTURE EXISTS</h2>
          <p style={bodyStyle}>
            The incumbents in this space fall into two categories: <span style={emphasisStyle}>data vendors
            and consulting firms.</span>
          </p>
          <p style={bodyStyle}>
            Data vendors like Flatiron, Tempus, and Aetion provide access to real-world
            datasets. They sell data. They do not validate claims. They do not produce
            the regulatory-grade evidence packages that the FDA requires.
          </p>
          <p style={bodyStyle}>
            Consulting firms like IQVIA, Evidera, and Analysis Group provide bespoke
            statistical services. They are expensive, slow, and non-reproducible. Each
            engagement produces a one-off deliverable that cannot be audited, version-controlled,
            or reused.
          </p>
          <p style={bodyStyle}>
            Neither category builds <span style={emphasisStyle}>infrastructure</span>. Neither produces a
            reusable, auditable validation layer that can be applied across submissions.
          </p>

          {/* WHAT SYNTHETIC ASCENSION BUILDS */}
          <h2 style={sectionHeadingStyle}>WHAT SYNTHETIC ASCENSION BUILDS</h2>
          <p style={bodyStyle}>
            Synthetic Ascendancy builds <span style={emphasisStyle}>Afarensis</span>: the evidence validation
            engine for external control arms.
          </p>
          <p style={bodyStyle}>
            Afarensis does not generate synthetic data. It does not sell datasets. It does
            not provide consulting. It provides the <span style={emphasisStyle}>validation infrastructure</span> that
            sits between a sponsor&apos;s data and the FDA&apos;s expectations.
          </p>
          <p style={bodyStyle}>
            The platform ingests an external control arm definition and systematically
            validates every claim embedded in that definition: population comparability,
            covariate balance, outcome alignment, statistical sensitivity, and regulatory
            traceability. It produces a structured evidence package that can be submitted
            alongside the clinical study report.
          </p>
          <p style={bodyStyle}>
            Every validation step is auditable. Every assumption is traceable. Every output
            is version-controlled and reproducible.
          </p>

          {/* THE NETWORK EFFECT THAT FOLLOWS */}
          <h2 style={sectionHeadingStyle}>THE NETWORK EFFECT THAT FOLLOWS</h2>
          <p style={bodyStyle}>
            There is a reason we think about this as infrastructure and not software.
          </p>
          <p style={bodyStyle}>
            When SWIFT was introduced for interbank messaging, no single bank needed it.
            But once a critical mass adopted it, <span style={emphasisStyle}>the network became the standard.</span> The
            format became the expectation. The infrastructure became invisible.
          </p>
          <p style={bodyStyle}>
            We believe the same dynamic applies to evidence validation. Today, each sponsor
            builds their own validation approach. Tomorrow, the FDA will expect a standard.
            The company that defines that standard will own the infrastructure layer for
            every external control arm submission.
          </p>

          {/* WHY NOW */}
          <h2 style={sectionHeadingStyle}>WHY NOW</h2>
          <p style={bodyStyle}>
            Three forces are converging:
          </p>
          <p style={bodyStyle}>
            <span style={emphasisStyle}>Regulatory pressure is increasing.</span> The REGENXBIO CRL is the
            most visible example, but FDA review divisions are systematically raising
            the bar for external control arm evidence. What was acceptable in 2022 is no
            longer sufficient.
          </p>
          <p style={bodyStyle}>
            <span style={emphasisStyle}>Submission volume is growing.</span> More rare disease programs are
            entering Phase 3. More sponsors are using external controls. The demand for
            validation infrastructure is increasing faster than the supply.
          </p>
          <p style={bodyStyle}>
            <span style={emphasisStyle}>The cost of failure is rising.</span> A Complete Response Letter
            costs a sponsor an average of $800K in direct regulatory costs and months
            of delay. For rare disease programs, it can mean the difference between
            approval and abandonment.
          </p>

          {/* WHY WE BUILD THIS */}
          <h2 style={sectionHeadingStyle}>WHY WE BUILD THIS</h2>
          <p style={bodyStyle}>
            We build this because the patient who doesn&apos;t exist in a randomized trial
            still exists in the world. She is still fighting her disease. She is still
            waiting for a therapy that works.
          </p>
          <p style={bodyStyle}>
            The evidence infrastructure that connects her to that therapy should not be
            improvised. It should not be rebuilt from scratch for every submission. It
            should not fail at the regulatory layer because no one built the validation
            tools.
          </p>
          <p style={bodyStyle}>
            <span style={emphasisStyle}>We are building those tools.</span>
          </p>
          <p style={{ ...bodyStyle, marginTop: '48px', fontStyle: 'italic', color: designSystem.colors.neutral.gray500 }}>
            &mdash; The Synthetic Ascendancy Team
          </p>
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid #e5e7eb',
          padding: '32px',
          textAlign: 'center',
          background: designSystem.colors.neutral.gray50,
        }}>
          <p style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, marginBottom: '16px' }}>
            &copy; {new Date().getFullYear()} Synthetic Ascendancy. All rights reserved.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenWaitlist}
              style={{
                padding: '10px 24px',
                background: designSystem.colors.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Join the Waitlist
            </button>
            <Link
              to="/"
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: designSystem.colors.primary,
                border: `1px solid ${designSystem.colors.primary}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              &larr; Back to Home
            </Link>
          </div>
        </footer>
      </div>

      <ContactModal
        isOpen={showContact}
        onClose={() => setShowContact(false)}
        leadSource="memo_page"
        leadIntent="waitlist"
      />
    </>
  );
}

export default MemoPage;
