"""
Intelligent Workflow Services for Afarensis Enterprise

Smart workflow orchestration, AI-powered guidance, and adaptive user experience
for regulatory evidence review processes.
"""

import uuid
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import networkx as nx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import Project, EvidenceRecord, ReviewDecision, User, ComparabilityScore
from app.core.exceptions import ProcessingError, ValidationError
from app.core.config import settings
from app.services import BaseService

logger = logging.getLogger(__name__)


class WorkflowStage(Enum):
    """Workflow stages in evidence review process"""
    PROJECT_SETUP = "project_setup"
    PROTOCOL_ANALYSIS = "protocol_analysis"
    EVIDENCE_DISCOVERY = "evidence_discovery"
    EVIDENCE_EXTRACTION = "evidence_extraction"
    QUALITY_ASSESSMENT = "quality_assessment"
    COMPARABILITY_ANALYSIS = "comparability_analysis"
    BIAS_ANALYSIS = "bias_analysis"
    EXPERT_REVIEW = "expert_review"
    REGULATORY_CRITIQUE = "regulatory_critique"
    ARTIFACT_GENERATION = "artifact_generation"
    FINAL_VALIDATION = "final_validation"


class WorkflowPriority(Enum):
    """Priority levels for workflow recommendations"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class UserExpertiseLevel(Enum):
    """User expertise levels for adaptive UI"""
    NOVICE = "novice"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"
    SPECIALIST = "specialist"


@dataclass
class WorkflowStep:
    """Individual workflow step definition"""
    id: str
    title: str
    description: str
    stage: WorkflowStage
    prerequisites: List[str]
    estimated_duration: timedelta
    ai_confidence: float
    required_expertise: UserExpertiseLevel
    automation_available: bool
    quality_checkpoints: List[str]
    regulatory_significance: bool


@dataclass
class WorkflowRecommendation:
    """AI-powered workflow recommendation"""
    step_id: str
    priority: WorkflowPriority
    rationale: str
    estimated_impact: float
    confidence: float
    automation_suggestion: Optional[str]
    expert_consultation_recommended: bool
    regulatory_considerations: List[str]


@dataclass
class WorkflowProgress:
    """Current workflow progress tracking"""
    project_id: str
    completed_steps: List[str]
    current_step: Optional[str]
    next_recommended_steps: List[WorkflowRecommendation]
    overall_progress: float
    estimated_completion: datetime
    quality_score: float
    regulatory_readiness: float
    blockers: List[str]


@dataclass
class AdaptiveUIConfiguration:
    """Adaptive UI configuration based on user context"""
    user_id: str
    expertise_level: UserExpertiseLevel
    preferred_detail_level: str
    information_density: float
    automation_preferences: Dict[str, bool]
    customized_shortcuts: List[str]
    cognitive_load_threshold: float


class IntelligentWorkflowService(BaseService):
    """Intelligent workflow orchestration and guidance"""
    
    def __init__(self, db: AsyncSession, current_user: Dict[str, Any] = None):
        super().__init__(db, current_user)
        self.workflow_engine = WorkflowOrchestrationEngine()
        self.ai_advisor = AIWorkflowAdvisor()
        self.progress_tracker = ProgressTrackingEngine()
        self.ui_adapter = AdaptiveUIEngine()
        self.quality_gate = QualityGateEngine()
    
    async def get_intelligent_workflow_guidance(
        self,
        project_id: uuid.UUID,
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Get AI-powered workflow guidance for project"""
        
        try:
            # Get current project state
            project_state = await self._analyze_project_state(project_id)
            
            # Get user expertise and preferences
            user_profile = await self._get_user_profile_for_workflow(
                self.user_id, user_context
            )
            
            # Generate workflow recommendations
            recommendations = await self.ai_advisor.generate_workflow_recommendations(
                project_state, user_profile
            )
            
            # Calculate progress and estimates
            progress = await self.progress_tracker.calculate_workflow_progress(
                project_state, recommendations
            )
            
            # Generate adaptive UI configuration
            ui_config = await self.ui_adapter.generate_adaptive_ui_config(
                user_profile, project_state, recommendations
            )
            
            # Check quality gates
            quality_status = await self.quality_gate.check_quality_gates(
                project_state, progress
            )
            
            # Log workflow guidance request
            await self.log_action(
                action="intelligent_workflow_guidance",
                resource_type="workflow",
                resource_id=str(project_id),
                details={
                    "recommendations_count": len(recommendations),
                    "progress_percentage": progress.overall_progress,
                    "quality_gate_status": quality_status.get("status"),
                    "user_expertise": user_profile.get("expertise_level")
                }
            )
            
            return {
                "project_id": str(project_id),
                "workflow_recommendations": [r.__dict__ for r in recommendations],
                "progress_tracking": progress.__dict__,
                "adaptive_ui_config": ui_config.__dict__,
                "quality_gate_status": quality_status,
                "intelligent_insights": await self._generate_intelligent_insights(
                    project_state, recommendations, progress
                ),
                "next_best_actions": await self._generate_next_best_actions(
                    recommendations, user_profile
                )
            }
            
        except Exception as e:
            logger.error(f"Workflow guidance generation failed for project {project_id}: {str(e)}")
            raise ProcessingError(
                message=f"Workflow guidance failed: {str(e)}",
                error_code="WORKFLOW_GUIDANCE_FAILED",
                details={"project_id": str(project_id), "error": str(e)}
            )
    
    async def execute_intelligent_workflow_step(
        self,
        project_id: uuid.UUID,
        step_id: str,
        automation_level: str = "assisted"
    ) -> Dict[str, Any]:
        """Execute workflow step with AI assistance"""
        
        # Get step definition
        step_definition = await self.workflow_engine.get_step_definition(step_id)
        
        # Check prerequisites
        prerequisites_met = await self._check_step_prerequisites(
            project_id, step_definition.prerequisites
        )
        
        if not prerequisites_met["all_met"]:
            raise ValidationError(
                message="Step prerequisites not met",
                error_code="PREREQUISITES_NOT_MET",
                details=prerequisites_met
            )
        
        # Execute step with appropriate automation
        if automation_level == "automated" and step_definition.automation_available:
            result = await self._execute_automated_step(project_id, step_definition)
        elif automation_level == "assisted":
            result = await self._execute_assisted_step(project_id, step_definition)
        else:
            result = await self._execute_manual_step(project_id, step_definition)
        
        # Update workflow progress
        await self._update_workflow_progress(project_id, step_id, result)
        
        # Check quality gates after step completion
        quality_check = await self.quality_gate.validate_step_completion(
            project_id, step_id, result
        )
        
        # Generate next step recommendations
        next_recommendations = await self.ai_advisor.generate_next_step_recommendations(
            project_id, step_id, result
        )
        
        return {
            "step_id": step_id,
            "execution_result": result,
            "quality_validation": quality_check,
            "next_recommendations": next_recommendations,
            "workflow_updated": True
        }
    
    async def optimize_workflow_for_user(
        self,
        user_id: uuid.UUID,
        workflow_history: List[Dict[str, Any]],
        performance_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize workflow based on user behavior and performance"""
        
        # Analyze user workflow patterns
        pattern_analysis = await self._analyze_user_workflow_patterns(
            user_id, workflow_history
        )
        
        # Identify optimization opportunities
        optimization_opportunities = await self._identify_optimization_opportunities(
            pattern_analysis, performance_metrics
        )
        
        # Generate personalized workflow configuration
        personalized_config = await self._generate_personalized_workflow_config(
            user_id, pattern_analysis, optimization_opportunities
        )
        
        # Update user preferences
        await self._update_user_workflow_preferences(user_id, personalized_config)
        
        return {
            "user_id": str(user_id),
            "pattern_analysis": pattern_analysis,
            "optimization_opportunities": optimization_opportunities,
            "personalized_configuration": personalized_config,
            "estimated_efficiency_gain": await self._calculate_efficiency_gain(
                pattern_analysis, personalized_config
            )
        }
    
    async def _analyze_project_state(self, project_id: uuid.UUID) -> Dict[str, Any]:
        """Comprehensive analysis of current project state"""
        
        # Get project and related data
        project_query = select(Project).where(Project.id == project_id)
        project_result = await self.db.execute(project_query)
        project = project_result.scalar_one_or_none()
        
        if not project:
            raise ValidationError(
                message="Project not found",
                error_code="PROJECT_NOT_FOUND"
            )
        
        # Get evidence records count and quality
        evidence_query = select(
            func.count(EvidenceRecord.id).label("total_evidence"),
            func.avg(EvidenceRecord.quality_score).label("avg_quality")
        ).where(EvidenceRecord.project_id == project_id)
        evidence_result = await self.db.execute(evidence_query)
        evidence_stats = evidence_result.first()
        
        # Get review decisions count
        review_query = select(
            func.count(ReviewDecision.id).label("total_reviews"),
            func.count(ReviewDecision.id).filter(
                ReviewDecision.is_final == True
            ).label("final_reviews")
        ).join(EvidenceRecord).where(EvidenceRecord.project_id == project_id)
        review_result = await self.db.execute(review_query)
        review_stats = review_result.first()
        
        # Get comparability scores
        comparability_query = select(
            func.avg(ComparabilityScore.composite_score).label("avg_comparability"),
            func.count(ComparabilityScore.id).label("scored_evidence")
        ).where(ComparabilityScore.project_id == project_id)
        comparability_result = await self.db.execute(comparability_query)
        comparability_stats = comparability_result.first()
        
        return {
            "project": {
                "id": str(project.id),
                "name": project.name,
                "status": project.status.value,
                "created_at": project.created_at.isoformat(),
                "therapeutic_area": project.therapeutic_area,
                "indication": project.indication
            },
            "evidence_metrics": {
                "total_evidence": evidence_stats.total_evidence or 0,
                "average_quality": float(evidence_stats.avg_quality or 0),
                "reviewed_count": review_stats.total_reviews or 0,
                "final_reviews": review_stats.final_reviews or 0,
                "scored_evidence": comparability_stats.scored_evidence or 0,
                "average_comparability": float(comparability_stats.avg_comparability or 0)
            },
            "workflow_stage": await self._determine_current_workflow_stage(project, evidence_stats, review_stats),
            "data_completeness": await self._assess_data_completeness(project_id),
            "regulatory_readiness": await self._assess_regulatory_readiness(project_id)
        }


class WorkflowOrchestrationEngine:
    """Core workflow orchestration and step management"""
    
    def __init__(self):
        self.workflow_graph = self._build_workflow_graph()
        self.step_definitions = self._load_step_definitions()
    
    def _build_workflow_graph(self) -> nx.DiGraph:
        """Build directed graph of workflow dependencies"""
        G = nx.DiGraph()
        
        # Add workflow stages as nodes
        stages = [
            ("project_setup", {"duration": 30, "complexity": 1}),
            ("protocol_analysis", {"duration": 120, "complexity": 3}),
            ("evidence_discovery", {"duration": 180, "complexity": 2}),
            ("evidence_extraction", {"duration": 240, "complexity": 4}),
            ("quality_assessment", {"duration": 90, "complexity": 3}),
            ("comparability_analysis", {"duration": 150, "complexity": 4}),
            ("bias_analysis", {"duration": 120, "complexity": 4}),
            ("expert_review", {"duration": 180, "complexity": 2}),
            ("regulatory_critique", {"duration": 90, "complexity": 5}),
            ("artifact_generation", {"duration": 60, "complexity": 2}),
            ("final_validation", {"duration": 45, "complexity": 3})
        ]
        
        G.add_nodes_from(stages)
        
        # Add workflow dependencies
        dependencies = [
            ("project_setup", "protocol_analysis"),
            ("protocol_analysis", "evidence_discovery"),
            ("evidence_discovery", "evidence_extraction"),
            ("evidence_extraction", "quality_assessment"),
            ("quality_assessment", "comparability_analysis"),
            ("quality_assessment", "bias_analysis"),
            ("comparability_analysis", "expert_review"),
            ("bias_analysis", "expert_review"),
            ("expert_review", "regulatory_critique"),
            ("regulatory_critique", "artifact_generation"),
            ("artifact_generation", "final_validation")
        ]
        
        G.add_edges_from(dependencies)
        
        return G
    
    def _load_step_definitions(self) -> Dict[str, WorkflowStep]:
        """Load detailed step definitions"""
        return {
            "project_setup": WorkflowStep(
                id="project_setup",
                title="Project Setup & Configuration",
                description="Initialize project with protocol upload and configuration",
                stage=WorkflowStage.PROJECT_SETUP,
                prerequisites=[],
                estimated_duration=timedelta(minutes=30),
                ai_confidence=0.9,
                required_expertise=UserExpertiseLevel.NOVICE,
                automation_available=True,
                quality_checkpoints=["protocol_uploaded", "metadata_complete"],
                regulatory_significance=True
            ),
            "protocol_analysis": WorkflowStep(
                id="protocol_analysis",
                title="Protocol & SAP Analysis",
                description="AI-powered extraction of study design and endpoints",
                stage=WorkflowStage.PROTOCOL_ANALYSIS,
                prerequisites=["project_setup"],
                estimated_duration=timedelta(hours=2),
                ai_confidence=0.8,
                required_expertise=UserExpertiseLevel.INTERMEDIATE,
                automation_available=True,
                quality_checkpoints=["endpoints_extracted", "population_defined", "methodology_analyzed"],
                regulatory_significance=True
            ),
            "evidence_discovery": WorkflowStep(
                id="evidence_discovery",
                title="Evidence Discovery & Retrieval",
                description="Automated search of literature and trial databases",
                stage=WorkflowStage.EVIDENCE_DISCOVERY,
                prerequisites=["protocol_analysis"],
                estimated_duration=timedelta(hours=3),
                ai_confidence=0.85,
                required_expertise=UserExpertiseLevel.NOVICE,
                automation_available=True,
                quality_checkpoints=["search_strategy_defined", "minimum_evidence_threshold_met"],
                regulatory_significance=False
            ),
            # Add more step definitions...
        }
    
    async def get_step_definition(self, step_id: str) -> WorkflowStep:
        """Get step definition by ID"""
        if step_id not in self.step_definitions:
            raise ValidationError(
                message=f"Unknown workflow step: {step_id}",
                error_code="UNKNOWN_WORKFLOW_STEP"
            )
        
        return self.step_definitions[step_id]
    
    async def get_next_possible_steps(
        self, 
        completed_steps: List[str]
    ) -> List[WorkflowStep]:
        """Get next possible steps based on completed steps"""
        
        next_steps = []
        
        for step_id, step_def in self.step_definitions.items():
            if step_id in completed_steps:
                continue
            
            # Check if all prerequisites are met
            prerequisites_met = all(
                prereq in completed_steps 
                for prereq in step_def.prerequisites
            )
            
            if prerequisites_met:
                next_steps.append(step_def)
        
        return next_steps
    
    async def calculate_critical_path(
        self, 
        completed_steps: List[str],
        target_completion: Optional[datetime] = None
    ) -> List[str]:
        """Calculate critical path for workflow completion"""
        
        # Create subgraph of remaining steps
        remaining_nodes = [
            node for node in self.workflow_graph.nodes()
            if node not in completed_steps
        ]
        
        subgraph = self.workflow_graph.subgraph(remaining_nodes)
        
        # Calculate longest path (critical path)
        if subgraph.nodes():
            try:
                critical_path = nx.dag_longest_path(subgraph, weight='duration')
                return critical_path
            except:
                # Fallback to topological sort if longest path fails
                return list(nx.topological_sort(subgraph))
        
        return []


class AIWorkflowAdvisor:
    """AI-powered workflow recommendations and guidance"""
    
    async def generate_workflow_recommendations(
        self,
        project_state: Dict[str, Any],
        user_profile: Dict[str, Any]
    ) -> List[WorkflowRecommendation]:
        """Generate intelligent workflow recommendations"""
        
        recommendations = []
        
        # Analyze current project state
        evidence_count = project_state["evidence_metrics"]["total_evidence"]
        avg_quality = project_state["evidence_metrics"]["average_quality"]
        review_completion = self._calculate_review_completion_rate(project_state)
        
        # Evidence discovery recommendations
        if evidence_count < 10:
            recommendations.append(WorkflowRecommendation(
                step_id="evidence_discovery_expansion",
                priority=WorkflowPriority.HIGH,
                rationale="Insufficient evidence base for robust analysis",
                estimated_impact=0.8,
                confidence=0.9,
                automation_suggestion="Expand search terms and databases",
                expert_consultation_recommended=False,
                regulatory_considerations=["Evidence sufficiency for regulatory review"]
            ))
        
        # Quality improvement recommendations
        if avg_quality < 0.7:
            recommendations.append(WorkflowRecommendation(
                step_id="evidence_quality_enhancement",
                priority=WorkflowPriority.MEDIUM,
                rationale="Evidence quality below optimal threshold",
                estimated_impact=0.6,
                confidence=0.8,
                automation_suggestion="Run enhanced quality assessment algorithms",
                expert_consultation_recommended=True,
                regulatory_considerations=["Regulatory acceptance risk due to quality concerns"]
            ))
        
        # Review completion recommendations
        if review_completion < 0.8:
            recommendations.append(WorkflowRecommendation(
                step_id="accelerate_review_process",
                priority=WorkflowPriority.HIGH,
                rationale="Review process lagging behind schedule",
                estimated_impact=0.7,
                confidence=0.85,
                automation_suggestion="Enable batch review workflows",
                expert_consultation_recommended=False,
                regulatory_considerations=["Timeline impact on submission deadlines"]
            ))
        
        # Adaptive recommendations based on user expertise
        user_expertise = user_profile.get("expertise_level", UserExpertiseLevel.INTERMEDIATE)
        
        if user_expertise == UserExpertiseLevel.NOVICE:
            recommendations.append(WorkflowRecommendation(
                step_id="guided_tutorial_mode",
                priority=WorkflowPriority.MEDIUM,
                rationale="Enable guided mode for new users",
                estimated_impact=0.5,
                confidence=0.9,
                automation_suggestion="Activate contextual help and tutorials",
                expert_consultation_recommended=True,
                regulatory_considerations=[]
            ))
        
        return recommendations
    
    async def generate_next_step_recommendations(
        self,
        project_id: uuid.UUID,
        completed_step_id: str,
        step_result: Dict[str, Any]
    ) -> List[WorkflowRecommendation]:
        """Generate recommendations for next steps after completing a step"""
        
        recommendations = []
        
        # Analyze step results
        step_quality = step_result.get("quality_score", 0.5)
        automation_success = step_result.get("automation_success", False)
        issues_detected = step_result.get("issues", [])
        
        # Quality-based recommendations
        if step_quality < 0.6:
            recommendations.append(WorkflowRecommendation(
                step_id="quality_improvement_review",
                priority=WorkflowPriority.HIGH,
                rationale="Step quality below acceptable threshold",
                estimated_impact=0.8,
                confidence=0.9,
                automation_suggestion="Run quality enhancement algorithms",
                expert_consultation_recommended=True,
                regulatory_considerations=["Quality impact on regulatory acceptance"]
            ))
        
        # Issue-based recommendations
        if issues_detected:
            for issue in issues_detected:
                recommendations.append(WorkflowRecommendation(
                    step_id=f"resolve_issue_{issue['type']}",
                    priority=WorkflowPriority.HIGH if issue.get("severity") == "high" else WorkflowPriority.MEDIUM,
                    rationale=f"Address detected issue: {issue['description']}",
                    estimated_impact=0.7,
                    confidence=0.8,
                    automation_suggestion=issue.get("suggested_resolution"),
                    expert_consultation_recommended=issue.get("requires_expert", False),
                    regulatory_considerations=issue.get("regulatory_impact", [])
                ))
        
        return recommendations
    
    def _calculate_review_completion_rate(self, project_state: Dict[str, Any]) -> float:
        """Calculate review completion rate"""
        evidence_count = project_state["evidence_metrics"]["total_evidence"]
        reviewed_count = project_state["evidence_metrics"]["reviewed_count"]
        
        if evidence_count == 0:
            return 0.0
        
        return reviewed_count / evidence_count


class ProgressTrackingEngine:
    """Advanced progress tracking and estimation"""
    
    async def calculate_workflow_progress(
        self,
        project_state: Dict[str, Any],
        recommendations: List[WorkflowRecommendation]
    ) -> WorkflowProgress:
        """Calculate comprehensive workflow progress"""
        
        # Determine completed steps based on project state
        completed_steps = await self._determine_completed_steps(project_state)
        
        # Calculate overall progress
        total_steps = len(WorkflowStage)
        completed_step_count = len(completed_steps)
        overall_progress = completed_step_count / total_steps
        
        # Estimate completion time
        estimated_completion = await self._estimate_completion_time(
            completed_steps, project_state
        )
        
        # Calculate quality score
        quality_score = await self._calculate_overall_quality_score(project_state)
        
        # Assess regulatory readiness
        regulatory_readiness = project_state.get("regulatory_readiness", 0.5)
        
        # Identify blockers
        blockers = await self._identify_workflow_blockers(project_state, recommendations)
        
        return WorkflowProgress(
            project_id=project_state["project"]["id"],
            completed_steps=completed_steps,
            current_step=await self._determine_current_step(project_state),
            next_recommended_steps=recommendations,
            overall_progress=overall_progress,
            estimated_completion=estimated_completion,
            quality_score=quality_score,
            regulatory_readiness=regulatory_readiness,
            blockers=blockers
        )
    
    async def _determine_completed_steps(self, project_state: Dict[str, Any]) -> List[str]:
        """Determine which workflow steps have been completed"""
        completed = []
        
        # Project setup
        if project_state["project"]["name"]:
            completed.append("project_setup")
        
        # Protocol analysis
        if project_state.get("data_completeness", {}).get("protocol_analyzed", False):
            completed.append("protocol_analysis")
        
        # Evidence discovery
        if project_state["evidence_metrics"]["total_evidence"] > 0:
            completed.append("evidence_discovery")
        
        # Evidence extraction
        if project_state["evidence_metrics"]["average_quality"] > 0:
            completed.append("evidence_extraction")
        
        # Quality assessment
        if project_state["evidence_metrics"]["scored_evidence"] > 0:
            completed.append("quality_assessment")
        
        # Comparability analysis
        if project_state["evidence_metrics"]["average_comparability"] > 0:
            completed.append("comparability_analysis")
        
        # Expert review
        if project_state["evidence_metrics"]["reviewed_count"] > 0:
            completed.append("expert_review")
        
        return completed
    
    async def _estimate_completion_time(
        self,
        completed_steps: List[str],
        project_state: Dict[str, Any]
    ) -> datetime:
        """Estimate workflow completion time"""
        
        # Base estimation on remaining steps and current velocity
        remaining_steps = len(WorkflowStage) - len(completed_steps)
        
        # Average time per step (could be improved with ML model)
        avg_step_duration = timedelta(hours=4)
        
        # Adjust based on project complexity
        evidence_count = project_state["evidence_metrics"]["total_evidence"]
        complexity_multiplier = 1.0 + (evidence_count / 100)
        
        estimated_duration = avg_step_duration * remaining_steps * complexity_multiplier
        
        return datetime.utcnow() + estimated_duration
    
    async def _calculate_overall_quality_score(self, project_state: Dict[str, Any]) -> float:
        """Calculate overall workflow quality score"""
        
        quality_components = [
            project_state["evidence_metrics"]["average_quality"] * 0.4,
            project_state["evidence_metrics"]["average_comparability"] * 0.3,
            project_state.get("data_completeness", {}).get("score", 0.5) * 0.3
        ]
        
        return sum(quality_components)


class AdaptiveUIEngine:
    """Adaptive user interface configuration based on user context"""
    
    async def generate_adaptive_ui_config(
        self,
        user_profile: Dict[str, Any],
        project_state: Dict[str, Any],
        recommendations: List[WorkflowRecommendation]
    ) -> AdaptiveUIConfiguration:
        """Generate adaptive UI configuration"""
        
        expertise_level = UserExpertiseLevel(
            user_profile.get("expertise_level", "intermediate")
        )
        
        # Determine information density based on expertise
        if expertise_level == UserExpertiseLevel.NOVICE:
            information_density = 0.3
            detail_level = "simplified"
        elif expertise_level == UserExpertiseLevel.INTERMEDIATE:
            information_density = 0.6
            detail_level = "standard"
        elif expertise_level == UserExpertiseLevel.EXPERT:
            information_density = 0.8
            detail_level = "detailed"
        else:  # SPECIALIST
            information_density = 1.0
            detail_level = "comprehensive"
        
        # Determine automation preferences
        automation_preferences = {
            "auto_quality_assessment": expertise_level in [UserExpertiseLevel.NOVICE, UserExpertiseLevel.INTERMEDIATE],
            "auto_bias_detection": True,
            "auto_recommendation_application": expertise_level == UserExpertiseLevel.NOVICE,
            "batch_operations": expertise_level in [UserExpertiseLevel.EXPERT, UserExpertiseLevel.SPECIALIST]
        }
        
        # Generate customized shortcuts based on workflow patterns
        customized_shortcuts = await self._generate_customized_shortcuts(
            user_profile, project_state, recommendations
        )
        
        # Calculate cognitive load threshold
        cognitive_load_threshold = 0.7 if expertise_level == UserExpertiseLevel.NOVICE else 0.9
        
        return AdaptiveUIConfiguration(
            user_id=user_profile["user_id"],
            expertise_level=expertise_level,
            preferred_detail_level=detail_level,
            information_density=information_density,
            automation_preferences=automation_preferences,
            customized_shortcuts=customized_shortcuts,
            cognitive_load_threshold=cognitive_load_threshold
        )
    
    async def _generate_customized_shortcuts(
        self,
        user_profile: Dict[str, Any],
        project_state: Dict[str, Any],
        recommendations: List[WorkflowRecommendation]
    ) -> List[str]:
        """Generate customized shortcuts based on user patterns"""
        
        shortcuts = []
        
        # High-priority recommendations become shortcuts
        for rec in recommendations:
            if rec.priority in [WorkflowPriority.CRITICAL, WorkflowPriority.HIGH]:
                shortcuts.append(f"quick_action_{rec.step_id}")
        
        # Common workflows become shortcuts
        evidence_count = project_state["evidence_metrics"]["total_evidence"]
        
        if evidence_count > 20:
            shortcuts.append("bulk_review_mode")
        
        if project_state["evidence_metrics"]["average_quality"] < 0.7:
            shortcuts.append("quality_enhancement_wizard")
        
        return shortcuts


class QualityGateEngine:
    """Quality gate validation and enforcement"""
    
    async def check_quality_gates(
        self,
        project_state: Dict[str, Any],
        progress: WorkflowProgress
    ) -> Dict[str, Any]:
        """Check all quality gates for current progress"""
        
        quality_gates = []
        
        # Evidence sufficiency gate
        evidence_gate = await self._check_evidence_sufficiency_gate(project_state)
        quality_gates.append(evidence_gate)
        
        # Quality threshold gate
        quality_gate = await self._check_quality_threshold_gate(project_state)
        quality_gates.append(quality_gate)
        
        # Review completion gate
        review_gate = await self._check_review_completion_gate(project_state)
        quality_gates.append(review_gate)
        
        # Regulatory readiness gate
        regulatory_gate = await self._check_regulatory_readiness_gate(project_state)
        quality_gates.append(regulatory_gate)
        
        # Overall status
        all_passed = all(gate["status"] == "passed" for gate in quality_gates)
        
        return {
            "overall_status": "passed" if all_passed else "failed",
            "gates": quality_gates,
            "can_proceed": all_passed,
            "blockers": [gate["name"] for gate in quality_gates if gate["status"] == "failed"]
        }
    
    async def validate_step_completion(
        self,
        project_id: uuid.UUID,
        step_id: str,
        step_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate step completion against quality criteria"""
        
        validation_results = {
            "step_id": step_id,
            "validation_passed": True,
            "quality_score": step_result.get("quality_score", 0.5),
            "issues": [],
            "recommendations": []
        }
        
        # Step-specific validation
        if step_id == "evidence_extraction":
            if step_result.get("extraction_confidence", 0) < 0.7:
                validation_results["issues"].append({
                    "type": "low_extraction_confidence",
                    "severity": "medium",
                    "message": "Extraction confidence below threshold"
                })
        
        elif step_id == "comparability_analysis":
            if step_result.get("comparability_score", 0) < 0.5:
                validation_results["issues"].append({
                    "type": "low_comparability",
                    "severity": "high", 
                    "message": "Comparability score indicates poor anchor quality"
                })
        
        # Set overall validation status
        validation_results["validation_passed"] = len(validation_results["issues"]) == 0
        
        return validation_results


# Export intelligent workflow services
__all__ = [
    "IntelligentWorkflowService",
    "WorkflowOrchestrationEngine",
    "AIWorkflowAdvisor",
    "ProgressTrackingEngine",
    "AdaptiveUIEngine",
    "QualityGateEngine",
    "WorkflowStep",
    "WorkflowRecommendation",
    "WorkflowProgress",
    "AdaptiveUIConfiguration"
]
