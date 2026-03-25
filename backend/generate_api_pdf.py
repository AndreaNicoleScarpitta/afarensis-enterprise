"""Generate professional API documentation PDF for Afarensis Enterprise."""

import json
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.platypus.flowables import Flowable
from datetime import datetime

# Colors
NAVY = HexColor("#1b2a4a")
DARK_BLUE = HexColor("#1e3a5f")
LIGHT_BLUE = HexColor("#e8f0fe")
ACCENT = HexColor("#2563eb")
LIGHT_GRAY = HexColor("#f5f5f5")
MID_GRAY = HexColor("#e0e0e0")
DARK_GRAY = HexColor("#333333")
METHOD_COLORS = {
    "GET": HexColor("#22c55e"),
    "POST": HexColor("#3b82f6"),
    "PUT": HexColor("#f59e0b"),
    "DELETE": HexColor("#ef4444"),
    "PATCH": HexColor("#8b5cf6"),
}

# Styles
styles = getSampleStyleSheet()

title_style = ParagraphStyle("DocTitle", parent=styles["Title"],
    fontSize=28, textColor=NAVY, spaceAfter=6, fontName="Helvetica-Bold")

subtitle_style = ParagraphStyle("DocSubtitle", parent=styles["Normal"],
    fontSize=14, textColor=DARK_GRAY, spaceAfter=30, fontName="Helvetica")

section_style = ParagraphStyle("Section", parent=styles["Heading1"],
    fontSize=18, textColor=NAVY, spaceBefore=20, spaceAfter=10,
    fontName="Helvetica-Bold", borderWidth=0, borderPadding=0)

subsection_style = ParagraphStyle("Subsection", parent=styles["Heading2"],
    fontSize=13, textColor=DARK_BLUE, spaceBefore=14, spaceAfter=6,
    fontName="Helvetica-Bold")

body_style = ParagraphStyle("Body", parent=styles["Normal"],
    fontSize=9.5, textColor=DARK_GRAY, spaceAfter=4, fontName="Helvetica",
    leading=13)

small_style = ParagraphStyle("Small", parent=styles["Normal"],
    fontSize=8, textColor=DARK_GRAY, fontName="Helvetica", leading=10)

code_style = ParagraphStyle("Code", parent=styles["Normal"],
    fontSize=8.5, textColor=DARK_GRAY, fontName="Courier", leading=11,
    leftIndent=12, backColor=LIGHT_GRAY, borderPadding=4)

method_style = ParagraphStyle("Method", parent=styles["Normal"],
    fontSize=9, textColor=white, fontName="Helvetica-Bold",
    alignment=TA_CENTER)

path_style = ParagraphStyle("Path", parent=styles["Normal"],
    fontSize=9, textColor=DARK_GRAY, fontName="Courier")

toc_style = ParagraphStyle("TOC", parent=styles["Normal"],
    fontSize=10, textColor=DARK_BLUE, fontName="Helvetica",
    spaceBefore=3, spaceAfter=3, leftIndent=20)

toc_section_style = ParagraphStyle("TOCSection", parent=styles["Normal"],
    fontSize=11, textColor=NAVY, fontName="Helvetica-Bold",
    spaceBefore=8, spaceAfter=2)

footer_style = ParagraphStyle("Footer", parent=styles["Normal"],
    fontSize=7, textColor=DARK_GRAY, fontName="Helvetica", alignment=TA_CENTER)


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(DARK_GRAY)
    canvas.drawCentredString(letter[0] / 2, 0.5 * inch,
        f"Afarensis Enterprise API Documentation  |  Page {doc.page}")
    # Header line
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(0.5)
    canvas.line(0.75 * inch, letter[1] - 0.6 * inch,
                letter[0] - 0.75 * inch, letter[1] - 0.6 * inch)
    canvas.restoreState()


def categorize_endpoints(endpoints):
    """Group endpoints by category based on path patterns."""
    categories = {
        "Health & System": [],
        "Authentication": [],
        "Projects": [],
        "Evidence Discovery": [],
        "Comparability & Bias": [],
        "Review & Collaboration": [],
        "Regulatory Artifacts": [],
        "Search": [],
        "Semantic Scholar": [],
        "Study Workflow": [],
        "SAR Pipeline": [],
        "TFL Generation": [],
        "ADaM Datasets": [],
        "Missing Data Analysis": [],
        "SAP Generation": [],
        "Submission Packaging": [],
        "AI & Workflow Intelligence": [],
        "Statistics": [],
        "Federated Network": [],
        "Admin & Audit": [],
    }

    for ep in endpoints:
        p = ep["path"]
        if "/health" in p:
            categories["Health & System"].append(ep)
        elif "/auth/" in p:
            categories["Authentication"].append(ep)
        elif "/study/definition" in p or "/study/lock" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/covariates" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/data-sources" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/cohort" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/balance" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/results" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/bias" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/reproducibility" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/audit" in p:
            categories["Study Workflow"].append(ep)
        elif "/study/regulatory" in p:
            categories["Regulatory Artifacts"].append(ep)
        elif "/study/sap" in p:
            categories["SAP Generation"].append(ep)
        elif "/study/tfl" in p:
            categories["TFL Generation"].append(ep)
        elif "/study/missing-data" in p:
            categories["Missing Data Analysis"].append(ep)
        elif "/submission/" in p:
            categories["Submission Packaging"].append(ep)
        elif "/adam/" in p:
            categories["ADaM Datasets"].append(ep)
        elif "/sar-pipeline" in p:
            categories["SAR Pipeline"].append(ep)
        elif "/discover-evidence" in p or "/generate-anchors" in p:
            categories["Evidence Discovery"].append(ep)
        elif "/evidence" in p and "/review" not in p and "/network" not in p:
            categories["Evidence Discovery"].append(ep)
        elif "/comparability" in p or "/bias" in p or "/analyze-bias" in p:
            categories["Comparability & Bias"].append(ep)
        elif "/review/" in p or "/decision" in p or "/critique" in p or "/conflicts" in p or "/presence" in p or "/workflows" in p:
            categories["Review & Collaboration"].append(ep)
        elif "/artifacts" in p or "/generate-artifact" in p:
            categories["Regulatory Artifacts"].append(ep)
        elif "/search/" in p and "semantic-scholar" not in p:
            categories["Search"].append(ep)
        elif "semantic-scholar" in p or "rare-disease" in p:
            categories["Semantic Scholar"].append(ep)
        elif "/ai/" in p or "/workflow/" in p or "/security/threat" in p or "/data/classify" in p:
            categories["AI & Workflow Intelligence"].append(ep)
        elif "/statistics" in p:
            categories["Statistics"].append(ep)
        elif "/federated" in p or "/evidence-patterns" in p:
            categories["Federated Network"].append(ep)
        elif "/users" in p or "/audit" in p or "/analytics" in p:
            categories["Admin & Audit"].append(ep)
        elif "/projects" in p:
            categories["Projects"].append(ep)
        else:
            categories["Health & System"].append(ep)

    # Remove empty categories
    return {k: v for k, v in categories.items() if v}


def build_endpoint_block(ep):
    """Build a KeepTogether block for one endpoint."""
    method = ep["method"]
    color = METHOD_COLORS.get(method, DARK_GRAY)

    # Method badge + path
    method_data = [[
        Paragraph(f"<b>{method}</b>", method_style),
        Paragraph(f"<font face='Courier' size='9'>{ep['path']}</font>", path_style),
    ]]
    method_table = Table(method_data, colWidths=[0.55 * inch, 5.9 * inch])
    method_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("BACKGROUND", (1, 0), (1, 0), LIGHT_GRAY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 6),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
    ]))

    elements = [method_table]

    # Description
    if ep["doc"]:
        doc_text = ep["doc"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        elements.append(Spacer(1, 3))
        elements.append(Paragraph(doc_text, body_style))

    # Parameters
    if ep["params"]:
        elements.append(Spacer(1, 3))
        param_header = [
            Paragraph("<b>Parameter</b>", small_style),
            Paragraph("<b>Type</b>", small_style),
            Paragraph("<b>Default</b>", small_style),
        ]
        param_rows = [param_header]
        for param in ep["params"]:
            param_rows.append([
                Paragraph(f"<font face='Courier'>{param['name']}</font>", small_style),
                Paragraph(param["type"], small_style),
                Paragraph(param["default"] or "required", small_style),
            ])
        param_table = Table(param_rows, colWidths=[2.0 * inch, 2.0 * inch, 2.45 * inch])
        param_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), MID_GRAY),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.3, MID_GRAY),
        ]))
        elements.append(param_table)

    elements.append(Spacer(1, 8))
    return KeepTogether(elements)


def generate_pdf(endpoints, output_path):
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )

    story = []
    categories = categorize_endpoints(endpoints)

    # ── Title Page ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("Afarensis Enterprise", title_style))
    story.append(Paragraph("API Documentation", ParagraphStyle("T2",
        parent=title_style, fontSize=22, textColor=ACCENT)))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=2, color=NAVY))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"Version 2.0  |  {len(endpoints)} Endpoints  |  "
        f"Generated {datetime.now().strftime('%B %d, %Y')}",
        subtitle_style))
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "Enterprise-grade clinical evidence review platform for regulatory submissions. "
        "Implements statistical traceability, CDISC ADaM compliance, ICH E9(R1) estimand framework, "
        "eCTD packaging, and 21 CFR Part 11 audit trails.",
        body_style))
    story.append(Spacer(1, 15))

    # Summary stats
    summary_data = [
        [Paragraph("<b>Category</b>", small_style), Paragraph("<b>Endpoints</b>", small_style)],
    ]
    for cat_name, cat_eps in categories.items():
        summary_data.append([
            Paragraph(cat_name, small_style),
            Paragraph(str(len(cat_eps)), small_style),
        ])
    summary_data.append([
        Paragraph("<b>Total</b>", small_style),
        Paragraph(f"<b>{len(endpoints)}</b>", small_style),
    ])
    summary_table = Table(summary_data, colWidths=[4.5 * inch, 1.5 * inch])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_BLUE),
        ("GRID", (0, 0), (-1, -1), 0.3, MID_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [white, LIGHT_GRAY]),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))

    # Auth info
    story.append(Paragraph("<b>Authentication:</b> Bearer JWT token in Authorization header", body_style))
    story.append(Paragraph("<b>Base URL:</b> <font face='Courier'>/api/v1</font>", body_style))
    story.append(Paragraph("<b>Content-Type:</b> <font face='Courier'>application/json</font>", body_style))

    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────────
    story.append(Paragraph("Table of Contents", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    story.append(Spacer(1, 10))

    page_num = 3  # Estimate
    for cat_name, cat_eps in categories.items():
        story.append(Paragraph(
            f"<b>{cat_name}</b> ({len(cat_eps)} endpoints)", toc_section_style))
        for ep in cat_eps:
            story.append(Paragraph(
                f"<font face='Courier' size='8'>{ep['method']}</font>  "
                f"<font face='Courier' size='8'>{ep['path']}</font>",
                toc_style))

    story.append(PageBreak())

    # ── Endpoint Sections ─────────────────────────────────────────────────────
    for cat_name, cat_eps in categories.items():
        story.append(Paragraph(cat_name, section_style))
        story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
        story.append(Spacer(1, 8))

        # Category description
        cat_descriptions = {
            "Health & System": "System health monitoring and status endpoints.",
            "Authentication": "JWT-based authentication with role-based access control. Supports access tokens (30 min) and refresh tokens (30 days).",
            "Projects": "CRUD operations for regulatory evidence review projects. Each project encapsulates a complete study workflow.",
            "Evidence Discovery": "Automated evidence discovery from PubMed, ClinicalTrials.gov, and other sources. Stores results as EvidenceRecord objects.",
            "Comparability & Bias": "Anchor comparability scoring (6 dimensions) and bias detection with E-value, fragility index, and sensitivity analyses.",
            "Review & Collaboration": "Multi-reviewer workflows with assignments, threaded comments, conflict resolution, and real-time presence tracking.",
            "Regulatory Artifacts": "Generate and download regulatory documents: Safety Assessment Reports (SAR), evidence tables, and submission-ready packages.",
            "Search": "Semantic, hybrid, and citation network search across evidence records.",
            "Semantic Scholar": "Integration with Semantic Scholar API for academic paper search, citations, and rare disease evidence.",
            "Study Workflow": "10-step regulatory study workflow. Each step reads/writes a section of the project's processing_config JSON.",
            "SAR Pipeline": "End-to-end SAR generation pipeline with stage execution and real statistical computation.",
            "TFL Generation": "Tables, Figures, and Listings (TFL) generation: demographics, adverse events, Kaplan-Meier curves, forest plots, Love plots.",
            "ADaM Datasets": "CDISC ADaM dataset generation (ADSL, ADAE, ADTTE) with validation and Define-XML metadata export.",
            "Missing Data Analysis": "Multiple imputation (MICE + Rubin's rules), tipping-point sensitivity, and MMRM (Mixed Model for Repeated Measures).",
            "SAP Generation": "Statistical Analysis Plan generation as DOCX with ICH E9(R1) estimand framework, multiplicity, and missing data strategy.",
            "Submission Packaging": "FDA submission packaging: eCTD Module 5, Define-XML 2.1, ADRG, and ICH E3 Clinical Study Report sections.",
            "AI & Workflow Intelligence": "AI-powered analysis, workflow guidance, security threat detection, and data classification.",
            "Statistics": "Full statistical analysis pipeline: Cox PH, IPTW, propensity scores, Kaplan-Meier, E-value, fragility, meta-analysis.",
            "Federated Network": "Federated evidence network nodes and shared evidence patterns.",
            "Admin & Audit": "User management, 21 CFR Part 11 audit logs, and analytics dashboard.",
        }
        if cat_name in cat_descriptions:
            story.append(Paragraph(cat_descriptions[cat_name], body_style))
            story.append(Spacer(1, 8))

        for ep in cat_eps:
            story.append(build_endpoint_block(ep))

        story.append(PageBreak())

    # ── Appendix: Data Models ─────────────────────────────────────────────────
    story.append(Paragraph("Appendix A: Core Data Models", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    story.append(Spacer(1, 8))

    models_info = [
        ("Project", "projects", "Central entity for regulatory evidence review. Stores study configuration in processing_config JSON.",
         "id (UUID), title, description, status (DRAFT/PROCESSING/REVIEW/COMPLETED/ARCHIVED), research_intent, processing_config (JSON), created_by, created_at"),
        ("User", "users", "Platform users with role-based access.",
         "id, email, full_name, role (ADMIN/REVIEWER/ANALYST/VIEWER), hashed_password, is_active, organization, department"),
        ("EvidenceRecord", "evidence_records", "Individual evidence items discovered from PubMed, ClinicalTrials.gov, or uploaded documents.",
         "id, project_id, source_type, source_id, title, abstract, authors (JSON), journal, publication_year, structured_data (JSON)"),
        ("ComparabilityScore", "comparability_scores", "Six-dimensional comparability scoring for evidence-to-study alignment.",
         "id, evidence_record_id, population_similarity, endpoint_alignment, covariate_coverage, temporal_alignment, evidence_quality, provenance_score, overall_score, regulatory_viability"),
        ("BiasAnalysis", "bias_analyses", "Bias detection results with severity, fragility, and mitigation strategies.",
         "id, comparability_score_id, bias_type, bias_severity, fragility_score, sensitivity_flags (JSON), regulatory_risk, mitigation_strategies (JSON)"),
        ("ReviewDecision", "review_decisions", "Reviewer decisions on evidence records with e-signatures.",
         "id, project_id, evidence_record_id, reviewer_id, decision (ACCEPTED/REJECTED/DEFERRED/PENDING), confidence_level, rationale, review_criteria (JSON)"),
        ("RegulatoryArtifact", "regulatory_artifacts", "Generated regulatory documents (SAR, SAP, ADRG, CSR, etc.).",
         "id, project_id, artifact_type, title, format, file_path, file_size, checksum, generated_at, regulatory_agency"),
        ("AuditLog", "audit_logs", "21 CFR Part 11 compliant audit trail.",
         "id, project_id, user_id, action, resource_type, resource_id, old_values (JSON), new_values (JSON), timestamp, regulatory_significance"),
        ("AdamDataset", "adam_datasets", "CDISC ADaM dataset specifications and data.",
         "id, project_id, dataset_name, dataset_label, structure, variables (JSON), records_count, data_content (JSON), validation_status"),
        ("ParsedSpecification", "parsed_specifications", "Parsed protocol/SAP with structured fields.",
         "id, project_id, indication, population_definition, primary_endpoint, secondary_endpoints (JSON), inclusion_criteria (JSON), exclusion_criteria (JSON), covariates (JSON)"),
    ]

    for model_name, table_name, desc, fields in models_info:
        story.append(Paragraph(f"<b>{model_name}</b> (<font face='Courier'>{table_name}</font>)", subsection_style))
        story.append(Paragraph(desc, body_style))
        story.append(Paragraph(f"<font face='Courier' size='8'>{fields}</font>", code_style))
        story.append(Spacer(1, 6))

    story.append(PageBreak())

    # ── Appendix B: Error Responses ───────────────────────────────────────────
    story.append(Paragraph("Appendix B: Error Responses", section_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY))
    story.append(Spacer(1, 8))
    story.append(Paragraph("All error responses follow a consistent JSON structure:", body_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph('{"detail": "Error message describing what went wrong"}', code_style))
    story.append(Spacer(1, 10))

    error_data = [
        [Paragraph("<b>Code</b>", small_style), Paragraph("<b>Meaning</b>", small_style), Paragraph("<b>When</b>", small_style)],
        [Paragraph("200", small_style), Paragraph("OK", small_style), Paragraph("Successful request", small_style)],
        [Paragraph("201", small_style), Paragraph("Created", small_style), Paragraph("Resource created", small_style)],
        [Paragraph("400", small_style), Paragraph("Bad Request", small_style), Paragraph("Invalid request body or parameters", small_style)],
        [Paragraph("401", small_style), Paragraph("Unauthorized", small_style), Paragraph("Missing or invalid JWT token", small_style)],
        [Paragraph("403", small_style), Paragraph("Forbidden", small_style), Paragraph("Insufficient role permissions", small_style)],
        [Paragraph("404", small_style), Paragraph("Not Found", small_style), Paragraph("Resource does not exist", small_style)],
        [Paragraph("422", small_style), Paragraph("Validation Error", small_style), Paragraph("Request body fails schema validation", small_style)],
        [Paragraph("429", small_style), Paragraph("Rate Limited", small_style), Paragraph("Too many requests (exponential backoff)", small_style)],
        [Paragraph("500", small_style), Paragraph("Server Error", small_style), Paragraph("Unexpected server-side error", small_style)],
    ]
    error_table = Table(error_data, colWidths=[0.8 * inch, 1.5 * inch, 4.15 * inch])
    error_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("GRID", (0, 0), (-1, -1), 0.3, MID_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_GRAY]),
    ]))
    story.append(error_table)

    # ── Build ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF generated: {output_path}")
    print(f"  Endpoints documented: {len(endpoints)}")
    print(f"  Categories: {len(categories)}")


if __name__ == "__main__":
    with open("_endpoints.json") as f:
        endpoints = json.load(f)

    output = r"C:\Users\andys\Downloads\AfarensisEnterprise-v2.1-COMPLETE-FIXED-PACKAGE\AfarensisEnterprise-v2.1-FIXED-COMPLETE\docs\API_Documentation.pdf"
    generate_pdf(endpoints, output)
