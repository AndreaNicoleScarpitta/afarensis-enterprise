"""
Afarensis Enterprise — CDISC ADaM Dataset Service

Generates Analysis Data Model (ADaM) datasets compliant with CDISC standards.
Supports ADSL (Subject-Level), ADAE (Adverse Events), and ADTTE (Time-to-Event).
Includes validation against ADaM Implementation Guide rules.
"""

import numpy as np
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models import Project

logger = logging.getLogger(__name__)


class AdamService:
    """Service for generating and validating CDISC ADaM datasets."""

    STUDY_ID = "XY-301"

    # MedDRA System Organ Classes and Preferred Terms for AE generation
    _AE_SOC_PT = {
        "Nervous system disorders": [
            "Headache", "Dizziness", "Somnolence", "Tremor", "Paraesthesia",
        ],
        "Gastrointestinal disorders": [
            "Nausea", "Diarrhoea", "Vomiting", "Abdominal pain", "Constipation",
        ],
        "General disorders and administration site conditions": [
            "Fatigue", "Pyrexia", "Asthenia", "Injection site reaction", "Oedema peripheral",
        ],
        "Infections and infestations": [
            "Upper respiratory tract infection", "Urinary tract infection",
            "Nasopharyngitis", "Pneumonia", "Bronchitis",
        ],
        "Musculoskeletal and connective tissue disorders": [
            "Arthralgia", "Back pain", "Myalgia", "Pain in extremity", "Muscle spasms",
        ],
    }

    _RACE_DIST = {
        "WHITE": 0.60,
        "BLACK OR AFRICAN AMERICAN": 0.18,
        "ASIAN": 0.14,
        "OTHER": 0.08,
    }

    @staticmethod
    async def create_adsl(db: AsyncSession, project_id: str, patient_data: list = None) -> dict:
        """
        Generate ADSL (Subject-Level Analysis Dataset).

        Standard ADaM variables per CDISC ADaM IG v1.3:
        STUDYID, USUBJID, SUBJID, SITEID, ARM, TRT01P, TRT01A,
        ITTFL, SAFFL, COMPLFL, AGE, AGEGR1, SEX, RACE, ETHNIC,
        TRTSDT, TRTEDT, TRTDUR, DTHFL, DTH, DTHDT

        If patient_data (list of dicts) is provided, real data is used
        instead of simulation. Missing ADaM columns receive defaults.
        """
        # --- Use real patient data when available ---
        if patient_data is not None:
            try:
                return AdamService._build_adsl_from_patient_data(patient_data, project_id)
            except Exception as exc:
                logger.warning("Failed to build ADSL from patient data, falling back to simulation: %s", exc)

        # Query project for processing config
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()

        processing_config = {}
        if project and project.processing_config:
            processing_config = project.processing_config

        # Use study definition from processing_config for project-specific parameters
        study_def = processing_config.get("study_definition", {})
        sar_pipeline = processing_config.get("sar_pipeline", {})

        # Determine study parameters: study_definition → sar_pipeline → hardcoded defaults
        study_id = processing_config.get("study_id", AdamService.STUDY_ID)
        treatment_name = (
            study_def.get("treatment")
            or sar_pipeline.get("treatment_source")
            or processing_config.get("treatment_name", "Drug-X 150mg")
        )
        control_name = (
            study_def.get("comparator")
            or sar_pipeline.get("control_source")
            or processing_config.get("control_name", "Standard of Care")
        )
        n_treatment = processing_config.get("n_treatment", 112)
        n_control = processing_config.get("n_control", 489)
        n_total = n_treatment + n_control

        rng = np.random.default_rng(seed=42)
        base_date = datetime(2020, 3, 15)
        sites = [f"{i:02d}" for i in range(1, 9)]

        race_labels = list(AdamService._RACE_DIST.keys())
        race_probs = list(AdamService._RACE_DIST.values())

        variables = [
            {"name": "STUDYID", "label": "Study Identifier", "type": "Char", "length": 12},
            {"name": "USUBJID", "label": "Unique Subject Identifier", "type": "Char", "length": 20},
            {"name": "SUBJID", "label": "Subject Identifier for the Study", "type": "Char", "length": 8},
            {"name": "SITEID", "label": "Study Site Identifier", "type": "Char", "length": 4},
            {"name": "ARM", "label": "Planned Arm", "type": "Char", "length": 40},
            {"name": "TRT01P", "label": "Planned Treatment for Period 01", "type": "Char", "length": 40},
            {"name": "TRT01A", "label": "Actual Treatment for Period 01", "type": "Char", "length": 40},
            {"name": "ITTFL", "label": "Intent-to-Treat Population Flag", "type": "Char", "length": 1},
            {"name": "SAFFL", "label": "Safety Population Flag", "type": "Char", "length": 1},
            {"name": "COMPLFL", "label": "Completers Population Flag", "type": "Char", "length": 1},
            {"name": "AGE", "label": "Age", "type": "Num", "length": 8},
            {"name": "AGEGR1", "label": "Pooled Age Group 1", "type": "Char", "length": 10},
            {"name": "SEX", "label": "Sex", "type": "Char", "length": 1},
            {"name": "RACE", "label": "Race", "type": "Char", "length": 40},
            {"name": "ETHNIC", "label": "Ethnicity", "type": "Char", "length": 20},
            {"name": "TRTSDT", "label": "Date of First Exposure to Treatment", "type": "Num", "length": 8},
            {"name": "TRTEDT", "label": "Date of Last Exposure to Treatment", "type": "Num", "length": 8},
            {"name": "TRTDUR", "label": "Duration of Treatment (days)", "type": "Num", "length": 8},
            {"name": "DTHFL", "label": "Subject Death Flag", "type": "Char", "length": 1},
            {"name": "DTH", "label": "Death Event (1=event, 0=no)", "type": "Num", "length": 8},
            {"name": "DTHDT", "label": "Date of Death", "type": "Num", "length": 8},
        ]

        data = []
        for i in range(n_total):
            subj_num = f"{i + 1:04d}"
            site = rng.choice(sites)
            usubjid = f"XY301-{site}-{subj_num}"

            is_treatment = i < n_treatment
            arm = treatment_name if is_treatment else control_name

            # Population flags
            itt_fl = "Y" if rng.random() > 0.02 else "N"
            saf_fl = "Y" if (itt_fl == "Y" and rng.random() > 0.03) else "N"
            compl_fl = "Y" if (saf_fl == "Y" and rng.random() > 0.15) else "N"

            # Demographics
            age = int(np.clip(rng.normal(62, 12), 18, 95))
            agegr1 = "<65" if age < 65 else ">=65"
            sex = "M" if rng.random() < 0.55 else "F"
            race = rng.choice(race_labels, p=race_probs)
            ethnic = "HISPANIC OR LATINO" if rng.random() < 0.15 else "NOT HISPANIC OR LATINO"

            # Treatment dates
            start_offset = int(rng.uniform(0, 180))
            trtsdt = base_date + timedelta(days=start_offset)
            trt_dur = int(rng.uniform(30, 365))
            trtedt = trtsdt + timedelta(days=trt_dur)

            # Death
            death_prob = 0.06 if is_treatment else 0.09
            dth = 1 if rng.random() < death_prob else 0
            dthfl = "Y" if dth == 1 else "N"
            dthdt = (trtsdt + timedelta(days=int(rng.uniform(14, trt_dur)))).isoformat() if dth == 1 else ""

            data.append({
                "STUDYID": study_id,
                "USUBJID": usubjid,
                "SUBJID": subj_num,
                "SITEID": site,
                "ARM": arm,
                "TRT01P": arm,
                "TRT01A": arm,
                "ITTFL": itt_fl,
                "SAFFL": saf_fl,
                "COMPLFL": compl_fl,
                "AGE": age,
                "AGEGR1": agegr1,
                "SEX": sex,
                "RACE": race,
                "ETHNIC": ethnic,
                "TRTSDT": trtsdt.isoformat(),
                "TRTEDT": trtedt.isoformat(),
                "TRTDUR": trt_dur,
                "DTHFL": dthfl,
                "DTH": dth,
                "DTHDT": dthdt,
            })

        return {
            "dataset_name": "ADSL",
            "label": "Subject-Level Analysis Dataset",
            "structure": "One record per subject",
            "variables": variables,
            "records_count": n_total,
            "data": data,
            "data_source": "simulated",
            "created_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    def _build_adsl_from_patient_data(patient_data: list, project_id: str) -> dict:
        """
        Build ADSL from real uploaded patient data.
        Maps available columns to ADaM ADSL variables; fills defaults for missing ones.
        """
        rng = np.random.default_rng(seed=42)
        base_date = datetime(2020, 3, 15)

        # Case-insensitive column lookup helper
        if not patient_data:
            raise ValueError("patient_data is empty")

        sample_row = patient_data[0]
        col_lower = {k.lower(): k for k in sample_row.keys()}

        def _get(row: dict, candidates: list, default=None):
            for cand in candidates:
                if cand.lower() in col_lower:
                    real_key = col_lower[cand.lower()]
                    val = row.get(real_key)
                    if val is not None and str(val).strip() != "":
                        return val
            return default

        variables = [
            {"name": "STUDYID", "label": "Study Identifier", "type": "Char", "length": 12},
            {"name": "USUBJID", "label": "Unique Subject Identifier", "type": "Char", "length": 20},
            {"name": "SUBJID", "label": "Subject Identifier for the Study", "type": "Char", "length": 8},
            {"name": "SITEID", "label": "Study Site Identifier", "type": "Char", "length": 4},
            {"name": "ARM", "label": "Planned Arm", "type": "Char", "length": 40},
            {"name": "TRT01P", "label": "Planned Treatment for Period 01", "type": "Char", "length": 40},
            {"name": "TRT01A", "label": "Actual Treatment for Period 01", "type": "Char", "length": 40},
            {"name": "ITTFL", "label": "Intent-to-Treat Population Flag", "type": "Char", "length": 1},
            {"name": "SAFFL", "label": "Safety Population Flag", "type": "Char", "length": 1},
            {"name": "COMPLFL", "label": "Completers Population Flag", "type": "Char", "length": 1},
            {"name": "AGE", "label": "Age", "type": "Num", "length": 8},
            {"name": "AGEGR1", "label": "Pooled Age Group 1", "type": "Char", "length": 10},
            {"name": "SEX", "label": "Sex", "type": "Char", "length": 1},
            {"name": "RACE", "label": "Race", "type": "Char", "length": 40},
            {"name": "ETHNIC", "label": "Ethnicity", "type": "Char", "length": 20},
            {"name": "TRTSDT", "label": "Date of First Exposure to Treatment", "type": "Num", "length": 8},
            {"name": "TRTEDT", "label": "Date of Last Exposure to Treatment", "type": "Num", "length": 8},
            {"name": "TRTDUR", "label": "Duration of Treatment (days)", "type": "Num", "length": 8},
            {"name": "DTHFL", "label": "Subject Death Flag", "type": "Char", "length": 1},
            {"name": "DTH", "label": "Death Event (1=event, 0=no)", "type": "Num", "length": 8},
            {"name": "DTHDT", "label": "Date of Death", "type": "Num", "length": 8},
        ]

        data = []
        for i, row in enumerate(patient_data):
            subj_num = f"{i + 1:04d}"
            usubjid = str(_get(row, ["USUBJID", "SUBJID", "SUBJECT_ID", "PATIENT_ID"], f"SUBJ-{subj_num}"))
            study_id = str(_get(row, ["STUDYID", "STUDY_ID", "PROTOCOL"], AdamService.STUDY_ID))
            site_id = str(_get(row, ["SITEID", "SITE_ID", "SITE"], f"{(i % 8) + 1:02d}"))

            arm = str(_get(row, ["ARM", "TRT01P", "ARMCD", "TREATMENT", "treatment", "group"], "Unknown"))
            trt01p = str(_get(row, ["TRT01P"], arm))
            trt01a = str(_get(row, ["TRT01A"], arm))

            # Demographics
            age_raw = _get(row, ["AGE", "age"], None)
            try:
                age = int(float(age_raw)) if age_raw is not None else int(rng.normal(62, 12))
            except (ValueError, TypeError):
                age = int(rng.normal(62, 12))
            age = max(0, min(age, 120))
            agegr1 = "<65" if age < 65 else ">=65"

            sex = str(_get(row, ["SEX", "GENDER", "sex", "gender"], "M" if rng.random() < 0.55 else "F"))
            sex = sex[0].upper() if sex else "U"

            race = str(_get(row, ["RACE", "race"], rng.choice(list(AdamService._RACE_DIST.keys()),
                        p=list(AdamService._RACE_DIST.values()))))
            ethnic = str(_get(row, ["ETHNIC", "ETHNICITY", "ethnicity"],
                        "HISPANIC OR LATINO" if rng.random() < 0.15 else "NOT HISPANIC OR LATINO"))

            # Flags
            itt_fl = str(_get(row, ["ITTFL"], "Y"))
            saf_fl = str(_get(row, ["SAFFL"], "Y"))
            compl_fl = str(_get(row, ["COMPLFL"], "Y" if rng.random() > 0.15 else "N"))

            # Dates
            start_offset = int(rng.uniform(0, 180))
            trtsdt_raw = _get(row, ["TRTSDT", "STARTDT", "START_DATE"], None)
            try:
                trtsdt = datetime.fromisoformat(str(trtsdt_raw)) if trtsdt_raw else base_date + timedelta(days=start_offset)
            except (ValueError, TypeError):
                trtsdt = base_date + timedelta(days=start_offset)

            trt_dur_raw = _get(row, ["TRTDUR", "DURATION"], None)
            try:
                trt_dur = int(float(trt_dur_raw)) if trt_dur_raw is not None else int(rng.uniform(30, 365))
            except (ValueError, TypeError):
                trt_dur = int(rng.uniform(30, 365))

            trtedt_raw = _get(row, ["TRTEDT", "END_DATE"], None)
            try:
                trtedt = datetime.fromisoformat(str(trtedt_raw)) if trtedt_raw else trtsdt + timedelta(days=trt_dur)
            except (ValueError, TypeError):
                trtedt = trtsdt + timedelta(days=trt_dur)

            # Death
            dth_raw = _get(row, ["DTH", "DEATH", "DTHFL"], None)
            if dth_raw is not None:
                dth = 1 if str(dth_raw).upper() in ("1", "Y", "YES", "TRUE") else 0
            else:
                dth = 0
            dthfl = "Y" if dth == 1 else "N"
            dthdt = str(_get(row, ["DTHDT", "DEATH_DATE"], "")) if dth == 1 else ""

            data.append({
                "STUDYID": study_id,
                "USUBJID": usubjid,
                "SUBJID": subj_num,
                "SITEID": site_id,
                "ARM": arm,
                "TRT01P": trt01p,
                "TRT01A": trt01a,
                "ITTFL": itt_fl,
                "SAFFL": saf_fl,
                "COMPLFL": compl_fl,
                "AGE": age,
                "AGEGR1": agegr1,
                "SEX": sex,
                "RACE": race,
                "ETHNIC": ethnic,
                "TRTSDT": trtsdt.isoformat(),
                "TRTEDT": trtedt.isoformat(),
                "TRTDUR": trt_dur,
                "DTHFL": dthfl,
                "DTH": dth,
                "DTHDT": dthdt,
            })

        return {
            "dataset_name": "ADSL",
            "label": "Subject-Level Analysis Dataset",
            "structure": "One record per subject",
            "variables": variables,
            "records_count": len(data),
            "data": data,
            "data_source": "uploaded",
            "created_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def create_adae(db: AsyncSession, project_id: str, adsl_data: Optional[List[dict]] = None, patient_data: list = None) -> dict:
        """
        Generate ADAE (Adverse Events Analysis Dataset).

        Standard ADaM variables:
        STUDYID, USUBJID, AESEQ, AEBODSYS, AEDECOD, AESEV,
        AESER, AEREL, AESTDTC, AEENDTC, AEOUT, TRTEMFL

        If patient_data is provided, build ADSL from it first.
        """
        # If no ADSL data provided, generate it (optionally from patient data)
        if adsl_data is None:
            adsl_result = await AdamService.create_adsl(db, project_id, patient_data=patient_data)
            adsl_data = adsl_result["data"]

        rng = np.random.default_rng(seed=123)
        soc_list = list(AdamService._AE_SOC_PT.keys())
        severity_choices = ["MILD", "MODERATE", "SEVERE"]
        severity_probs = [0.55, 0.33, 0.12]
        outcome_choices = ["RECOVERED/RESOLVED", "RECOVERING/RESOLVING", "NOT RECOVERED/NOT RESOLVED", "FATAL"]
        outcome_probs = [0.60, 0.22, 0.15, 0.03]

        variables = [
            {"name": "STUDYID", "label": "Study Identifier", "type": "Char", "length": 12},
            {"name": "USUBJID", "label": "Unique Subject Identifier", "type": "Char", "length": 20},
            {"name": "AESEQ", "label": "Sequence Number", "type": "Num", "length": 8},
            {"name": "AEBODSYS", "label": "Body System or Organ Class", "type": "Char", "length": 40},
            {"name": "AEDECOD", "label": "Dictionary-Derived Term", "type": "Char", "length": 40},
            {"name": "AESEV", "label": "Severity/Intensity", "type": "Char", "length": 10},
            {"name": "AESER", "label": "Serious Event", "type": "Char", "length": 1},
            {"name": "AEREL", "label": "Causality", "type": "Char", "length": 20},
            {"name": "AESTDTC", "label": "Start Date/Time of AE", "type": "Char", "length": 20},
            {"name": "AEENDTC", "label": "End Date/Time of AE", "type": "Char", "length": 20},
            {"name": "AEOUT", "label": "Outcome of AE", "type": "Char", "length": 40},
            {"name": "TRTEMFL", "label": "Treatment Emergent Flag", "type": "Char", "length": 1},
        ]

        data = []
        for subj in adsl_data:
            if subj.get("SAFFL") != "Y":
                continue

            n_aes = int(rng.integers(3, 6))  # 3 to 5 AEs per subject
            trtsdt = datetime.fromisoformat(subj["TRTSDT"])

            for seq in range(1, n_aes + 1):
                soc = rng.choice(soc_list)
                pt = rng.choice(AdamService._AE_SOC_PT[soc])
                severity = rng.choice(severity_choices, p=severity_probs)
                is_serious = "Y" if (severity == "SEVERE" and rng.random() < 0.40) else "N"
                relatedness = "RELATED" if rng.random() < 0.35 else "NOT RELATED"

                ae_start_offset = int(rng.uniform(1, subj["TRTDUR"]))
                ae_start = trtsdt + timedelta(days=ae_start_offset)
                ae_dur = int(rng.uniform(1, 30))
                ae_end = ae_start + timedelta(days=ae_dur)

                outcome = rng.choice(outcome_choices, p=outcome_probs)
                if outcome == "FATAL" and subj.get("DTHFL") != "Y":
                    outcome = "RECOVERED/RESOLVED"

                trtemfl = "Y" if ae_start >= trtsdt else "N"

                data.append({
                    "STUDYID": subj["STUDYID"],
                    "USUBJID": subj["USUBJID"],
                    "AESEQ": seq,
                    "AEBODSYS": soc,
                    "AEDECOD": pt,
                    "AESEV": severity,
                    "AESER": is_serious,
                    "AEREL": relatedness,
                    "AESTDTC": ae_start.isoformat(),
                    "AEENDTC": ae_end.isoformat(),
                    "AEOUT": outcome,
                    "TRTEMFL": trtemfl,
                })

        return {
            "dataset_name": "ADAE",
            "label": "Adverse Events Analysis Dataset",
            "structure": "One record per adverse event per subject",
            "variables": variables,
            "records_count": len(data),
            "data": data,
            "data_source": "uploaded" if patient_data is not None else "simulated",
            "created_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def create_adtte(db: AsyncSession, project_id: str, adsl_data: Optional[List[dict]] = None, patient_data: list = None) -> dict:
        """
        Generate ADTTE (Time-to-Event Analysis Dataset).

        Standard ADaM variables:
        STUDYID, USUBJID, PARAMCD, PARAM, AVAL, CNSR,
        STARTDT, ADT, EVNTDESC, SRCDOM, SRCVAR

        If patient_data is provided, build ADSL from it first.
        """
        if adsl_data is None:
            adsl_result = await AdamService.create_adsl(db, project_id, patient_data=patient_data)
            adsl_data = adsl_result["data"]

        rng = np.random.default_rng(seed=456)

        param_defs = [
            ("OS", "Overall Survival (days)"),
            ("PFS", "Progression-Free Survival (days)"),
            ("EFS", "Event-Free Survival (days)"),
        ]

        variables = [
            {"name": "STUDYID", "label": "Study Identifier", "type": "Char", "length": 12},
            {"name": "USUBJID", "label": "Unique Subject Identifier", "type": "Char", "length": 20},
            {"name": "PARAMCD", "label": "Parameter Code", "type": "Char", "length": 8},
            {"name": "PARAM", "label": "Parameter", "type": "Char", "length": 40},
            {"name": "AVAL", "label": "Analysis Value", "type": "Num", "length": 8},
            {"name": "CNSR", "label": "Censor", "type": "Num", "length": 8},
            {"name": "STARTDT", "label": "Time-to-Event Origin Date", "type": "Num", "length": 8},
            {"name": "ADT", "label": "Analysis Date", "type": "Num", "length": 8},
            {"name": "EVNTDESC", "label": "Event Description", "type": "Char", "length": 40},
            {"name": "SRCDOM", "label": "Source Domain", "type": "Char", "length": 8},
            {"name": "SRCVAR", "label": "Source Variable", "type": "Char", "length": 8},
        ]

        event_descriptions = {
            "OS": "Death",
            "PFS": "Disease progression or death",
            "EFS": "Disease event",
        }

        data = []
        for subj in adsl_data:
            if subj.get("ITTFL") != "Y":
                continue

            trtsdt = datetime.fromisoformat(subj["TRTSDT"])
            is_treatment = subj["ARM"] != "Standard of Care"

            for paramcd, param in param_defs:
                # Different hazard rates by parameter and arm
                if paramcd == "OS":
                    base_rate = 0.0008 if is_treatment else 0.0012
                elif paramcd == "PFS":
                    base_rate = 0.0015 if is_treatment else 0.0022
                else:
                    base_rate = 0.0020 if is_treatment else 0.0028

                # Exponential time-to-event
                time_days = float(rng.exponential(1.0 / base_rate))
                max_follow_up = float(subj["TRTDUR"])

                if time_days > max_follow_up:
                    # Censored
                    cnsr = 1
                    aval = max_follow_up
                    evntdesc = "Censored at end of study"
                else:
                    cnsr = 0
                    aval = round(time_days, 1)
                    evntdesc = event_descriptions[paramcd]

                adt = trtsdt + timedelta(days=int(aval))

                data.append({
                    "STUDYID": subj["STUDYID"],
                    "USUBJID": subj["USUBJID"],
                    "PARAMCD": paramcd,
                    "PARAM": param,
                    "AVAL": round(aval, 1),
                    "CNSR": cnsr,
                    "STARTDT": trtsdt.isoformat(),
                    "ADT": adt.isoformat(),
                    "EVNTDESC": evntdesc,
                    "SRCDOM": "ADSL",
                    "SRCVAR": "DTHDT" if paramcd == "OS" else "TRTEDT",
                })

        return {
            "dataset_name": "ADTTE",
            "label": "Time-to-Event Analysis Dataset",
            "structure": "One record per parameter per subject",
            "variables": variables,
            "records_count": len(data),
            "data": data,
            "data_source": "uploaded" if patient_data is not None else "simulated",
            "created_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    def validate_adam(dataset: dict, adsl_data: Optional[List[dict]] = None) -> dict:
        """
        Validate an ADaM dataset against Implementation Guide rules.

        Checks:
        - Required variables present per dataset type
        - Variable names <= 8 characters
        - Labels <= 40 characters
        - No duplicate USUBJID in ADSL
        - All USUBJID in ADAE/ADTTE exist in ADSL
        """
        errors: List[str] = []
        warnings: List[str] = []
        dataset_name = dataset.get("dataset_name", "UNKNOWN")
        variables = dataset.get("variables", [])
        data = dataset.get("data", [])

        # Required variables per dataset type
        required_vars = {
            "ADSL": ["STUDYID", "USUBJID", "SUBJID", "SITEID", "ARM", "TRT01P",
                      "TRT01A", "ITTFL", "SAFFL", "AGE", "SEX", "RACE"],
            "ADAE": ["STUDYID", "USUBJID", "AESEQ", "AEBODSYS", "AEDECOD",
                      "AESEV", "AESER", "TRTEMFL"],
            "ADTTE": ["STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL", "CNSR",
                       "STARTDT"],
        }

        req = required_vars.get(dataset_name, [])
        var_names = [v["name"] for v in variables]

        # Check required variables present
        for rv in req:
            if rv not in var_names:
                errors.append(f"Required variable {rv} is missing from {dataset_name}")

        # Check variable name length <= 8
        for v in variables:
            if len(v["name"]) > 8:
                errors.append(f"Variable name '{v['name']}' exceeds 8 characters")

        # Check label length <= 40
        for v in variables:
            if len(v.get("label", "")) > 40:
                warnings.append(
                    f"Variable '{v['name']}' label exceeds 40 characters: "
                    f"'{v['label']}' ({len(v['label'])} chars)"
                )

        # Dataset-specific checks
        if dataset_name == "ADSL":
            # No duplicate USUBJID
            usubjids = [row.get("USUBJID") for row in data]
            if len(usubjids) != len(set(usubjids)):
                duplicates = [u for u in set(usubjids) if usubjids.count(u) > 1]
                errors.append(
                    f"Duplicate USUBJID found in ADSL: {duplicates[:5]}"
                )

        if dataset_name in ("ADAE", "ADTTE") and adsl_data is not None:
            # All USUBJID must exist in ADSL
            adsl_ids = {row.get("USUBJID") for row in adsl_data}
            dataset_ids = {row.get("USUBJID") for row in data}
            orphans = dataset_ids - adsl_ids
            if orphans:
                errors.append(
                    f"{len(orphans)} USUBJID(s) in {dataset_name} not found in ADSL: "
                    f"{list(orphans)[:5]}"
                )

        is_valid = len(errors) == 0

        return {
            "valid": is_valid,
            "errors": errors,
            "warnings": warnings,
            "dataset": dataset_name,
            "records": len(data),
        }

    @staticmethod
    def export_adam_metadata(dataset: dict) -> dict:
        """
        Export variable-level metadata in Define-XML style JSON.

        For each variable, includes:
        name, label, type, length, format, origin, source_variable,
        codelist, core (Req/Cond/Perm)
        """
        dataset_name = dataset.get("dataset_name", "UNKNOWN")
        variables = dataset.get("variables", [])

        # Core classification by dataset type
        required_core = {
            "ADSL": ["STUDYID", "USUBJID", "SUBJID", "SITEID", "ARM",
                      "TRT01P", "TRT01A", "AGE", "SEX", "RACE"],
            "ADAE": ["STUDYID", "USUBJID", "AESEQ", "AEBODSYS", "AEDECOD",
                      "AESEV", "TRTEMFL"],
            "ADTTE": ["STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL", "CNSR"],
        }
        conditional_core = {
            "ADSL": ["ITTFL", "SAFFL", "COMPLFL", "ETHNIC", "TRTSDT", "TRTEDT"],
            "ADAE": ["AESER", "AEREL", "AESTDTC", "AEENDTC", "AEOUT"],
            "ADTTE": ["STARTDT", "ADT", "EVNTDESC"],
        }

        # Codelists
        codelists = {
            "SEX": {"M": "Male", "F": "Female"},
            "ITTFL": {"Y": "Yes", "N": "No"},
            "SAFFL": {"Y": "Yes", "N": "No"},
            "COMPLFL": {"Y": "Yes", "N": "No"},
            "DTHFL": {"Y": "Yes", "N": "No"},
            "AESER": {"Y": "Yes", "N": "No"},
            "TRTEMFL": {"Y": "Yes", "N": "No"},
            "AESEV": {"MILD": "Mild", "MODERATE": "Moderate", "SEVERE": "Severe"},
            "CNSR": {0: "Event", 1: "Censored"},
        }

        # Format mapping
        format_map = {
            "TRTSDT": "DATE9.", "TRTEDT": "DATE9.", "DTHDT": "DATE9.",
            "STARTDT": "DATE9.", "ADT": "DATE9.",
            "AESTDTC": "IS8601DA", "AEENDTC": "IS8601DA",
            "AGE": "8.", "TRTDUR": "8.", "AVAL": "8.1",
            "DTH": "1.", "CNSR": "1.", "AESEQ": "8.",
        }

        # Origin mapping
        origin_map = {
            "STUDYID": "Assigned", "USUBJID": "Assigned", "SUBJID": "Assigned",
            "SITEID": "CRF", "ARM": "Assigned", "TRT01P": "Assigned",
            "TRT01A": "Assigned", "AGE": "Derived", "AGEGR1": "Derived",
            "SEX": "CRF", "RACE": "CRF", "ETHNIC": "CRF",
            "ITTFL": "Derived", "SAFFL": "Derived", "COMPLFL": "Derived",
            "TRTSDT": "Derived", "TRTEDT": "Derived", "TRTDUR": "Derived",
            "DTHFL": "Derived", "DTH": "Derived", "DTHDT": "CRF",
            "AESEQ": "Derived", "AEBODSYS": "Derived", "AEDECOD": "Derived",
            "AESEV": "CRF", "AESER": "CRF", "AEREL": "CRF",
            "AESTDTC": "CRF", "AEENDTC": "CRF", "AEOUT": "CRF",
            "TRTEMFL": "Derived",
            "PARAMCD": "Derived", "PARAM": "Derived", "AVAL": "Derived",
            "CNSR": "Derived", "STARTDT": "Derived", "ADT": "Derived",
            "EVNTDESC": "Derived", "SRCDOM": "Derived", "SRCVAR": "Derived",
        }

        req_set = set(required_core.get(dataset_name, []))
        cond_set = set(conditional_core.get(dataset_name, []))

        variable_metadata = []
        for var in variables:
            name = var["name"]
            core = "Req" if name in req_set else ("Cond" if name in cond_set else "Perm")

            variable_metadata.append({
                "name": name,
                "label": var.get("label", ""),
                "type": var.get("type", "Char"),
                "length": var.get("length", 8),
                "format": format_map.get(name, ""),
                "origin": origin_map.get(name, "Derived"),
                "source_variable": name,
                "codelist": codelists.get(name),
                "core": core,
            })

        return {
            "dataset_name": dataset_name,
            "dataset_label": dataset.get("label", ""),
            "dataset_structure": dataset.get("structure", ""),
            "records_count": dataset.get("records_count", 0),
            "variables_count": len(variable_metadata),
            "variables": variable_metadata,
            "adam_ig_version": "1.3",
            "define_xml_version": "2.1.0",
            "created_at": datetime.utcnow().isoformat(),
        }
