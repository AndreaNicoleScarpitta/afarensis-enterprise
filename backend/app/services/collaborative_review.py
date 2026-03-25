"""
Collaborative Review Workflows Service for Afarensis Enterprise
Implements multi-reviewer assignments, comment threads, approval workflows, and real-time collaboration
"""

import asyncio
import logging
import json
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload

from app.models import (
    Project, EvidenceRecord, User, ReviewAssignment, ReviewComment, 
    ReviewDecision, WorkflowStep, UserPresence, NotificationSettings
)
from app.services import BaseService
from app.core.config import settings
from app.core.exceptions import ProcessingError, ValidationError, AuthorizationError

logger = logging.getLogger(__name__)


class ReviewStatus(Enum):
    """Review status options"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REQUIRES_CONSENSUS = "requires_consensus"
    APPROVED = "approved"
    REJECTED = "rejected"


class WorkflowStepType(Enum):
    """Types of workflow steps"""
    INITIAL_REVIEW = "initial_review"
    PEER_REVIEW = "peer_review"
    SENIOR_REVIEW = "senior_review"
    CONSENSUS_REVIEW = "consensus_review"
    FINAL_APPROVAL = "final_approval"


class ConflictResolutionStrategy(Enum):
    """Conflict resolution strategies"""
    MAJORITY_VOTE = "majority_vote"
    SENIOR_DECISION = "senior_decision"
    CONSENSUS_REQUIRED = "consensus_required"
    EXPERT_PANEL = "expert_panel"


@dataclass
class ReviewerAssignment:
    """Reviewer assignment details"""
    assignment_id: str
    evidence_id: str
    reviewer_id: str
    reviewer_name: str
    role: str
    status: str
    assigned_at: datetime
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    weight: float  # Voting weight for this reviewer


@dataclass
class CommentThread:
    """Comment thread on evidence"""
    thread_id: str
    evidence_id: str
    comments: List[Dict[str, Any]]
    status: str  # open, resolved, archived
    created_at: datetime
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]


@dataclass
class WorkflowProgress:
    """Progress through review workflow"""
    workflow_id: str
    evidence_id: str
    current_step: str
    completed_steps: List[str]
    pending_steps: List[str]
    overall_progress: float
    estimated_completion: Optional[datetime]


class CollaborativeReviewService(BaseService):
    """Service for managing collaborative evidence review workflows"""
    
    def __init__(self, db: AsyncSession, current_user: Optional[Dict[str, Any]] = None):
        super().__init__(db, current_user)
        self.active_sessions = set()  # Track active user sessions
    
    async def create_review_workflow(
        self,
        project_id: str,
        evidence_ids: List[str],
        workflow_config: Dict[str, Any]
    ) -> str:
        """Create a new collaborative review workflow"""
        
        self.require_permission("project:manage", "project workflow creation")
        
        try:
            workflow_id = str(uuid.uuid4())
            
            # Create workflow steps based on configuration
            steps = self._design_workflow_steps(workflow_config)
            
            # Assign reviewers to evidence
            for evidence_id in evidence_ids:
                await self._assign_reviewers_to_evidence(
                    evidence_id, 
                    workflow_config.get("reviewers", []),
                    workflow_id
                )
            
            # Create workflow tracking
            workflow = WorkflowProgress(
                workflow_id=workflow_id,
                evidence_id="",  # Multiple evidence items
                current_step=steps[0]["step_type"],
                completed_steps=[],
                pending_steps=[step["step_type"] for step in steps],
                overall_progress=0.0,
                estimated_completion=self._estimate_completion_date(steps, len(evidence_ids))
            )
            
            # Send notifications to assigned reviewers
            await self._send_assignment_notifications(workflow_id, evidence_ids)
            
            await self.log_action(
                action="create_review_workflow",
                resource_type="workflow",
                resource_id=workflow_id,
                details={
                    "evidence_count": len(evidence_ids),
                    "reviewer_count": len(workflow_config.get("reviewers", [])),
                    "workflow_type": workflow_config.get("type", "standard")
                }
            )
            
            return workflow_id
            
        except Exception as e:
            logger.error(f"Failed to create review workflow: {e}")
            raise ProcessingError(f"Workflow creation failed: {str(e)}")
    
    async def assign_reviewer(
        self,
        evidence_id: str,
        reviewer_id: str,
        role: str = "reviewer",
        due_date: Optional[datetime] = None,
        weight: float = 1.0
    ) -> str:
        """Assign a reviewer to evidence"""
        
        self.require_permission("project:manage", "reviewer assignment")
        
        # Verify reviewer exists and has appropriate permissions
        reviewer = await self.db.get(User, reviewer_id)
        if not reviewer:
            raise ValidationError("Reviewer not found")
        
        if not self._has_review_capability(reviewer, role):
            raise ValidationError(f"User does not have {role} capabilities")
        
        # Create assignment
        assignment = ReviewAssignment(
            id=uuid.uuid4(),
            evidence_id=evidence_id,
            reviewer_id=reviewer_id,
            role=role,
            status=ReviewStatus.PENDING.value,
            assigned_at=datetime.utcnow(),
            assigned_by=self.user_id,
            due_date=due_date or datetime.utcnow() + timedelta(days=7),
            weight=weight
        )
        
        self.db.add(assignment)
        await self.db.commit()
        
        # Send notification
        await self._send_assignment_notification(assignment)
        
        return str(assignment.id)
    
    async def add_review_comment(
        self,
        evidence_id: str,
        content: str,
        comment_type: str = "general",
        parent_comment_id: Optional[str] = None,
        mentions: Optional[List[str]] = None
    ) -> str:
        """Add a comment to evidence review"""
        
        self.require_permission("project:review", "adding review comments")
        
        comment = ReviewComment(
            id=uuid.uuid4(),
            evidence_id=evidence_id,
            author_id=self.user_id,
            content=content,
            comment_type=comment_type,
            parent_comment_id=parent_comment_id,
            created_at=datetime.utcnow(),
            mentions=mentions or []
        )
        
        self.db.add(comment)
        await self.db.commit()
        
        # Send notifications to mentioned users
        if mentions:
            await self._send_mention_notifications(comment, mentions)
        
        # Update real-time presence
        await self._broadcast_comment_update(evidence_id, comment)
        
        return str(comment.id)
    
    async def submit_review_decision(
        self,
        assignment_id: str,
        decision: str,
        rationale: str,
        confidence: float,
        tags: Optional[List[str]] = None
    ) -> str:
        """Submit a review decision"""
        
        assignment = await self.db.get(ReviewAssignment, assignment_id)
        if not assignment:
            raise ValidationError("Assignment not found")
        
        if assignment.reviewer_id != self.user_id:
            raise AuthorizationError("Can only submit decisions for your own assignments")
        
        # Create review decision
        review_decision = ReviewDecision(
            id=uuid.uuid4(),
            assignment_id=assignment_id,
            evidence_id=assignment.evidence_id,
            reviewer_id=self.user_id,
            decision=decision,
            rationale=rationale,
            confidence=confidence,
            tags=tags or [],
            submitted_at=datetime.utcnow()
        )
        
        self.db.add(review_decision)
        
        # Update assignment status
        assignment.status = ReviewStatus.COMPLETED.value
        assignment.completed_at = datetime.utcnow()
        
        await self.db.commit()
        
        # Check if all reviewers have submitted decisions
        await self._check_workflow_completion(assignment.evidence_id)
        
        return str(review_decision.id)
    
    async def get_evidence_comments(
        self,
        evidence_id: str,
        include_resolved: bool = True
    ) -> List[Dict[str, Any]]:
        """Get all comments for evidence"""
        
        self.require_permission("project:read", "viewing comments")
        
        query = select(ReviewComment).where(
            ReviewComment.evidence_id == evidence_id
        ).options(selectinload(ReviewComment.author))
        
        if not include_resolved:
            query = query.where(ReviewComment.resolved_at.is_(None))
        
        query = query.order_by(asc(ReviewComment.created_at))
        
        result = await self.db.execute(query)
        comments = result.scalars().all()
        
        # Group comments into threads
        threads = {}
        root_comments = []
        
        for comment in comments:
            comment_data = {
                "id": str(comment.id),
                "content": comment.content,
                "author": {
                    "id": str(comment.author.id),
                    "name": comment.author.full_name,
                    "role": comment.author.role
                },
                "created_at": comment.created_at.isoformat(),
                "comment_type": comment.comment_type,
                "mentions": comment.mentions,
                "resolved_at": comment.resolved_at.isoformat() if comment.resolved_at else None,
                "replies": []
            }
            
            if comment.parent_comment_id:
                # This is a reply
                if comment.parent_comment_id not in threads:
                    threads[comment.parent_comment_id] = []
                threads[comment.parent_comment_id].append(comment_data)
            else:
                # This is a root comment
                root_comments.append(comment_data)
        
        # Add replies to their parent comments
        for comment in root_comments:
            comment_id = comment["id"]
            if comment_id in threads:
                comment["replies"] = threads[comment_id]
        
        return root_comments
    
    async def get_review_assignments(
        self,
        evidence_id: Optional[str] = None,
        reviewer_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ReviewerAssignment]:
        """Get review assignments with filters"""
        
        query = select(ReviewAssignment).options(
            selectinload(ReviewAssignment.reviewer),
            selectinload(ReviewAssignment.evidence)
        )
        
        if evidence_id:
            query = query.where(ReviewAssignment.evidence_id == evidence_id)
        
        if reviewer_id:
            query = query.where(ReviewAssignment.reviewer_id == reviewer_id)
        elif not self.check_permission("project:manage"):
            # Non-managers can only see their own assignments
            query = query.where(ReviewAssignment.reviewer_id == self.user_id)
        
        if status:
            query = query.where(ReviewAssignment.status == status)
        
        query = query.order_by(desc(ReviewAssignment.assigned_at))
        
        result = await self.db.execute(query)
        assignments = result.scalars().all()
        
        return [
            ReviewerAssignment(
                assignment_id=str(assignment.id),
                evidence_id=str(assignment.evidence_id),
                reviewer_id=str(assignment.reviewer_id),
                reviewer_name=assignment.reviewer.full_name,
                role=assignment.role,
                status=assignment.status,
                assigned_at=assignment.assigned_at,
                due_date=assignment.due_date,
                completed_at=assignment.completed_at,
                weight=assignment.weight
            )
            for assignment in assignments
        ]
    
    async def resolve_conflicts(
        self,
        evidence_id: str,
        resolution_strategy: str,
        resolution_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Resolve conflicts between reviewer decisions"""
        
        self.require_permission("project:manage", "conflict resolution")
        
        # Get all decisions for this evidence
        decisions_query = select(ReviewDecision).where(
            ReviewDecision.evidence_id == evidence_id
        ).options(selectinload(ReviewDecision.reviewer))
        
        result = await self.db.execute(decisions_query)
        decisions = result.scalars().all()
        
        if len(decisions) < 2:
            raise ValidationError("Need at least 2 decisions to resolve conflicts")
        
        # Analyze conflicts
        conflict_analysis = self._analyze_decision_conflicts(decisions)
        
        # Apply resolution strategy
        if resolution_strategy == ConflictResolutionStrategy.MAJORITY_VOTE.value:
            final_decision = self._resolve_by_majority_vote(decisions)
        elif resolution_strategy == ConflictResolutionStrategy.SENIOR_DECISION.value:
            final_decision = self._resolve_by_senior_decision(decisions)
        elif resolution_strategy == ConflictResolutionStrategy.CONSENSUS_REQUIRED.value:
            final_decision = await self._initiate_consensus_process(evidence_id, decisions)
        else:
            raise ValidationError(f"Unknown resolution strategy: {resolution_strategy}")
        
        # Record the resolution
        resolution_record = {
            "evidence_id": evidence_id,
            "strategy": resolution_strategy,
            "final_decision": final_decision,
            "conflict_analysis": conflict_analysis,
            "resolved_by": self.user_id,
            "resolved_at": datetime.utcnow().isoformat(),
            "notes": resolution_notes
        }
        
        # Update evidence status
        await self._update_evidence_review_status(evidence_id, final_decision)
        
        return resolution_record
    
    async def get_real_time_presence(self, evidence_id: str) -> Dict[str, Any]:
        """Get real-time presence information for evidence review"""
        
        # Get active users viewing this evidence
        presence_query = select(UserPresence).where(
            and_(
                UserPresence.resource_id == evidence_id,
                UserPresence.resource_type == "evidence",
                UserPresence.last_seen > datetime.utcnow() - timedelta(minutes=5)
            )
        ).options(selectinload(UserPresence.user))
        
        result = await self.db.execute(presence_query)
        presence_records = result.scalars().all()
        
        active_users = []
        for presence in presence_records:
            active_users.append({
                "user_id": str(presence.user_id),
                "name": presence.user.full_name,
                "avatar": presence.user.avatar_url if hasattr(presence.user, 'avatar_url') else None,
                "activity": presence.activity,
                "last_seen": presence.last_seen.isoformat(),
                "cursor_position": presence.cursor_position
            })
        
        return {
            "evidence_id": evidence_id,
            "active_users": active_users,
            "total_active": len(active_users),
            "last_updated": datetime.utcnow().isoformat()
        }
    
    async def update_user_presence(
        self,
        evidence_id: str,
        activity: str,
        cursor_position: Optional[Dict[str, Any]] = None
    ):
        """Update user's real-time presence"""
        
        # Update or create presence record
        presence_query = select(UserPresence).where(
            and_(
                UserPresence.user_id == self.user_id,
                UserPresence.resource_id == evidence_id,
                UserPresence.resource_type == "evidence"
            )
        )
        
        result = await self.db.execute(presence_query)
        presence = result.scalar_one_or_none()
        
        if presence:
            presence.activity = activity
            presence.last_seen = datetime.utcnow()
            presence.cursor_position = cursor_position
        else:
            presence = UserPresence(
                id=uuid.uuid4(),
                user_id=self.user_id,
                resource_id=evidence_id,
                resource_type="evidence",
                activity=activity,
                last_seen=datetime.utcnow(),
                cursor_position=cursor_position
            )
            self.db.add(presence)
        
        await self.db.commit()
        
        # Broadcast presence update to other users
        await self._broadcast_presence_update(evidence_id)
    
    async def get_workflow_progress(self, workflow_id: str) -> WorkflowProgress:
        """Get progress of a review workflow"""
        
        # This would query workflow steps and calculate progress
        # For now, return a placeholder implementation
        
        return WorkflowProgress(
            workflow_id=workflow_id,
            evidence_id="",
            current_step="peer_review",
            completed_steps=["initial_review"],
            pending_steps=["senior_review", "final_approval"],
            overall_progress=0.4,
            estimated_completion=datetime.utcnow() + timedelta(days=5)
        )
    
    # Helper methods
    
    def _design_workflow_steps(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Design workflow steps based on configuration"""
        
        workflow_type = config.get("type", "standard")
        
        if workflow_type == "fast_track":
            return [
                {"step_type": "initial_review", "reviewers": 2, "duration_hours": 24},
                {"step_type": "final_approval", "reviewers": 1, "duration_hours": 12}
            ]
        elif workflow_type == "comprehensive":
            return [
                {"step_type": "initial_review", "reviewers": 2, "duration_hours": 48},
                {"step_type": "peer_review", "reviewers": 3, "duration_hours": 72},
                {"step_type": "senior_review", "reviewers": 1, "duration_hours": 24},
                {"step_type": "final_approval", "reviewers": 1, "duration_hours": 24}
            ]
        else:  # standard
            return [
                {"step_type": "initial_review", "reviewers": 2, "duration_hours": 48},
                {"step_type": "peer_review", "reviewers": 2, "duration_hours": 48},
                {"step_type": "final_approval", "reviewers": 1, "duration_hours": 24}
            ]
    
    async def _assign_reviewers_to_evidence(
        self,
        evidence_id: str,
        reviewers: List[Dict[str, Any]],
        workflow_id: str
    ):
        """Assign reviewers to evidence based on workflow"""
        
        for reviewer_config in reviewers:
            await self.assign_reviewer(
                evidence_id=evidence_id,
                reviewer_id=reviewer_config["user_id"],
                role=reviewer_config.get("role", "reviewer"),
                due_date=reviewer_config.get("due_date"),
                weight=reviewer_config.get("weight", 1.0)
            )
    
    def _has_review_capability(self, user: User, role: str) -> bool:
        """Check if user has capability for review role"""
        
        role_requirements = {
            "reviewer": ["reviewer", "analyst", "admin"],
            "senior_reviewer": ["analyst", "admin"], 
            "approver": ["admin"]
        }
        
        return user.role in role_requirements.get(role, [])
    
    def _estimate_completion_date(self, steps: List[Dict], evidence_count: int) -> datetime:
        """Estimate workflow completion date"""
        
        total_hours = sum(step["duration_hours"] for step in steps)
        # Add buffer for multiple evidence items
        total_hours *= (1 + evidence_count * 0.1)
        
        return datetime.utcnow() + timedelta(hours=total_hours)
    
    async def _send_assignment_notifications(self, workflow_id: str, evidence_ids: List[str]):
        """Send notifications to assigned reviewers"""
        # Placeholder for notification system
        pass
    
    async def _send_assignment_notification(self, assignment: ReviewAssignment):
        """Send notification to assigned reviewer"""
        # Placeholder for notification system
        pass
    
    async def _send_mention_notifications(self, comment: ReviewComment, mentions: List[str]):
        """Send notifications to mentioned users"""
        # Placeholder for notification system
        pass
    
    async def _broadcast_comment_update(self, evidence_id: str, comment: ReviewComment):
        """Broadcast comment update to real-time subscribers"""
        # Placeholder for real-time system (WebSocket/SSE)
        pass
    
    async def _broadcast_presence_update(self, evidence_id: str):
        """Broadcast presence update to real-time subscribers"""
        # Placeholder for real-time system
        pass
    
    async def _check_workflow_completion(self, evidence_id: str):
        """Check if workflow step is complete and advance to next step"""
        
        # Get all assignments for this evidence
        assignments_query = select(ReviewAssignment).where(
            ReviewAssignment.evidence_id == evidence_id
        )
        
        result = await self.db.execute(assignments_query)
        assignments = result.scalars().all()
        
        # Check if all assignments are complete
        completed_assignments = [a for a in assignments if a.status == ReviewStatus.COMPLETED.value]
        
        if len(completed_assignments) == len(assignments):
            # All reviewers have submitted - check for conflicts
            await self._check_for_conflicts(evidence_id)
    
    def _analyze_decision_conflicts(self, decisions: List[ReviewDecision]) -> Dict[str, Any]:
        """Analyze conflicts between reviewer decisions"""
        
        decision_counts = {}
        confidence_scores = []
        
        for decision in decisions:
            decision_value = decision.decision
            if decision_value not in decision_counts:
                decision_counts[decision_value] = 0
            decision_counts[decision_value] += decision.weight
            confidence_scores.append(decision.confidence)
        
        # Check if there's a clear majority
        total_weight = sum(decision_counts.values())
        majority_threshold = total_weight / 2
        
        has_majority = any(count > majority_threshold for count in decision_counts.values())
        
        return {
            "decision_distribution": decision_counts,
            "has_majority": has_majority,
            "average_confidence": sum(confidence_scores) / len(confidence_scores),
            "total_reviewers": len(decisions),
            "conflict_level": "high" if not has_majority else "low"
        }
    
    def _resolve_by_majority_vote(self, decisions: List[ReviewDecision]) -> str:
        """Resolve conflict using majority vote"""
        
        vote_counts = {}
        for decision in decisions:
            vote = decision.decision
            if vote not in vote_counts:
                vote_counts[vote] = 0
            vote_counts[vote] += decision.weight
        
        # Return decision with highest weighted vote
        return max(vote_counts.items(), key=lambda x: x[1])[0]
    
    def _resolve_by_senior_decision(self, decisions: List[ReviewDecision]) -> str:
        """Resolve conflict by senior reviewer decision"""
        
        # Find the senior reviewer (highest role/weight)
        senior_decision = max(decisions, key=lambda d: d.weight)
        return senior_decision.decision
    
    async def _initiate_consensus_process(self, evidence_id: str, decisions: List[ReviewDecision]) -> str:
        """Initiate consensus building process"""
        
        # Create a consensus review assignment
        # This would involve additional review rounds
        return "consensus_required"
    
    async def _update_evidence_review_status(self, evidence_id: str, final_decision: str):
        """Update evidence review status based on final decision"""
        
        evidence = await self.db.get(EvidenceRecord, evidence_id)
        if evidence:
            # Update evidence metadata with review result
            if not evidence.review_metadata:
                evidence.review_metadata = {}
            
            evidence.review_metadata["final_decision"] = final_decision
            evidence.review_metadata["review_completed_at"] = datetime.utcnow().isoformat()
            
            await self.db.commit()
    
    async def _check_for_conflicts(self, evidence_id: str):
        """Check for conflicts in review decisions"""
        
        decisions_query = select(ReviewDecision).where(
            ReviewDecision.evidence_id == evidence_id
        )
        
        result = await self.db.execute(decisions_query)
        decisions = result.scalars().all()
        
        if len(decisions) >= 2:
            conflict_analysis = self._analyze_decision_conflicts(decisions)
            
            if not conflict_analysis["has_majority"]:
                # Conflict detected - require manual resolution
                await self._flag_for_conflict_resolution(evidence_id, conflict_analysis)


# Note: All database models are now properly defined in app.models
