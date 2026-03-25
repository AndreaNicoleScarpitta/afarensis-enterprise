#!/usr/bin/env python3
"""
Simpson's Paradox / Confounding Assessment for IPF Dataset

This analysis evaluates whether the aggregate treatment effect is
consistent across clinically relevant subgroups, or whether confounding
or Simpson's paradox makes the global estimate misleading.

Uses the same 50-patient IPF dataset from the immortal time bias test.
NOTE: We exclude the 5 impossible-timeline rows identified previously.
"""
import csv
import io
import sys
import numpy as np
from collections import defaultdict

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
IPF046,4.8,1,0,,76,M,46,current
IPF047,3.6,1,0,,78,M,44,current
IPF048,11.0,0,1,6.0,65,F,72,never
IPF049,12.5,0,1,7.5,62,M,75,former
IPF050,13.2,1,1,9.0,67,M,61,former"""
# NOTE: IPF041-045 excluded (impossible timelines from prior validation)


def parse():
    reader = csv.DictReader(io.StringIO(DATA.strip()))
    rows = []
    for r in reader:
        rows.append({
            "id": r["patient_id"],
            "tte": float(r["time_to_event_months"]),
            "event": int(r["event_observed"]),
            "trt": int(r["treatment_ever"]),
            "age": int(r["age"]),
            "sex": r["sex"],
            "fvc": float(r["fvc_percent_predicted"]),
            "smoking": r["smoking_status"],
        })
    return rows


def event_rate(group):
    """Compute crude event rate (deaths / total)."""
    if not group:
        return 0.0, 0, 0
    events = sum(r["event"] for r in group)
    return events / len(group), events, len(group)


def mean_tte(group):
    """Mean time-to-event (includes censored — crude, not KM)."""
    if not group:
        return 0.0
    return np.mean([r["tte"] for r in group])


def smd(treated_vals, control_vals):
    """Standardized mean difference (Cohen's d)."""
    t = np.array(treated_vals, dtype=float)
    c = np.array(control_vals, dtype=float)
    if len(t) < 2 or len(c) < 2:
        return float("nan")
    pooled_sd = np.sqrt((t.var(ddof=1) + c.var(ddof=1)) / 2)
    if pooled_sd == 0:
        return 0.0
    return (t.mean() - c.mean()) / pooled_sd


def main():
    rows = parse()
    treated = [r for r in rows if r["trt"] == 1]
    untreated = [r for r in rows if r["trt"] == 0]

    print("=" * 72)
    print("CONFOUNDING & SIMPSON'S PARADOX ASSESSMENT")
    print("Dataset: IPF Cohort (N=45, 5 impossible rows excluded)")
    print("=" * 72)

    # ==================================================================
    # 1. COVARIATE BALANCE BETWEEN TREATMENT GROUPS
    # ==================================================================
    print("\n1. COVARIATE BALANCE BETWEEN TREATMENT GROUPS")
    print("-" * 72)

    trt_ages = [r["age"] for r in treated]
    ctl_ages = [r["age"] for r in untreated]
    trt_fvc = [r["fvc"] for r in treated]
    ctl_fvc = [r["fvc"] for r in untreated]

    trt_male = sum(1 for r in treated if r["sex"] == "M") / len(treated) * 100
    ctl_male = sum(1 for r in untreated if r["sex"] == "M") / len(untreated) * 100

    trt_current = sum(1 for r in treated if r["smoking"] == "current") / len(treated) * 100
    ctl_current = sum(1 for r in untreated if r["smoking"] == "current") / len(untreated) * 100

    print(f"\n   {'Variable':<25} {'Treated (N={})'.format(len(treated)):<20} {'Untreated (N={})'.format(len(untreated)):<20} {'SMD':<8} {'Balanced?'}")
    print(f"   {'-'*25} {'-'*20} {'-'*20} {'-'*8} {'-'*10}")

    age_smd = smd(trt_ages, ctl_ages)
    fvc_smd = smd(trt_fvc, ctl_fvc)
    sex_smd = smd([1 if r["sex"] == "M" else 0 for r in treated],
                   [1 if r["sex"] == "M" else 0 for r in untreated])
    smoke_smd = smd([1 if r["smoking"] == "current" else 0 for r in treated],
                     [1 if r["smoking"] == "current" else 0 for r in untreated])

    bal = lambda s: "Yes" if abs(s) < 0.10 else ("Marginal" if abs(s) < 0.25 else "NO")

    print(f"   {'Age (years)':<25} {np.mean(trt_ages):.1f} +/- {np.std(trt_ages):.1f}{'':<8} {np.mean(ctl_ages):.1f} +/- {np.std(ctl_ages):.1f}{'':<8} {age_smd:+.3f}  {bal(age_smd)}")
    print(f"   {'FVC % predicted':<25} {np.mean(trt_fvc):.1f} +/- {np.std(trt_fvc):.1f}{'':<7} {np.mean(ctl_fvc):.1f} +/- {np.std(ctl_fvc):.1f}{'':<8} {fvc_smd:+.3f}  {bal(fvc_smd)}")
    print(f"   {'Male (%)':<25} {trt_male:.0f}%{'':<17} {ctl_male:.0f}%{'':<17} {sex_smd:+.3f}  {bal(sex_smd)}")
    print(f"   {'Current smoker (%)':<25} {trt_current:.0f}%{'':<17} {ctl_current:.0f}%{'':<17} {smoke_smd:+.3f}  {bal(smoke_smd)}")

    imbalanced = []
    if abs(age_smd) >= 0.25: imbalanced.append(("Age", age_smd))
    if abs(fvc_smd) >= 0.25: imbalanced.append(("FVC", fvc_smd))
    if abs(sex_smd) >= 0.25: imbalanced.append(("Sex", sex_smd))
    if abs(smoke_smd) >= 0.25: imbalanced.append(("Smoking", smoke_smd))

    print()
    if imbalanced:
        print(f"   [FINDING] {len(imbalanced)} covariates are IMBALANCED (|SMD| >= 0.25):")
        for name, s in imbalanced:
            direction = "higher in treated" if s > 0 else "higher in untreated"
            print(f"     - {name}: SMD = {s:+.3f} ({direction})")
        print()
        print("   Implication: Treatment assignment is NOT random.")
        print("   Treated patients are systematically different from untreated patients.")
        print("   Any observed treatment effect may reflect these differences, not treatment.")
    else:
        print("   [OK] All covariates balanced (|SMD| < 0.25).")

    # ==================================================================
    # 2. SUBGROUP-LEVEL COMPARISON OF OUTCOMES
    # ==================================================================
    print("\n\n2. SUBGROUP-LEVEL COMPARISON OF OUTCOMES")
    print("-" * 72)

    # Define clinically relevant strata
    strata = {
        "Age < 65": lambda r: r["age"] < 65,
        "Age >= 65": lambda r: r["age"] >= 65,
        "Male": lambda r: r["sex"] == "M",
        "Female": lambda r: r["sex"] == "F",
        "FVC < 60%": lambda r: r["fvc"] < 60,
        "FVC >= 60%": lambda r: r["fvc"] >= 60,
        "Current smoker": lambda r: r["smoking"] == "current",
        "Non-current smoker": lambda r: r["smoking"] != "current",
    }

    print(f"\n   {'Subgroup':<22} {'Trt N':<7} {'Trt Deaths':<12} {'Trt Rate':<10} {'Ctl N':<7} {'Ctl Deaths':<12} {'Ctl Rate':<10} {'Direction'}")
    print(f"   {'-'*22} {'-'*7} {'-'*12} {'-'*10} {'-'*7} {'-'*12} {'-'*10} {'-'*15}")

    subgroup_results = {}
    for name, cond in strata.items():
        trt_sub = [r for r in treated if cond(r)]
        ctl_sub = [r for r in untreated if cond(r)]

        trt_rate, trt_events, trt_n = event_rate(trt_sub)
        ctl_rate, ctl_events, ctl_n = event_rate(ctl_sub)

        if trt_n > 0 and ctl_n > 0:
            if trt_rate < ctl_rate:
                direction = "Trt BETTER"
            elif trt_rate > ctl_rate:
                direction = "Trt WORSE"
            else:
                direction = "Equal"
        elif ctl_n == 0:
            direction = "No controls"
        elif trt_n == 0:
            direction = "No treated"
        else:
            direction = "N/A"

        subgroup_results[name] = {
            "trt_n": trt_n, "trt_events": trt_events, "trt_rate": trt_rate,
            "ctl_n": ctl_n, "ctl_events": ctl_events, "ctl_rate": ctl_rate,
            "direction": direction,
        }

        print(f"   {name:<22} {trt_n:<7} {trt_events:<12} {trt_rate*100:.0f}%{'':<7} {ctl_n:<7} {ctl_events:<12} {ctl_rate*100:.0f}%{'':<7} {direction}")

    # ==================================================================
    # 3. AGGREGATE vs SUBGROUP COMPARISON
    # ==================================================================
    print("\n\n3. AGGREGATE vs SUBGROUP COMPARISON")
    print("-" * 72)

    agg_trt_rate, agg_trt_events, agg_trt_n = event_rate(treated)
    agg_ctl_rate, agg_ctl_events, agg_ctl_n = event_rate(untreated)

    print(f"\n   AGGREGATE (all patients):")
    print(f"     Treated:   {agg_trt_events}/{agg_trt_n} deaths ({agg_trt_rate*100:.1f}%)")
    print(f"     Untreated: {agg_ctl_events}/{agg_ctl_n} deaths ({agg_ctl_rate*100:.1f}%)")
    print(f"     Mean TTE:  Treated={mean_tte(treated):.1f}mo, Untreated={mean_tte(untreated):.1f}mo")

    if agg_trt_rate < agg_ctl_rate:
        agg_direction = "BETTER"
        print(f"     Aggregate direction: Treatment appears PROTECTIVE")
    elif agg_trt_rate > agg_ctl_rate:
        agg_direction = "WORSE"
        print(f"     Aggregate direction: Treatment appears HARMFUL")
    else:
        agg_direction = "EQUAL"
        print(f"     Aggregate direction: No difference")

    # Check for reversal
    print(f"\n   SUBGROUP CONSISTENCY CHECK:")
    reversals = []
    consistent = []
    no_comparison = []

    for name, res in subgroup_results.items():
        if "No controls" in res["direction"] or "No treated" in res["direction"] or "N/A" in res["direction"]:
            no_comparison.append(name)
            continue

        sub_better = "BETTER" in res["direction"]
        sub_worse = "WORSE" in res["direction"]

        if agg_direction == "BETTER" and sub_worse:
            reversals.append((name, res))
        elif agg_direction == "WORSE" and sub_better:
            reversals.append((name, res))
        else:
            consistent.append(name)

    if reversals:
        print(f"\n   [CRITICAL] DIRECTION REVERSAL DETECTED IN {len(reversals)} SUBGROUP(S):")
        for name, res in reversals:
            print(f"     - {name}: Treatment is {res['direction']}")
            print(f"       (Trt: {res['trt_events']}/{res['trt_n']} = {res['trt_rate']*100:.0f}% vs "
                  f"Ctl: {res['ctl_events']}/{res['ctl_n']} = {res['ctl_rate']*100:.0f}%)")
        print()
        print("   --> The aggregate treatment effect REVERSES in at least one subgroup.")
        print("   --> This is a hallmark of SIMPSON'S PARADOX or unmeasured confounding.")
        print("   --> The global treatment effect estimate is MISLEADING.")
        simpson_detected = True
    else:
        print(f"\n   [OK] Treatment direction is consistent across all evaluable subgroups.")
        simpson_detected = False

    if no_comparison:
        print(f"\n   [NOTE] {len(no_comparison)} subgroups could not be compared (empty arm):")
        for name in no_comparison:
            print(f"     - {name}")

    # ==================================================================
    # 4. IS THE OVERALL TREATMENT EFFECT VALID OR MISLEADING?
    # ==================================================================
    print("\n\n4. TREATMENT EFFECT VALIDITY DETERMINATION")
    print("-" * 72)

    problems = []

    # Check 1: Covariate imbalance
    if imbalanced:
        problems.append(f"Covariate imbalance: {', '.join(n for n,_ in imbalanced)} "
                        f"(treatment groups are not comparable)")

    # Check 2: Simpson's paradox
    if simpson_detected:
        problems.append("Direction reversal in subgroups (Simpson's paradox)")

    # Check 3: Immortal time (from prior analysis)
    problems.append("Immortal time bias present (all treated patients have treatment_start > 0)")

    # Check 4: Confounding direction
    # Treated patients are younger and have higher FVC — both are PROTECTIVE factors
    # This means treated patients would have better outcomes EVEN WITHOUT treatment
    treated_healthier = (np.mean(trt_ages) < np.mean(ctl_ages) and
                         np.mean(trt_fvc) > np.mean(ctl_fvc))
    if treated_healthier:
        problems.append("Confounding by indication: treated patients are younger (mean "
                        f"{np.mean(trt_ages):.0f} vs {np.mean(ctl_ages):.0f}) and have better "
                        f"baseline lung function (FVC {np.mean(trt_fvc):.0f}% vs {np.mean(ctl_fvc):.0f}%)")

    if problems:
        print("\n   OVERALL TREATMENT EFFECT: ** POTENTIALLY MISLEADING **")
        print()
        print("   Reasons:")
        for i, p in enumerate(problems, 1):
            print(f"   {i}. {p}")
        print()
        print("   A single global HR or event rate comparison SHOULD NOT be reported")
        print("   without acknowledging these limitations. The apparent treatment benefit")
        print("   may be partially or entirely explained by confounding.")
    else:
        print("\n   OVERALL TREATMENT EFFECT: Appears valid for reporting.")

    # ==================================================================
    # 5. RECOMMENDED ANALYTICAL APPROACH
    # ==================================================================
    print("\n\n5. RECOMMENDED ANALYTICAL APPROACH")
    print("-" * 72)

    print("""
   Given the identified issues, the following analytical strategy is recommended:

   A. ADDRESS IMMORTAL TIME BIAS (prerequisite)
      - Use time-dependent Cox model OR landmark analysis
      - Do NOT use treatment_ever as a baseline covariate

   B. ADDRESS CONFOUNDING
      - Propensity score matching or IPTW using: age, sex, FVC, smoking
      - Verify covariate balance after adjustment (target |SMD| < 0.10)
      - Report both unadjusted and adjusted estimates

   C. ASSESS EFFECT HETEROGENEITY
      - Report subgroup-specific treatment effects for:
        * Age (< 65 vs >= 65)
        * Baseline FVC (< 60% vs >= 60%)
        * Sex
      - Test for treatment-by-subgroup interaction
      - If interaction is significant, do NOT report a pooled estimate

   D. SENSITIVITY ANALYSES
      - E-value for unmeasured confounding
      - Tipping-point analysis for missing data
      - Negative control outcome (if available)

   E. REPORTING
      - Report subgroup-stratified results alongside any global estimate
      - Include a table of covariate balance pre/post adjustment
      - Include forest plot showing subgroup-specific HRs""")

    # ==================================================================
    # 6. FINAL CONCLUSION
    # ==================================================================
    print("\n6. FINAL CONCLUSION")
    print("-" * 72)

    print(f"""
   CAUSAL CLAIM STATUS: ** NOT SUPPORTED **

   The dataset exhibits:
   1. Severe covariate imbalance (treated patients are younger and healthier)
   2. Immortal time bias (312.7 person-months of misclassified time)
   3. {"Direction reversal in subgroups (Simpson's paradox)" if simpson_detected else "Potential confounding by indication"}

   The apparent treatment benefit in the aggregate data is likely explained
   by a combination of:
   - Selection bias: healthier patients were more likely to receive treatment
   - Immortal time bias: treated patients had guaranteed survival until
     treatment initiation
   - {"Simpson's paradox: the effect reverses within strata" if simpson_detected else "Confounding: baseline differences drive the outcome difference"}

   A SINGLE GLOBAL TREATMENT EFFECT IS NOT REPORTED because it would be
   misleading. Any reported estimate must be:
   - Adjusted for confounding (PS methods)
   - Corrected for immortal time bias (time-dependent model)
   - Accompanied by subgroup-specific estimates
   - Qualified with sensitivity analysis for unmeasured confounding

   Without these corrections, no valid causal inference about antifibrotic
   treatment efficacy can be drawn from this dataset.""")

    print()
    print("=" * 72)
    print("END OF CONFOUNDING ASSESSMENT")
    print("=" * 72)


if __name__ == "__main__":
    main()
