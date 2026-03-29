import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ContactModal } from '../../components/public/ContactModal';
import { usePageSEO } from '../../hooks/usePageSEO';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

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
      mono: '"JetBrains Mono", monospace',
    },
  },
};

/* ─── CSS Mockup Components ──────────────────────────────────────────── */
/* These render stylized representations of each Afarensis screen.      */
/* Replace any of these with <img src="/screenshots/xxx.png"> when       */
/* real screenshots are available.                                       */

const mockupFrame: React.CSSProperties = {
  background: '#0f172a',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
  width: '100%',
  maxWidth: '720px',
};

const mockupTitleBar: React.CSSProperties = {
  background: '#1e293b',
  padding: '10px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  borderBottom: '1px solid #334155',
};

const mockupDot = (color: string): React.CSSProperties => ({
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  background: color,
});

const mockupBody: React.CSSProperties = {
  padding: '24px',
  minHeight: '300px',
  fontFamily: designSystem.typography.fontFamily.mono,
  fontSize: '13px',
  color: '#94a3b8',
  lineHeight: 1.6,
};

interface ScreenMockupProps {
  title: string;
  children: React.ReactNode;
  imageSrc?: string;
}

function ScreenMockup({ title, children, imageSrc }: ScreenMockupProps) {
  if (imageSrc) {
    return (
      <div style={mockupFrame}>
        <div style={mockupTitleBar}>
          <div style={mockupDot('#ef4444')} />
          <div style={mockupDot('#f59e0b')} />
          <div style={mockupDot('#22c55e')} />
          <span style={{ marginLeft: '12px', fontSize: '12px', color: '#94a3b8', fontFamily: designSystem.typography.fontFamily.mono }}>{title}</span>
        </div>
        <img src={imageSrc} alt={title} style={{ width: '100%', display: 'block' }} />
      </div>
    );
  }
  return (
    <div style={mockupFrame}>
      <div style={mockupTitleBar}>
        <div style={mockupDot('#ef4444')} />
        <div style={mockupDot('#f59e0b')} />
        <div style={mockupDot('#22c55e')} />
        <span style={{ marginLeft: '12px', fontSize: '12px', color: '#94a3b8', fontFamily: designSystem.typography.fontFamily.mono }}>{title}</span>
      </div>
      <div style={mockupBody}>
        {children}
      </div>
    </div>
  );
}

/* ─── Mockup line helpers ────────────────────────────────────────────── */
const MLabel = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#7c3aed', fontWeight: 600 }}>{children}</span>
);
const MValue = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#22d3ee' }}>{children}</span>
);
const MComment = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#475569', fontStyle: 'italic' }}>{children}</span>
);
const MKey = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#f59e0b' }}>{children}</span>
);
const MString = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: '#34d399' }}>{children}</span>
);
const MBadge = ({ children, color = '#3b82f6' }: { children: React.ReactNode; color?: string }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
    background: color + '22', color, fontSize: '11px', fontWeight: 600,
    border: `1px solid ${color}44`,
  }}>{children}</span>
);

/* ─── Individual Screen Mockups ──────────────────────────────────────── */

function DashboardMockup() {
  return (
    <ScreenMockup title="Afarensis — Dashboard" >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 600, fontFamily: designSystem.typography.fontFamily.primary }}>Evidence Review Projects</div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>3 active · 1 archived</div>
          </div>
          <div style={{ padding: '6px 14px', background: '#1e40af', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600 }}>+ New Project</div>
        </div>
        {[
          { name: 'XY-301 Gene Therapy — CLN2 Batten Disease', status: 'In Review', progress: 75, color: '#3b82f6' },
          { name: 'MRD-445 — Autoimmune Hepatitis Phase 3', status: 'Draft', progress: 30, color: '#f59e0b' },
          { name: 'NPC-201 — Niemann-Pick Type C', status: 'Submitted', progress: 100, color: '#22c55e' },
        ].map((p, i) => (
          <div key={i} style={{ background: '#1e293b', borderRadius: '8px', padding: '14px', marginBottom: '10px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{p.name}</span>
              <MBadge color={p.color}>{p.status}</MBadge>
            </div>
            <div style={{ marginTop: '10px', background: '#0f172a', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${p.progress}%`, height: '100%', background: p.color, borderRadius: '4px', transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>{p.progress}% complete · 12-step validation pipeline</div>
          </div>
        ))}
      </div>
    </ScreenMockup>
  );
}

function StudyDefinitionMockup() {
  return (
    <ScreenMockup title="Afarensis — Study Definition (PICO/PECO)" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          PICO Framework Definition
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {[
            { key: 'P', label: 'Population', value: 'Pediatric CLN2 Batten disease patients, aged 2–10, confirmed TPP1 mutation' },
            { key: 'I', label: 'Intervention', value: 'XY-301 intracerebroventricular enzyme replacement, 300 mg Q2W × 48 weeks' },
            { key: 'C', label: 'Comparator', value: 'DEM-CHILD Natural History Registry (n=42), matched on age, genotype, baseline CLN2 score' },
            { key: 'O', label: 'Outcome', value: 'Change in CLN2 Motor-Language Score at Week 48 vs. natural history trajectory' },
          ].map((item) => (
            <div key={item.key} style={{ background: '#1e293b', borderRadius: '8px', padding: '12px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', borderRadius: '6px',
                  background: '#1e40af', color: '#fff', fontSize: '12px', fontWeight: 700,
                }}>{item.key}</span>
                <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5 }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px', padding: '10px', background: '#0f172a', borderRadius: '6px', border: '1px solid #1e3a5f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>PICO definition validated against ICH E10 requirements</span>
          </div>
        </div>
      </div>
    </ScreenMockup>
  );
}

function CausalFrameworkMockup() {
  return (
    <ScreenMockup title="Afarensis — Causal Framework (DAG)" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          Directed Acyclic Graph — Causal Assumptions
        </div>
        {/* DAG Visualization */}
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155', textAlign: 'center' }}>
          <svg viewBox="0 0 500 200" style={{ width: '100%', maxWidth: '460px' }}>
            {/* Nodes */}
            <rect x="10" y="80" width="90" height="36" rx="8" fill="#1e40af" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="55" y="103" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" fontFamily="Inter">Treatment</text>

            <rect x="200" y="80" width="90" height="36" rx="8" fill="#7c3aed" stroke="#8b5cf6" strokeWidth="1.5" />
            <text x="245" y="103" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" fontFamily="Inter">CLN2 Score</text>

            <rect x="130" y="10" width="90" height="36" rx="8" fill="#0891b2" stroke="#22d3ee" strokeWidth="1.5" />
            <text x="175" y="33" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" fontFamily="Inter">Age</text>

            <rect x="130" y="150" width="90" height="36" rx="8" fill="#0891b2" stroke="#22d3ee" strokeWidth="1.5" />
            <text x="175" y="173" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" fontFamily="Inter">Genotype</text>

            <rect x="370" y="80" width="110" height="36" rx="8" fill="#059669" stroke="#34d399" strokeWidth="1.5" />
            <text x="425" y="103" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" fontFamily="Inter">Motor Function</text>

            {/* Edges */}
            <line x1="100" y1="98" x2="200" y2="98" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="175" y1="46" x2="55" y2="80" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="175" y1="46" x2="245" y2="80" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="175" y1="150" x2="55" y2="116" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="175" y1="150" x2="245" y2="116" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="290" y1="98" x2="370" y2="98" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow)" />

            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
            </defs>
          </svg>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <MBadge color="#3b82f6">Exposure</MBadge>
          <MBadge color="#8b5cf6">Primary Outcome</MBadge>
          <MBadge color="#22d3ee">Confounders</MBadge>
          <MBadge color="#34d399">Secondary Outcome</MBadge>
        </div>
        <div style={{ marginTop: '12px', color: '#64748b', fontSize: '11px' }}>
          5 nodes · 6 edges · 2 confounders identified · No backdoor paths unblocked
        </div>
      </div>
    </ScreenMockup>
  );
}

function ComparabilityMockup() {
  return (
    <ScreenMockup title="Afarensis — Comparability & Balance" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          Covariate Balance Assessment
        </div>
        {/* Love Plot */}
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '16px', border: '1px solid #334155', marginBottom: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Standardized Mean Differences (Love Plot)
          </div>
          {[
            { name: 'Age', before: 0.42, after: 0.08 },
            { name: 'Baseline CLN2', before: 0.35, after: 0.05 },
            { name: 'Genotype (severe)', before: 0.28, after: 0.12 },
            { name: 'Sex (female)', before: 0.15, after: 0.03 },
            { name: 'Disease duration', before: 0.51, after: 0.09 },
          ].map((cv, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ color: '#cbd5e1', fontSize: '12px', width: '120px', textAlign: 'right' }}>{cv.name}</span>
              <div style={{ flex: 1, position: 'relative', height: '16px', background: '#0f172a', borderRadius: '4px' }}>
                {/* Threshold line */}
                <div style={{ position: 'absolute', left: '20%', top: 0, bottom: 0, width: '1px', background: '#f59e0b44' }} />
                {/* Before */}
                <div style={{
                  position: 'absolute', left: `${cv.before * 100}%`, top: '2px',
                  width: '8px', height: '12px', borderRadius: '2px',
                  background: '#ef4444', opacity: 0.7,
                }} />
                {/* After */}
                <div style={{
                  position: 'absolute', left: `${cv.after * 100}%`, top: '2px',
                  width: '8px', height: '12px', borderRadius: '2px',
                  background: '#22c55e',
                }} />
              </div>
              <span style={{ color: '#22c55e', fontSize: '11px', width: '40px' }}>{cv.after.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px' }}>
            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px', marginRight: '4px' }} />Before matching</span>
            <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#22c55e', borderRadius: '2px', marginRight: '4px' }} />After PS matching</span>
            <span><span style={{ display: 'inline-block', width: '1px', height: '8px', background: '#f59e0b', marginRight: '4px' }} />SMD threshold (0.2)</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <MBadge color="#22c55e">All covariates balanced (SMD &lt; 0.2)</MBadge>
          <MBadge color="#3b82f6">Propensity score overlap: 94.3%</MBadge>
        </div>
      </div>
    </ScreenMockup>
  );
}

function EffectEstimationMockup() {
  return (
    <ScreenMockup title="Afarensis — Effect Estimation" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          Treatment Effect Analysis
        </div>
        {/* KM Curve */}
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '16px', border: '1px solid #334155', marginBottom: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Kaplan-Meier Survival Curves
          </div>
          <svg viewBox="0 0 400 180" style={{ width: '100%' }}>
            {/* Grid */}
            {[0, 45, 90, 135, 180].map((y) => (
              <line key={y} x1="40" y1={y} x2="380" y2={y} stroke="#334155" strokeWidth="0.5" />
            ))}
            {/* Axes */}
            <line x1="40" y1="0" x2="40" y2="180" stroke="#475569" strokeWidth="1" />
            <line x1="40" y1="180" x2="380" y2="180" stroke="#475569" strokeWidth="1" />
            {/* Treatment arm */}
            <polyline points="40,10 80,12 120,15 160,18 200,22 240,28 280,35 320,42 360,50" fill="none" stroke="#3b82f6" strokeWidth="2" />
            {/* Control arm */}
            <polyline points="40,10 80,25 120,45 160,68 200,88 240,105 280,120 320,138 360,155" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6,3" />
            {/* Labels */}
            <text x="365" y="48" fill="#3b82f6" fontSize="10" fontWeight="600">XY-301</text>
            <text x="365" y="153" fill="#94a3b8" fontSize="10" fontWeight="600">ECA</text>
            <text x="200" y="175" textAnchor="middle" fill="#64748b" fontSize="9">Weeks</text>
            <text x="35" y="95" textAnchor="end" fill="#64748b" fontSize="9" transform="rotate(-90,35,95)">Event-free (%)</text>
          </svg>
        </div>
        {/* Results */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Hazard Ratio', value: '0.38', ci: '95% CI: 0.21–0.69' },
            { label: 'P-value', value: 'p = 0.0014', ci: 'Log-rank test' },
            { label: 'E-value', value: '4.72', ci: 'Robust to unmeasured confounding' },
          ].map((r, i) => (
            <div key={i} style={{ background: '#1e293b', borderRadius: '6px', padding: '10px', border: '1px solid #334155', textAlign: 'center' }}>
              <div style={{ color: '#22d3ee', fontSize: '18px', fontWeight: 700 }}>{r.value}</div>
              <div style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>{r.label}</div>
              <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>{r.ci}</div>
            </div>
          ))}
        </div>
      </div>
    </ScreenMockup>
  );
}

function BiasSensitivityMockup() {
  return (
    <ScreenMockup title="Afarensis — Quantitative Bias Analysis" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          Sensitivity & Bias Analysis
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px', border: '1px solid #334155' }}>
            <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>E-Value Analysis</div>
            <div style={{ color: '#22d3ee', fontSize: '28px', fontWeight: 700 }}>4.72</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Point estimate E-value</div>
            <div style={{ marginTop: '8px', padding: '6px 8px', background: '#0f172a', borderRadius: '4px' }}>
              <div style={{ color: '#34d399', fontSize: '11px' }}>Lower bound CI: 2.31</div>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>An unmeasured confounder would need RR ≥ 4.72 with both treatment and outcome to explain away the effect</div>
            </div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px', border: '1px solid #334155' }}>
            <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Tipping Point Analysis</div>
            <div style={{ color: '#f59e0b', fontSize: '28px', fontWeight: 700 }}>68%</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Of control patients would need reclassification to null result</div>
            <div style={{ marginTop: '8px', padding: '6px 8px', background: '#0f172a', borderRadius: '4px' }}>
              <div style={{ color: '#34d399', fontSize: '11px' }}>Result is robust</div>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>Threshold for concern: &lt;20%</div>
            </div>
          </div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px', border: '1px solid #334155' }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Bias Parameters Assessed</div>
          {[
            { name: 'Selection bias', status: 'Low', color: '#22c55e' },
            { name: 'Measurement bias', status: 'Low', color: '#22c55e' },
            { name: 'Confounding (residual)', status: 'Moderate', color: '#f59e0b' },
            { name: 'Time-related bias', status: 'Low', color: '#22c55e' },
            { name: 'Missing data bias', status: 'Low', color: '#22c55e' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 4 ? '1px solid #1e293b' : 'none' }}>
              <span style={{ color: '#cbd5e1', fontSize: '12px' }}>{b.name}</span>
              <MBadge color={b.color}>{b.status}</MBadge>
            </div>
          ))}
        </div>
      </div>
    </ScreenMockup>
  );
}

function RegulatoryAttackMockup() {
  return (
    <ScreenMockup title="Afarensis — Regulatory Stress Test" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          Adversarial Regulatory Review Simulation
        </div>
        <div style={{ background: '#1e293b', borderRadius: '8px', padding: '14px', border: '1px solid #334155', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 700 }}>!</span>
            <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>FDA Reviewer Challenge Vectors</span>
          </div>
          {[
            { q: '"How do you account for the 3-year gap between your natural history cohort and the trial enrollment period?"', severity: 'HIGH', color: '#ef4444' },
            { q: '"The DEM-CHILD registry uses a different CLN2 scoring protocol. How were scores harmonized?"', severity: 'MEDIUM', color: '#f59e0b' },
            { q: '"Your propensity score model includes 8 covariates for 42 control patients. What is the effective sample size?"', severity: 'HIGH', color: '#ef4444' },
            { q: '"Provide sensitivity analyses under the assumption that unmeasured confounders exist with RR=2."', severity: 'MEDIUM', color: '#f59e0b' },
          ].map((challenge, i) => (
            <div key={i} style={{ padding: '10px', background: '#0f172a', borderRadius: '6px', marginBottom: '8px', borderLeft: `3px solid ${challenge.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b', fontSize: '10px' }}>Challenge {i + 1}</span>
                <MBadge color={challenge.color}>{challenge.severity}</MBadge>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '12px', fontStyle: 'italic', lineHeight: 1.5 }}>{challenge.q}</div>
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#22c55e', fontSize: '12px' }}>✓</span>
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>Pre-addressed in evidence package</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <MBadge color="#22c55e">4/4 challenges pre-addressed</MBadge>
          <MBadge color="#3b82f6">Regulatory readiness: 92%</MBadge>
        </div>
      </div>
    </ScreenMockup>
  );
}

function RegulatoryOutputMockup() {
  return (
    <ScreenMockup title="Afarensis — Regulatory Evidence Package" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          Export: Submission-Ready Evidence Package
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            { name: 'Clinical Study Report — ECA Supplement', format: 'PDF', size: '2.4 MB', icon: 'CSR', status: 'Generated' },
            { name: 'ADaM ADSL (Analysis Dataset)', format: 'XPT', size: '340 KB', icon: 'XPT', status: 'Generated' },
            { name: 'ADaM ADTTE (Time-to-Event)', format: 'XPT', size: '180 KB', icon: 'XPT', status: 'Generated' },
            { name: 'Statistical Analysis Plan', format: 'PDF', size: '890 KB', icon: 'SAP', status: 'Generated' },
            { name: 'Covariate Balance Tables (TFL)', format: 'PDF', size: '1.1 MB', icon: 'TFL', status: 'Generated' },
            { name: 'Kaplan-Meier Figures (TFL)', format: 'PDF', size: '520 KB', icon: 'TFL', status: 'Generated' },
            { name: 'Bias Analysis Report', format: 'PDF', size: '680 KB', icon: 'QBA', status: 'Generated' },
            { name: 'Audit Trail & Provenance Log', format: 'JSON', size: '95 KB', icon: 'LOG', status: 'Generated' },
          ].map((doc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: '#1e293b', borderRadius: '6px', padding: '10px 14px',
              border: '1px solid #334155',
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', fontFamily: designSystem.typography.fontFamily.mono, background: '#1e40af22', padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.05em' }}>{doc.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>{doc.name}</div>
                <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>{doc.format} · {doc.size}</div>
              </div>
              <MBadge color="#22c55e">{doc.status}</MBadge>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
          <div style={{ padding: '8px 16px', background: '#1e40af', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600 }}>Download Package (.zip)</div>
          <div style={{ padding: '8px 16px', background: '#334155', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>Export to eCTD</div>
        </div>
      </div>
    </ScreenMockup>
  );
}

function AuditTrailMockup() {
  return (
    <ScreenMockup title="Afarensis — Audit Trail" >
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: designSystem.typography.fontFamily.primary }}>
          Immutable Audit History — CFR Part 11 Compliant
        </div>
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
          <div style={{ position: 'absolute', left: '8px', top: 0, bottom: 0, width: '2px', background: '#334155' }} />
          {[
            { action: 'Evidence package exported', user: 'Dr. Rachel Kim', time: '2 hours ago', type: 'export' },
            { action: 'Bias sensitivity analysis completed (E-value: 4.72)', user: 'System', time: '3 hours ago', type: 'analysis' },
            { action: 'Propensity score model updated — added disease duration covariate', user: 'James Chen, MSc', time: '5 hours ago', type: 'edit' },
            { action: 'Covariate balance review approved', user: 'Dr. Rachel Kim', time: '1 day ago', type: 'approval' },
            { action: 'External control cohort definition locked (v3)', user: 'Dr. Rachel Kim', time: '1 day ago', type: 'lock' },
            { action: 'DEM-CHILD registry data linked (n=42)', user: 'System', time: '2 days ago', type: 'data' },
            { action: 'PICO framework definition created', user: 'James Chen, MSc', time: '3 days ago', type: 'create' },
          ].map((entry, i) => (
            <div key={i} style={{ marginBottom: '14px', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '-20px', top: '4px',
                width: '12px', height: '12px', borderRadius: '50%',
                background: entry.type === 'approval' ? '#22c55e' : entry.type === 'lock' ? '#f59e0b' : '#3b82f6',
                border: '2px solid #0f172a',
              }} />
              <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>{entry.action}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                {entry.user} · {entry.time}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '8px', padding: '8px 12px', background: '#1e293b', borderRadius: '6px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 700 }}>&#x2713;</span>
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>All entries are cryptographically signed and immutable. SHA-256 chain verified.</span>
          </div>
        </div>
      </div>
    </ScreenMockup>
  );
}

/* ─── Step Component ─────────────────────────────────────────────────── */
interface StepSectionProps {
  stepNumber: number;
  title: string;
  subtitle: string;
  description: React.ReactNode;
  capabilities: string[];
  mockup: React.ReactNode;
  reversed?: boolean;
}

function StepSection({ stepNumber, title, subtitle, description, capabilities, mockup, reversed }: StepSectionProps) {
  return (
    <section style={{
      padding: '80px 32px',
      background: stepNumber % 2 === 0 ? designSystem.colors.neutral.gray50 : designSystem.colors.neutral.white,
    }}>
      <div className="hiw-step-grid" style={{
        maxWidth: '1200px', margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px',
        alignItems: 'center',
      }}>
        <div style={{ order: reversed ? 2 : 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            marginBottom: '16px',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '10px',
              background: designSystem.colors.primary, color: '#fff',
              fontSize: '16px', fontWeight: 700,
              fontFamily: designSystem.typography.fontFamily.heading,
            }}>{stepNumber}</span>
            <span style={{
              fontSize: '13px', fontWeight: 600, color: designSystem.colors.primary,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>{subtitle}</span>
          </div>
          <h2 style={{
            fontSize: '32px', fontWeight: 700, color: designSystem.colors.neutral.gray900,
            fontFamily: designSystem.typography.fontFamily.heading,
            lineHeight: 1.2, marginBottom: '20px',
          }}>{title}</h2>
          <div style={{
            fontSize: '17px', lineHeight: 1.7, color: designSystem.colors.neutral.gray600,
            fontFamily: designSystem.typography.fontFamily.primary,
            marginBottom: '24px',
          }}>{description}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {capabilities.map((cap, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: '#dcfce7', color: '#16a34a', fontSize: '12px', marginTop: '2px',
                }}>✓</span>
                <span style={{ fontSize: '15px', color: designSystem.colors.neutral.gray700 }}>{cap}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ order: reversed ? 1 : 2 }}>
          {mockup}
        </div>
      </div>
    </section>
  );
}

/* ─── Main Page Component ────────────────────────────────────────────── */

interface HowItWorksPageProps {
  onOpenWaitlist?: () => void;
}

export function HowItWorksPage({ onOpenWaitlist }: HowItWorksPageProps) {
  const [showContact, setShowContact] = useState(false);

  usePageSEO({
    title: 'How It Works — External Control Arm Validation for Rare Disease FDA Submissions',
    description: 'Afarensis validates external control arms through a 7-step evidence pipeline: PICO definition, causal framework modeling, propensity score matching, treatment effect estimation, quantitative bias analysis, regulatory stress testing, and CDISC-compliant evidence package generation. Purpose-built for rare disease sponsors preparing single-arm trial FDA submissions with externally controlled comparators.',
    canonicalPath: '/how-it-works',
    keywords: 'external control arm, ECA validation, externally controlled trial, single-arm trial FDA submission, rare disease clinical trial, propensity score matching, IPTW, covariate balance, love plot, kaplan-meier, cox proportional hazards, e-value, tipping point analysis, quantitative bias analysis, CDISC ADaM, regulatory evidence package, ICH E10, natural history comparator, real-world evidence, CFR Part 11 audit trail, FDA complete response letter prevention, clinical study report supplement',
    ogTitle: 'How Afarensis Validates External Control Arms | Synthetic Ascension',
    ogDescription: 'From raw comparator data to regulatory-ready evidence package in 7 steps. Propensity score matching, bias analysis, regulatory stress testing, and CDISC-compliant exports for rare disease FDA submissions.',
  });

  // Inject JSON-LD structured data for SEO
  useEffect(() => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Validate an External Control Arm for FDA Submission',
      description: 'A 7-step evidence validation pipeline that transforms external control arm data into defensible, auditable regulatory evidence packages for rare disease FDA submissions.',
      totalTime: 'P7D',
      tool: {
        '@type': 'SoftwareApplication',
        name: 'Afarensis',
        applicationCategory: 'Clinical Trial Software',
        operatingSystem: 'Web-based',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/ComingSoon' },
      },
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Study Definition', text: 'Define your clinical question using the PICO/PECO framework with ICH E10 regulatory cross-referencing.' },
        { '@type': 'HowToStep', position: 2, name: 'Causal Framework', text: 'Map causal assumptions with a directed acyclic graph (DAG) to identify confounders and backdoor paths.' },
        { '@type': 'HowToStep', position: 3, name: 'Comparability Assessment', text: 'Run propensity score matching, IPTW, and exact matching with love plots and balance diagnostics.' },
        { '@type': 'HowToStep', position: 4, name: 'Effect Estimation', text: 'Estimate treatment effects with Cox proportional hazards, Kaplan-Meier curves, and forest plots.' },
        { '@type': 'HowToStep', position: 5, name: 'Bias & Sensitivity Analysis', text: 'Compute E-values, tipping point analyses, and probabilistic bias analysis for unmeasured confounding.' },
        { '@type': 'HowToStep', position: 6, name: 'Regulatory Stress Test', text: 'Simulate FDA reviewer challenge vectors derived from real complete response letters and advisory committee transcripts.' },
        { '@type': 'HowToStep', position: 7, name: 'Evidence Package Export', text: 'Export CDISC ADaM datasets, TFLs, statistical analysis plans, and cryptographically signed audit trails.' },
      ],
    };
    let script = document.querySelector('script[data-schema="how-it-works"]') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-schema', 'how-it-works');
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    // FAQ schema
    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What is an external control arm?', acceptedAnswer: { '@type': 'Answer', text: 'An external control arm (ECA) is a comparator group constructed from patients outside the clinical trial — typically from natural history registries, electronic health records, or prior clinical studies. ECAs are used when randomization is not feasible, particularly in rare disease trials.' } },
        { '@type': 'Question', name: 'Why do external control arm submissions fail at the FDA?', acceptedAnswer: { '@type': 'Answer', text: 'The most common reasons include insufficient population comparability, lack of sensitivity analyses for unmeasured confounding, inadequate covariate balance documentation, and absence of a structured validation layer between raw data and regulatory claims.' } },
        { '@type': 'Question', name: 'How does Afarensis differ from data vendors like Flatiron or Tempus?', acceptedAnswer: { '@type': 'Answer', text: 'Data vendors provide access to real-world datasets. Afarensis validates the claims you make with that data, providing evidence validation infrastructure that produces auditable, reproducible regulatory evidence packages.' } },
        { '@type': 'Question', name: 'What statistical methods does Afarensis support?', acceptedAnswer: { '@type': 'Answer', text: 'Propensity score matching, IPTW, exact matching, Cox proportional hazards, Kaplan-Meier survival estimation, E-value computation, tipping point analysis, probabilistic bias analysis, and forest plots across pre-specified subgroups.' } },
        { '@type': 'Question', name: 'What file formats does Afarensis export?', acceptedAnswer: { '@type': 'Answer', text: 'CDISC ADaM-compliant datasets (ADSL, ADTTE, ADAE) in XPT format, publication-quality TFLs in PDF, statistical analysis plans, quantitative bias analysis reports, and cryptographically signed audit trails for eCTD submission.' } },
        { '@type': 'Question', name: 'Is Afarensis CFR Part 11 compliant?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Every action is logged with user attribution, timestamps, and cryptographic verification (SHA-256 chain). The platform supports electronic signature workflows and exportable audit logs for regulatory inspection.' } },
      ],
    };
    let faqScript = document.querySelector('script[data-schema="faq"]') as HTMLScriptElement | null;
    if (!faqScript) {
      faqScript = document.createElement('script');
      faqScript.type = 'application/ld+json';
      faqScript.setAttribute('data-schema', 'faq');
      document.head.appendChild(faqScript);
    }
    faqScript.textContent = JSON.stringify(faqJsonLd);

    // Also inject Organization schema
    const orgJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Synthetic Ascension',
      url: 'https://syntheticascendancy.tech',
      description: 'Evidence validation infrastructure for external control arm submissions in rare disease clinical trials.',
      sameAs: [],
    };
    let orgScript = document.querySelector('script[data-schema="organization"]') as HTMLScriptElement | null;
    if (!orgScript) {
      orgScript = document.createElement('script');
      orgScript.type = 'application/ld+json';
      orgScript.setAttribute('data-schema', 'organization');
      document.head.appendChild(orgScript);
    }
    orgScript.textContent = JSON.stringify(orgJsonLd);

    return () => {
      script?.remove();
      faqScript?.remove();
      orgScript?.remove();
    };
  }, []);

  // GA4 page view + engagement tracking
  useEffect(() => {
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: 'How It Works',
        page_location: window.location.href,
        page_path: '/how-it-works',
      });
      window.gtag('event', 'view_how_it_works', {
        event_category: 'engagement',
        event_label: 'how_it_works_page',
      });
    }
  }, []);

  const handleOpenWaitlist = () => {
    if (window.gtag) {
      window.gtag('event', 'cta_click', {
        event_category: 'engagement',
        event_label: 'waitlist_from_how_it_works',
        page: '/how-it-works',
      });
    }
    if (onOpenWaitlist) {
      onOpenWaitlist();
    } else {
      setShowContact(true);
    }
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .hiw-step-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .hiw-step-grid > div {
            order: unset !important;
          }
          .hiw-hero-title {
            font-size: 32px !important;
          }
          .hiw-pipeline-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .hiw-pipeline-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ fontFamily: designSystem.typography.fontFamily.primary, color: designSystem.colors.neutral.gray800 }}>

        {/* ===== HEADER ===== */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb', padding: '12px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo.png" alt="Synthetic Ascension" style={{ height: '36px', width: '36px' }} />
              <span style={{
                fontSize: '20px', fontWeight: 700, color: '#6366f1',
                fontFamily: designSystem.typography.fontFamily.heading,
              }}>
                Synthetic Ascension
              </span>
            </Link>
            <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Link to="/how-it-works" style={{
                textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                color: designSystem.colors.primary,
                borderBottom: `2px solid ${designSystem.colors.primary}`,
                paddingBottom: '2px',
              }}>
                How It Works
              </Link>
              <Link to="/memo" style={{
                textDecoration: 'none', fontSize: '14px', fontWeight: 500,
                color: designSystem.colors.neutral.gray600,
              }}>
                Founding Memo
              </Link>
            </nav>
          </div>
          <button
            onClick={handleOpenWaitlist}
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
        <section style={{
          paddingTop: '140px', paddingBottom: '80px', textAlign: 'center',
          background: `linear-gradient(180deg, ${designSystem.colors.neutral.white} 0%, ${designSystem.colors.neutral.gray50} 100%)`,
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 32px' }}>
            <p style={{
              fontSize: '14px', fontWeight: 700, color: designSystem.colors.primary,
              textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '16px',
            }}>
              HOW IT WORKS
            </p>
            <h1 className="hiw-hero-title" style={{
              fontSize: '44px', fontWeight: 700, color: designSystem.colors.neutral.gray900,
              fontFamily: designSystem.typography.fontFamily.heading,
              lineHeight: 1.15, marginBottom: '24px',
            }}>
              From raw comparator data to regulatory-ready evidence package
            </h1>
            <p style={{
              fontSize: '19px', lineHeight: 1.7, color: designSystem.colors.neutral.gray600,
              maxWidth: '640px', margin: '0 auto 24px',
            }}>
              Afarensis implements a systematic validation pipeline that transforms
              external control arm data into defensible, auditable evidence — before your
              submission reaches a reviewer.
            </p>
            <p style={{
              fontSize: '15px', lineHeight: 1.7, color: designSystem.colors.neutral.gray500,
              maxWidth: '640px', margin: '0 auto 40px',
            }}>
              Purpose-built for rare disease sponsors conducting single-arm trials with
              natural history or real-world data comparators. Aligned with ICH E10, FDA draft
              guidance on externally controlled trials, and 21st Century Cures Act frameworks.
            </p>
          </div>

          {/* Pipeline Overview */}
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 32px' }}>
            <div className="hiw-pipeline-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
            }}>
              {[
                { num: '1', label: 'Define' },
                { num: '2', label: 'Model' },
                { num: '3', label: 'Balance' },
                { num: '4', label: 'Estimate' },
                { num: '5', label: 'Stress-Test' },
                { num: '6', label: 'Attack' },
                { num: '7', label: 'Export' },
                { num: '\u221E', label: 'Audit' },
              ].map((step, i) => (
                <div key={i} style={{
                  background: designSystem.colors.neutral.white,
                  borderRadius: '10px', padding: '16px 12px',
                  border: `1px solid ${designSystem.colors.neutral.gray200}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: designSystem.colors.primary, color: '#fff',
                    fontSize: '14px', fontWeight: 700, marginBottom: '6px',
                    fontFamily: designSystem.typography.fontFamily.heading,
                  }}>{step.num}</div>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, color: designSystem.colors.primary,
                    marginBottom: '2px',
                  }}>STEP {step.num}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: designSystem.colors.neutral.gray800 }}>{step.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== STEPS ===== */}

        <StepSection
          stepNumber={1}
          subtitle="Study Definition"
          title="Define your clinical question with regulatory precision"
          description={
            <p>
              Every external control arm submission begins with a structured claim. Afarensis
              captures your study design using the PICO/PECO framework — Population, Intervention,
              Comparator, Outcome — and validates each element against ICH E10 and FDA draft
              guidance requirements. Ambiguity in your study definition is the first thing a
              reviewer will attack. We eliminate it before they see it.
            </p>
          }
          capabilities={[
            'Structured PICO/PECO framework with regulatory cross-referencing',
            'Automated gap detection against ICH E10 requirements',
            'Population eligibility criteria with inclusion/exclusion logic',
            'Outcome endpoint specification with measurement harmonization flags',
            'Version-controlled study definition with change attribution',
          ]}
          mockup={<StudyDefinitionMockup />}
        />

        <StepSection
          stepNumber={2}
          subtitle="Causal Framework"
          title="Map the causal structure your analysis assumes"
          description={
            <p>
              Regulatory reviewers increasingly expect sponsors to articulate their causal
              assumptions explicitly. Afarensis provides a directed acyclic graph (DAG) editor
              that maps confounders, mediators, and colliders — then identifies every backdoor
              path between treatment and outcome. If your propensity score model is missing a
              confounder, the DAG will show it.
            </p>
          }
          capabilities={[
            'Visual DAG editor with drag-and-drop node placement',
            'Automated backdoor path identification (Pearl\'s criteria)',
            'Confounder, mediator, and collider classification',
            'Adjustment set recommendations for causal identification',
            'Exportable DAG diagrams for inclusion in CSR supplements',
          ]}
          mockup={<CausalFrameworkMockup />}
          reversed
        />

        <StepSection
          stepNumber={3}
          subtitle="Comparability Assessment"
          title="Prove your populations are comparable — or show exactly where they diverge"
          description={
            <p>
              The most common reason external control arm submissions fail is comparability.
              Afarensis runs propensity score matching, IPTW, and exact matching across every
              covariate in your DAG, then produces love plots, balance tables, and overlap
              diagnostics that meet FDA expectations. If your populations can&apos;t be balanced,
              you&apos;ll know before the reviewer does.
            </p>
          }
          capabilities={[
            'Propensity score estimation with multiple model specifications',
            'Love plots with pre/post matching standardized mean differences',
            'IPTW (Inverse Probability of Treatment Weighting) with stabilized weights',
            'Overlap diagnostics with effective sample size calculations',
            'Automated flagging when SMD exceeds regulatory thresholds (>0.1, >0.2)',
          ]}
          mockup={<ComparabilityMockup />}
        />

        <StepSection
          stepNumber={4}
          subtitle="Effect Estimation"
          title="Estimate treatment effects with the rigor regulators expect"
          description={
            <p>
              Afarensis runs your primary and sensitivity analyses simultaneously: Cox proportional
              hazards, Kaplan-Meier survival estimation, forest plots across subgroups, and
              IPTW-weighted outcomes. Every analysis is pre-specified, reproducible, and
              accompanied by the diagnostics a statistical reviewer will ask for — proportional
              hazards tests, influence diagnostics, and Schoenfeld residuals.
            </p>
          }
          capabilities={[
            'Cox proportional hazards with PH assumption testing',
            'Kaplan-Meier curves with confidence bands and risk tables',
            'Forest plots across pre-specified subgroups',
            'IPTW-weighted treatment effect estimation',
            'Hazard ratio, risk difference, and restricted mean survival time',
          ]}
          mockup={<EffectEstimationMockup />}
          reversed
        />

        <StepSection
          stepNumber={5}
          subtitle="Bias & Sensitivity"
          title="Quantify what unmeasured confounding could do to your results"
          description={
            <p>
              The FDA expects sponsors to address unmeasured confounding — not dismiss it. Afarensis
              computes E-values, runs tipping point analyses, and conducts probabilistic bias
              analysis across the parameter space your causal diagram implies. The result is a
              quantitative answer to the question every reviewer asks: &ldquo;How robust is this
              finding to what you didn&apos;t measure?&rdquo;
            </p>
          }
          capabilities={[
            'E-value computation with lower confidence bound interpretation',
            'Tipping point analysis: how many patients must be reclassified to null',
            'Probabilistic bias analysis with Monte Carlo simulation',
            'Negative control outcome and exposure analyses',
            'Structured bias assessment mapped to FDA guidance categories',
          ]}
          mockup={<BiasSensitivityMockup />}
        />

        <StepSection
          stepNumber={6}
          subtitle="Regulatory Stress Test"
          title="Simulate the questions a reviewer will ask — and pre-address them"
          description={
            <p>
              Afarensis generates adversarial challenge vectors based on published FDA complete
              response letters, advisory committee transcripts, and CDER reviewer guidance. Each
              challenge is mapped to the specific evidence in your package that addresses it. If
              a gap exists, you find it now — not in a CRL twelve months from now.
            </p>
          }
          capabilities={[
            'Challenge vectors derived from real FDA CRLs and AdCom transcripts',
            'Automated evidence mapping: each challenge linked to your response',
            'Gap detection with severity scoring (HIGH / MEDIUM / LOW)',
            'Regulatory readiness score with per-section breakdown',
            'Pre-built response templates for common reviewer objections',
          ]}
          mockup={<RegulatoryAttackMockup />}
          reversed
        />

        <StepSection
          stepNumber={7}
          subtitle="Evidence Package"
          title="Export a complete, submission-ready evidence package"
          description={
            <p>
              Every analysis, every assumption, every validation step collapses into a structured
              evidence package: CDISC-compliant ADaM datasets, tables/figures/listings, a
              statistical analysis plan, bias analysis reports, and a provenance log that
              traces every output back to its source data and transformation. Ready for your
              CSR supplement or eCTD submission.
            </p>
          }
          capabilities={[
            'CDISC ADaM datasets (ADSL, ADTTE, ADAE) with define.xml',
            'Tables, Figures, and Listings (TFLs) in publication-quality format',
            'Statistical Analysis Plan with pre-specified sensitivity analyses',
            'Quantitative Bias Analysis report with parameter documentation',
            'Cryptographically signed audit trail with SHA-256 chain verification',
          ]}
          mockup={<RegulatoryOutputMockup />}
        />

        {/* ===== AUDIT TRAIL SECTION ===== */}
        <section style={{
          padding: '80px 32px',
          background: designSystem.colors.neutral.gray50,
        }}>
          <div style={{
            maxWidth: '1200px', margin: '0 auto',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px',
            alignItems: 'center',
          }} className="hiw-step-grid">
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                marginBottom: '16px',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#0f172a', color: '#fff',
                  fontSize: '16px', fontWeight: 700,
                  fontFamily: designSystem.typography.fontFamily.heading,
                }}>∞</span>
                <span style={{
                  fontSize: '13px', fontWeight: 600, color: designSystem.colors.neutral.gray700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>Always On</span>
              </div>
              <h2 style={{
                fontSize: '32px', fontWeight: 700, color: designSystem.colors.neutral.gray900,
                fontFamily: designSystem.typography.fontFamily.heading,
                lineHeight: 1.2, marginBottom: '20px',
              }}>Every action is attributed, timestamped, and immutable</h2>
              <p style={{
                fontSize: '17px', lineHeight: 1.7, color: designSystem.colors.neutral.gray600,
                marginBottom: '24px',
              }}>
                CFR Part 11 compliance isn&apos;t a feature — it&apos;s a foundation. Every change
                to every field in every step is logged with user attribution, timestamp, and
                cryptographic verification. When a reviewer asks &ldquo;who changed this and
                when,&rdquo; the answer is one click away.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  'Immutable audit trail with cryptographic signing (SHA-256)',
                  'User attribution on every field-level change',
                  'Version-controlled evidence packages with diff comparison',
                  'Electronic signature workflows for review and approval',
                  'Exportable audit logs for regulatory inspection',
                ].map((cap, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                      background: '#dcfce7', color: '#16a34a', fontSize: '12px', marginTop: '2px',
                    }}>✓</span>
                    <span style={{ fontSize: '15px', color: designSystem.colors.neutral.gray700 }}>{cap}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <AuditTrailMockup />
            </div>
          </div>
        </section>

        {/* ===== CTA SECTION ===== */}
        <section style={{
          padding: '96px 32px', textAlign: 'center',
          background: designSystem.colors.neutral.white,
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{
              fontSize: '36px', fontWeight: 700, color: designSystem.colors.neutral.gray900,
              fontFamily: designSystem.typography.fontFamily.heading,
              lineHeight: 1.2, marginBottom: '20px',
            }}>
              Ready to validate your external control arm?
            </h2>
            <p style={{
              fontSize: '18px', lineHeight: 1.7, color: designSystem.colors.neutral.gray600,
              marginBottom: '32px',
            }}>
              We work with a small number of rare disease sponsors whose submissions
              are actively exposed to the current regulatory environment.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleOpenWaitlist}
                style={{
                  padding: '14px 32px', background: designSystem.colors.primary,
                  color: '#fff', border: 'none', borderRadius: '8px',
                  fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Join the Waitlist
              </button>
              <Link
                to="/memo"
                style={{
                  padding: '14px 32px', background: 'transparent',
                  color: designSystem.colors.primary,
                  border: `1px solid ${designSystem.colors.primary}`,
                  borderRadius: '8px', fontSize: '16px', fontWeight: 600,
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}
              >
                Read the Founding Memo →
              </Link>
            </div>
          </div>
        </section>

        {/* ===== FAQ SECTION (SEO) ===== */}
        <section style={{
          padding: '80px 32px',
          background: designSystem.colors.neutral.gray50,
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{
              fontSize: '32px', fontWeight: 700, color: designSystem.colors.neutral.gray900,
              fontFamily: designSystem.typography.fontFamily.heading,
              lineHeight: 1.2, marginBottom: '40px', textAlign: 'center',
            }}>
              Frequently Asked Questions
            </h2>
            {[
              {
                q: 'What is an external control arm?',
                a: 'An external control arm (ECA) is a comparator group constructed from patients outside the clinical trial — typically from natural history registries, electronic health records, or prior clinical studies. ECAs are used when randomization is not feasible, particularly in rare disease trials where patient populations are too small for traditional randomized controlled trial designs.',
              },
              {
                q: 'Why do external control arm submissions fail at the FDA?',
                a: 'The most common reasons include insufficient population comparability, lack of sensitivity analyses for unmeasured confounding, inadequate covariate balance documentation, and absence of a structured validation layer between raw data and regulatory claims. The FDA expects sponsors to pre-address these concerns with quantitative evidence — not qualitative arguments.',
              },
              {
                q: 'How does Afarensis differ from data vendors like Flatiron or Tempus?',
                a: 'Data vendors provide access to real-world datasets. Afarensis does not sell data — it validates the claims you make with that data. Afarensis sits between your data source and the FDA, providing the evidence validation infrastructure that produces auditable, reproducible regulatory evidence packages.',
              },
              {
                q: 'What statistical methods does Afarensis support?',
                a: 'Afarensis supports propensity score matching, inverse probability of treatment weighting (IPTW), exact matching, Cox proportional hazards models, Kaplan-Meier survival estimation, E-value computation, tipping point analysis, probabilistic bias analysis, and forest plots across pre-specified subgroups.',
              },
              {
                q: 'What file formats does Afarensis export?',
                a: 'Afarensis exports CDISC ADaM-compliant datasets (ADSL, ADTTE, ADAE) in XPT format, publication-quality tables/figures/listings (TFLs) in PDF, statistical analysis plans, quantitative bias analysis reports, and cryptographically signed audit trails — all structured for CSR supplements and eCTD submission.',
              },
              {
                q: 'Is Afarensis CFR Part 11 compliant?',
                a: 'Yes. Every action in Afarensis is logged with user attribution, timestamps, and cryptographic verification (SHA-256 chain). The platform supports electronic signature workflows, version-controlled evidence packages, and exportable audit logs designed for regulatory inspection.',
              },
            ].map((faq, i) => (
              <details key={i} style={{
                marginBottom: '12px',
                background: designSystem.colors.neutral.white,
                borderRadius: '8px',
                border: `1px solid ${designSystem.colors.neutral.gray200}`,
                overflow: 'hidden',
              }}>
                <summary style={{
                  padding: '18px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: designSystem.colors.neutral.gray800,
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  {faq.q}
                  <span style={{ color: designSystem.colors.neutral.gray400, fontSize: '20px', fontWeight: 300 }}>+</span>
                </summary>
                <div style={{
                  padding: '0 24px 18px',
                  fontSize: '15px',
                  lineHeight: 1.7,
                  color: designSystem.colors.neutral.gray600,
                }}>
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer style={{
          borderTop: '1px solid #e5e7eb',
          padding: '32px',
          textAlign: 'center',
          background: designSystem.colors.neutral.gray50,
        }}>
          <p style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, marginBottom: '16px' }}>
            &copy; {new Date().getFullYear()} Synthetic Ascension. All rights reserved.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, textDecoration: 'none' }}>Home</Link>
            <Link to="/memo" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, textDecoration: 'none' }}>Founding Memo</Link>
            <Link to="/privacy" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, textDecoration: 'none' }}>Privacy Policy</Link>
            <Link to="/terms" style={{ fontSize: '14px', color: designSystem.colors.neutral.gray500, textDecoration: 'none' }}>Terms of Service</Link>
          </div>
        </footer>
      </div>

      <ContactModal
        isOpen={showContact}
        onClose={() => setShowContact(false)}
        leadSource="how_it_works"
        leadIntent="waitlist"
      />
    </>
  );
}

export default HowItWorksPage;
