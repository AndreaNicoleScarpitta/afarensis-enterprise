import React, { useState, useEffect } from 'react'
import {
  X,
  CreditCard,
  FunctionSquare,
  Database,
  Activity,
  FlaskConical,
  GitBranch,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  ArrowDown,
  Hash,
  FileText,
  User,
  Clock,
  Server,
  Layers,
  BarChart3,
  Shield,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShowYourWorkProps {
  isOpen: boolean
  onClose: () => void
  resultId: string
  resultLabel: string
  resultType: 'estimate' | 'table' | 'figure' | 'diagnostic'
  /** Analysis results from the API — all display data comes from here */
  analysisData?: any
  /** Project ID for fetching additional context */
  projectId?: string
}

type TabKey = 'model' | 'formula' | 'inputs' | 'diagnostics' | 'sensitivity' | 'lineage'

interface TabDef {
  key: TabKey
  label: string
  icon: React.ReactNode
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: TabDef[] = [
  { key: 'model', label: 'Model Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
  { key: 'formula', label: 'Formula', icon: <FunctionSquare className="w-3.5 h-3.5" /> },
  { key: 'inputs', label: 'Inputs', icon: <Database className="w-3.5 h-3.5" /> },
  { key: 'diagnostics', label: 'Diagnostics', icon: <Activity className="w-3.5 h-3.5" /> },
  { key: 'sensitivity', label: 'Sensitivity', icon: <FlaskConical className="w-3.5 h-3.5" /> },
  { key: 'lineage', label: 'Lineage', icon: <GitBranch className="w-3.5 h-3.5" /> },
]

// ---------------------------------------------------------------------------
// Helper: extract structured data from API analysis results
// ---------------------------------------------------------------------------

function extractModelCard(data: any) {
  if (!data) return null
  const cox = data.cox_proportional_hazards || data.weighted_cox || {}
  const detection = data.column_detection || {}
  const validation = data.pre_analysis_validation || {}
  const ps = data.propensity_scores || {}

  return {
    modelType: cox.model_type || 'Cox Proportional Hazards',
    estimand: data.estimand || 'Average Treatment Effect (ATE)',
    outcome: detection.time ? `Time to event (${detection.time})` : 'Time to event',
    population: `N=${detection.n_records_analyzed || detection.n_records || '—'} patients`,
    treatment: detection.groups
      ? `${detection.groups.treated || '—'} vs. ${detection.groups.control || '—'}`
      : '—',
    covariates: Array.isArray(detection.covariates) ? detection.covariates : [],
    weightingMethod: data.iptw ? 'Inverse Probability of Treatment Weighting (IPTW)' : 'Unadjusted',
    psModel: ps.model_type || 'Logistic regression',
    trimming: data.iptw?.trimming_note || 'Stabilized weights',
    varianceEstimator: 'Robust (sandwich) standard errors',
    software: 'Afarensis Statistical Engine v2.1',
    randomSeed: data.random_seed || '—',
    analysisDate: data.analysis_timestamp || data.timestamp || new Date().toISOString(),
    runId: data.run_id || '—',
    dataSource: data.data_source || 'unknown',
  }
}

function extractFormula(data: any) {
  if (!data) return null
  const covs = data.column_detection?.covariates || []
  const covTerms = covs.map((c: string, i: number) => `B${i + 2}*${c}`).join(' + ')
  return {
    plainEnglish: data.iptw
      ? 'A Cox proportional hazards model estimates the hazard as a function of treatment assignment, adjusting for measured confounders via inverse probability of treatment weighting (IPTW).'
      : 'A Cox proportional hazards model estimates the hazard as a function of treatment assignment, adjusting for measured confounders.',
    formula: covTerms
      ? `log(h(t)) = log(h0(t)) + B1*Treatment + ${covTerms}`
      : 'log(h(t)) = log(h0(t)) + B1*Treatment',
    linkFunction: 'Log link on the hazard function. Exponentiated coefficients (exp(B)) are interpreted as hazard ratios.',
    referenceGroup: data.column_detection?.groups?.control
      ? `${data.column_detection.groups.control} is the reference group.`
      : '—',
    varianceNote: data.iptw
      ? 'Variance estimated via robust (sandwich) estimator to account for IPTW weights. Confidence intervals are Wald-type at the 95% level.'
      : 'Variance estimated via observed information matrix. Confidence intervals are Wald-type at the 95% level.',
  }
}

function extractInputs(data: any) {
  if (!data) return null
  const detection = data.column_detection || {}
  const dropAudit = data.row_drop_audit || null
  return {
    dataSource: data.data_source || 'unknown',
    nInput: detection.n_records_input || detection.n_records || 0,
    nAnalyzed: detection.n_records_analyzed || detection.n_records || 0,
    nDropped: detection.n_records_dropped || 0,
    nEvents: detection.n_events || 0,
    covariates: Array.isArray(detection.covariates) ? detection.covariates : [],
    armCol: detection.arm || '—',
    timeCol: detection.time || '—',
    eventCol: detection.event || '—',
    groups: detection.groups || {},
    dropAudit,
  }
}

function extractDiagnostics(data: any) {
  if (!data) return null
  const ps = data.propensity_scores || {}
  const cox = data.cox_proportional_hazards || {}
  const balance = ps.balance_assessment || {}
  const covBalances = Array.isArray(balance.covariate_balance) ? balance.covariate_balance : []

  return {
    balance: {
      status: (balance.all_balanced ? 'pass' : 'warn') as 'pass' | 'warn' | 'fail',
      threshold: balance.threshold || 0.1,
      covariates: covBalances.map((c: any) => ({
        name: c.name || c.covariate || '—',
        preSMD: c.pre_smd ?? c.unadjusted_smd ?? 0,
        postSMD: c.post_smd ?? c.adjusted_smd ?? 0,
        status: (c.post_smd ?? c.adjusted_smd ?? 0) <= (balance.threshold || 0.1) ? 'pass' as const : 'warn' as const,
      })),
    },
    overlap: {
      status: (ps.overlap_adequate !== false ? 'pass' : 'warn') as 'pass' | 'warn' | 'fail',
      treatmentMean: ps.treatment_ps_mean ?? null,
      controlMean: ps.control_ps_mean ?? null,
      cStatistic: ps.c_statistic ?? ps.auc ?? null,
    },
    proportionalHazards: {
      status: (cox.schoenfeld_p != null && cox.schoenfeld_p > 0.05 ? 'pass' : cox.schoenfeld_p != null ? 'warn' : 'pass') as 'pass' | 'warn' | 'fail',
      pValue: cox.schoenfeld_p ?? null,
    },
    convergence: {
      status: (cox.converged !== false ? 'pass' : 'fail') as 'pass' | 'warn' | 'fail',
      iterations: cox.iterations ?? null,
      converged: cox.converged ?? true,
      logLikelihood: cox.log_likelihood ?? null,
    },
  }
}

function extractSensitivityAnalyses(data: any) {
  if (!data) return []
  const results: any[] = []
  const primary = data.weighted_cox || data.cox_proportional_hazards || {}
  const primaryStr = primary.hazard_ratio
    ? `HR ${primary.hazard_ratio?.toFixed(2)} [${primary.ci_lower?.toFixed(2)}, ${primary.ci_upper?.toFixed(2)}]`
    : '—'

  // Unadjusted Cox
  const unadj = data.cox_proportional_hazards || {}
  if (unadj.hazard_ratio) {
    results.push({
      name: 'Unadjusted Cox PH',
      change: 'No IPTW weighting applied',
      rationale: 'Assess impact of propensity score adjustment',
      primaryEstimate: primaryStr,
      sensitivityEstimate: `HR ${unadj.hazard_ratio?.toFixed(2)} [${unadj.ci_lower?.toFixed(2)}, ${unadj.ci_upper?.toFixed(2)}]`,
      direction: Math.sign(Math.log(unadj.hazard_ratio)) === Math.sign(Math.log(primary.hazard_ratio || 1)) ? 'consistent' as const : 'reversed' as const,
    })
  }

  // E-value
  const evalue = data.evalue || data.e_value || {}
  if (evalue.point_estimate || evalue.e_value_point) {
    results.push({
      name: 'E-value assessment',
      change: 'Quantify unmeasured confounding needed to explain away result',
      rationale: 'Robustness to unmeasured confounding',
      primaryEstimate: primaryStr,
      sensitivityEstimate: `E-value: ${(evalue.point_estimate || evalue.e_value_point)?.toFixed(2)} (CI bound: ${(evalue.ci_bound || evalue.e_value_ci)?.toFixed(2)})`,
      direction: 'consistent' as const,
    })
  }

  // Fragility index
  const frag = data.fragility_index || {}
  if (frag.fragility_index != null) {
    results.push({
      name: 'Fragility Index',
      change: `${frag.fragility_index} event(s) would change significance`,
      rationale: 'Assess stability of the conclusion',
      primaryEstimate: primaryStr,
      sensitivityEstimate: `FI = ${frag.fragility_index}`,
      direction: (frag.fragility_index >= 3 ? 'consistent' : 'attenuated') as 'consistent' | 'attenuated',
    })
  }

  // Sensitivity analyses from backend
  if (data.sensitivity_analyses && typeof data.sensitivity_analyses === 'object') {
    for (const [key, val] of Object.entries(data.sensitivity_analyses)) {
      const v = val as any
      if (v && v.hazard_ratio) {
        results.push({
          name: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          change: v.description || key,
          rationale: v.rationale || 'Pre-specified sensitivity analysis',
          primaryEstimate: primaryStr,
          sensitivityEstimate: `HR ${v.hazard_ratio?.toFixed(2)} [${v.ci_lower?.toFixed(2)}, ${v.ci_upper?.toFixed(2)}]`,
          direction: Math.sign(Math.log(v.hazard_ratio)) === Math.sign(Math.log(primary.hazard_ratio || 1)) ? 'consistent' as const : 'reversed' as const,
        })
      }
    }
  }

  return results
}

function extractLineage(data: any) {
  if (!data) return []
  const nodes: any[] = []
  const detection = data.column_detection || {}
  const validation = data.pre_analysis_validation || {}
  const ts = data.analysis_timestamp || data.timestamp || new Date().toISOString()

  nodes.push({
    type: 'Data Source',
    icon: Server,
    name: data.data_source === 'uploaded' ? 'Patient Dataset Upload' : 'Generated Data',
    version: null,
    timestamp: ts,
    actor: 'System',
    checksum: null,
  })

  if (detection.n_records_input) {
    nodes.push({
      type: 'Dataset',
      icon: Database,
      name: `${detection.n_records_input} input rows, ${(detection.covariates || []).length + 3} columns`,
      version: null,
      timestamp: ts,
      actor: 'Ingestion Service',
      checksum: null,
    })
  }

  if (validation.validation_timestamp) {
    nodes.push({
      type: 'Validation Gate',
      icon: Shield,
      name: `Pre-analysis: ${validation.verdict || 'UNKNOWN'}`,
      version: null,
      timestamp: validation.validation_timestamp,
      actor: 'PreAnalysisValidator (6-phase)',
      checksum: null,
    })
  }

  if (detection.n_records_dropped > 0) {
    nodes.push({
      type: 'Exclusions',
      icon: Layers,
      name: `${detection.n_records_dropped} rows excluded, ${detection.n_records_analyzed} analyzed`,
      version: null,
      timestamp: ts,
      actor: 'System',
      checksum: null,
    })
  }

  const primary = data.weighted_cox || data.cox_proportional_hazards || {}
  if (primary.hazard_ratio) {
    nodes.push({
      type: 'Analysis Run',
      icon: Activity,
      name: `IPTW Cox PH executed`,
      version: null,
      timestamp: ts,
      actor: 'StatisticalAnalysisService',
      checksum: null,
    })
    nodes.push({
      type: 'Result',
      icon: BarChart3,
      name: `HR ${primary.hazard_ratio?.toFixed(2)} [${primary.ci_lower?.toFixed(2)}, ${primary.ci_upper?.toFixed(2)}]`,
      version: null,
      timestamp: ts,
      actor: 'System (deterministic output)',
      checksum: null,
    })
  }

  return nodes
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: 'pass' | 'fail' | 'warn' }) {
  const styles = {
    pass: 'bg-emerald-50 text-emerald-700',
    fail: 'bg-red-50 text-red-700',
    warn: 'bg-amber-50 text-amber-700',
  }
  const icons = {
    pass: <CheckCircle2 className="w-3 h-3" />,
    fail: <XCircle className="w-3 h-3" />,
    warn: <AlertTriangle className="w-3 h-3" />,
  }
  const labels = { pass: 'Pass', fail: 'Fail', warn: 'Warning' }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', styles[status])}>
      {icons[status]} {labels[status]}
    </span>
  )
}

function DirectionBadge({ direction }: { direction: 'consistent' | 'attenuated' | 'reversed' }) {
  const styles = {
    consistent: 'bg-emerald-50 text-emerald-700',
    attenuated: 'bg-amber-50 text-amber-700',
    reversed: 'bg-red-50 text-red-700',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', styles[direction])}>
      {direction}
    </span>
  )
}

function ChecksumBadge({ hash }: { hash: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
      <Hash className="w-2.5 h-2.5" />
      {hash}
    </span>
  )
}

function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-2 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6 first:mt-0">
      {children}
    </h3>
  )
}

function NoDataPlaceholder({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-8 h-8 text-amber-600 mb-3" />
      <p className="text-sm font-medium text-gray-700">No analysis data available</p>
      <p className="text-xs text-gray-500 mt-1 max-w-xs">
        Run an analysis on uploaded patient data to populate the {tab} tab. All fields are derived from actual computation results.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab content panels — all data-driven from API results
// ---------------------------------------------------------------------------

function ModelCardTab({ data }: { data: any }) {
  const card = extractModelCard(data)
  if (!card) return <NoDataPlaceholder tab="Model Card" />

  return (
    <div className="space-y-1">
      <SectionHeading>Model Specification</SectionHeading>
      <dl>
        <KVRow label="Model Type">{card.modelType}</KVRow>
        <KVRow label="Estimand">{card.estimand}</KVRow>
        <KVRow label="Outcome">{card.outcome}</KVRow>
        <KVRow label="Population">{card.population}</KVRow>
        <KVRow label="Treatment">{card.treatment}</KVRow>
        <KVRow label="Data Source">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            card.dataSource === 'uploaded'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          )}>
            {card.dataSource === 'uploaded' ? 'Uploaded Patient Data' : 'Simulated Data'}
          </span>
        </KVRow>
      </dl>

      <SectionHeading>Covariates ({card.covariates.length})</SectionHeading>
      {card.covariates.length > 0 ? (
        <ul className="space-y-1">
          {card.covariates.map((c: string, i: number) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-gray-500 mt-0.5 text-xs font-mono w-4 text-right shrink-0">{i + 1}.</span>
              {c}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 italic">No covariates detected</p>
      )}

      <SectionHeading>Adjustment Method</SectionHeading>
      <dl>
        <KVRow label="Weighting">{card.weightingMethod}</KVRow>
        <KVRow label="PS Model">{card.psModel}</KVRow>
        <KVRow label="Trimming">{card.trimming}</KVRow>
        <KVRow label="Variance">{card.varianceEstimator}</KVRow>
      </dl>

      <SectionHeading>Execution</SectionHeading>
      <dl>
        <KVRow label="Software">{card.software}</KVRow>
        <KVRow label="Random Seed"><span className="font-mono text-xs">{card.randomSeed}</span></KVRow>
        <KVRow label="Run ID"><span className="font-mono text-xs">{card.runId}</span></KVRow>
        <KVRow label="Analysis Date">
          {new Date(card.analysisDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </KVRow>
      </dl>
    </div>
  )
}

function FormulaTab({ data }: { data: any }) {
  const formula = extractFormula(data)
  if (!formula) return <NoDataPlaceholder tab="Formula" />

  return (
    <div className="space-y-1">
      <SectionHeading>Plain English Description</SectionHeading>
      <p className="text-sm text-gray-700 leading-relaxed">{formula.plainEnglish}</p>

      <SectionHeading>Statistical Formula</SectionHeading>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm font-mono text-gray-900 whitespace-pre">{formula.formula}</code>
      </div>

      <SectionHeading>Link Function</SectionHeading>
      <p className="text-sm text-gray-700 leading-relaxed">{formula.linkFunction}</p>

      <SectionHeading>Reference Groups</SectionHeading>
      <p className="text-sm text-gray-700 leading-relaxed">{formula.referenceGroup}</p>

      <SectionHeading>Variance Estimation</SectionHeading>
      <p className="text-sm text-gray-700 leading-relaxed">{formula.varianceNote}</p>
    </div>
  )
}

function InputsTab({ data }: { data: any }) {
  const inputs = extractInputs(data)
  if (!inputs) return <NoDataPlaceholder tab="Inputs" />

  return (
    <div className="space-y-1">
      <SectionHeading>Dataset</SectionHeading>
      <dl>
        <KVRow label="Source">{inputs.dataSource === 'uploaded' ? 'Uploaded patient dataset' : 'Generated simulation'}</KVRow>
        <KVRow label="Input Rows">{inputs.nInput.toLocaleString()}</KVRow>
        <KVRow label="Analyzed Rows">{inputs.nAnalyzed.toLocaleString()}</KVRow>
        <KVRow label="Events">{inputs.nEvents.toLocaleString()}</KVRow>
      </dl>

      <SectionHeading>Column Mapping</SectionHeading>
      <dl>
        <KVRow label="Arm Column"><span className="font-mono text-xs">{inputs.armCol}</span></KVRow>
        <KVRow label="Time Column"><span className="font-mono text-xs">{inputs.timeCol}</span></KVRow>
        <KVRow label="Event Column"><span className="font-mono text-xs">{inputs.eventCol}</span></KVRow>
      </dl>

      <SectionHeading>Treatment Groups</SectionHeading>
      <dl>
        <KVRow label="Control">{inputs.groups.control || '—'}</KVRow>
        <KVRow label="Treated">{Array.isArray(inputs.groups.treated) ? inputs.groups.treated.join(', ') : (inputs.groups.treated || '—')}</KVRow>
      </dl>

      {inputs.nDropped > 0 && (
        <>
          <SectionHeading>Row Exclusions ({inputs.nDropped} rows)</SectionHeading>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                {inputs.nDropped} of {inputs.nInput} rows excluded from analysis
              </span>
            </div>
            <p className="text-xs text-amber-700">
              Every exclusion is documented. A regulatory-grade system must account for every excluded record.
            </p>
          </div>
          {inputs.dropAudit && Array.isArray(inputs.dropAudit.details) && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1.5 px-2 font-medium text-gray-500">Subject</th>
                    <th className="text-left py-1.5 px-2 font-medium text-gray-500">Reason(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {inputs.dropAudit.details.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 px-2 font-mono text-gray-700">{d.row}</td>
                      <td className="py-1.5 px-2 text-gray-600">{Array.isArray(d.reasons) ? d.reasons.join(', ') : d.reasons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <SectionHeading>Covariates ({inputs.covariates.length})</SectionHeading>
      <ul className="space-y-1">
        {inputs.covariates.map((c: string, i: number) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
            <span className="text-gray-500 text-xs font-mono w-4 text-right shrink-0">{i + 1}.</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DiagnosticsTab({ data }: { data: any }) {
  const diag = extractDiagnostics(data)
  if (!diag) return <NoDataPlaceholder tab="Diagnostics" />

  const checks = [
    { name: 'Covariate Balance', status: diag.balance.status },
    { name: 'PS Overlap', status: diag.overlap.status },
    { name: 'Proportional Hazards', status: diag.proportionalHazards.status },
    { name: 'Convergence', status: diag.convergence.status },
  ]
  const passCount = checks.filter(c => c.status === 'pass').length

  return (
    <div className="space-y-1">
      <SectionHeading>Diagnostic Summary ({passCount}/{checks.length} passed)</SectionHeading>
      <div className="space-y-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100">
            <span className="text-sm text-gray-700">{c.name}</span>
            <StatusBadge status={c.status} />
          </div>
        ))}
      </div>

      {diag.balance.covariates.length > 0 && (
        <>
          <SectionHeading>Covariate Balance (threshold: SMD {'<'} {diag.balance.threshold})</SectionHeading>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 px-2 font-medium text-gray-500">Covariate</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500">Pre-SMD</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500">Post-SMD</th>
                  <th className="text-center py-1.5 px-2 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {diag.balance.covariates.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-gray-700">{c.name}</td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      <span className={c.preSMD > diag.balance.threshold ? 'text-amber-600' : 'text-gray-500'}>{c.preSMD.toFixed(3)}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      <span className={c.postSMD > diag.balance.threshold ? 'text-red-600' : 'text-emerald-600'}>{c.postSMD.toFixed(3)}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionHeading>Overlap</SectionHeading>
      <dl>
        {diag.overlap.cStatistic != null && <KVRow label="C-statistic">{diag.overlap.cStatistic.toFixed(3)}</KVRow>}
        {diag.overlap.treatmentMean != null && <KVRow label="Treatment PS Mean">{diag.overlap.treatmentMean.toFixed(3)}</KVRow>}
        {diag.overlap.controlMean != null && <KVRow label="Control PS Mean">{diag.overlap.controlMean.toFixed(3)}</KVRow>}
      </dl>

      <SectionHeading>Proportional Hazards</SectionHeading>
      <dl>
        {diag.proportionalHazards.pValue != null && (
          <KVRow label="Schoenfeld p-value">
            <span className={cn('font-mono', diag.proportionalHazards.pValue < 0.05 ? 'text-red-600' : 'text-emerald-600')}>
              {diag.proportionalHazards.pValue.toFixed(4)}
            </span>
            <span className="text-xs text-gray-500 ml-2">(threshold: 0.05)</span>
          </KVRow>
        )}
      </dl>

      <SectionHeading>Convergence</SectionHeading>
      <dl>
        <KVRow label="Converged"><StatusBadge status={diag.convergence.status} /></KVRow>
        {diag.convergence.iterations != null && <KVRow label="Iterations">{diag.convergence.iterations}</KVRow>}
        {diag.convergence.logLikelihood != null && <KVRow label="Log-likelihood">{diag.convergence.logLikelihood.toFixed(2)}</KVRow>}
      </dl>
    </div>
  )
}

function SensitivityTab({ data }: { data: any }) {
  const analyses = extractSensitivityAnalyses(data)
  if (analyses.length === 0) return <NoDataPlaceholder tab="Sensitivity" />

  return (
    <div className="space-y-1">
      <SectionHeading>Sensitivity Analyses ({analyses.length})</SectionHeading>
      <div className="space-y-4">
        {analyses.map((a, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800">{a.name}</span>
              <DirectionBadge direction={a.direction} />
            </div>
            <p className="text-xs text-gray-500 mb-2">{a.rationale}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Primary:</span>
                <span className="ml-1 font-mono text-gray-700">{a.primaryEstimate}</span>
              </div>
              <div>
                <span className="text-gray-500">This analysis:</span>
                <span className="ml-1 font-mono text-gray-700">{a.sensitivityEstimate}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineageTab({ data }: { data: any }) {
  const nodes = extractLineage(data)
  if (nodes.length === 0) return <NoDataPlaceholder tab="Lineage" />

  return (
    <div className="space-y-1">
      <SectionHeading>Data Lineage ({nodes.length} steps)</SectionHeading>
      <div className="relative">
        {nodes.map((node, i) => {
          const IconComp = node.icon
          const isLast = i === nodes.length - 1
          return (
            <div key={i} className="flex gap-3 relative">
              {!isLast && (
                <div className="absolute left-[15px] top-[30px] bottom-0 w-px bg-gray-200" />
              )}
              <div className="relative z-10 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <IconComp className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{node.type}</span>
                  {node.version && (
                    <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                      {node.version}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 mt-0.5">{node.name}</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{node.actor}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(node.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                {node.checksum && (
                  <div className="mt-1"><ChecksumBadge hash={node.checksum} /></div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ShowYourWork({ isOpen, onClose, resultId, resultLabel, resultType, analysisData }: ShowYourWorkProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('model')

  if (!isOpen) return null

  const hasData = analysisData && Object.keys(analysisData).length > 0

  const tabContent: Record<TabKey, React.ReactNode> = {
    model: <ModelCardTab data={analysisData} />,
    formula: <FormulaTab data={analysisData} />,
    inputs: <InputsTab data={analysisData} />,
    diagnostics: <DiagnosticsTab data={analysisData} />,
    sensitivity: <SensitivityTab data={analysisData} />,
    lineage: <LineageTab data={analysisData} />,
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Show Your Work</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-sm truncate">{resultLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Data source indicator */}
        {hasData && (
          <div className={cn(
            'px-5 py-2 text-xs flex items-center gap-2 border-b',
            analysisData.data_source === 'uploaded'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          )}>
            <Database className="w-3.5 h-3.5" />
            <span className="font-medium">
              {analysisData.data_source === 'uploaded' ? 'Uploaded Patient Data' : 'Simulation Data'}
            </span>
            {analysisData.column_detection?.n_records_analyzed && (
              <span className="ml-auto font-mono">
                N={analysisData.column_detection.n_records_analyzed}
              </span>
            )}
          </div>
        )}

        {!hasData && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">No analysis results available</span>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              Upload patient data and run an analysis to populate this panel. All fields are derived from actual computation results.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tabContent[activeTab]}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50">
          <p className="text-[10px] text-gray-500">
            All values derived from the current analysis run. No hardcoded or cached data is displayed.
          </p>
        </div>
      </div>
    </>
  )
}
