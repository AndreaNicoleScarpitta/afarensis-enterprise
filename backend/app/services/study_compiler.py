"""
Study Definition Compiler
Uses Claude to enforce completeness, fill gaps intelligently, flag
inconsistencies, and produce a fully structured schema-compliant
study definition object.
"""

import json
import logging
from typing import Any, Dict, List
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class CompilerAssumption:
    """A single assumption the compiler made to fill a gap."""
    field: str
    assumed_value: str
    reason: str


@dataclass
class CompilerWarning:
    """A validation warning about the study definition."""
    severity: str  # "error" | "warning" | "info"
    category: str  # "endpoint_mismatch" | "estimand_inconsistency" | "missing_covariate" | "positivity_risk" | "missing_data_risk" | "causal_assumption"
    field: str
    message: str
    recommendation: str


@dataclass
class CompilerResult:
    """Output of the study definition compiler."""
    compiled_definition: Dict[str, Any]
    assumptions: List[CompilerAssumption]
    warnings: List[CompilerWarning]
    missing_critical: List[str]
    completeness_score: float  # 0.0 - 1.0
    verdict: str  # "PASS" | "WARN" | "FAIL" | "BLOCKED"
    compiled_at: str


# The strict schema the compiler enforces
COMPILED_SCHEMA = {
    "protocol": {
        "study_title": {"type": "string", "required": True},
        "phase": {"type": "enum", "values": ["Phase 1", "Phase 1/2", "Phase 2", "Phase 2/3", "Phase 3", "Phase 4 / Post-Marketing", "Pre-IND Supportive", "NDA/BLA Support"], "required": True},
        "regulatory_agency": {"type": "enum", "values": ["FDA", "EMA", "PMDA", "Health Canada", "TGA", "MHRA", "ANVISA", "NMPA"], "required": True},
        "indication": {"type": "string", "required": True},
        "rationale": {"type": "string", "required": False},
    },
    "design": {
        "comparator_type": {"type": "string", "required": True},
        "estimand_type": {"type": "enum", "values": ["ATT", "ATE", "ITT", "PP"], "required": True},
        "primary_endpoint": {"type": "string", "required": True},
        "endpoint_type": {"type": "enum", "values": ["time_to_event", "binary", "continuous", "rate", "composite"], "required": True},
        "secondary_endpoints": {"type": "array", "required": False},
    },
    "analysis": {
        "primary_model": {"type": "string", "required": True},
        "weighting_method": {"type": "string", "required": True},
        "variance_estimator": {"type": "string", "required": True},
        "ps_trimming": {"type": "string", "required": True},
        "smd_threshold": {"type": "number", "required": True, "default": 0.1},
        "covariates": {"type": "array", "required": True},
    },
    "missing_data": {
        "primary_method": {"type": "string", "required": True},
        "sensitivity_method": {"type": "string", "required": True},
        "missingness_threshold": {"type": "number", "required": True, "default": 0.05},
        "escalation_threshold": {"type": "number", "required": True, "default": 0.10},
    },
    "intercurrent_events": {
        "strategies": {"type": "array", "required": True},
    },
}


SYSTEM_PROMPT = """You are a Clinical Study Definition Compiler.

Your job is NOT to be helpful or conversational.
Your job is to take partially specified study inputs and produce a COMPLETE, internally consistent, regulator-grade study definition.

You must:
1. Infer missing fields where scientifically appropriate
2. Flag inconsistencies explicitly
3. Never leave required fields undefined
4. Normalize all inputs into the strict schema
5. Ensure all selections are scientifically coherent

RULES:

Endpoint Rules:
- Endpoint must classify into: time_to_event, binary, continuous, rate, or composite
- Analysis method must be appropriate for the endpoint type

Estimand Rules:
- Weighting method MUST match estimand:
  - IPTW / Overlap Weights → ATE
  - ATT weights → ATT
  - If mismatch → severity="error"

Intercurrent Event Rules:
- Strategy MUST have implementation logic:
  - Treatment Policy → analyze regardless of ICE
  - Hypothetical → model adjustment
  - If missing → infer + warn

Missing Data Rules:
- If missingness threshold not provided: default = 0.05, escalation = 0.10
- Must include BOTH thresholds

Positivity Rules:
- If trimming not provided: default PS bounds = 1st-99th percentile

Balance Rules:
- Default SMD threshold = 0.1

Variance Rules:
- Weighted models → MUST use robust (sandwich) SE unless specified otherwise

DEFAULTS (only if user does not specify):
- estimand_type = ATE
- weighting_method = IPTW — Stabilized Weights
- primary_model = Cox Proportional Hazards (for time-to-event), Logistic Regression (for binary), ANCOVA (for continuous)
- variance_estimator = Robust (Sandwich) SE
- missing_data.primary = Multiple Imputation (MICE)
- missing_data.sensitivity = Complete Case Analysis
- smd_threshold = 0.1
- ps_trimming = 1st – 99th Percentile
- missingness_threshold = 0.05
- escalation_threshold = 0.10

RESPONSE FORMAT:
You must respond with valid JSON only. No markdown, no explanation, no preamble.
The JSON must have exactly these top-level keys:
{
  "compiled_definition": { ... },
  "assumptions": [ {"field": "...", "assumed_value": "...", "reason": "..."}, ... ],
  "warnings": [ {"severity": "error|warning|info", "category": "...", "field": "...", "message": "...", "recommendation": "..."}, ... ],
  "missing_critical": [ "description of blocking gap", ... ],
  "completeness_score": 0.0-1.0,
  "verdict": "PASS|WARN|FAIL|BLOCKED"
}

The compiled_definition must follow this structure:
{
  "protocol": { "study_title", "phase", "regulatory_agency", "indication", "rationale" },
  "design": { "comparator_type", "estimand_type", "primary_endpoint", "endpoint_type", "secondary_endpoints" },
  "analysis": { "primary_model", "weighting_method", "variance_estimator", "ps_trimming", "smd_threshold", "covariates" },
  "missing_data": { "primary_method", "sensitivity_method", "missingness_threshold", "escalation_threshold" },
  "intercurrent_events": { "strategies": [ {"event", "strategy", "implementation"}, ... ] }
}

Be precise. Be strict. Only output JSON."""


def build_compiler_prompt(study_def: Dict[str, Any], project_name: str = "") -> str:
    """Build the user prompt with the partial study definition."""
    return f"""COMPILE THE FOLLOWING PARTIAL STUDY DEFINITION INTO A COMPLETE, SCHEMA-COMPLIANT OUTPUT.

PROJECT: {project_name or "Unnamed Study"}

PARTIAL INPUT:
```json
{json.dumps(study_def, indent=2, default=str)}
```

Apply all rules. Infer defaults where needed. Flag all issues. Return strict JSON."""


class StudyDefinitionCompiler:
    """Compiles partial study definitions into complete, validated objects."""

    def __init__(self):
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            from app.services.llm_integration import LLMServiceIntegration
            self._llm = LLMServiceIntegration()
        return self._llm

    async def compile(
        self,
        study_def: Dict[str, Any],
        project_name: str = "",
    ) -> CompilerResult:
        """
        Compile a partial study definition into a complete, validated output.
        Falls back to rule-based compilation if LLM is unavailable.
        """
        try:
            llm = self._get_llm()
            prompt = build_compiler_prompt(study_def, project_name)

            response = await llm.call_claude(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT,
                model="claude-sonnet-4-20250514",
                max_tokens=8000,
                temperature=0.0,
            )

            # Parse the JSON response
            raw = response.content.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

            parsed = json.loads(raw)

            return CompilerResult(
                compiled_definition=parsed.get("compiled_definition", {}),
                assumptions=[CompilerAssumption(**a) for a in parsed.get("assumptions", [])],
                warnings=[CompilerWarning(**w) for w in parsed.get("warnings", [])],
                missing_critical=parsed.get("missing_critical", []),
                completeness_score=float(parsed.get("completeness_score", 0.0)),
                verdict=parsed.get("verdict", "FAIL"),
                compiled_at=datetime.utcnow().isoformat(),
            )

        except Exception as e:
            logger.warning(f"LLM compilation failed, falling back to rule-based: {e}")
            return self._rule_based_compile(study_def, project_name)

    def _rule_based_compile(
        self,
        study_def: Dict[str, Any],
        project_name: str = "",
    ) -> CompilerResult:
        """Deterministic rule-based fallback when LLM is unavailable."""
        assumptions: List[CompilerAssumption] = []
        warnings: List[CompilerWarning] = []
        missing_critical: List[str] = []

        # Build compiled definition with defaults
        compiled: Dict[str, Any] = {
            "protocol": {},
            "design": {},
            "analysis": {},
            "missing_data": {},
            "intercurrent_events": {"strategies": []},
        }

        # ── Protocol ──
        compiled["protocol"]["study_title"] = study_def.get("study_title") or project_name or ""
        compiled["protocol"]["phase"] = study_def.get("phase", "")
        compiled["protocol"]["regulatory_agency"] = study_def.get("regBody", "")
        compiled["protocol"]["indication"] = study_def.get("indication", "")
        compiled["protocol"]["rationale"] = study_def.get("rationale", "")

        if not compiled["protocol"]["indication"]:
            missing_critical.append("Indication/disease area is required for any regulatory submission.")

        if not compiled["protocol"]["phase"]:
            missing_critical.append("Regulatory phase must be specified.")

        # ── Design ──
        compiled["design"]["comparator_type"] = study_def.get("comparator", "")
        compiled["design"]["estimand_type"] = study_def.get("estimand", "")
        compiled["design"]["primary_endpoint"] = study_def.get("endpoint", "")
        compiled["design"]["secondary_endpoints"] = study_def.get("secondaryEndpoints", [])

        if not compiled["design"]["primary_endpoint"]:
            missing_critical.append("Primary endpoint must be defined.")

        # Classify endpoint type
        ep = compiled["design"]["primary_endpoint"].lower()
        if any(k in ep for k in ["survival", "time to", "event-free", "progression-free", "relapse-free", "disease-free", "duration"]):
            compiled["design"]["endpoint_type"] = "time_to_event"
        elif any(k in ep for k in ["response rate", "rate of", "incidence", "proportion"]):
            compiled["design"]["endpoint_type"] = "binary"
        elif any(k in ep for k in ["change in", "reduction", "score", "fev1", "hba1c", "egfr"]):
            compiled["design"]["endpoint_type"] = "continuous"
        elif any(k in ep for k in ["exacerbation rate", "annualized", "viral load"]):
            compiled["design"]["endpoint_type"] = "rate"
        elif "composite" in ep:
            compiled["design"]["endpoint_type"] = "composite"
        else:
            compiled["design"]["endpoint_type"] = "time_to_event"
            assumptions.append(CompilerAssumption(
                field="design.endpoint_type",
                assumed_value="time_to_event",
                reason=f"Could not classify endpoint '{compiled['design']['primary_endpoint']}'; defaulting to time-to-event as the most common RWE endpoint type.",
            ))

        # Default estimand
        if not compiled["design"]["estimand_type"]:
            compiled["design"]["estimand_type"] = "ATE"
            assumptions.append(CompilerAssumption(
                field="design.estimand_type",
                assumed_value="ATE",
                reason="No estimand specified. Defaulting to Average Treatment Effect (ATE) per ICH E9(R1) guidance for comparative effectiveness.",
            ))

        # ── Analysis ──
        et = compiled["design"]["endpoint_type"]
        pm = study_def.get("primaryModel", "")
        wm = study_def.get("weightingMethod", "")
        ve = study_def.get("varianceEstimator", "")
        ps = study_def.get("psTrimming", "")

        # Default primary model based on endpoint type
        if not pm:
            defaults_by_type = {
                "time_to_event": "Cox Proportional Hazards",
                "binary": "Logistic Regression",
                "continuous": "ANCOVA",
                "rate": "Negative Binomial Regression",
                "composite": "Cox PH (Time to First Component)",
            }
            pm = defaults_by_type.get(et, "Cox Proportional Hazards")
            assumptions.append(CompilerAssumption(
                field="analysis.primary_model",
                assumed_value=pm,
                reason=f"No analysis model specified. '{pm}' is the standard method for {et} endpoints.",
            ))

        compiled["analysis"]["primary_model"] = pm

        # Default weighting
        if not wm:
            est = compiled["design"]["estimand_type"]
            wm = "IPTW — Stabilized Weights" if est == "ATE" else "IPTW"
            assumptions.append(CompilerAssumption(
                field="analysis.weighting_method",
                assumed_value=wm,
                reason=f"No weighting method specified. '{wm}' is appropriate for {est} estimand.",
            ))

        compiled["analysis"]["weighting_method"] = wm

        # Check estimand-weighting consistency
        est = compiled["design"]["estimand_type"]
        if est == "ATT" and "stabilized" in wm.lower():
            warnings.append(CompilerWarning(
                severity="error",
                category="estimand_inconsistency",
                field="analysis.weighting_method",
                message="Stabilized IPTW targets ATE, but estimand is ATT.",
                recommendation="Use ATT-specific weights or change estimand to ATE.",
            ))
        if est == "ATE" and wm.lower() == "iptw" and "stabilized" not in wm.lower():
            warnings.append(CompilerWarning(
                severity="warning",
                category="estimand_inconsistency",
                field="analysis.weighting_method",
                message="Unstabilized IPTW can produce extreme weights for ATE estimation.",
                recommendation="Consider stabilized IPTW or overlap weights for ATE.",
            ))

        # Default variance estimator
        if not ve:
            ve = "Robust (Sandwich) SE"
            assumptions.append(CompilerAssumption(
                field="analysis.variance_estimator",
                assumed_value=ve,
                reason="Weighted models require robust variance estimation. Sandwich SE is the standard choice.",
            ))
        compiled["analysis"]["variance_estimator"] = ve

        # Check: weighted model should use robust SE
        if any(k in wm.lower() for k in ["iptw", "weight", "overlap", "entropy"]):
            if "robust" not in ve.lower() and "sandwich" not in ve.lower() and "bootstrap" not in ve.lower():
                warnings.append(CompilerWarning(
                    severity="error",
                    category="estimand_inconsistency",
                    field="analysis.variance_estimator",
                    message=f"Weighted analysis ({wm}) requires robust variance estimation, but '{ve}' was specified.",
                    recommendation="Use Robust (Sandwich) SE or Bootstrap for weighted analyses.",
                ))

        # Default PS trimming
        if not ps:
            ps = "1st – 99th Percentile"
            assumptions.append(CompilerAssumption(
                field="analysis.ps_trimming",
                assumed_value=ps,
                reason="No propensity score trimming specified. 1st-99th percentile is the standard default to address positivity violations.",
            ))
        compiled["analysis"]["ps_trimming"] = ps

        compiled["analysis"]["smd_threshold"] = 0.1
        compiled["analysis"]["covariates"] = study_def.get("covariates", [])

        if not compiled["analysis"]["covariates"]:
            warnings.append(CompilerWarning(
                severity="warning",
                category="missing_covariate",
                field="analysis.covariates",
                message="No covariates specified. Propensity score model requires measured confounders.",
                recommendation="Add baseline covariates identified from the causal DAG (e.g., age, sex, comorbidities).",
            ))

        # ── Missing Data ──
        mdp = study_def.get("missingDataPrimary", "")
        mds = study_def.get("missingDataSensitivity", "")
        mdt = study_def.get("missingThreshold", "5")

        if not mdp:
            mdp = "Multiple Imputation (MICE)"
            assumptions.append(CompilerAssumption(
                field="missing_data.primary_method",
                assumed_value=mdp,
                reason="No primary missing data method specified. MICE is the recommended default for regulatory-grade analyses.",
            ))
        if not mds:
            mds = "Complete Case Analysis"
            assumptions.append(CompilerAssumption(
                field="missing_data.sensitivity_method",
                assumed_value=mds,
                reason="No sensitivity method specified. Complete Case Analysis provides a conservative bound.",
            ))

        compiled["missing_data"]["primary_method"] = mdp
        compiled["missing_data"]["sensitivity_method"] = mds

        try:
            compiled["missing_data"]["missingness_threshold"] = float(mdt) / 100 if float(mdt) > 1 else float(mdt)
        except (ValueError, TypeError):
            compiled["missing_data"]["missingness_threshold"] = 0.05
        compiled["missing_data"]["escalation_threshold"] = 0.10

        # ── Intercurrent Events ──
        ice_raw = study_def.get("iceStrategies", [])
        for ice in ice_raw:
            strategy_entry = {
                "event": ice.get("event", ""),
                "strategy": ice.get("strategy", ""),
                "implementation": ice.get("desc", ""),
            }
            if not strategy_entry["implementation"]:
                impl_map = {
                    "Treatment Policy": "Analyze regardless of what happened after the ICE",
                    "Composite": "Treat ICE as component of composite endpoint",
                    "Hypothetical": "Model adjustment to estimate outcome as if ICE had not occurred",
                    "Principal Stratum": "Restrict analysis to principal stratum defined by potential ICE status",
                    "While on Treatment": "Censor at time of ICE",
                }
                strategy_entry["implementation"] = impl_map.get(strategy_entry["strategy"], "Implementation not specified")
                assumptions.append(CompilerAssumption(
                    field=f"intercurrent_events.{strategy_entry['event']}",
                    assumed_value=strategy_entry["implementation"],
                    reason=f"No implementation specified for '{strategy_entry['strategy']}' strategy. Using standard ICH E9(R1) implementation.",
                ))
            compiled["intercurrent_events"]["strategies"].append(strategy_entry)

        if not compiled["intercurrent_events"]["strategies"]:
            warnings.append(CompilerWarning(
                severity="warning",
                category="missing_data_risk",
                field="intercurrent_events.strategies",
                message="No intercurrent event strategies defined.",
                recommendation="Define strategies for treatment discontinuation, rescue therapy, and death (ICH E9(R1) requirement).",
            ))

        # ── Compute completeness ──
        required_fields = [
            compiled["protocol"]["indication"],
            compiled["protocol"]["phase"],
            compiled["protocol"]["regulatory_agency"],
            compiled["design"]["primary_endpoint"],
            compiled["design"]["estimand_type"],
            compiled["design"]["comparator_type"],
            compiled["analysis"]["primary_model"],
            compiled["analysis"]["weighting_method"],
            compiled["analysis"]["variance_estimator"],
            compiled["missing_data"]["primary_method"],
        ]
        filled = sum(1 for f in required_fields if f)
        completeness = filled / len(required_fields) if required_fields else 0.0

        # ── Verdict ──
        error_count = sum(1 for w in warnings if w.severity == "error")
        if missing_critical:
            verdict = "BLOCKED"
        elif error_count > 0:
            verdict = "FAIL"
        elif completeness < 0.7:
            verdict = "WARN"
        else:
            verdict = "PASS"

        return CompilerResult(
            compiled_definition=compiled,
            assumptions=assumptions,
            warnings=warnings,
            missing_critical=missing_critical,
            completeness_score=round(completeness, 2),
            verdict=verdict,
            compiled_at=datetime.utcnow().isoformat(),
        )

    def to_dict(self, result: CompilerResult) -> Dict[str, Any]:
        """Serialize a CompilerResult to a JSON-compatible dict."""
        return {
            "compiled_definition": result.compiled_definition,
            "assumptions": [asdict(a) for a in result.assumptions],
            "warnings": [asdict(w) for w in result.warnings],
            "missing_critical": result.missing_critical,
            "completeness_score": result.completeness_score,
            "verdict": result.verdict,
            "compiled_at": result.compiled_at,
        }
