"""Generate API Documentation PDF for Afarensis Enterprise v2.1"""
import json
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER

with open("_api_docs.json") as f:
    data = json.load(f)

output_path = "../docs/Afarensis_API_Documentation_v2.1.pdf"
doc = SimpleDocTemplate(
    output_path, pagesize=letter,
    topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    leftMargin=0.75 * inch, rightMargin=0.75 * inch,
)

styles = getSampleStyleSheet()
navy = HexColor("#1e3a5f")
blue = HexColor("#2563EB")
gray = HexColor("#6b7280")
light_gray = HexColor("#f3f4f6")
green = HexColor("#059669")
red = HexColor("#dc2626")
orange = HexColor("#d97706")
dark = HexColor("#374151")

styles.add(ParagraphStyle("DocTitle", parent=styles["Title"], fontSize=24, textColor=navy, spaceAfter=6))
styles.add(ParagraphStyle("DocSub", parent=styles["Normal"], fontSize=11, textColor=gray, spaceAfter=20))
styles.add(ParagraphStyle("GrpTitle", parent=styles["Heading2"], fontSize=16, textColor=navy, spaceBefore=20, spaceAfter=10))
styles.add(ParagraphStyle("EpTitle", parent=styles["Heading3"], fontSize=11, textColor=black, spaceBefore=12, spaceAfter=4))
styles.add(ParagraphStyle("Desc", parent=styles["Normal"], fontSize=9, textColor=dark, spaceAfter=4))
styles.add(ParagraphStyle("Auth", parent=styles["Normal"], fontSize=8, textColor=gray, fontName="Helvetica-Oblique"))
styles.add(ParagraphStyle("CodeBlock", parent=styles["Normal"], fontSize=8, fontName="Courier", textColor=HexColor("#1f2937"), backColor=light_gray))
styles.add(ParagraphStyle("TOC", parent=styles["Normal"], fontSize=10, textColor=dark, spaceBefore=2))
styles.add(ParagraphStyle("Ftr", parent=styles["Normal"], fontSize=7, textColor=gray, alignment=TA_CENTER))

story = []

# ---- Title page ----
story.append(Spacer(1, 2 * inch))
story.append(Paragraph("Afarensis Enterprise", styles["DocTitle"]))
story.append(Paragraph("API Documentation", styles["DocTitle"]))
story.append(Spacer(1, 0.3 * inch))
story.append(Paragraph("Version 2.1  |  133 Endpoints  |  Bearer JWT Authentication", styles["DocSub"]))
story.append(Spacer(1, 0.5 * inch))
story.append(HRFlowable(width="100%", thickness=1, color=navy))
story.append(Spacer(1, 0.3 * inch))
story.append(Paragraph('Base URL: <font color="#2563EB">/api/v1</font>', styles["Desc"]))
story.append(Paragraph("Authentication: Bearer JWT in Authorization header", styles["Desc"]))
story.append(Paragraph("Content-Type: application/json", styles["Desc"]))
story.append(Spacer(1, 0.5 * inch))

# Accounts table
acct = [
    ["Account", "Email", "Password", "Role"],
    ["Admin", "admin@afarensis.com", "admin123", "ADMIN"],
    ["Reviewer 1", "reviewer1@afarensis.com", "reviewer123", "REVIEWER"],
    ["Analyst", "analyst@afarensis.com", "analyst123", "ANALYST"],
    ["Viewer", "viewer@afarensis.com", "viewer123", "VIEWER"],
]
t = Table(acct, colWidths=[1.5 * inch, 2.2 * inch, 1.3 * inch, 1 * inch])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), navy),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, light_gray]),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.append(t)
story.append(PageBreak())

# ---- Table of Contents ----
story.append(Paragraph("Table of Contents", styles["GrpTitle"]))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#d1d5db")))
story.append(Spacer(1, 0.2 * inch))

group_order = [
    "Authentication & Health", "Projects", "Evidence & Analysis", "Review & Artifacts",
    "Collaborative Review", "Study Configuration", "SAP Generation", "TFL Generation",
    "Missing Data Analysis", "CDISC ADaM Datasets", "Statistics",
    "SAR Pipeline", "Search & Discovery",
    "eCTD Packaging", "Define-XML", "ADRG Generation", "Clinical Study Report",
    "Submission Status", "Federated Network", "Workflow & AI", "Security",
    "Administration", "Program Dashboard", "Other",
]

ordered = []
for g in group_order:
    if g in data["groups"]:
        ordered.append((g, data["groups"][g]))
for g, eps in data["groups"].items():
    if g not in group_order:
        ordered.append((g, eps))

for i, (group, eps) in enumerate(ordered):
    story.append(Paragraph(f"{i + 1}. <b>{group}</b> ({len(eps)} endpoints)", styles["TOC"]))

story.append(PageBreak())

# ---- Method colors ----
mc_map = {"GET": green, "POST": blue, "PUT": orange, "DELETE": red, "PATCH": HexColor("#7c3aed")}

# ---- Each group ----
for group, eps in ordered:
    story.append(Paragraph(group, styles["GrpTitle"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=navy))
    story.append(Spacer(1, 0.1 * inch))

    for ep in eps:
        method = ep["method"]
        path = ep["path"]
        name = ep["name"]
        doc_str = ep["doc"] or "No description available."
        params = ep.get("params", [])
        mc = mc_map.get(method, black)

        story.append(Paragraph(
            f'<font color="{mc.hexval()}" size="10"><b>{method}</b></font> '
            f'<font face="Courier" size="9">{path}</font>',
            styles["EpTitle"],
        ))
        story.append(Paragraph(doc_str, styles["Desc"]))
        story.append(Paragraph(f"<i>Handler: {name}()</i>", styles["Auth"]))

        if params:
            pdata = [["Parameter", "Type", "Default"]]
            for p in params:
                ptype = p["type"]
                if "annotation=" in str(ptype):
                    ptype = "JSON Body"
                pdef = p.get("default") or "Required"
                if "annotation=" in str(pdef):
                    pdef = "Required"
                pdata.append([p["name"], ptype, pdef])

            pt = Table(pdata, colWidths=[1.8 * inch, 1.5 * inch, 2.5 * inch])
            pt.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#e5e7eb")),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Courier"),
                ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#d1d5db")),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(Spacer(1, 3))
            story.append(pt)

        if "auth" not in path and "health" not in path:
            story.append(Paragraph("Requires: Bearer JWT token", styles["Auth"]))

        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=0.3, color=HexColor("#e5e7eb")))

# ---- Error responses ----
story.append(PageBreak())
story.append(Paragraph("Error Response Format", styles["GrpTitle"]))
story.append(HRFlowable(width="100%", thickness=0.5, color=navy))
story.append(Spacer(1, 0.1 * inch))
story.append(Paragraph("All error responses follow a standardized JSON format:", styles["Desc"]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    '{"error": {"type": "...", "message": "...", "correlation_id": "uuid"}, "detail": "..."}',
    styles["CodeBlock"],
))
story.append(Spacer(1, 0.2 * inch))

sdata = [
    ["Status", "Meaning"],
    ["200", "Success"],
    ["201", "Created"],
    ["400", "Bad Request - invalid parameters"],
    ["401", "Unauthorized - missing or invalid JWT token"],
    ["403", "Forbidden - insufficient role permissions"],
    ["404", "Not Found - resource does not exist"],
    ["422", "Validation Error - request body fails schema validation"],
    ["429", "Rate Limited - too many requests"],
    ["500", "Internal Server Error"],
]
st = Table(sdata, colWidths=[1 * inch, 5 * inch])
st.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), navy),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, light_gray]),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.append(st)

# ---- Roles ----
story.append(Spacer(1, 0.3 * inch))
story.append(Paragraph("Role-Based Access Control", styles["GrpTitle"]))
story.append(HRFlowable(width="100%", thickness=0.5, color=navy))
story.append(Spacer(1, 0.1 * inch))

rdata = [
    ["Role", "Access Level"],
    ["ADMIN", "Full access to all endpoints including user management and audit logs"],
    ["REVIEWER", "Review decisions, comments, evidence analysis, artifact generation"],
    ["ANALYST", "Project creation, evidence discovery, statistical analysis, TFL generation"],
    ["VIEWER", "Read-only access to projects, evidence, and results"],
]
rt = Table(rdata, colWidths=[1.2 * inch, 4.8 * inch])
rt.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), navy),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, light_gray]),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.append(rt)

story.append(Spacer(1, 0.5 * inch))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#d1d5db")))
story.append(Spacer(1, 0.1 * inch))
story.append(Paragraph("Afarensis Enterprise v2.1 - Synthetic Ascension - Confidential", styles["Ftr"]))

doc.build(story)
print(f"PDF generated: {output_path}")
