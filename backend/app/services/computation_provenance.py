"""
Computation Provenance Service
Records deterministic execution manifests for every analytical computation.
Enables "show me the code" traceability from any output back to source.
"""
import hashlib
import inspect
import json
import time
import os
import subprocess
import sys
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar
from functools import wraps

import numpy as np


# -- Execution Manifest ----------------------------------------------------

@dataclass
class ExecutionManifest:
    """Complete provenance record for a single computation."""
    manifest_id: str                        # UUID
    project_id: str
    computation_type: str                   # e.g., "cox_ph", "propensity_score", "iptw_weighting"
    function_path: str                      # e.g., "app.services.statistical_models.StatisticalAnalysisService.compute_cox_proportional_hazards"
    source_file: str                        # Relative path: "backend/app/services/statistical_models.py"
    source_line: int                        # Line number where the function is defined
    git_sha: str                            # Current git commit SHA

    # Input provenance
    input_data_hash: str                    # SHA-256 of input data (sorted JSON)
    input_row_count: int                    # Number of data rows
    input_columns: List[str]               # Column names
    parameter_snapshot: Dict[str, Any]      # All parameters used (JSON-serializable)
    random_seed: int                        # Locked random seed used

    # Output provenance
    output_hash: str                        # SHA-256 of output
    output_summary: Dict[str, Any]          # Key results (HR, CI, p-value, etc.)

    # Timing
    started_at: str                         # ISO timestamp
    completed_at: str                       # ISO timestamp
    duration_ms: float                      # Execution time

    # Dependencies / lineage
    parent_manifest_ids: List[str] = field(default_factory=list)  # IDs of upstream computations
    library_versions: Dict[str, str] = field(default_factory=dict)

    # Determinism metadata
    is_deterministic: bool = True
    replay_command: str = ""                # How to replay this exact computation


# -- Lineage DAG -----------------------------------------------------------

@dataclass
class LineageNode:
    """A node in the data lineage DAG."""
    node_id: str
    node_type: str          # "source_data" | "ingestion" | "cohort_filter" | "weighting" | "model" | "estimate" | "sensitivity" | "output"
    label: str              # Human-readable label
    manifest_id: Optional[str] = None   # Links to ExecutionManifest
    data_hash: str = ""
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    created_at: str = ""


@dataclass
class LineageEdge:
    """An edge in the data lineage DAG."""
    edge_id: str
    from_node: str
    to_node: str
    transformation: str     # Description: "IPTW weighting applied", "Cox PH regression", etc.
    function_path: str      # Code path that performed the transformation
    rows_in: Optional[int] = None
    rows_out: Optional[int] = None
    columns_added: List[str] = field(default_factory=list)
    columns_removed: List[str] = field(default_factory=list)


@dataclass
class LineageDAG:
    """Complete data lineage from source to output."""
    dag_id: str
    project_id: str
    nodes: List[LineageNode] = field(default_factory=list)
    edges: List[LineageEdge] = field(default_factory=list)
    created_at: str = ""

    def add_node(self, node: LineageNode):
        self.nodes.append(node)
        return node.node_id

    def add_edge(self, edge: LineageEdge):
        self.edges.append(edge)
        return edge.edge_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dag_id": self.dag_id,
            "project_id": self.project_id,
            "nodes": [asdict(n) for n in self.nodes],
            "edges": [asdict(e) for e in self.edges],
            "created_at": self.created_at,
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
        }


# -- Code Reference --------------------------------------------------------

@dataclass
class CodeReference:
    """Maps an output artifact to the exact code that produced it."""
    ref_id: str
    artifact_type: str          # "table" | "figure" | "statistic" | "test_result"
    artifact_label: str         # e.g., "Table 14.1: Primary Efficacy Analysis"
    artifact_key: str           # e.g., "primary_hr", "km_figure", "demographics_table"

    # Code location
    function_path: str          # Full qualified function path
    source_file: str            # Relative file path
    source_line: int            # Line number

    # Provenance
    manifest_id: str            # Links to ExecutionManifest
    input_data_hash: str        # What data was used
    output_hash: str            # Hash of this specific artifact

    # Human-readable
    computation_description: str  # "Cox proportional hazards regression with IPTW weights"
    parameters_used: Dict[str, Any] = field(default_factory=dict)


# -- Provenance Tracker ----------------------------------------------------

class ComputationProvenanceTracker:
    """
    Central tracker that records execution manifests for every computation.

    Usage:
        tracker = ComputationProvenanceTracker(project_id)

        # Record a computation
        manifest = tracker.record_computation(
            computation_type="cox_ph",
            func=service.compute_cox_proportional_hazards,
            input_data={"treatment": [...], "time": [...], ...},
            parameters={"alpha": 0.05},
            output={"hr": 0.63, "ci_lower": 0.41, "ci_upper": 0.97},
            parent_ids=["upstream-manifest-id"],
        )

        # Or use the decorator
        @tracker.track("propensity_score")
        def compute_ps(data, covariates):
            ...
    """

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.manifests: List[ExecutionManifest] = []
        self.lineage = LineageDAG(
            dag_id=str(uuid.uuid4()),
            project_id=project_id,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.code_references: List[CodeReference] = []
        self._git_sha: Optional[str] = None
        self._lib_versions: Optional[Dict[str, str]] = None

    # -- Git SHA -----------------------------------------------------------

    def _get_git_sha(self) -> str:
        if self._git_sha is not None:
            return self._git_sha
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True, text=True, timeout=5,
                cwd=os.path.dirname(os.path.abspath(__file__))
            )
            self._git_sha = result.stdout.strip() if result.returncode == 0 else "unknown"
        except Exception:
            self._git_sha = "unknown"
        return self._git_sha

    # -- Library versions --------------------------------------------------

    def _get_library_versions(self) -> Dict[str, str]:
        if self._lib_versions is not None:
            return self._lib_versions
        versions = {"python": sys.version.split()[0], "numpy": np.__version__}
        for lib in ["scipy", "pandas", "lifelines", "statsmodels"]:
            try:
                mod = __import__(lib)
                versions[lib] = getattr(mod, "__version__", "unknown")
            except ImportError:
                pass
        self._lib_versions = versions
        return self._lib_versions

    # -- Hashing -----------------------------------------------------------

    @staticmethod
    def hash_data(data: Any) -> str:
        """Compute a deterministic SHA-256 hash of any JSON-serializable data."""
        if isinstance(data, np.ndarray):
            return hashlib.sha256(data.tobytes()).hexdigest()[:16]
        if isinstance(data, dict):
            serialized = json.dumps(data, sort_keys=True, default=str)
            return hashlib.sha256(serialized.encode()).hexdigest()[:16]
        if isinstance(data, (list, tuple)):
            serialized = json.dumps(data, default=str)
            return hashlib.sha256(serialized.encode()).hexdigest()[:16]
        return hashlib.sha256(str(data).encode()).hexdigest()[:16]

    @staticmethod
    def _extract_data_shape(data: Any) -> Tuple[int, List[str]]:
        """Extract row count and column names from various data formats."""
        if isinstance(data, dict):
            cols = list(data.keys())
            first_val = next(iter(data.values()), None)
            if isinstance(first_val, (list, np.ndarray)):
                return len(first_val), cols
            if isinstance(first_val, dict):
                return len(data), cols
            return 1, cols
        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            return len(data), list(data[0].keys())
        if isinstance(data, np.ndarray):
            if data.ndim == 2:
                return data.shape[0], [f"col_{i}" for i in range(data.shape[1])]
            return len(data), ["value"]
        return 0, []

    @staticmethod
    def _get_function_info(func: Callable) -> Tuple[str, str, int]:
        """Extract function path, source file, and line number."""
        try:
            module = getattr(func, '__module__', '') or ''
            qualname = getattr(func, '__qualname__', '') or getattr(func, '__name__', 'unknown')
            function_path = f"{module}.{qualname}" if module else qualname

            source_file = inspect.getfile(func)
            # Make path relative to project root
            backend_idx = source_file.find("backend")
            if backend_idx >= 0:
                source_file = source_file[backend_idx:]
            source_file = source_file.replace("\\", "/")

            source_lines, start_line = inspect.getsourcelines(func)
            return function_path, source_file, start_line
        except (TypeError, OSError):
            return str(func), "unknown", 0

    @staticmethod
    def _extract_output_summary(output: Any) -> Dict[str, Any]:
        """Extract key numeric results from output for the manifest."""
        summary = {}
        if isinstance(output, dict):
            for key, val in output.items():
                if isinstance(val, (int, float, bool, str)):
                    summary[key] = val
                elif isinstance(val, np.floating):
                    summary[key] = float(val)
                elif isinstance(val, np.integer):
                    summary[key] = int(val)
                elif isinstance(val, dict):
                    for k2, v2 in val.items():
                        if isinstance(v2, (int, float, bool, str)):
                            summary[f"{key}.{k2}"] = v2
        return summary

    # -- Record computation ------------------------------------------------

    def record_computation(
        self,
        computation_type: str,
        func: Callable,
        input_data: Any,
        parameters: Dict[str, Any],
        output: Any,
        random_seed: int = 42,
        parent_ids: Optional[List[str]] = None,
        started_at: Optional[str] = None,
        duration_ms: Optional[float] = None,
    ) -> ExecutionManifest:
        """Record a complete execution manifest for a computation."""

        function_path, source_file, source_line = self._get_function_info(func)
        row_count, columns = self._extract_data_shape(input_data)
        output_summary = self._extract_output_summary(output)

        now = datetime.now(timezone.utc).isoformat()

        manifest = ExecutionManifest(
            manifest_id=str(uuid.uuid4()),
            project_id=self.project_id,
            computation_type=computation_type,
            function_path=function_path,
            source_file=source_file,
            source_line=source_line,
            git_sha=self._get_git_sha(),
            input_data_hash=self.hash_data(input_data),
            input_row_count=row_count,
            input_columns=columns,
            parameter_snapshot=parameters,
            random_seed=random_seed,
            output_hash=self.hash_data(output),
            output_summary=output_summary,
            started_at=started_at or now,
            completed_at=now,
            duration_ms=duration_ms or 0,
            parent_manifest_ids=parent_ids or [],
            library_versions=self._get_library_versions(),
            is_deterministic=True,
            replay_command=self._build_replay_command(computation_type, parameters, random_seed),
        )

        self.manifests.append(manifest)
        return manifest

    def _build_replay_command(self, computation_type: str, params: Dict, seed: int) -> str:
        """Build a human-readable command to replay this exact computation."""
        param_str = ", ".join(f"{k}={repr(v)}" for k, v in sorted(params.items()) if not isinstance(v, (list, dict, np.ndarray)))
        return f"# Replay: np.random.seed({seed}); service.{computation_type}({param_str})"

    # -- Lineage helpers ---------------------------------------------------

    def add_lineage_node(
        self,
        node_type: str,
        label: str,
        manifest_id: Optional[str] = None,
        data_hash: str = "",
        row_count: Optional[int] = None,
        column_count: Optional[int] = None,
    ) -> str:
        """Add a node to the lineage DAG. Returns node_id."""
        node = LineageNode(
            node_id=str(uuid.uuid4()),
            node_type=node_type,
            label=label,
            manifest_id=manifest_id,
            data_hash=data_hash,
            row_count=row_count,
            column_count=column_count,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.lineage.add_node(node)
        return node.node_id

    def add_lineage_edge(
        self,
        from_node: str,
        to_node: str,
        transformation: str,
        function_path: str = "",
        rows_in: Optional[int] = None,
        rows_out: Optional[int] = None,
        columns_added: Optional[List[str]] = None,
        columns_removed: Optional[List[str]] = None,
    ) -> str:
        """Add an edge to the lineage DAG. Returns edge_id."""
        edge = LineageEdge(
            edge_id=str(uuid.uuid4()),
            from_node=from_node,
            to_node=to_node,
            transformation=transformation,
            function_path=function_path,
            rows_in=rows_in,
            rows_out=rows_out,
            columns_added=columns_added or [],
            columns_removed=columns_removed or [],
        )
        self.lineage.add_edge(edge)
        return edge.edge_id

    # -- Code references ---------------------------------------------------

    def add_code_reference(
        self,
        artifact_type: str,
        artifact_label: str,
        artifact_key: str,
        func: Callable,
        manifest_id: str,
        input_data_hash: str,
        output_hash: str,
        computation_description: str,
        parameters: Optional[Dict] = None,
    ) -> CodeReference:
        """Register a code reference mapping an output artifact to its source code."""
        function_path, source_file, source_line = self._get_function_info(func)

        ref = CodeReference(
            ref_id=str(uuid.uuid4()),
            artifact_type=artifact_type,
            artifact_label=artifact_label,
            artifact_key=artifact_key,
            function_path=function_path,
            source_file=source_file,
            source_line=source_line,
            manifest_id=manifest_id,
            input_data_hash=input_data_hash,
            output_hash=output_hash,
            computation_description=computation_description,
            parameters_used=parameters or {},
        )
        self.code_references.append(ref)
        return ref

    # -- Decorator ---------------------------------------------------------

    def track(self, computation_type: str, seed: int = 42):
        """Decorator that automatically records provenance for a function call."""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                np.random.seed(seed)

                input_data = kwargs.get("data", args[0] if args else {})
                parameters = {k: v for k, v in kwargs.items() if k != "data"}

                start_time = time.time()
                started_at = datetime.now(timezone.utc).isoformat()

                result = func(*args, **kwargs)

                duration_ms = (time.time() - start_time) * 1000

                self.record_computation(
                    computation_type=computation_type,
                    func=func,
                    input_data=input_data,
                    parameters=parameters,
                    output=result,
                    random_seed=seed,
                    started_at=started_at,
                    duration_ms=duration_ms,
                )

                return result
            return wrapper
        return decorator

    # -- Full provenance report --------------------------------------------

    def build_provenance_report(self) -> Dict[str, Any]:
        """Build the complete provenance report for storage in processing_config."""
        return {
            "provenance_id": str(uuid.uuid4()),
            "project_id": self.project_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "git_sha": self._get_git_sha(),
            "library_versions": self._get_library_versions(),

            # Execution manifests
            "manifests": [asdict(m) for m in self.manifests],
            "manifest_count": len(self.manifests),

            # Lineage DAG
            "lineage": self.lineage.to_dict(),

            # Code references (for SAR)
            "code_references": [asdict(r) for r in self.code_references],
            "code_reference_count": len(self.code_references),

            # Determinism summary
            "all_deterministic": all(m.is_deterministic for m in self.manifests),
            "total_computations": len(self.manifests),
            "computation_types": list(set(m.computation_type for m in self.manifests)),

            # Replay instructions
            "replay_instructions": {
                "git_checkout": f"git checkout {self._get_git_sha()}",
                "install_deps": "pip install -r requirements.txt",
                "run": f"python -m app.services.computation_provenance --project {self.project_id} --replay",
            },
        }


# -- Provenance-Wrapped Analysis Runner ------------------------------------

class ProvenanceAnalysisRunner:
    """
    Wraps the StatisticalAnalysisService to automatically record provenance
    for every computation in the analysis pipeline.

    This is the main entry point for running a full analysis with provenance.
    It builds the lineage DAG as it goes.
    """

    def __init__(self, project_id: str, processing_config: Dict[str, Any]):
        self.project_id = project_id
        self.config = processing_config
        self.tracker = ComputationProvenanceTracker(project_id)
        self._seed_counter = 0

    def _next_seed(self, base: int = 42) -> int:
        """Generate a deterministic seed for each computation step."""
        self._seed_counter += 1
        return base + self._seed_counter

    def run_full_pipeline(self, data: Optional[Dict] = None, config=None) -> Dict[str, Any]:
        """
        Run the complete analysis pipeline with full provenance tracking.

        This method:
        1. Records each computation step as an ExecutionManifest
        2. Builds the lineage DAG from source data to final outputs
        3. Creates code references for every SAR artifact
        4. Returns full analysis results with embedded provenance report
        """
        from app.services.statistical_models import StatisticalAnalysisService, AnalysisConfig

        stats = StatisticalAnalysisService()
        if config is None:
            config = AnalysisConfig()

        base_seed = config.simulation_seed
        is_simulated = data is None

        # -- Step 1: Source Data -------------------------------------------

        seed = base_seed
        np.random.seed(seed)

        if data is None:
            source_data = stats.generate_simulation_data(seed=seed)
        else:
            source_data = data

        source_hash = self.tracker.hash_data(source_data)
        row_count, columns = self.tracker._extract_data_shape(source_data)

        source_node = self.tracker.add_lineage_node(
            node_type="source_data",
            label="Patient-Level Dataset" if not is_simulated else f"Simulated Data (seed={seed})",
            data_hash=source_hash,
            row_count=row_count,
            column_count=len(columns),
        )

        source_manifest = self.tracker.record_computation(
            computation_type="data_simulation" if is_simulated else "data_ingestion",
            func=stats.generate_simulation_data,
            input_data={"seed": seed} if is_simulated else data,
            parameters={"source": "simulation" if is_simulated else "uploaded", "seed": seed},
            output=source_data,
            random_seed=seed,
        )

        # -- Step 2: Propensity Score Estimation ---------------------------

        start = time.time()
        started_at = datetime.now(timezone.utc).isoformat()

        ps_result = stats.compute_propensity_scores(
            source_data["treatment"], source_data["covariates"],
            source_data["covariate_names"], config=config,
        )

        ps_duration = (time.time() - start) * 1000

        ps_manifest = self.tracker.record_computation(
            computation_type="propensity_score",
            func=stats.compute_propensity_scores,
            input_data=source_data,
            parameters={"optimizer": config.ps_optimizer, "max_iterations": config.ps_max_iterations},
            output=ps_result,
            random_seed=0,
            parent_ids=[source_manifest.manifest_id],
            started_at=started_at,
            duration_ms=ps_duration,
        )

        ps_node = self.tracker.add_lineage_node(
            node_type="model",
            label="Propensity Score Model (Logistic Regression)",
            manifest_id=ps_manifest.manifest_id,
            data_hash=self.tracker.hash_data(ps_result),
            row_count=row_count,
        )
        self.tracker.add_lineage_edge(
            from_node=source_node, to_node=ps_node,
            transformation="Logistic regression: e(X) = P(T=1|X)",
            function_path="app.services.statistical_models.StatisticalAnalysisService.compute_propensity_scores",
            rows_in=row_count, rows_out=row_count,
        )

        self.tracker.add_code_reference(
            artifact_type="table",
            artifact_label="Table 14.2.2: Propensity Score Model",
            artifact_key="propensity_scores",
            func=stats.compute_propensity_scores,
            manifest_id=ps_manifest.manifest_id,
            input_data_hash=source_hash,
            output_hash=self.tracker.hash_data(ps_result),
            computation_description="Logistic regression propensity score estimation: e(X) = P(T=1|X)",
        )

        # -- Step 3: IPTW Weighting ----------------------------------------

        ps_scores = np.array(ps_result["propensity_scores"])

        start = time.time()
        started_at = datetime.now(timezone.utc).isoformat()

        iptw_result = stats.compute_iptw(
            source_data["treatment"], ps_scores,
            stabilized=config.iptw_stabilized,
            trim_percentile=config.iptw_trim_percentile,
            config=config,
        )

        iptw_duration = (time.time() - start) * 1000

        iptw_manifest = self.tracker.record_computation(
            computation_type="iptw_weighting",
            func=stats.compute_iptw,
            input_data={"treatment": source_hash, "ps_scores": self.tracker.hash_data(ps_result)},
            parameters={
                "stabilized": config.iptw_stabilized,
                "trim_percentile": list(config.iptw_trim_percentile),
            },
            output=iptw_result,
            random_seed=0,
            parent_ids=[ps_manifest.manifest_id],
            started_at=started_at,
            duration_ms=iptw_duration,
        )

        weighting_node = self.tracker.add_lineage_node(
            node_type="weighting",
            label="IPTW Weights (stabilized={})".format(config.iptw_stabilized),
            manifest_id=iptw_manifest.manifest_id,
            data_hash=self.tracker.hash_data(iptw_result),
            row_count=row_count,
        )
        self.tracker.add_lineage_edge(
            from_node=ps_node, to_node=weighting_node,
            transformation="IPTW: w_treated = 1/e(X), w_control = 1/(1-e(X))",
            function_path="app.services.statistical_models.StatisticalAnalysisService.compute_iptw",
            rows_in=row_count, rows_out=row_count,
            columns_added=["iptw_weight", "stabilized_weight"],
        )

        self.tracker.add_code_reference(
            artifact_type="table",
            artifact_label="Table 14.2.3: IPTW Weight Distribution",
            artifact_key="iptw_weights",
            func=stats.compute_iptw,
            manifest_id=iptw_manifest.manifest_id,
            input_data_hash=self.tracker.hash_data(ps_result),
            output_hash=self.tracker.hash_data(iptw_result),
            computation_description="Inverse probability of treatment weighting with stabilization and percentile trimming",
        )

        # -- Step 4: Cox Proportional Hazards ------------------------------

        start = time.time()
        started_at = datetime.now(timezone.utc).isoformat()

        cox_result = stats.compute_cox_proportional_hazards(
            source_data["time_to_event"], source_data["event_indicator"],
            source_data["treatment"], source_data["covariates"],
            source_data["covariate_names"], config=config,
        )

        cox_duration = (time.time() - start) * 1000

        cox_manifest = self.tracker.record_computation(
            computation_type="cox_proportional_hazards",
            func=stats.compute_cox_proportional_hazards,
            input_data=source_data,
            parameters={
                "max_iterations": config.cox_max_iterations,
                "convergence_tol": config.cox_convergence_tol,
                "alpha": config.alpha,
                "bootstrap_iterations": config.bootstrap_iterations,
            },
            output=cox_result,
            random_seed=config.bootstrap_seed,
            parent_ids=[iptw_manifest.manifest_id],
            started_at=started_at,
            duration_ms=cox_duration,
        )

        estimate_node = self.tracker.add_lineage_node(
            node_type="estimate",
            label="Primary Estimate: HR (Cox PH with IPTW)",
            manifest_id=cox_manifest.manifest_id,
            data_hash=self.tracker.hash_data(cox_result),
        )
        self.tracker.add_lineage_edge(
            from_node=weighting_node, to_node=estimate_node,
            transformation="Cox PH: h(t|X) = h0(t) * exp(beta'X), IPTW-weighted",
            function_path="app.services.statistical_models.StatisticalAnalysisService.compute_cox_proportional_hazards",
            rows_in=row_count,
        )

        self.tracker.add_code_reference(
            artifact_type="table",
            artifact_label="Table 14.2.1: Primary Efficacy Analysis -- Hazard Ratio",
            artifact_key="primary_hr",
            func=stats.compute_cox_proportional_hazards,
            manifest_id=cox_manifest.manifest_id,
            input_data_hash=self.tracker.hash_data(iptw_result),
            output_hash=self.tracker.hash_data(cox_result),
            computation_description="Cox proportional hazards regression with IPTW weights, Newton-Raphson optimization",
            parameters={
                "max_iterations": config.cox_max_iterations,
                "alpha": config.alpha,
                "bootstrap_seed": config.bootstrap_seed,
            },
        )

        # -- Step 5: E-value -----------------------------------------------

        hr_val = None
        if cox_result.get("coefficients", {}).get("treatment"):
            hr_val = cox_result["coefficients"]["treatment"].get("hazard_ratio")

        sensitivity_node = None
        if hr_val is not None:
            start = time.time()
            started_at = datetime.now(timezone.utc).isoformat()

            e_value_result = stats.compute_e_value(hr_val)

            e_duration = (time.time() - start) * 1000

            ev_manifest = self.tracker.record_computation(
                computation_type="e_value",
                func=stats.compute_e_value,
                input_data={"hazard_ratio": hr_val},
                parameters={"formula": "E = RR + sqrt(RR*(RR-1))"},
                output=e_value_result,
                random_seed=0,
                parent_ids=[cox_manifest.manifest_id],
                started_at=started_at,
                duration_ms=e_duration,
            )

            sensitivity_node = self.tracker.add_lineage_node(
                node_type="sensitivity",
                label="E-value: Unmeasured Confounding Robustness",
                manifest_id=ev_manifest.manifest_id,
                data_hash=self.tracker.hash_data(e_value_result),
            )
            self.tracker.add_lineage_edge(
                from_node=estimate_node, to_node=sensitivity_node,
                transformation="E-value: E = RR + sqrt(RR*(RR-1))",
                function_path="app.services.statistical_models.StatisticalAnalysisService.compute_e_value",
            )

            self.tracker.add_code_reference(
                artifact_type="table",
                artifact_label="Table 14.2.4: E-value for Unmeasured Confounding",
                artifact_key="e_value",
                func=stats.compute_e_value,
                manifest_id=ev_manifest.manifest_id,
                input_data_hash=self.tracker.hash_data({"hazard_ratio": hr_val}),
                output_hash=self.tracker.hash_data(e_value_result),
                computation_description="VanderWeele-Ding E-value: minimum strength of unmeasured confounder to explain away the effect",
            )

        # -- Step 6: Kaplan-Meier ------------------------------------------

        start = time.time()
        started_at = datetime.now(timezone.utc).isoformat()

        km_result = stats.compute_kaplan_meier(
            source_data["time_to_event"], source_data["event_indicator"],
            source_data["treatment"],
        )

        km_duration = (time.time() - start) * 1000

        km_manifest = self.tracker.record_computation(
            computation_type="kaplan_meier",
            func=stats.compute_kaplan_meier,
            input_data=source_data,
            parameters={"method": "product_limit"},
            output=km_result,
            random_seed=0,
            parent_ids=[source_manifest.manifest_id],
            started_at=started_at,
            duration_ms=km_duration,
        )

        km_node = self.tracker.add_lineage_node(
            node_type="estimate",
            label="Kaplan-Meier Survival Curves",
            manifest_id=km_manifest.manifest_id,
            data_hash=self.tracker.hash_data(km_result),
        )
        self.tracker.add_lineage_edge(
            from_node=source_node, to_node=km_node,
            transformation="Product-limit estimator: S(t) = prod(1 - d_i/n_i)",
            function_path="app.services.statistical_models.StatisticalAnalysisService.compute_kaplan_meier",
            rows_in=row_count,
        )

        self.tracker.add_code_reference(
            artifact_type="figure",
            artifact_label="Figure 14.1.1: Kaplan-Meier Survival Curves",
            artifact_key="km_figure",
            func=stats.compute_kaplan_meier,
            manifest_id=km_manifest.manifest_id,
            input_data_hash=source_hash,
            output_hash=self.tracker.hash_data(km_result),
            computation_description="Product-limit survival estimator with 95% confidence bands",
        )

        # -- Step 7: SAR Output Node ---------------------------------------

        output_node = self.tracker.add_lineage_node(
            node_type="output",
            label="Submission Analysis Report (SAR)",
            data_hash=self.tracker.hash_data({"cox": self.tracker.hash_data(cox_result), "km": self.tracker.hash_data(km_result)}),
        )

        self.tracker.add_lineage_edge(
            from_node=estimate_node, to_node=output_node,
            transformation="Primary efficacy results -> SAR Table 14.2.1",
            function_path="app.services.tfl_generator",
        )
        self.tracker.add_lineage_edge(
            from_node=km_node, to_node=output_node,
            transformation="Survival curves -> SAR Figure 14.1.1",
            function_path="app.services.tfl_generator",
        )
        if sensitivity_node is not None:
            self.tracker.add_lineage_edge(
                from_node=sensitivity_node, to_node=output_node,
                transformation="Sensitivity analysis -> SAR Section 14.3",
                function_path="app.services.tfl_generator",
            )

        # -- Run full analysis for complete results ------------------------
        full_results = stats.run_full_analysis(seed=base_seed, data=source_data, config=config)

        # -- Build final report --------------------------------------------

        provenance_report = self.tracker.build_provenance_report()

        full_results["computation_provenance"] = provenance_report
        full_results["data_provenance"] = {
            "is_simulated": is_simulated,
            "source_data_hash": source_hash,
            "random_seed": seed if is_simulated else None,
            "deterministic": provenance_report.get("all_deterministic", True),
            "replay_instructions": provenance_report.get("replay_instructions", {}),
        }

        return full_results
