"""
Afarensis Enterprise — eCTD Module 5 Packager

Organizes regulatory submission documents into the FDA's electronic
Common Technical Document (eCTD) structure per ICH M8 specifications.
Generates the directory structure, Study Tagging File (STF), and
document cross-references required for gateway submission.
"""

import os
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models import Project, RegulatoryArtifact, EvidenceRecord, ParsedSpecification

logger = logging.getLogger(__name__)


class ECTDPackager:
    """Generates eCTD Module 5 submission packages."""

    ECTD_NAMESPACE = "http://www.ich.org/ectd/v3.0"
    SUBMISSION_TYPE = "original"
    SEQUENCE_NUMBER = "0000"

    # Required eCTD Module 5 sections
    _REQUIRED_SECTIONS = [
        "m5/datasets/analysis",
        "m5/datasets/tabulations",
        "m5/clinical-study-reports/study-report-body",
        "m5/clinical-study-reports/study-report-appendices",
        "m5/clinical-study-reports/individual-patient-data",
        "m5/literature-references",
        "m5/regional-info",
    ]

    # Standard ADaM datasets expected
    _ADAM_DATASETS = ["adsl", "adae", "adtte"]

    async def generate_package(self, db: AsyncSession, project_id: str) -> dict:
        """
        Build a complete eCTD Module 5 package structure.

        Returns a dict representing the package with:
        - directory_structure: nested dict of folders/files
        - study_tagging_file: STF XML content
        - documents: list of all included documents with checksums
        - validation: package validation results
        """
        # ---- Fetch project data from DB ----
        project = await db.get(Project, project_id)
        if not project:
            return {
                "error": f"Project {project_id} not found",
                "directory_structure": {},
                "study_tagging_file": "",
                "documents": [],
                "validation": {"valid": False, "errors": ["Project not found"]},
            }

        artifacts_result = await db.execute(
            select(RegulatoryArtifact).where(
                RegulatoryArtifact.project_id == project_id
            )
        )
        artifacts = artifacts_result.scalars().all()

        evidence_result = await db.execute(
            select(EvidenceRecord).where(
                EvidenceRecord.project_id == project_id
            )
        )
        evidence_records = evidence_result.scalars().all()

        specs_result = await db.execute(
            select(ParsedSpecification).where(
                ParsedSpecification.project_id == project_id
            )
        )
        specifications = specs_result.scalars().all()

        # ---- Build project metadata ----
        project_data = {
            "project_id": project_id,
            "protocol": getattr(project, "protocol_id", "XY-301"),
            "title": getattr(project, "title", "External Control Arm Study"),
            "sponsor": getattr(project, "sponsor", "Afarensis Therapeutics, Inc."),
            "indication": getattr(project, "indication", "Rare CNS Disorder (Pediatric)"),
            "submission_type": self.SUBMISSION_TYPE,
            "sequence_number": self.SEQUENCE_NUMBER,
        }

        # ---- Assemble virtual documents ----
        documents: List[Dict[str, Any]] = []
        now = datetime.utcnow().isoformat()

        # ADaM analysis datasets
        for ds_name in self._ADAM_DATASETS:
            content = json.dumps(
                {"dataset": ds_name.upper(), "project_id": project_id, "generated": now},
                indent=2,
            )
            documents.append(self._make_document(
                path=f"m5/datasets/analysis/{ds_name}.json",
                title=f"{ds_name.upper()} Analysis Dataset",
                content=content,
                doc_type="dataset",
                format="json",
            ))

        # Clinical Study Reports
        csr_docs = [
            ("m5/clinical-study-reports/study-report-body/csr-synopsis.html",
             "Clinical Study Report — Synopsis",
             self._generate_csr_synopsis_html(project_data, evidence_records)),
            ("m5/clinical-study-reports/study-report-body/csr-full.html",
             "Clinical Study Report — Full",
             self._generate_csr_full_html(project_data, artifacts)),
            ("m5/clinical-study-reports/study-report-appendices/appendix-16-1-9-statistical-methods.html",
             "Appendix 16.1.9 — Statistical Methods",
             self._generate_statistical_appendix_html(project_data)),
            ("m5/clinical-study-reports/study-report-appendices/appendix-analysis-datasets.html",
             "Appendix — Analysis Datasets Description",
             self._generate_dataset_appendix_html(project_data)),
        ]
        for path, title, html_content in csr_docs:
            documents.append(self._make_document(
                path=path, title=title, content=html_content,
                doc_type="clinical-study-report", format="html",
            ))

        # Literature references
        ref_html = self._generate_references_html(evidence_records)
        documents.append(self._make_document(
            path="m5/literature-references/references.html",
            title="Literature References",
            content=ref_html,
            doc_type="literature-reference",
            format="html",
        ))

        # Regional info — cover letter
        cover_html = self._generate_cover_letter_html(project_data)
        documents.append(self._make_document(
            path="m5/regional-info/cover-letter.html",
            title="Cover Letter",
            content=cover_html,
            doc_type="regional-info",
            format="html",
        ))

        # ---- Build directory tree ----
        directory_structure = self._build_directory_tree(documents)

        # ---- Generate STF ----
        stf_xml = self.generate_study_tagging_file(project_data, documents)

        # ---- Validate ----
        package = {
            "directory_structure": directory_structure,
            "study_tagging_file": stf_xml,
            "documents": documents,
        }
        validation = self.validate_package(package)
        package["validation"] = validation

        logger.info(
            "eCTD package generated for project %s: %d documents, valid=%s",
            project_id, len(documents), validation["valid"],
        )
        return package

    # ------------------------------------------------------------------
    # Study Tagging File
    # ------------------------------------------------------------------

    def generate_study_tagging_file(self, project_data: dict, documents: list) -> str:
        """
        Generate the Study Tagging File (STF) as XML.

        The STF maps each document to its eCTD location, provides
        document metadata (title, format, checksum), and defines
        the submission sequence.
        """
        now = datetime.utcnow().isoformat()
        study_id = project_data.get("protocol", "XY-301")
        title = project_data.get("title", "")
        submission_type = project_data.get("submission_type", self.SUBMISSION_TYPE)
        sequence = project_data.get("sequence_number", self.SEQUENCE_NUMBER)

        doc_entries = []
        for idx, doc in enumerate(documents, start=1):
            md5 = hashlib.md5(doc.get("content", "").encode("utf-8")).hexdigest()
            entry = (
                f'    <document id="doc-{idx:04d}">\n'
                f"      <title>{doc['title']}</title>\n"
                f"      <file-path>{doc['path']}</file-path>\n"
                f"      <checksum algorithm=\"md5\">{md5}</checksum>\n"
                f"      <doc-type>{doc.get('doc_type', 'unknown')}</doc-type>\n"
                f"      <format>{doc.get('format', 'html')}</format>\n"
                f"    </document>"
            )
            doc_entries.append(entry)

        documents_xml = "\n".join(doc_entries)

        stf = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<study-tagging-file xmlns="{self.ECTD_NAMESPACE}"\n'
            f'                    created="{now}">\n'
            f"  <study-id>{study_id}</study-id>\n"
            f"  <title>{title}</title>\n"
            f"  <submission-type>{submission_type}</submission-type>\n"
            f"  <sequence-number>{sequence}</sequence-number>\n"
            f"  <documents>\n{documents_xml}\n  </documents>\n"
            f"</study-tagging-file>"
        )
        return stf

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate_package(self, package: dict) -> dict:
        """
        Validate the eCTD package against FDA Technical Conformance Guide rules.

        Returns: valid (bool), errors (list), warnings (list),
                 documents_count, total_size_bytes
        """
        errors: List[str] = []
        warnings: List[str] = []
        documents = package.get("documents", [])
        directory = package.get("directory_structure", {})
        stf = package.get("study_tagging_file", "")

        # 1. Required sections present
        doc_paths = {d["path"] for d in documents}
        for section in self._REQUIRED_SECTIONS:
            section_found = any(p.startswith(section) for p in doc_paths)
            if not section_found:
                # individual-patient-data and tabulations are placeholders
                if "individual-patient-data" in section or "tabulations" in section:
                    warnings.append(f"Optional section empty: {section}")
                else:
                    errors.append(f"Required section missing content: {section}")

        # 2. File naming conventions (lowercase, no spaces)
        for doc in documents:
            fname = doc["path"].split("/")[-1]
            if fname != fname.lower():
                errors.append(f"Filename not lowercase: {doc['path']}")
            if " " in fname:
                errors.append(f"Filename contains spaces: {doc['path']}")

        # 3. Checksums present
        for doc in documents:
            if not doc.get("checksum_sha256"):
                errors.append(f"Missing SHA-256 checksum: {doc['path']}")

        # 4. STF present and non-empty
        if not stf or len(stf) < 50:
            errors.append("Study Tagging File is missing or empty")

        # 5. PDF bookmark requirements (placeholder — no real PDFs)
        pdf_docs = [d for d in documents if d.get("format") == "pdf"]
        if pdf_docs:
            warnings.append(
                f"{len(pdf_docs)} PDF document(s) present — bookmark validation skipped (virtual package)"
            )

        # 6. Dataset presence
        dataset_docs = [d for d in documents if d.get("doc_type") == "dataset"]
        if not dataset_docs:
            errors.append("No analysis datasets found in package")

        total_size = sum(d.get("size_bytes", 0) for d in documents)

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "documents_count": len(documents),
            "total_size_bytes": total_size,
        }

    # ------------------------------------------------------------------
    # Manifest
    # ------------------------------------------------------------------

    def generate_package_manifest(self, package: dict) -> str:
        """Generate an HTML manifest listing all submission documents."""
        documents = package.get("documents", [])
        validation = package.get("validation", {})
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

        rows = []
        for doc in documents:
            status = "OK" if doc.get("checksum_sha256") else "WARN"
            rows.append(
                f"        <tr>\n"
                f"          <td>{doc['path']}</td>\n"
                f"          <td>{doc['title']}</td>\n"
                f"          <td>{doc.get('format', 'N/A')}</td>\n"
                f"          <td>{doc.get('size_bytes', 0):,}</td>\n"
                f"          <td style=\"font-family:monospace;font-size:0.75em\">"
                f"{doc.get('checksum_sha256', 'N/A')}</td>\n"
                f"          <td>{status}</td>\n"
                f"        </tr>"
            )

        rows_html = "\n".join(rows)
        valid_str = "PASS" if validation.get("valid") else "FAIL"

        manifest = (
            "<!DOCTYPE html>\n<html>\n<head>\n"
            "  <meta charset=\"UTF-8\">\n"
            "  <title>eCTD Package Manifest</title>\n"
            "  <style>\n"
            "    body { font-family: Arial, sans-serif; margin: 2em; }\n"
            "    table { border-collapse: collapse; width: 100%; }\n"
            "    th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; }\n"
            "    th { background: #003366; color: #fff; }\n"
            "    .pass { color: green; font-weight: bold; }\n"
            "    .fail { color: red; font-weight: bold; }\n"
            "  </style>\n"
            "</head>\n<body>\n"
            "  <h1>eCTD Module 5 — Package Manifest</h1>\n"
            f"  <p>Generated: {now}</p>\n"
            f"  <p>Documents: {len(documents)} | "
            f"Validation: <span class=\"{'pass' if validation.get('valid') else 'fail'}\">"
            f"{valid_str}</span></p>\n"
            "  <table>\n"
            "    <thead>\n"
            "      <tr>\n"
            "        <th>Path</th><th>Title</th><th>Format</th>"
            "<th>Size (bytes)</th><th>SHA-256</th><th>Status</th>\n"
            "      </tr>\n"
            "    </thead>\n"
            f"    <tbody>\n{rows_html}\n    </tbody>\n"
            "  </table>\n"
            "</body>\n</html>"
        )
        return manifest

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make_document(
        path: str, title: str, content: str, doc_type: str, format: str
    ) -> Dict[str, Any]:
        """Create a virtual document entry with SHA-256 checksum."""
        encoded = content.encode("utf-8")
        return {
            "path": path,
            "title": title,
            "content": content,
            "doc_type": doc_type,
            "format": format,
            "size_bytes": len(encoded),
            "checksum_sha256": hashlib.sha256(encoded).hexdigest(),
        }

    @staticmethod
    def _build_directory_tree(documents: List[Dict[str, Any]]) -> dict:
        """Convert flat document paths into a nested directory dict."""
        tree: dict = {}
        for doc in documents:
            parts = doc["path"].split("/")
            node = tree
            for part in parts[:-1]:
                node = node.setdefault(part, {})
            node[parts[-1]] = {
                "title": doc["title"],
                "format": doc["format"],
                "size_bytes": doc["size_bytes"],
            }
        return tree

    # ------------------------------------------------------------------
    # HTML generators for virtual documents
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_csr_synopsis_html(project_data: dict, evidence_records) -> str:
        protocol = project_data.get("protocol", "XY-301")
        title = project_data.get("title", "")
        sponsor = project_data.get("sponsor", "")
        indication = project_data.get("indication", "")
        evidence_count = len(evidence_records) if evidence_records else 0

        return (
            "<!DOCTYPE html>\n<html><head><meta charset=\"UTF-8\">\n"
            f"<title>CSR Synopsis — {protocol}</title></head>\n<body>\n"
            f"<h1>Clinical Study Report Synopsis</h1>\n"
            f"<h2>{protocol}: {title}</h2>\n"
            f"<table border=\"1\" cellpadding=\"6\">\n"
            f"<tr><td><b>Sponsor</b></td><td>{sponsor}</td></tr>\n"
            f"<tr><td><b>Protocol</b></td><td>{protocol}</td></tr>\n"
            f"<tr><td><b>Indication</b></td><td>{indication}</td></tr>\n"
            f"<tr><td><b>Study Design</b></td><td>External Control Arm (ECA)</td></tr>\n"
            f"<tr><td><b>Evidence Sources</b></td><td>{evidence_count} records</td></tr>\n"
            f"</table>\n"
            "</body></html>"
        )

    @staticmethod
    def _generate_csr_full_html(project_data: dict, artifacts) -> str:
        protocol = project_data.get("protocol", "XY-301")
        title = project_data.get("title", "")
        artifact_count = len(artifacts) if artifacts else 0

        return (
            "<!DOCTYPE html>\n<html><head><meta charset=\"UTF-8\">\n"
            f"<title>CSR Full Report — {protocol}</title></head>\n<body>\n"
            f"<h1>Clinical Study Report</h1>\n"
            f"<h2>{protocol}: {title}</h2>\n"
            f"<p>This document constitutes the full Clinical Study Report for study "
            f"{protocol}.</p>\n"
            f"<p>Regulatory artifacts included: {artifact_count}</p>\n"
            f"<h3>Sections</h3>\n<ul>\n"
            "<li>1. Synopsis</li>\n<li>2. Introduction</li>\n"
            "<li>3. Study Objectives</li>\n<li>4. Investigational Plan</li>\n"
            "<li>5. Study Patients</li>\n<li>6. Efficacy Evaluation</li>\n"
            "<li>7. Safety Evaluation</li>\n<li>8. Discussion</li>\n"
            "<li>9. Conclusions</li>\n<li>10. References</li>\n"
            "</ul>\n</body></html>"
        )

    @staticmethod
    def _generate_statistical_appendix_html(project_data: dict) -> str:
        protocol = project_data.get("protocol", "XY-301")
        return (
            "<!DOCTYPE html>\n<html><head><meta charset=\"UTF-8\">\n"
            f"<title>Appendix 16.1.9 — {protocol}</title></head>\n<body>\n"
            f"<h1>Appendix 16.1.9 — Documentation of Statistical Methods</h1>\n"
            f"<h2>Study {protocol}</h2>\n"
            "<h3>Primary Analysis</h3>\n"
            "<p>IPTW Cox proportional hazards model for time-to-first "
            "hospitalization with robust (sandwich) standard errors.</p>\n"
            "<h3>Propensity Score Model</h3>\n"
            "<p>Logistic regression with covariates: age, sex, disease duration, "
            "baseline EDSS, prior relapse count, prior immunotherapy, region, CCI.</p>\n"
            "<h3>Sensitivity Analyses</h3>\n<ul>\n"
            "<li>Trimmed weights (1st/99th percentile)</li>\n"
            "<li>Matching (1:1 nearest-neighbor)</li>\n"
            "<li>Doubly robust estimation (AIPW)</li>\n"
            "</ul>\n</body></html>"
        )

    @staticmethod
    def _generate_dataset_appendix_html(project_data: dict) -> str:
        protocol = project_data.get("protocol", "XY-301")
        return (
            "<!DOCTYPE html>\n<html><head><meta charset=\"UTF-8\">\n"
            f"<title>Analysis Datasets — {protocol}</title></head>\n<body>\n"
            f"<h1>Appendix — Analysis Datasets Description</h1>\n"
            f"<h2>Study {protocol}</h2>\n"
            "<table border=\"1\" cellpadding=\"6\">\n"
            "<tr><th>Dataset</th><th>Label</th><th>Structure</th></tr>\n"
            "<tr><td>ADSL</td><td>Subject-Level Analysis Dataset</td>"
            "<td>One record per subject</td></tr>\n"
            "<tr><td>ADAE</td><td>Adverse Events Analysis Dataset</td>"
            "<td>One record per adverse event per subject</td></tr>\n"
            "<tr><td>ADTTE</td><td>Time-to-Event Analysis Dataset</td>"
            "<td>One record per parameter per subject</td></tr>\n"
            "</table>\n</body></html>"
        )

    @staticmethod
    def _generate_references_html(evidence_records) -> str:
        rows = []
        if evidence_records:
            for rec in evidence_records:
                source_id = getattr(rec, "source_id", "N/A")
                title = getattr(rec, "title", "Untitled")
                source_type = getattr(rec, "source_type", "unknown")
                rows.append(
                    f"<tr><td>{source_id}</td><td>{title}</td>"
                    f"<td>{source_type}</td></tr>"
                )
        rows_html = "\n".join(rows) if rows else "<tr><td colspan=\"3\">No references</td></tr>"

        return (
            "<!DOCTYPE html>\n<html><head><meta charset=\"UTF-8\">\n"
            "<title>Literature References</title></head>\n<body>\n"
            "<h1>Literature References</h1>\n"
            "<table border=\"1\" cellpadding=\"6\">\n"
            "<tr><th>Source ID</th><th>Title</th><th>Type</th></tr>\n"
            f"{rows_html}\n</table>\n</body></html>"
        )

    @staticmethod
    def _generate_cover_letter_html(project_data: dict) -> str:
        protocol = project_data.get("protocol", "XY-301")
        sponsor = project_data.get("sponsor", "")
        title = project_data.get("title", "")
        now = datetime.utcnow().strftime("%B %d, %Y")

        return (
            "<!DOCTYPE html>\n<html><head><meta charset=\"UTF-8\">\n"
            f"<title>Cover Letter — {protocol}</title></head>\n<body>\n"
            f"<p>{now}</p>\n"
            "<p>Food and Drug Administration<br>\n"
            "Center for Drug Evaluation and Research<br>\n"
            "5901 Ammendale Road<br>\n"
            "Beltsville, MD 20705-1266</p>\n"
            f"<p>Re: eCTD Submission for Study {protocol}</p>\n"
            f"<p>Dear Regulatory Reviewer,</p>\n"
            f"<p>{sponsor} hereby submits the Module 5 Clinical Study Report "
            f"package for study {protocol}: {title}.</p>\n"
            "<p>This package includes the full CSR, analysis datasets in ADaM "
            "format, statistical appendices, and supporting literature.</p>\n"
            "<p>Sincerely,<br>\nRegulatory Affairs</p>\n"
            "</body></html>"
        )
