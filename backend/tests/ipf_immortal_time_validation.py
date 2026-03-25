#!/usr/bin/env python3
"""
Senior Biostatistician Pre-Analysis Validation
Dataset: IPF cohort with treatment_start_month (time-dependent exposure)

Checks:
  1. Treatment variable validity (baseline vs time-varying)
  2. Temporal consistency
  3. Immortal time bias assessment
  4. Model validity determination
  5. Recommended approach
"""
import csv
import io
import sys
import numpy as np

DATA = """patient_id,time_to_event_months,event_observed,treatment_ever,treatment_start_month,age,sex,fvc_percent_predicted,smoking_status
IPF001,3.2,1,0,,74,M,49,former
IPF002,4.1,1,0,,71,F,54,never
IPF003,5.0,1,0,,76,M,47,current
IPF004,6.3,1,0,,69,M,56,former
IPF005,7.1,1,0,,73,F,52,former
IPF006,8.4,1,0,,75,M,50,current
IPF007,9.0,0,1,6.0,66,F,63,never
IPF008,10.2,0,1,5.5,64,M,67,former
IPF009,11.5,1,1,7.0,68,M,61,former
IPF010,12.1,0,1,4.0,62,F,72,never
IPF011,13.4,0,1,8.0,65,F,69,never
IPF012,14.6,1,1,9.5,67,M,60,former
IPF013,15.3,0,1,6.5,63,F,74,never
IPF014,16.1,0,1,7.5,61,M,76,former
IPF015,17.8,0,1,10.0,60,F,79,never
IPF016,18.2,1,1,11.0,66,M,64,former
IPF017,19.5,0,1,8.5,59,F,81,never
IPF018,20.4,0,1,12.0,58,F,83,never
IPF019,21.1,0,1,9.0,62,M,73,former
IPF020,22.0,0,1,13.0,57,F,85,never
IPF021,2.9,1,0,,77,M,45,current
IPF022,3.8,1,0,,72,F,53,former
IPF023,4.7,1,0,,75,M,48,current
IPF024,5.6,1,0,,70,F,55,former
IPF025,6.8,1,0,,73,M,51,current
IPF026,7.9,1,0,,74,M,49,former
IPF027,9.2,0,1,6.5,65,F,66,never
IPF028,10.8,0,1,7.2,63,M,70,former
IPF029,11.9,1,1,8.0,67,M,62,former
IPF030,12.7,0,1,5.0,61,F,75,never
IPF031,13.9,0,1,9.0,64,F,71,never
IPF032,15.1,1,1,10.5,68,M,63,former
IPF033,16.4,0,1,7.0,60,F,78,never
IPF034,17.2,0,1,8.0,59,M,80,former
IPF035,18.6,0,1,11.0,58,F,82,never
IPF036,19.3,1,1,12.0,66,M,65,former
IPF037,20.7,0,1,9.5,57,F,84,never
IPF038,21.6,0,1,13.5,56,F,86,never
IPF039,22.8,0,1,10.0,62,M,74,former
IPF040,23.5,0,1,14.0,55,F,88,never
IPF041,5.0,1,1,6.0,70,M,58,former
IPF042,8.0,0,1,9.5,64,F,66,never
IPF043,7.5,1,1,8.5,69,M,57,former
IPF044,6.2,1,1,7.0,72,F,54,former
IPF045,9.0,0,1,10.5,63,F,69,never
IPF046,4.8,1,0,,76,M,46,current
IPF047,3.6,1,0,,78,M,44,current
IPF048,11.0,0,1,6.0,65,F,72,never
IPF049,12.5,0,1,7.5,62,M,75,former
IPF050,13.2,1,1,9.0,67,M,61,former"""


def parse():
    reader = csv.DictReader(io.StringIO(DATA.strip()))
    rows = []
    for r in reader:
        rows.append({
            "id": r["patient_id"],
            "tte": float(r["time_to_event_months"]),
            "event": int(r["event_observed"]),
            "trt": int(r["treatment_ever"]),
            "trt_start": float(r["treatment_start_month"]) if r["treatment_start_month"] else None,
            "age": int(r["age"]),
            "sex": r["sex"],
            "fvc": float(r["fvc_percent_predicted"]),
            "smoking": r["smoking_status"],
        })
    return rows


def main():
    rows = parse()
    treated = [r for r in rows if r["trt"] == 1]
    untreated = [r for r in rows if r["trt"] == 0]

    print("=" * 72)
    print("PRE-ANALYSIS VALIDATION REPORT")
    print("Dataset: IPF Antifibrotic Cohort (N=50)")
    print("Prepared by: Afarensis Biostatistical Validation Engine")
    print("=" * 72)

    # ===================================================================
    # 1. DATA VALIDATION FINDINGS
    # ===================================================================
    print("\n1. DATA VALIDATION FINDINGS")
    print("-" * 72)

    print(f"   Total patients:       {len(rows)}")
    print(f"   Treated (ever):       {len(treated)}")
    print(f"   Untreated:            {len(untreated)}")
    print(f"   Events (deaths):      {sum(r['event'] for r in rows)}")
    print(f"   Censored:             {sum(1-r['event'] for r in rows)}")
    print()

    # Check for missing treatment_start in treated patients
    missing_start = [r for r in treated if r["trt_start"] is None]
    if missing_start:
        print(f"   [CRITICAL] {len(missing_start)} treated patients have no treatment_start_month:")
        for r in missing_start:
            print(f"              {r['id']}")
    else:
        print("   [OK] All treated patients have treatment_start_month recorded.")

    # Check untreated patients have no start month
    untrt_with_start = [r for r in untreated if r["trt_start"] is not None]
    if untrt_with_start:
        print(f"   [WARN] {len(untrt_with_start)} untreated patients have treatment_start_month values")
    else:
        print("   [OK] No untreated patients have treatment_start_month (consistent).")

    # Check for negative or zero times
    bad_times = [r for r in rows if r["tte"] <= 0]
    if bad_times:
        print(f"   [CRITICAL] {len(bad_times)} patients with time_to_event <= 0")
    else:
        print("   [OK] All time_to_event values are positive.")

    print()

    # ===================================================================
    # 2. TEMPORAL CONSISTENCY ASSESSMENT
    # ===================================================================
    print("\n2. TEMPORAL CONSISTENCY ASSESSMENT")
    print("-" * 72)

    # Key check: is treatment_start BEFORE time_to_event for all treated?
    trt_after_event = []
    trt_after_censor = []
    trt_at_baseline = []

    for r in treated:
        if r["trt_start"] is None:
            continue
        if r["trt_start"] > r["tte"]:
            if r["event"] == 1:
                trt_after_event.append(r)
            else:
                trt_after_censor.append(r)
        if r["trt_start"] == 0:
            trt_at_baseline.append(r)

    print(f"   Treatment initiation timing (treated patients, N={len(treated)}):")
    print()

    # Distribution of treatment start times
    start_times = [r["trt_start"] for r in treated if r["trt_start"] is not None]
    print(f"   Treatment start month distribution:")
    print(f"     Min:    {min(start_times):.1f}")
    print(f"     Median: {np.median(start_times):.1f}")
    print(f"     Max:    {max(start_times):.1f}")
    print(f"     Mean:   {np.mean(start_times):.1f}")
    print()

    # CRITICAL: treatment after event (impossible)
    if trt_after_event:
        print(f"   [CRITICAL] {len(trt_after_event)} patients have treatment_start AFTER death:")
        for r in trt_after_event:
            print(f"     {r['id']}: died at month {r['tte']:.1f}, treatment started month {r['trt_start']:.1f}")
        print("   --> These rows represent impossible timelines.")
        print("   --> Treatment cannot be initiated after the patient has died.")
        print("   --> This is a data quality error that MUST be resolved before analysis.")
    else:
        print("   [OK] No patients have treatment_start after death.")

    # Treatment after censoring
    if trt_after_censor:
        print(f"\n   [CRITICAL] {len(trt_after_censor)} patients have treatment_start AFTER censoring:")
        for r in trt_after_censor:
            print(f"     {r['id']}: censored at month {r['tte']:.1f}, treatment started month {r['trt_start']:.1f}")
        print("   --> If censored = lost to follow-up, treatment after this point is unobservable.")
        print("   --> These patients should be classified as UNTREATED up to censoring.")
    else:
        print("   [OK] No patients have treatment_start after censoring.")

    # Treatment at baseline (month 0)?
    if trt_at_baseline:
        print(f"\n   [INFO] {len(trt_at_baseline)} patients initiated treatment at baseline (month 0).")
    else:
        print(f"\n   [FINDING] NO patients initiated treatment at baseline (month 0).")
        print(f"   --> ALL treated patients have treatment_start > 0.")
        print(f"   --> Treatment is NOT a baseline covariate. It is time-dependent.")

    print()

    # ===================================================================
    # 3. IMMORTAL TIME BIAS ASSESSMENT
    # ===================================================================
    print("\n3. IMMORTAL TIME BIAS ASSESSMENT")
    print("-" * 72)

    # Calculate immortal time per treated patient
    immortal_times = []
    for r in treated:
        if r["trt_start"] is not None and r["trt_start"] > 0:
            immortal_times.append(r["trt_start"])

    if immortal_times:
        total_immortal = sum(immortal_times)
        mean_immortal = np.mean(immortal_times)
        pct_with_immortal = len(immortal_times) / len(treated) * 100

        print(f"   IMMORTAL TIME BIAS IS PRESENT IN THIS DATASET.")
        print()
        print(f"   Definition: Immortal time is the period between cohort entry (month 0)")
        print(f"   and treatment initiation, during which a treated patient CANNOT die")
        print(f"   (because they must survive long enough to receive treatment).")
        print()
        print(f"   Affected patients:     {len(immortal_times)}/{len(treated)} ({pct_with_immortal:.0f}%)")
        print(f"   Total immortal time:   {total_immortal:.1f} person-months")
        print(f"   Mean immortal time:    {mean_immortal:.1f} months per treated patient")
        print(f"   Range:                 {min(immortal_times):.1f} - {max(immortal_times):.1f} months")
        print()
        print(f"   Mechanism of bias:")
        print(f"   - If treatment_ever is used as a BASELINE covariate in Cox PH,")
        print(f"     the immortal person-time (pre-treatment) is MISCLASSIFIED as")
        print(f"     'treated' time, during which no events can occur by definition.")
        print(f"   - This artificially lowers the event rate in the treated group.")
        print(f"   - Result: a SPURIOUS protective effect (HR biased toward < 1).")
        print()
        print(f"   Expected bias direction: HR will be ARTIFACTUALLY LOW (protective)")
        print(f"   even if treatment has NO effect or is HARMFUL.")
    else:
        print("   [OK] No immortal time bias detected.")

    # Additional: show the impossible rows (treatment after event/censor)
    impossible = trt_after_event + trt_after_censor
    if impossible:
        print(f"\n   IMPOSSIBLE TIMELINE ROWS (treatment_start > time_to_event):")
        print(f"   {'ID':<10} {'Event/Censor':<15} {'TTE':<8} {'Trt Start':<10} {'Issue'}")
        print(f"   {'-'*10} {'-'*15} {'-'*8} {'-'*10} {'-'*30}")
        for r in impossible:
            ec = "DEATH" if r["event"] == 1 else "CENSORED"
            issue = "Treatment after death" if r["event"] == 1 else "Treatment after censoring"
            print(f"   {r['id']:<10} {ec:<15} {r['tte']:<8.1f} {r['trt_start']:<10.1f} {issue}")

    print()

    # ===================================================================
    # 4. MODEL VALIDITY DETERMINATION
    # ===================================================================
    print("\n4. MODEL VALIDITY DETERMINATION")
    print("-" * 72)

    naive_valid = True
    reasons = []

    # Check 1: Is treatment time-dependent?
    all_start_after_zero = all(r["trt_start"] > 0 for r in treated if r["trt_start"] is not None)
    if all_start_after_zero:
        naive_valid = False
        reasons.append("Treatment is initiated AFTER cohort entry for ALL treated patients (time-dependent exposure)")

    # Check 2: Are there impossible rows?
    if impossible:
        naive_valid = False
        reasons.append(f"{len(impossible)} rows have treatment_start > time_to_event (impossible timelines)")

    # Check 3: Immortal time present?
    if immortal_times:
        naive_valid = False
        reasons.append(f"Immortal time bias: {total_immortal:.1f} person-months of misclassified time")

    if naive_valid:
        print("   STANDARD COX PH WITH BASELINE TREATMENT: VALID")
    else:
        print("   STANDARD COX PH WITH BASELINE TREATMENT: ** INVALID **")
        print()
        print("   Reasons:")
        for i, reason in enumerate(reasons, 1):
            print(f"   {i}. {reason}")
        print()
        print("   A naive Cox PH model using treatment_ever as a baseline covariate")
        print("   would produce BIASED hazard ratio estimates. The bias direction is")
        print("   toward an artifactually PROTECTIVE effect (HR < 1) regardless of")
        print("   the true treatment effect.")
        print()
        print("   This analysis CANNOT support causal interpretation of the")
        print("   treatment effect under the current analytical framework.")

    print()

    # ===================================================================
    # 5. RECOMMENDED ANALYSIS APPROACH
    # ===================================================================
    print("\n5. RECOMMENDED ANALYSIS APPROACH")
    print("-" * 72)

    print("   Given the findings above, the following approaches are recommended:")
    print()
    print("   A. TIME-DEPENDENT COX MODEL (Preferred)")
    print("      - Model treatment as a time-varying covariate")
    print("      - Each treated patient contributes UNTREATED person-time from")
    print(f"        month 0 to treatment_start, and TREATED person-time from")
    print(f"        treatment_start to event/censoring")
    print("      - Requires splitting each treated patient's record into two rows:")
    print("        (0, treatment_start, untreated) and (treatment_start, TTE, treated)")
    print("      - Eliminates immortal time bias by correct time classification")
    print()
    print("   B. LANDMARK ANALYSIS (Alternative)")
    print("      - Choose a fixed landmark time L (e.g., L = 6 months)")
    print("      - Exclude all patients who experienced event before L")
    print("      - Classify treatment based on status AT the landmark time")
    print("      - Analyze survival from L onward")
    print("      - Advantages: simple, avoids time-dependent modeling")
    print("      - Disadvantages: loses patients, choice of L is arbitrary")
    print()
    print("   C. DATA CORRECTIONS REQUIRED BEFORE ANY ANALYSIS:")
    if impossible:
        print(f"      - Resolve {len(impossible)} impossible timeline rows")
        print(f"        (treatment_start > time_to_event)")
        print(f"        Options: reclassify as untreated, correct data entry error,")
        print(f"        or exclude with documented justification")

    print()

    # ===================================================================
    # 6. FINAL CONCLUSION
    # ===================================================================
    print("\n6. FINAL CONCLUSION")
    print("-" * 72)

    if not naive_valid:
        print("   CAUSAL INTERPRETATION STATUS: ** INVALID **")
        print("   (under naive baseline treatment analysis)")
        print()
        print("   CONDITIONALLY VALID if:")
        print("   - Time-dependent Cox model is used (addresses immortal time bias)")
        if impossible:
            print(f"   - {len(impossible)} impossible timeline rows are resolved")
        print("   - Propensity score methods account for time-dependent confounding")
        print("   - Sensitivity analysis for unmeasured confounding is conducted")
        print()
        print("   NO TREATMENT EFFECT ESTIMATE IS PRODUCED.")
        print("   The dataset fails pre-analysis validation checks.")
        print("   Running a naive Cox PH model would yield misleading results.")
    else:
        print("   CAUSAL INTERPRETATION STATUS: CONDITIONALLY VALID")
        print("   Standard Cox PH model may be appropriate.")

    print()
    print("=" * 72)
    print("END OF VALIDATION REPORT")
    print("=" * 72)


if __name__ == "__main__":
    main()
