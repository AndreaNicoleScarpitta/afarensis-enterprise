"""
Afarensis Enterprise — Multi-Study Program Dashboard Service

Provides cross-study submission tracking, NDA/BLA portfolio management,
and program-level readiness views across multiple regulatory projects.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
import logging

from app.models import (
    Project, ProjectStatus, AuditLog, User, RegulatoryArtifact,
    EvidenceRecord, ReviewDecision, ReviewDecisionEnum,
)

logger = logging.getLogger(__name__)


class ProgramDashboardService:
    """Cross-study program management and portfolio tracking."""

    @staticmethod
    async def get_program_overview(db: AsyncSession, org_id: Optional[str] = None) -> dict:
        """
        Query all projects, group by status, and return a program-level overview.

        Returns total_projects, by_status counts, recent_activity, active_users.
        """
        # Total projects
        total_q = select(func.count(Project.id))
        if org_id:
            total_q = total_q.where(Project.organization_id == org_id)
        total_result = await db.execute(total_q)
        total_projects = total_result.scalar() or 0

        # Count by status
        by_status = {}
        for status in ProjectStatus:
            count_q = select(func.count(Project.id)).where(Project.status == status)
            if org_id:
                count_q = count_q.where(Project.organization_id == org_id)
            count_result = await db.execute(count_q)
            by_status[status.value] = count_result.scalar() or 0

        # Recent activity — last 10 audit logs
        recent_logs_result = await db.execute(
            select(AuditLog)
            .order_by(AuditLog.timestamp.desc())
            .limit(10)
        )
        recent_logs = recent_logs_result.scalars().all()
        recent_activity = [
            {
                "id": log.id,
                "project_id": log.project_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "change_summary": log.change_summary,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            }
            for log in recent_logs
        ]

        # Active users count
        active_users_result = await db.execute(
            select(func.count(User.id)).where(User.is_active)
        )
        active_users = active_users_result.scalar() or 0

        return {
            "total_projects": total_projects,
            "by_status": by_status,
            "recent_activity": recent_activity,
            "active_users": active_users,
            "generated_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def get_submission_readiness(db: AsyncSession, project_id: str) -> dict:
        """
        Compute submission readiness score across all deliverables for a project.

        Checks: study definition, SAP, ADaM, SDTM, TFLs, CSR, eCTD, Define-XML, ADRG.
        Returns overall_score (0-100), checklist with status, missing items,
        and estimated_completion.
        """
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        if not project:
            return {"error": "Project not found", "project_id": project_id}

        # Fetch all artifacts for this project
        artifacts_result = await db.execute(
            select(RegulatoryArtifact).where(RegulatoryArtifact.project_id == project_id)
        )
        artifacts = artifacts_result.scalars().all()
        artifact_types = {a.artifact_type for a in artifacts}

        # Define the checklist items and how they map to artifacts/state
        checklist = [
            {
                "item": "Study definition complete",
                "key": "study_definition",
                "status": "complete" if project.research_intent and len(project.research_intent) > 10 else "incomplete",
                "weight": 10,
            },
            {
                "item": "SAP generated",
                "key": "sap",
                "status": "complete" if "sap" in artifact_types or "statistical_analysis_plan" in artifact_types else "incomplete",
                "weight": 12,
            },
            {
                "item": "ADaM datasets generated and validated",
                "key": "adam",
                "status": "complete" if "adam_dataset" in artifact_types or "adam" in artifact_types else "incomplete",
                "weight": 15,
            },
            {
                "item": "SDTM datasets generated",
                "key": "sdtm",
                "status": "complete" if "sdtm_dataset" in artifact_types or "sdtm" in artifact_types else "incomplete",
                "weight": 15,
            },
            {
                "item": "TFLs generated",
                "key": "tfls",
                "status": "complete" if "tfl" in artifact_types or "tables_figures_listings" in artifact_types else "incomplete",
                "weight": 12,
            },
            {
                "item": "CSR sections generated",
                "key": "csr",
                "status": "complete" if "csr" in artifact_types or "clinical_study_report" in artifact_types else "incomplete",
                "weight": 12,
            },
            {
                "item": "eCTD package generated",
                "key": "ectd",
                "status": "complete" if "ectd" in artifact_types or "ectd_package" in artifact_types else "incomplete",
                "weight": 10,
            },
            {
                "item": "Define-XML generated",
                "key": "define_xml",
                "status": "complete" if "define_xml" in artifact_types or "define-xml" in artifact_types else "incomplete",
                "weight": 8,
            },
            {
                "item": "ADRG generated",
                "key": "adrg",
                "status": "complete" if "adrg" in artifact_types or "analysis_data_reviewers_guide" in artifact_types else "incomplete",
                "weight": 6,
            },
        ]

        total_weight = sum(c["weight"] for c in checklist)
        earned_weight = sum(c["weight"] for c in checklist if c["status"] == "complete")
        overall_score = round((earned_weight / total_weight) * 100, 1) if total_weight > 0 else 0.0

        missing_items = [c["item"] for c in checklist if c["status"] == "incomplete"]

        # Estimate completion based on missing items count
        items_remaining = len(missing_items)
        if items_remaining == 0:
            estimated_completion = "Ready for submission"
        elif items_remaining <= 2:
            estimated_completion = "1-2 weeks"
        elif items_remaining <= 4:
            estimated_completion = "3-6 weeks"
        else:
            estimated_completion = "8+ weeks"

        return {
            "project_id": project_id,
            "project_title": project.title,
            "overall_score": overall_score,
            "checklist": checklist,
            "missing_items": missing_items,
            "estimated_completion": estimated_completion,
            "generated_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def get_portfolio_summary(db: AsyncSession, org_id: Optional[str] = None) -> dict:
        """
        Cross-study view of all projects with their readiness scores.
        """
        portfolio_q = select(Project).order_by(Project.updated_at.desc())
        if org_id:
            portfolio_q = portfolio_q.where(Project.organization_id == org_id)
        projects_result = await db.execute(portfolio_q)
        projects = projects_result.scalars().all()

        project_summaries = []
        for proj in projects:
            # Count artifacts
            artifact_count_result = await db.execute(
                select(func.count(RegulatoryArtifact.id))
                .where(RegulatoryArtifact.project_id == proj.id)
            )
            artifacts_count = artifact_count_result.scalar() or 0

            # Count evidence records
            evidence_count_result = await db.execute(
                select(func.count(EvidenceRecord.id))
                .where(EvidenceRecord.project_id == proj.id)
            )
            evidence_count = evidence_count_result.scalar() or 0

            # Compute readiness score inline
            readiness = await ProgramDashboardService.get_submission_readiness(db, proj.id)
            readiness_score = readiness.get("overall_score", 0.0)

            # Last activity from audit logs
            last_log_result = await db.execute(
                select(AuditLog.timestamp)
                .where(AuditLog.project_id == proj.id)
                .order_by(AuditLog.timestamp.desc())
                .limit(1)
            )
            last_activity_row = last_log_result.scalar_one_or_none()
            last_activity = last_activity_row.isoformat() if last_activity_row else (
                proj.updated_at.isoformat() if proj.updated_at else None
            )

            project_summaries.append({
                "id": proj.id,
                "title": proj.title,
                "status": proj.status.value if isinstance(proj.status, ProjectStatus) else str(proj.status),
                "readiness_score": readiness_score,
                "artifacts_count": artifacts_count,
                "evidence_count": evidence_count,
                "last_activity": last_activity,
            })

        return {
            "projects": project_summaries,
            "total_projects": len(project_summaries),
            "generated_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def get_milestone_timeline(db: AsyncSession, project_id: str) -> dict:
        """
        Key milestones for a project computed from audit logs and artifact timestamps.

        Milestones: protocol lock, SAP finalized, database lock, primary analysis,
        CSR draft, submission.
        """
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        if not project:
            return {"error": "Project not found", "project_id": project_id}

        # Fetch all audit logs for the project, ordered by timestamp
        logs_result = await db.execute(
            select(AuditLog)
            .where(AuditLog.project_id == project_id)
            .order_by(AuditLog.timestamp.asc())
        )
        logs = logs_result.scalars().all()

        # Fetch all artifacts for the project
        artifacts_result = await db.execute(
            select(RegulatoryArtifact)
            .where(RegulatoryArtifact.project_id == project_id)
            .order_by(RegulatoryArtifact.generated_at.asc())
        )
        artifacts = artifacts_result.scalars().all()
        artifact_types = {a.artifact_type: a for a in artifacts}

        # Map actions/artifacts to milestone completion
        milestone_definitions = [
            {
                "name": "Protocol Lock",
                "description": "Research protocol and study definition finalized",
                "detect_action": "protocol_lock",
                "detect_condition": lambda: project.research_intent and len(project.research_intent) > 10,
            },
            {
                "name": "SAP Finalized",
                "description": "Statistical Analysis Plan completed and approved",
                "detect_action": "sap_generated",
                "detect_artifact": ["sap", "statistical_analysis_plan"],
            },
            {
                "name": "Database Lock",
                "description": "Clinical database locked for analysis",
                "detect_action": "database_lock",
                "detect_artifact": ["sdtm_dataset", "sdtm"],
            },
            {
                "name": "Primary Analysis",
                "description": "Primary efficacy and safety analyses completed",
                "detect_action": "primary_analysis",
                "detect_artifact": ["adam_dataset", "adam", "tfl", "tables_figures_listings"],
            },
            {
                "name": "CSR Draft",
                "description": "Clinical Study Report draft completed",
                "detect_action": "csr_generated",
                "detect_artifact": ["csr", "clinical_study_report"],
            },
            {
                "name": "Submission",
                "description": "eCTD submission package finalized",
                "detect_action": "submission",
                "detect_artifact": ["ectd", "ectd_package"],
            },
        ]

        log_actions = {log.action: log for log in logs}

        milestones = []
        for mdef in milestone_definitions:
            status = "pending"
            date = None

            # Check audit logs for matching action
            if mdef["detect_action"] in log_actions:
                status = "completed"
                date = log_actions[mdef["detect_action"]].timestamp

            # Check artifacts
            if status == "pending" and "detect_artifact" in mdef:
                for atype in mdef["detect_artifact"]:
                    if atype in artifact_types:
                        status = "completed"
                        date = artifact_types[atype].generated_at
                        break

            # Check condition-based detection
            if status == "pending" and "detect_condition" in mdef:
                if mdef["detect_condition"]():
                    status = "completed"
                    date = project.updated_at

            milestones.append({
                "name": mdef["name"],
                "status": status,
                "date": date.isoformat() if date else None,
                "description": mdef["description"],
            })

        # Mark first pending milestone as in_progress
        for m in milestones:
            if m["status"] == "pending":
                m["status"] = "in_progress"
                break

        return {
            "project_id": project_id,
            "project_title": project.title,
            "milestones": milestones,
            "generated_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def get_cross_study_comparison(db: AsyncSession, project_ids: List[str]) -> dict:
        """
        Compare metrics across multiple projects.

        Returns a comparison table with project_id, title, evidence_count,
        review_completion_rate, readiness_score, artifacts_count.
        """
        comparison = []
        for pid in project_ids:
            proj_result = await db.execute(select(Project).where(Project.id == pid))
            project = proj_result.scalar_one_or_none()
            if not project:
                comparison.append({
                    "project_id": pid,
                    "title": "NOT FOUND",
                    "evidence_count": 0,
                    "review_completion_rate": 0.0,
                    "readiness_score": 0.0,
                    "artifacts_count": 0,
                })
                continue

            # Evidence count
            ev_result = await db.execute(
                select(func.count(EvidenceRecord.id))
                .where(EvidenceRecord.project_id == pid)
            )
            evidence_count = ev_result.scalar() or 0

            # Review completion rate
            total_reviews_result = await db.execute(
                select(func.count(ReviewDecision.id))
                .where(ReviewDecision.project_id == pid)
            )
            total_reviews = total_reviews_result.scalar() or 0

            completed_reviews_result = await db.execute(
                select(func.count(ReviewDecision.id))
                .where(
                    ReviewDecision.project_id == pid,
                    ReviewDecision.decision != ReviewDecisionEnum.PENDING,
                )
            )
            completed_reviews = completed_reviews_result.scalar() or 0
            review_rate = round((completed_reviews / total_reviews) * 100, 1) if total_reviews > 0 else 0.0

            # Readiness score
            readiness = await ProgramDashboardService.get_submission_readiness(db, pid)
            readiness_score = readiness.get("overall_score", 0.0)

            # Artifacts count
            art_result = await db.execute(
                select(func.count(RegulatoryArtifact.id))
                .where(RegulatoryArtifact.project_id == pid)
            )
            artifacts_count = art_result.scalar() or 0

            comparison.append({
                "project_id": pid,
                "title": project.title,
                "evidence_count": evidence_count,
                "review_completion_rate": review_rate,
                "readiness_score": readiness_score,
                "artifacts_count": artifacts_count,
            })

        return {
            "comparison": comparison,
            "projects_compared": len(comparison),
            "generated_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def generate_program_report(db: AsyncSession) -> dict:
        """
        Generate an executive summary across all projects.

        Returns formatted HTML report, project list, overall readiness,
        key risks, and upcoming milestones.
        """
        portfolio = await ProgramDashboardService.get_portfolio_summary(db)
        projects = portfolio["projects"]

        # Overall readiness across all projects
        if projects:
            overall_readiness = round(
                sum(p["readiness_score"] for p in projects) / len(projects), 1
            )
        else:
            overall_readiness = 0.0

        # Key risks — projects with low readiness or stale activity
        key_risks = []
        for p in projects:
            if p["readiness_score"] < 30:
                key_risks.append({
                    "project_id": p["id"],
                    "title": p["title"],
                    "risk": "Low readiness score",
                    "score": p["readiness_score"],
                })
            if p["evidence_count"] == 0:
                key_risks.append({
                    "project_id": p["id"],
                    "title": p["title"],
                    "risk": "No evidence records collected",
                    "score": 0,
                })

        # Upcoming milestones — gather in_progress milestones across all projects
        upcoming_milestones = []
        for p in projects:
            timeline = await ProgramDashboardService.get_milestone_timeline(db, p["id"])
            for m in timeline.get("milestones", []):
                if m["status"] == "in_progress":
                    upcoming_milestones.append({
                        "project_id": p["id"],
                        "project_title": p["title"],
                        "milestone": m["name"],
                        "description": m["description"],
                    })

        # Generate HTML report
        project_rows = []
        for p in projects:
            status_color = {
                "draft": "#9e9e9e",
                "processing": "#2196f3",
                "review": "#ff9800",
                "completed": "#4caf50",
                "archived": "#607d8b",
            }.get(p["status"], "#9e9e9e")

            project_rows.append(
                f'<tr>'
                f'<td>{p["title"]}</td>'
                f'<td><span style="color:{status_color};font-weight:bold;">{p["status"].upper()}</span></td>'
                f'<td>{p["readiness_score"]}%</td>'
                f'<td>{p["evidence_count"]}</td>'
                f'<td>{p["artifacts_count"]}</td>'
                f'</tr>'
            )

        risk_rows = []
        for r in key_risks:
            risk_rows.append(
                f'<li><strong>{r["title"]}</strong>: {r["risk"]} (score: {r["score"]}%)</li>'
            )

        milestone_rows = []
        for m in upcoming_milestones:
            milestone_rows.append(
                f'<li><strong>{m["project_title"]}</strong>: {m["milestone"]} &mdash; {m["description"]}</li>'
            )

        html = (
            '<html><head><title>Program Executive Summary</title>'
            '<style>'
            'body{font-family:Arial,sans-serif;margin:20px;color:#333;}'
            'h1{color:#1a73e8;}h2{color:#444;border-bottom:2px solid #1a73e8;padding-bottom:4px;}'
            'table{border-collapse:collapse;width:100%;margin:12px 0;}'
            'th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;}'
            'th{background:#1a73e8;color:#fff;}'
            '.metric{display:inline-block;background:#f5f5f5;border-radius:8px;padding:12px 20px;margin:6px;text-align:center;}'
            '.metric .value{font-size:28px;font-weight:bold;color:#1a73e8;}'
            '.metric .label{font-size:12px;color:#666;}'
            '</style></head><body>'
            '<h1>Program Executive Summary</h1>'
            f'<p>Generated: {datetime.utcnow().strftime("%Y-%m-%d %H:%M")} UTC</p>'
            '<div>'
            f'<div class="metric"><div class="value">{len(projects)}</div><div class="label">Total Projects</div></div>'
            f'<div class="metric"><div class="value">{overall_readiness}%</div><div class="label">Avg Readiness</div></div>'
            f'<div class="metric"><div class="value">{len(key_risks)}</div><div class="label">Key Risks</div></div>'
            f'<div class="metric"><div class="value">{len(upcoming_milestones)}</div><div class="label">Active Milestones</div></div>'
            '</div>'
            '<h2>Project Portfolio</h2>'
            '<table><tr><th>Project</th><th>Status</th><th>Readiness</th><th>Evidence</th><th>Artifacts</th></tr>'
            + "\n".join(project_rows)
            + '</table>'
            '<h2>Key Risks</h2>'
            + ('<ul>' + "\n".join(risk_rows) + '</ul>' if risk_rows else '<p>No critical risks identified.</p>')
            + '<h2>Upcoming Milestones</h2>'
            + ('<ul>' + "\n".join(milestone_rows) + '</ul>' if milestone_rows else '<p>No active milestones.</p>')
            + '</body></html>'
        )

        return {
            "html": html,
            "projects": projects,
            "overall_readiness": overall_readiness,
            "key_risks": key_risks,
            "upcoming_milestones": upcoming_milestones,
            "generated_at": datetime.utcnow().isoformat(),
        }
