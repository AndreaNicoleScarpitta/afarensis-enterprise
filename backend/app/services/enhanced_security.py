"""
Enhanced Security Services for Afarensis Enterprise

Zero Trust architecture, advanced threat detection, and regulatory security compliance
for enterprise-grade clinical evidence review platform.
"""

import uuid
import asyncio
import logging
import hashlib
import hmac
import secrets
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import ipaddress
import json
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, AuditLog, SessionToken
from app.core.exceptions import AuthenticationError, AuthorizationError, SecurityError
from app.core.config import settings
from app.core.logging import audit_logger
from app.services import BaseService

logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    """Security risk assessment levels"""
    MINIMAL = "minimal"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high" 
    CRITICAL = "critical"


class ThreatType(Enum):
    """Types of security threats"""
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DATA_EXFILTRATION = "data_exfiltration"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    INSIDER_THREAT = "insider_threat"
    BRUTE_FORCE = "brute_force"
    SESSION_HIJACKING = "session_hijacking"
    DATA_MANIPULATION = "data_manipulation"
    SUSPICIOUS_PATTERN = "suspicious_pattern"


@dataclass
class SecurityEvent:
    """Security event data structure"""
    event_id: str
    timestamp: datetime
    event_type: ThreatType
    risk_level: RiskLevel
    user_id: Optional[str]
    session_id: Optional[str]
    ip_address: str
    user_agent: str
    resource_accessed: str
    details: Dict[str, Any]
    mitigation_actions: List[str]


@dataclass
class RiskAssessment:
    """User risk assessment result"""
    user_id: str
    overall_risk_score: float
    risk_level: RiskLevel
    risk_factors: List[str]
    behavioral_anomalies: List[str]
    recommended_actions: List[str]
    assessment_timestamp: datetime


@dataclass
class AuthenticationContext:
    """Enhanced authentication context"""
    user_id: str
    session_id: str
    device_fingerprint: str
    location: Dict[str, Any]
    risk_score: float
    authentication_factors: List[str]
    step_up_required: bool


class ZeroTrustSecurityService(BaseService):
    """Zero Trust security architecture implementation"""
    
    def __init__(self, db: AsyncSession, current_user: Dict[str, Any] = None):
        super().__init__(db, current_user)
        self.risk_engine = RiskAssessmentEngine()
        self.threat_detector = ThreatDetectionEngine()
        self.behavior_analyzer = UserBehaviorAnalytics()
        self.data_classifier = DataClassificationEngine()
    
    async def verify_zero_trust_request(
        self,
        request_data: Dict[str, Any],
        user: User,
        session_token: str
    ) -> Tuple[bool, Optional[str], RiskAssessment]:
        """Comprehensive zero trust verification for each request"""
        
        try:
            # Step 1: Continuous risk assessment
            risk_assessment = await self.risk_engine.assess_request_risk(
                user=user,
                request_data=request_data,
                session_token=session_token
            )
            
            # Step 2: Behavioral analysis
            behavioral_risk = await self.behavior_analyzer.analyze_behavior(
                user_id=user.id,
                request_pattern=request_data,
                historical_context=await self._get_user_history(user.id)
            )
            
            # Step 3: Resource classification and access requirements
            resource_classification = await self.data_classifier.classify_resource(
                resource_type=request_data.get("resource_type"),
                resource_id=request_data.get("resource_id"),
                operation=request_data.get("operation")
            )
            
            # Step 4: Dynamic access decision
            access_decision = await self._make_access_decision(
                risk_assessment, behavioral_risk, resource_classification, user
            )
            
            # Step 5: Log security decision
            await self._log_security_decision(
                user, request_data, risk_assessment, access_decision
            )
            
            return access_decision
            
        except Exception as e:
            logger.error(f"Zero trust verification failed: {str(e)}")
            # Fail secure - deny access on any error
            return False, "Security verification failed", RiskAssessment(
                user_id=str(user.id),
                overall_risk_score=1.0,
                risk_level=RiskLevel.CRITICAL,
                risk_factors=["verification_failure"],
                behavioral_anomalies=[],
                recommended_actions=["deny_access", "escalate_to_security"],
                assessment_timestamp=datetime.utcnow()
            )
    
    async def detect_and_respond_to_threats(
        self,
        session_data: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Real-time threat detection and automated response"""
        
        detected_threats = []
        
        # Parallel threat detection
        threat_checks = await asyncio.gather(
            self.threat_detector.detect_brute_force_attempts(session_data),
            self.threat_detector.detect_unusual_access_patterns(session_data),
            self.threat_detector.detect_data_exfiltration_attempts(session_data),
            self.threat_detector.detect_privilege_escalation_attempts(session_data),
            self.threat_detector.detect_session_anomalies(session_data),
            return_exceptions=True
        )
        
        # Process threat detection results
        for threat_result in threat_checks:
            if isinstance(threat_result, Exception):
                logger.error(f"Threat detection failed: {str(threat_result)}")
                continue
            
            if threat_result:
                detected_threats.extend(threat_result)
        
        # Automated threat response
        for threat in detected_threats:
            await self._respond_to_threat(threat)
        
        return detected_threats
    
    async def enforce_data_protection_controls(
        self,
        data_access_request: Dict[str, Any],
        user: User
    ) -> Dict[str, Any]:
        """Enforce data protection based on classification"""
        
        # Classify data sensitivity
        data_classification = await self.data_classifier.classify_data_sensitivity(
            data_type=data_access_request.get("data_type"),
            content_indicators=data_access_request.get("content_indicators", []),
            regulatory_context=data_access_request.get("regulatory_context", {})
        )
        
        # Determine required protections
        protection_requirements = await self._determine_protection_requirements(
            data_classification, user
        )
        
        # Apply protection controls
        protected_data = await self._apply_protection_controls(
            data_access_request, protection_requirements
        )
        
        # Log data access for compliance
        await self._log_data_access(
            user, data_access_request, data_classification, protection_requirements
        )
        
        return protected_data
    
    async def _make_access_decision(
        self,
        risk_assessment: RiskAssessment,
        behavioral_risk: Dict[str, Any],
        resource_classification: Dict[str, Any],
        user: User
    ) -> Tuple[bool, Optional[str], RiskAssessment]:
        """Make dynamic access control decision"""
        
        # Calculate combined risk score
        combined_risk = (
            risk_assessment.overall_risk_score * 0.4 +
            behavioral_risk.get("risk_score", 0.5) * 0.3 +
            resource_classification.get("sensitivity_score", 0.5) * 0.3
        )
        
        # Determine if step-up authentication is required
        step_up_required = combined_risk > 0.7 or resource_classification.get("requires_mfa", False)
        
        # Access decision logic
        if combined_risk < 0.3:
            # Low risk - grant access
            return True, None, risk_assessment
        elif combined_risk < 0.7:
            # Moderate risk - grant with monitoring
            await self._enable_enhanced_monitoring(user.id)
            return True, "enhanced_monitoring_enabled", risk_assessment
        elif step_up_required:
            # High risk - require step-up authentication
            return False, "step_up_authentication_required", risk_assessment
        else:
            # Critical risk - deny access
            return False, "access_denied_high_risk", risk_assessment
    
    async def _respond_to_threat(self, threat: SecurityEvent):
        """Automated threat response"""
        
        response_actions = []
        
        if threat.risk_level == RiskLevel.CRITICAL:
            # Critical threats - immediate lockdown
            if threat.user_id:
                await self._suspend_user_account(threat.user_id)
                response_actions.append("user_account_suspended")
            
            await self._block_ip_address(threat.ip_address)
            response_actions.append("ip_address_blocked")
            
            await self._alert_security_team(threat)
            response_actions.append("security_team_alerted")
        
        elif threat.risk_level == RiskLevel.HIGH:
            # High threats - enhanced monitoring
            if threat.user_id:
                await self._enable_enhanced_monitoring(threat.user_id)
                response_actions.append("enhanced_monitoring_enabled")
            
            await self._require_step_up_authentication(threat.user_id)
            response_actions.append("step_up_auth_required")
        
        elif threat.risk_level == RiskLevel.MODERATE:
            # Moderate threats - increased scrutiny
            await self._increase_session_monitoring(threat.session_id)
            response_actions.append("increased_session_monitoring")
        
        # Log response actions
        await self.log_action(
            action="automated_threat_response",
            resource_type="security_incident",
            resource_id=threat.event_id,
            details={
                "threat_type": threat.event_type.value,
                "risk_level": threat.risk_level.value,
                "response_actions": response_actions
            },
            regulatory_significance=True
        )


class RiskAssessmentEngine:
    """Advanced risk assessment for zero trust security"""
    
    async def assess_request_risk(
        self,
        user: User,
        request_data: Dict[str, Any],
        session_token: str
    ) -> RiskAssessment:
        """Comprehensive risk assessment for user request"""
        
        risk_factors = []
        risk_score = 0.0
        
        # Time-based risk factors
        current_time = datetime.utcnow()
        if current_time.hour < 6 or current_time.hour > 22:
            risk_factors.append("off_hours_access")
            risk_score += 0.2
        
        # Location-based risk factors
        location_risk = await self._assess_location_risk(
            request_data.get("ip_address"),
            user.last_known_location
        )
        risk_score += location_risk * 0.3
        if location_risk > 0.5:
            risk_factors.append("unusual_location")
        
        # Device-based risk factors
        device_risk = await self._assess_device_risk(
            request_data.get("user_agent"),
            request_data.get("device_fingerprint"),
            user.known_devices
        )
        risk_score += device_risk * 0.2
        if device_risk > 0.5:
            risk_factors.append("unknown_device")
        
        # Resource sensitivity risk
        resource_risk = await self._assess_resource_sensitivity_risk(
            request_data.get("resource_type"),
            request_data.get("operation")
        )
        risk_score += resource_risk * 0.3
        if resource_risk > 0.7:
            risk_factors.append("high_sensitivity_resource")
        
        # Determine overall risk level
        if risk_score < 0.3:
            risk_level = RiskLevel.LOW
        elif risk_score < 0.5:
            risk_level = RiskLevel.MODERATE
        elif risk_score < 0.7:
            risk_level = RiskLevel.HIGH
        else:
            risk_level = RiskLevel.CRITICAL
        
        return RiskAssessment(
            user_id=str(user.id),
            overall_risk_score=risk_score,
            risk_level=risk_level,
            risk_factors=risk_factors,
            behavioral_anomalies=[],  # Will be filled by behavior analyzer
            recommended_actions=await self._generate_risk_mitigation_actions(risk_level),
            assessment_timestamp=datetime.utcnow()
        )
    
    async def _assess_location_risk(
        self,
        current_ip: Optional[str],
        last_known_location: Optional[Dict[str, Any]]
    ) -> float:
        """Assess risk based on geographical location"""
        if not current_ip or not last_known_location:
            return 0.3  # Moderate risk for unknown location
        
        # Would implement IP geolocation and distance calculation
        # Placeholder logic
        return 0.1  # Low risk for familiar location
    
    async def _assess_device_risk(
        self,
        user_agent: Optional[str],
        device_fingerprint: Optional[str],
        known_devices: Optional[List[Dict[str, Any]]]
    ) -> float:
        """Assess risk based on device characteristics"""
        if not device_fingerprint:
            return 0.5  # Moderate risk for no fingerprint
        
        if known_devices:
            for device in known_devices:
                if device.get("fingerprint") == device_fingerprint:
                    return 0.1  # Low risk for known device
        
        return 0.6  # Higher risk for unknown device
    
    async def _assess_resource_sensitivity_risk(
        self,
        resource_type: Optional[str],
        operation: Optional[str]
    ) -> float:
        """Assess risk based on resource sensitivity"""
        high_sensitivity_resources = [
            "regulatory_artifacts", 
            "audit_logs", 
            "user_management",
            "system_settings"
        ]
        
        if resource_type in high_sensitivity_resources:
            return 0.8
        
        high_risk_operations = ["delete", "bulk_export", "admin_action"]
        if operation in high_risk_operations:
            return 0.7
        
        return 0.3  # Default moderate risk
    
    async def _generate_risk_mitigation_actions(self, risk_level: RiskLevel) -> List[str]:
        """Generate recommended risk mitigation actions"""
        actions = []
        
        if risk_level == RiskLevel.CRITICAL:
            actions.extend([
                "deny_access",
                "require_administrator_approval",
                "enable_continuous_monitoring"
            ])
        elif risk_level == RiskLevel.HIGH:
            actions.extend([
                "require_step_up_authentication",
                "enable_enhanced_logging",
                "limit_session_duration"
            ])
        elif risk_level == RiskLevel.MODERATE:
            actions.extend([
                "enable_additional_monitoring",
                "require_confirmation_for_sensitive_actions"
            ])
        
        return actions


class ThreatDetectionEngine:
    """Advanced threat detection using pattern analysis and ML"""
    
    async def detect_brute_force_attempts(
        self,
        session_data: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Detect brute force authentication attempts"""
        
        threats = []
        ip_address = session_data.get("ip_address", "unknown")
        
        # Check failed login attempts from same IP
        failed_attempts = await self._get_failed_login_attempts(ip_address, hours=1)
        
        if failed_attempts > 10:
            threats.append(SecurityEvent(
                event_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                event_type=ThreatType.BRUTE_FORCE,
                risk_level=RiskLevel.HIGH,
                user_id=session_data.get("user_id"),
                session_id=session_data.get("session_id"),
                ip_address=ip_address,
                user_agent=session_data.get("user_agent", ""),
                resource_accessed="authentication_endpoint",
                details={
                    "failed_attempts": failed_attempts,
                    "time_window": "1_hour"
                },
                mitigation_actions=["block_ip", "alert_security_team"]
            ))
        
        return threats
    
    async def detect_unusual_access_patterns(
        self,
        session_data: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Detect unusual user access patterns"""
        
        threats = []
        user_id = session_data.get("user_id")
        
        if not user_id:
            return threats
        
        # Analyze access pattern anomalies
        pattern_analysis = await self._analyze_access_patterns(user_id, session_data)
        
        if pattern_analysis.get("anomaly_score", 0) > 0.7:
            threats.append(SecurityEvent(
                event_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                event_type=ThreatType.SUSPICIOUS_PATTERN,
                risk_level=RiskLevel.MODERATE,
                user_id=user_id,
                session_id=session_data.get("session_id"),
                ip_address=session_data.get("ip_address", "unknown"),
                user_agent=session_data.get("user_agent", ""),
                resource_accessed=session_data.get("resource_accessed", ""),
                details=pattern_analysis,
                mitigation_actions=["enhanced_monitoring", "require_verification"]
            ))
        
        return threats
    
    async def detect_data_exfiltration_attempts(
        self,
        session_data: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Detect potential data exfiltration"""
        
        threats = []
        
        # Check for bulk download patterns
        download_volume = session_data.get("download_volume_mb", 0)
        download_frequency = session_data.get("download_frequency", 0)
        
        if download_volume > 100 or download_frequency > 20:  # Thresholds
            threats.append(SecurityEvent(
                event_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                event_type=ThreatType.DATA_EXFILTRATION,
                risk_level=RiskLevel.HIGH,
                user_id=session_data.get("user_id"),
                session_id=session_data.get("session_id"),
                ip_address=session_data.get("ip_address", "unknown"),
                user_agent=session_data.get("user_agent", ""),
                resource_accessed=session_data.get("resource_accessed", ""),
                details={
                    "download_volume_mb": download_volume,
                    "download_frequency": download_frequency,
                    "suspicious_files": session_data.get("files_accessed", [])
                },
                mitigation_actions=["block_downloads", "alert_security_team", "preserve_evidence"]
            ))
        
        return threats
    
    async def detect_privilege_escalation_attempts(
        self,
        session_data: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Detect privilege escalation attempts"""
        
        threats = []
        
        # Check for unauthorized admin access attempts
        admin_attempts = session_data.get("admin_resource_attempts", [])
        user_role = session_data.get("user_role", "")
        
        if admin_attempts and user_role not in ["admin", "reviewer"]:
            threats.append(SecurityEvent(
                event_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                event_type=ThreatType.PRIVILEGE_ESCALATION,
                risk_level=RiskLevel.HIGH,
                user_id=session_data.get("user_id"),
                session_id=session_data.get("session_id"),
                ip_address=session_data.get("ip_address", "unknown"),
                user_agent=session_data.get("user_agent", ""),
                resource_accessed="admin_resources",
                details={
                    "attempted_resources": admin_attempts,
                    "user_role": user_role
                },
                mitigation_actions=["deny_access", "escalate_to_security", "audit_user_permissions"]
            ))
        
        return threats
    
    async def detect_session_anomalies(
        self,
        session_data: Dict[str, Any]
    ) -> List[SecurityEvent]:
        """Detect session-based anomalies"""
        
        threats = []
        
        # Check for session hijacking indicators
        session_anomalies = await self._analyze_session_anomalies(session_data)
        
        if session_anomalies.get("hijacking_risk", 0) > 0.7:
            threats.append(SecurityEvent(
                event_id=str(uuid.uuid4()),
                timestamp=datetime.utcnow(),
                event_type=ThreatType.SESSION_HIJACKING,
                risk_level=RiskLevel.HIGH,
                user_id=session_data.get("user_id"),
                session_id=session_data.get("session_id"),
                ip_address=session_data.get("ip_address", "unknown"),
                user_agent=session_data.get("user_agent", ""),
                resource_accessed=session_data.get("resource_accessed", ""),
                details=session_anomalies,
                mitigation_actions=["terminate_session", "require_reauthentication"]
            ))
        
        return threats


class UserBehaviorAnalytics:
    """User behavior analytics for anomaly detection"""
    
    async def analyze_behavior(
        self,
        user_id: uuid.UUID,
        request_pattern: Dict[str, Any],
        historical_context: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze user behavior patterns for anomalies"""
        
        behavioral_risk = 0.0
        anomalies = []
        
        # Time-based behavior analysis
        time_anomaly = await self._analyze_time_patterns(user_id, request_pattern, historical_context)
        if time_anomaly > 0.5:
            anomalies.append("unusual_access_time")
            behavioral_risk += time_anomaly * 0.3
        
        # Resource access pattern analysis
        resource_anomaly = await self._analyze_resource_patterns(user_id, request_pattern, historical_context)
        if resource_anomaly > 0.5:
            anomalies.append("unusual_resource_access")
            behavioral_risk += resource_anomaly * 0.4
        
        # Volume-based analysis
        volume_anomaly = await self._analyze_volume_patterns(user_id, request_pattern, historical_context)
        if volume_anomaly > 0.5:
            anomalies.append("unusual_activity_volume")
            behavioral_risk += volume_anomaly * 0.3
        
        return {
            "user_id": str(user_id),
            "risk_score": min(behavioral_risk, 1.0),
            "anomalies": anomalies,
            "confidence": 0.8,  # Would be calculated based on data quality
            "analysis_timestamp": datetime.utcnow().isoformat()
        }


class DataClassificationEngine:
    """Automatic data classification and protection"""
    
    async def classify_data_sensitivity(
        self,
        data_type: str,
        content_indicators: List[str],
        regulatory_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Classify data sensitivity level"""
        
        sensitivity_score = 0.0
        classification_factors = []
        
        # Data type-based classification
        high_sensitivity_types = [
            "patient_data", "clinical_trial_data", "regulatory_submission",
            "audit_logs", "authentication_data"
        ]
        
        if data_type in high_sensitivity_types:
            sensitivity_score += 0.6
            classification_factors.append("high_sensitivity_data_type")
        
        # Content indicator analysis
        sensitive_indicators = [
            "patient_identifiers", "genetic_data", "medical_history",
            "proprietary_algorithms", "trade_secrets"
        ]
        
        for indicator in content_indicators:
            if indicator in sensitive_indicators:
                sensitivity_score += 0.2
                classification_factors.append(f"contains_{indicator}")
        
        # Regulatory context
        if regulatory_context.get("hipaa_applicable"):
            sensitivity_score += 0.3
            classification_factors.append("hipaa_protected")
        
        if regulatory_context.get("cfr_part_11_applicable"):
            sensitivity_score += 0.2
            classification_factors.append("cfr_part_11_regulated")
        
        # Determine classification level
        if sensitivity_score < 0.3:
            classification = "public"
        elif sensitivity_score < 0.5:
            classification = "internal"
        elif sensitivity_score < 0.7:
            classification = "confidential"
        else:
            classification = "restricted"
        
        return {
            "classification_level": classification,
            "sensitivity_score": min(sensitivity_score, 1.0),
            "classification_factors": classification_factors,
            "protection_requirements": await self._determine_protection_requirements(classification),
            "retention_policy": await self._determine_retention_policy(classification, regulatory_context)
        }
    
    async def classify_resource(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        operation: Optional[str]
    ) -> Dict[str, Any]:
        """Classify resource access requirements"""
        
        sensitivity_score = 0.3  # Default baseline
        access_requirements = []
        
        # Resource type classification
        if resource_type in ["regulatory_artifacts", "audit_logs"]:
            sensitivity_score = 0.9
            access_requirements.extend(["mfa_required", "approval_workflow"])
        elif resource_type in ["evidence_records", "review_decisions"]:
            sensitivity_score = 0.7
            access_requirements.append("role_based_access")
        
        # Operation-based requirements
        if operation in ["delete", "bulk_export"]:
            sensitivity_score += 0.2
            access_requirements.append("additional_authorization")
        
        return {
            "sensitivity_score": min(sensitivity_score, 1.0),
            "access_requirements": access_requirements,
            "requires_mfa": sensitivity_score > 0.7,
            "requires_approval": sensitivity_score > 0.8
        }


# Additional helper functions for the enhanced security services

async def calculate_file_integrity_hash(file_content: bytes) -> str:
    """Calculate SHA-256 hash for file integrity verification"""
    return hashlib.sha256(file_content).hexdigest()

async def verify_cryptographic_signature(
    data: str, 
    signature: str, 
    public_key: str
) -> bool:
    """Verify cryptographic signature for data integrity"""
    # Placeholder - would implement actual signature verification
    return True

async def generate_secure_token(length: int = 32) -> str:
    """Generate cryptographically secure random token"""
    return secrets.token_urlsafe(length)

async def constant_time_compare(a: str, b: str) -> bool:
    """Constant-time string comparison to prevent timing attacks"""
    return hmac.compare_digest(a.encode(), b.encode())


# Export enhanced security services
__all__ = [
    "ZeroTrustSecurityService",
    "RiskAssessmentEngine",
    "ThreatDetectionEngine", 
    "UserBehaviorAnalytics",
    "DataClassificationEngine",
    "SecurityEvent",
    "RiskAssessment",
    "AuthenticationContext",
    "RiskLevel",
    "ThreatType"
]
