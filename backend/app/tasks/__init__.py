"""
Afarensis Enterprise Background Tasks Package

Provides comprehensive background task processing for:
- AI-powered evidence analysis
- Security monitoring and threat detection  
- Workflow optimization and intelligence
- Evidence discovery and processing
- Regulatory artifact generation
"""

from .enhanced_tasks import celery_app
from .ai_tasks import *
from .security_tasks import *
from .workflow_tasks import *
from .evidence_tasks import *

__all__ = [
    'celery_app',
    # AI Tasks
    'evidence_extraction_task',
    'comparability_analysis_task', 
    'bias_detection_task',
    'regulatory_critique_task',
    'model_ensemble_inference_task',
    # Security Tasks
    'security_risk_assessment_task',
    'automated_threat_response_task',
    'data_classification_scan_task',
    'compliance_audit_task',
    # Workflow Tasks
    'workflow_optimization_task',
    'intelligent_guidance_generation_task',
    'regulatory_timeline_optimization_task',
    'collaboration_insights_task',
    'predictive_project_analytics_task',
    # Evidence Tasks
    'evidence_discovery_task',
    'evidence_quality_assessment_task',
    'evidence_synthesis_task',
    'regulatory_artifact_generation_task',
    'evidence_gap_analysis_task'
]
