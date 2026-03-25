"""
Afarensis Enterprise — CDISC Define-XML 2.1 Generator

Generates Define-XML metadata files per CDISC Define-XML 2.1 specification.
These machine-readable files describe all datasets, variables, codelists,
and value-level metadata required for FDA data submissions.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models import Project, AdamDataset

logger = logging.getLogger(__name__)


# =====================================================================
# Default ADaM variable definitions (used when DB records lack detail)
# =====================================================================

_DEFAULT_ADAM_VARIABLES: Dict[str, List[Dict[str, str]]] = {
    "ADSL": [
        {"name": "STUDYID",  "label": "Study Identifier",                "type": "text",    "length": "20",  "origin": "CRF"},
        {"name": "USUBJID",  "label": "Unique Subject Identifier",       "type": "text",    "length": "40",  "origin": "Derived"},
        {"name": "SUBJID",   "label": "Subject Identifier for the Study","type": "text",    "length": "20",  "origin": "CRF"},
        {"name": "SITEID",   "label": "Study Site Identifier",           "type": "text",    "length": "10",  "origin": "CRF"},
        {"name": "AGE",      "label": "Age",                             "type": "integer", "length": "8",   "origin": "CRF"},
        {"name": "AGEU",     "label": "Age Units",                       "type": "text",    "length": "10",  "origin": "CRF"},
        {"name": "SEX",      "label": "Sex",                             "type": "text",    "length": "2",   "origin": "CRF",     "codelist": "CL.SEX"},
        {"name": "RACE",     "label": "Race",                            "type": "text",    "length": "60",  "origin": "CRF",     "codelist": "CL.RACE"},
        {"name": "ARM",      "label": "Description of Planned Arm",      "type": "text",    "length": "200", "origin": "CRF"},
        {"name": "TRT01P",   "label": "Planned Treatment for Period 01", "type": "text",    "length": "200", "origin": "Derived"},
        {"name": "TRT01A",   "label": "Actual Treatment for Period 01",  "type": "text",    "length": "200", "origin": "Derived"},
        {"name": "ITTFL",    "label": "Intent-To-Treat Population Flag", "type": "text",    "length": "2",   "origin": "Derived", "codelist": "CL.NY"},
        {"name": "SAFFL",    "label": "Safety Population Flag",          "type": "text",    "length": "2",   "origin": "Derived", "codelist": "CL.NY"},
        {"name": "TRTSDT",   "label": "Date of First Exposure to Trt",   "type": "integer", "length": "8",   "origin": "Derived"},
        {"name": "TRTEDT",   "label": "Date of Last Exposure to Trt",    "type": "integer", "length": "8",   "origin": "Derived"},
    ],
    "ADAE": [
        {"name": "STUDYID",  "label": "Study Identifier",                "type": "text",    "length": "20",  "origin": "CRF"},
        {"name": "USUBJID",  "label": "Unique Subject Identifier",       "type": "text",    "length": "40",  "origin": "Derived"},
        {"name": "AESEQ",    "label": "Sequence Number",                 "type": "integer", "length": "8",   "origin": "CRF"},
        {"name": "AETERM",   "label": "Reported Term for the AE",        "type": "text",    "length": "200", "origin": "CRF"},
        {"name": "AEDECOD",  "label": "Dictionary-Derived Term",         "type": "text",    "length": "200", "origin": "Derived"},
        {"name": "AEBODSYS", "label": "Body System or Organ Class",      "type": "text",    "length": "200", "origin": "Derived"},
        {"name": "AESEV",    "label": "Severity/Intensity",              "type": "text",    "length": "20",  "origin": "CRF",     "codelist": "CL.AESEV"},
        {"name": "AESER",    "label": "Serious Event",                   "type": "text",    "length": "2",   "origin": "CRF",     "codelist": "CL.AESER"},
        {"name": "AEREL",    "label": "Causality",                       "type": "text",    "length": "20",  "origin": "CRF"},
        {"name": "AEACN",    "label": "Action Taken with Study Trt",     "type": "text",    "length": "40",  "origin": "CRF"},
        {"name": "ASTDT",    "label": "Analysis Start Date",             "type": "integer", "length": "8",   "origin": "Derived"},
        {"name": "AENDT",    "label": "Analysis End Date",               "type": "integer", "length": "8",   "origin": "Derived"},
        {"name": "TRTEMFL",  "label": "Treatment Emergent Analysis Flag", "type": "text",   "length": "2",   "origin": "Derived", "codelist": "CL.NY"},
    ],
    "ADTTE": [
        {"name": "STUDYID",  "label": "Study Identifier",                "type": "text",    "length": "20",  "origin": "CRF"},
        {"name": "USUBJID",  "label": "Unique Subject Identifier",       "type": "text",    "length": "40",  "origin": "Derived"},
        {"name": "PARAMCD",  "label": "Parameter Code",                  "type": "text",    "length": "20",  "origin": "Derived"},
        {"name": "PARAM",    "label": "Parameter",                       "type": "text",    "length": "200", "origin": "Derived"},
        {"name": "AVAL",     "label": "Analysis Value",                  "type": "float",   "length": "8",   "origin": "Derived"},
        {"name": "CNSR",     "label": "Censor",                          "type": "integer", "length": "8",   "origin": "Derived"},
        {"name": "STARTDT",  "label": "Time to Event Origin Date",       "type": "integer", "length": "8",   "origin": "Derived"},
        {"name": "EVNTDESC", "label": "Event or Censoring Description",  "type": "text",    "length": "200", "origin": "Derived"},
        {"name": "CNSDTDSC", "label": "Censor Date Description",         "type": "text",    "length": "200", "origin": "Derived"},
    ],
}


class DefineXMLGenerator:
    """Generates CDISC Define-XML 2.1 metadata documents."""

    DEFINE_XML_VERSION = "2.1.0"
    ODM_VERSION = "1.3.2"

    async def generate(self, db: AsyncSession, project_id: str) -> dict:
        """
        Generate Define-XML for all ADaM datasets in a project.

        Returns:
        - xml_content: the Define-XML as a string
        - datasets: list of dataset metadata
        - variables_count: total variables across all datasets
        - codelists: list of codelists used
        - validation: validation results
        """
        # ---- Fetch project ----
        project = await db.get(Project, project_id)
        if not project:
            return {
                "xml_content": "",
                "datasets": [],
                "variables_count": 0,
                "codelists": [],
                "validation": {"valid": False, "errors": ["Project not found"]},
            }

        # ---- Fetch ADaM datasets ----
        result = await db.execute(
            select(AdamDataset).where(AdamDataset.project_id == project_id)
        )
        adam_records = result.scalars().all()

        # Build dataset metadata — merge DB records with defaults
        datasets_meta = self._build_datasets_metadata(adam_records)

        # ---- Codelists ----
        codelists = self.generate_codelists()

        # ---- Build XML ----
        study_oid = getattr(project, "protocol_id", "XY-301") or "XY-301"
        study_name = getattr(project, "title", "External Control Arm Study") or "External Control Arm Study"
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

        xml_content = self._assemble_xml(
            study_oid=study_oid,
            study_name=study_name,
            creation_dt=now,
            datasets=datasets_meta,
            codelists=codelists,
        )

        # ---- Validation ----
        validation = self.validate_define_xml(xml_content)

        total_vars = sum(len(ds["variables"]) for ds in datasets_meta)

        logger.info(
            "Define-XML generated for project %s: %d datasets, %d variables",
            project_id, len(datasets_meta), total_vars,
        )

        return {
            "xml_content": xml_content,
            "datasets": [
                {
                    "name": ds["name"],
                    "label": ds["label"],
                    "structure": ds["structure"],
                    "variables_count": len(ds["variables"]),
                }
                for ds in datasets_meta
            ],
            "variables_count": total_vars,
            "codelists": [{"oid": cl["oid"], "name": cl["name"], "items_count": len(cl["items"])} for cl in codelists],
            "validation": validation,
        }

    # ------------------------------------------------------------------
    # Codelists
    # ------------------------------------------------------------------

    def generate_codelists(self) -> list:
        """Generate standard CDISC codelists for ADaM variables."""
        return [
            {
                "oid": "CL.SEX",
                "name": "Sex",
                "datatype": "text",
                "items": [
                    {"coded_value": "M", "decode": "Male"},
                    {"coded_value": "F", "decode": "Female"},
                ],
            },
            {
                "oid": "CL.RACE",
                "name": "Race",
                "datatype": "text",
                "items": [
                    {"coded_value": "WHITE",                      "decode": "White"},
                    {"coded_value": "BLACK OR AFRICAN AMERICAN",  "decode": "Black or African American"},
                    {"coded_value": "ASIAN",                      "decode": "Asian"},
                    {"coded_value": "AMERICAN INDIAN OR ALASKA NATIVE", "decode": "American Indian or Alaska Native"},
                    {"coded_value": "OTHER",                      "decode": "Other"},
                ],
            },
            {
                "oid": "CL.NY",
                "name": "No Yes Response",
                "datatype": "text",
                "items": [
                    {"coded_value": "Y", "decode": "Yes"},
                    {"coded_value": "N", "decode": "No"},
                ],
            },
            {
                "oid": "CL.AESEV",
                "name": "Severity/Intensity Scale for AEs",
                "datatype": "text",
                "items": [
                    {"coded_value": "MILD",     "decode": "Mild"},
                    {"coded_value": "MODERATE", "decode": "Moderate"},
                    {"coded_value": "SEVERE",   "decode": "Severe"},
                ],
            },
            {
                "oid": "CL.AESER",
                "name": "Serious Event",
                "datatype": "text",
                "items": [
                    {"coded_value": "Y", "decode": "Yes"},
                    {"coded_value": "N", "decode": "No"},
                ],
            },
        ]

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate_define_xml(self, xml_content: str) -> dict:
        """Validate the generated Define-XML against CDISC rules."""
        errors: List[str] = []
        warnings: List[str] = []

        if not xml_content:
            return {"valid": False, "errors": ["XML content is empty"], "warnings": []}

        # 1. Check all datasets have OIDs
        if "ItemGroupDef" not in xml_content:
            errors.append("No ItemGroupDef elements found — datasets missing")

        # 2. Check all variables have labels
        # Count ItemDef entries vs those with def:Label
        item_def_count = xml_content.count("<ItemDef ")
        label_count = xml_content.count("def:Label=")
        if item_def_count == 0:
            errors.append("No ItemDef elements found — variables missing")
        elif label_count < item_def_count:
            errors.append(
                f"Some variables missing labels: {label_count} labels for "
                f"{item_def_count} variables"
            )

        # 3. Check label lengths <= 40 chars
        import re
        labels = re.findall(r'def:Label="([^"]*)"', xml_content)
        long_labels = [lbl for lbl in labels if len(lbl) > 40]
        if long_labels:
            for lbl in long_labels:
                warnings.append(f"Label exceeds 40 chars ({len(lbl)}): \"{lbl[:50]}...\"")

        # 4. Check codelist references resolve
        cl_refs = set(re.findall(r'CodeListRef CodeListOID="([^"]*)"', xml_content))
        cl_defs = set(re.findall(r'<CodeList OID="([^"]*)"', xml_content))
        unresolved = cl_refs - cl_defs
        if unresolved:
            for ref in unresolved:
                errors.append(f"Unresolved CodeList reference: {ref}")

        # 5. Basic XML well-formedness (simple check)
        if not xml_content.strip().startswith("<?xml"):
            errors.append("Missing XML declaration")
        if xml_content.count("<ODM") != xml_content.count("</ODM>"):
            errors.append("Mismatched ODM open/close tags")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_datasets_metadata(self, adam_records) -> List[Dict[str, Any]]:
        """Merge DB AdamDataset rows with default variable definitions."""
        # Index DB records by name
        db_map: Dict[str, Any] = {}
        if adam_records:
            for rec in adam_records:
                name = getattr(rec, "dataset_name", "").upper()
                db_map[name] = rec

        datasets = []
        structures = {
            "ADSL": "One record per subject",
            "ADAE": "One record per adverse event per subject",
            "ADTTE": "One record per parameter per subject",
        }
        labels = {
            "ADSL": "Subject-Level Analysis Dataset",
            "ADAE": "Adverse Events Analysis Dataset",
            "ADTTE": "Time-to-Event Analysis Dataset",
        }

        for ds_name in ("ADSL", "ADAE", "ADTTE"):
            db_rec = db_map.get(ds_name)
            variables = _DEFAULT_ADAM_VARIABLES.get(ds_name, [])

            # Merge DB variable specs if available
            if db_rec and getattr(db_rec, "variables", None):
                db_vars = getattr(db_rec, "variables")
                if isinstance(db_vars, list) and db_vars:
                    variables = db_vars

            datasets.append({
                "name": ds_name,
                "label": getattr(db_rec, "dataset_label", None) or labels.get(ds_name, ds_name),
                "structure": getattr(db_rec, "structure", None) or structures.get(ds_name, ""),
                "class": "ADAM OTHER" if ds_name == "ADTTE" else "ADAM OTHER",
                "purpose": "Analysis",
                "variables": variables,
            })

        return datasets

    def _assemble_xml(
        self,
        study_oid: str,
        study_name: str,
        creation_dt: str,
        datasets: List[Dict[str, Any]],
        codelists: list,
    ) -> str:
        """Build the full Define-XML string."""
        # ---- ItemGroupDefs ----
        ig_blocks = []
        item_defs = []
        seen_item_oids: set = set()

        for ds in datasets:
            ds_name = ds["name"]
            ds_oid = f"IG.{ds_name}"
            var_refs = []
            for idx, var in enumerate(ds["variables"], start=1):
                var_name = var.get("name", f"VAR{idx}")
                item_oid = f"IT.{ds_name}.{var_name}"
                var_refs.append(
                    f'        <ItemRef ItemOID="{item_oid}" OrderNumber="{idx}" Mandatory="No"/>'
                )
                # Build ItemDef only once per unique OID
                if item_oid not in seen_item_oids:
                    seen_item_oids.add(item_oid)
                    item_defs.append(self._build_item_def(item_oid, var, ds_name))

            var_refs_xml = "\n".join(var_refs)
            ig_blocks.append(
                f'      <ItemGroupDef OID="{ds_oid}"\n'
                f'                    Name="{ds_name}"\n'
                f'                    def:Label="{ds["label"]}"\n'
                f'                    def:Structure="{ds["structure"]}"\n'
                f'                    def:Class="{ds["class"]}"\n'
                f'                    Purpose="{ds["purpose"]}"\n'
                f'                    Repeating="{"Yes" if ds_name != "ADSL" else "No"}">\n'
                f"{var_refs_xml}\n"
                f"      </ItemGroupDef>"
            )

        # ---- CodeLists ----
        cl_blocks = []
        for cl in codelists:
            items_xml = "\n".join(
                f'        <CodeListItem CodedValue="{it["coded_value"]}">\n'
                f'          <Decode><TranslatedText xml:lang="en">{it["decode"]}</TranslatedText></Decode>\n'
                f"        </CodeListItem>"
                for it in cl["items"]
            )
            cl_blocks.append(
                f'      <CodeList OID="{cl["oid"]}" Name="{cl["name"]}"\n'
                f'                DataType="{cl["datatype"]}">\n'
                f"{items_xml}\n"
                f"      </CodeList>"
            )

        # ---- Assemble full document ----
        ig_xml = "\n".join(ig_blocks)
        id_xml = "\n".join(item_defs)
        cl_xml = "\n".join(cl_blocks)

        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"\n'
            '     xmlns:def="http://www.cdisc.org/ns/def/v2.1"\n'
            f'     ODMVersion="{self.ODM_VERSION}"\n'
            '     FileType="Snapshot"\n'
            f'     FileOID="DEF.{study_oid}.ADAM"\n'
            f'     CreationDateTime="{creation_dt}">\n'
            f'  <Study OID="{study_oid}">\n'
            "    <GlobalVariables>\n"
            f"      <StudyName>{study_name}</StudyName>\n"
            f"      <StudyDescription>External Control Arm Study</StudyDescription>\n"
            f"      <ProtocolName>{study_oid}</ProtocolName>\n"
            "    </GlobalVariables>\n"
            f'    <MetaDataVersion OID="CDISC.ADaM.{self.DEFINE_XML_VERSION}"\n'
            f'                     Name="ADaM {self.DEFINE_XML_VERSION}"\n'
            f'                     def:DefineVersion="{self.DEFINE_XML_VERSION}">\n'
            f"{ig_xml}\n"
            f"{id_xml}\n"
            f"{cl_xml}\n"
            "    </MetaDataVersion>\n"
            "  </Study>\n"
            "</ODM>"
        )
        return xml

    @staticmethod
    def _build_item_def(oid: str, var: dict, ds_name: str) -> str:
        """Build a single <ItemDef> element for a variable."""
        name = var.get("name", "UNKNOWN")
        label = var.get("label", name)
        dtype = var.get("type", "text")
        length = var.get("length", "8")
        origin = var.get("origin", "Derived")
        codelist_oid = var.get("codelist", "")

        # Map Python-style types to Define-XML DataType
        type_map = {"text": "text", "integer": "integer", "float": "float"}
        xml_type = type_map.get(dtype, "text")

        parts = [
            f'      <ItemDef OID="{oid}"',
            f'              Name="{name}"',
            f'              DataType="{xml_type}"',
            f'              Length="{length}"',
            f'              def:Label="{label}"',
            f'              def:Origin="{origin}">',
        ]
        inner = ""
        if codelist_oid:
            inner = f'\n        <CodeListRef CodeListOID="{codelist_oid}"/>'
        comment = var.get("comment", "")
        if comment:
            inner += f"\n        <!-- {comment} -->"

        return "\n".join(parts) + inner + "\n      </ItemDef>"
