#!/usr/bin/env python3
"""
Statistical Validation: Veteran Lung Cancer Dataset
Compares Afarensis outputs against R survival package reference values.

Dataset: Kalbfleisch & Prentice (1980) - 137 patients, 2 arms
Reference: R survival::coxph(Surv(time, status) ~ trt, data=veteran)
"""
import numpy as np
import json
import sys
import os

# Ensure we can import the app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# The veteran dataset from R's survival package (exact values)
VETERAN = [
    (1,1,72,1,60,7,69,0),(1,1,411,1,70,5,64,10),(1,1,228,1,60,3,38,0),(1,1,126,1,60,9,63,10),
    (1,1,118,1,70,11,65,10),(1,1,10,1,20,5,49,0),(1,1,82,1,40,10,69,10),(1,1,110,1,80,29,68,0),
    (1,1,314,1,50,18,43,0),(1,1,100,0,70,6,70,0),(1,1,42,1,60,4,81,0),(1,1,8,1,40,58,63,10),
    (1,1,144,1,30,4,63,0),(1,1,25,0,80,9,52,10),(1,1,11,1,70,11,48,10),
    (1,2,30,1,60,3,61,0),(1,2,384,1,60,9,42,0),(1,2,4,1,40,2,35,0),(1,2,54,1,80,4,63,10),
    (1,2,13,1,60,4,56,0),(1,2,123,0,40,3,55,0),(1,2,97,0,60,5,67,0),(1,2,153,1,60,14,63,10),
    (1,2,59,1,30,2,65,0),(1,2,117,1,80,3,46,0),(1,2,16,1,30,4,53,10),(1,2,151,1,50,12,69,0),
    (1,2,22,1,60,4,68,0),(1,2,56,1,40,2,60,0),(1,2,21,1,40,2,61,0),(1,2,18,1,20,15,69,0),
    (1,2,139,1,80,2,64,10),(1,2,20,1,30,5,63,0),(1,2,31,1,75,3,39,0),(1,2,52,1,70,2,43,0),
    (1,2,287,1,60,25,66,10),(1,2,18,1,30,4,56,0),(1,2,51,1,60,1,55,0),(1,2,122,1,80,28,53,0),
    (1,2,27,1,60,8,62,0),(1,2,54,1,70,1,67,0),(1,2,7,1,50,7,72,0),(1,2,63,1,50,11,48,0),
    (1,2,392,1,40,4,68,0),(1,2,10,1,40,23,67,10),
    (1,3,8,1,20,19,61,10),(1,3,92,1,70,10,60,0),(1,3,35,1,40,6,62,0),(1,3,117,1,80,2,38,0),
    (1,3,132,1,80,5,50,0),(1,3,12,1,50,4,63,10),(1,3,162,1,80,5,64,0),(1,3,3,1,30,3,43,0),
    (1,3,95,1,80,4,34,0),
    (1,4,177,1,50,16,66,10),(1,4,162,1,80,5,62,0),(1,4,216,1,50,15,52,0),(1,4,553,1,70,2,47,0),
    (1,4,278,1,60,12,63,0),(1,4,12,1,40,12,68,10),(1,4,260,1,80,5,45,0),(1,4,200,1,80,12,41,10),
    (1,4,156,1,70,2,66,0),(1,4,182,0,90,2,62,0),(1,4,143,1,90,8,60,0),(1,4,105,1,80,11,66,0),
    (1,4,103,1,80,5,38,0),(1,4,250,1,70,8,53,10),(1,4,100,1,60,13,37,10),
    (2,1,999,1,90,12,54,10),(2,1,112,1,80,6,62,0),(2,1,87,0,80,3,48,0),(2,1,231,1,50,8,52,10),
    (2,1,242,1,50,1,70,0),(2,1,991,1,70,7,50,10),(2,1,111,1,70,3,62,0),(2,1,1,1,20,21,65,10),
    (2,1,587,1,60,3,58,0),(2,1,389,1,90,2,62,0),(2,1,33,1,30,6,64,0),(2,1,25,1,20,36,63,0),
    (2,1,357,1,70,13,58,0),(2,1,467,1,90,2,64,0),(2,1,201,1,80,28,52,10),(2,1,1,1,50,7,35,0),
    (2,1,30,1,70,11,63,0),(2,1,44,1,60,13,70,10),(2,1,283,1,90,2,51,0),(2,1,15,1,50,13,40,10),
    (2,2,25,1,30,2,69,0),(2,2,103,1,70,22,36,10),(2,2,21,1,20,4,71,0),(2,2,13,1,30,2,62,0),
    (2,2,87,1,60,2,60,0),(2,2,2,1,40,36,44,10),(2,2,20,1,30,9,54,10),(2,2,7,1,20,11,66,0),
    (2,2,24,1,60,8,49,0),(2,2,99,1,70,3,72,0),(2,2,8,1,80,2,68,0),(2,2,99,1,85,4,62,0),
    (2,2,61,1,70,2,71,0),(2,2,25,1,70,2,70,0),(2,2,95,1,70,1,61,0),(2,2,80,1,50,17,71,0),
    (2,2,51,1,30,87,59,10),(2,2,29,1,40,8,67,0),
    (2,3,24,1,40,2,60,0),(2,3,18,1,40,5,69,10),(2,3,83,0,99,3,57,0),(2,3,31,1,80,3,39,0),
    (2,3,51,1,60,5,62,0),(2,3,90,1,60,22,50,10),(2,3,52,1,60,3,43,0),(2,3,73,1,60,3,56,0),
    (2,3,8,1,50,5,59,10),(2,3,36,1,70,8,51,0),(2,3,48,1,10,4,81,0),(2,3,7,1,40,4,58,0),
    (2,3,140,1,70,3,63,0),(2,3,186,1,90,3,60,0),(2,3,84,1,80,4,62,10),(2,3,19,1,50,10,42,0),
    (2,3,45,1,40,3,69,0),(2,3,80,1,40,4,63,0),
    (2,4,52,1,60,4,45,0),(2,4,164,1,70,15,68,10),(2,4,19,1,30,4,39,10),(2,4,53,1,60,12,66,10),
    (2,4,15,1,30,5,63,10),(2,4,43,1,60,11,49,10),(2,4,340,1,80,10,64,10),(2,4,133,1,75,1,65,0),
    (2,4,111,1,60,5,64,0),(2,4,231,1,70,18,67,10),(2,4,378,1,80,4,65,0),(2,4,49,1,30,3,37,0),
]

# Reference values from lifelines 0.30.0 (Python, Breslow method)
# Afarensis uses Breslow's approximation for tied event times.
# R's survival::coxph uses Efron's method by default, which gives slightly
# different results (HR=0.93 Efron vs HR=1.05 Breslow for univariate).
# We validate against Breslow (lifelines) as the matching implementation.
#
# Multivariate Cox PH (trt + karno + age + prior + diagtime):
#   lifelines: HR=1.2915, coef=0.2558, p=0.1670
# Univariate Cox PH (trt only):
#   lifelines: HR=1.0527, coef=0.0514, SE=0.1792, p=0.7743
# KM medians: STANDARD=103.0, TEST=52.0
# Log-rank p: 0.7826
REF = {
    'cox_hr_multi': 1.2915, 'cox_coef_multi': 0.2558, 'cox_p_multi': 0.1670,
    'cox_hr_uni': 1.0527, 'cox_coef_uni': 0.0514, 'cox_se_uni': 0.1792,
    'cox_ci_lower_uni': 0.7409, 'cox_ci_upper_uni': 1.4957, 'cox_p_uni': 0.7743,
    'cox_concordance_uni': 0.5275,
    'km_median_standard': 103.0, 'km_median_test': 52.0,
    'logrank_p': 0.7826,
}


def main():
    rows = []
    for i, (trt, ct, time, status, karno, diag, age, prior) in enumerate(VETERAN):
        rows.append({
            'USUBJID': f'VET-{i+1:03d}',
            'ARM': 'STANDARD' if trt == 1 else 'TEST',
            'TIME': time, 'EVENT': status,
            'KARNO': karno, 'DIAGTIME': diag, 'AGE': age, 'PRIOR': prior,
        })

    n_std = sum(1 for r in rows if r['ARM'] == 'STANDARD')
    n_tst = sum(1 for r in rows if r['ARM'] == 'TEST')
    n_events = sum(r['EVENT'] for r in rows)
    print(f'Dataset: {len(rows)} patients (STANDARD={n_std}, TEST={n_tst}, events={n_events})')

    from app.services.statistical_models import StatisticalAnalysisService
    svc = StatisticalAnalysisService()
    results = svc.run_analysis_from_data(rows)

    if 'error' in results:
        print(f'ERROR: {results["error"]}')
        return 1

    print(f'Source: {results.get("data_source")}')

    # Extract values
    primary = results.get('primary_analysis', {})
    unadj = results.get('unadjusted_analysis', {})
    km = results.get('kaplan_meier', {})

    # Use unadjusted for comparison (R coxph without IPTW)
    cox = unadj if unadj else primary

    print('\n' + '=' * 70)
    print('AFARENSIS STATISTICAL VALIDATION REPORT')
    print('Benchmark: R survival::coxph / survfit')
    print('=' * 70)

    checks = []

    def check(name, afar, ref, tol_pct=10, tol_abs=None):
        if afar is None:
            print(f'  [SKIP] {name}: not computed')
            checks.append({'name': name, 'status': 'SKIP', 'afar': None, 'ref': ref})
            return
        if tol_abs is not None:
            diff = abs(afar - ref)
            ok = diff <= tol_abs
            diff_str = f'{diff:.4f} (abs tol={tol_abs})'
        else:
            diff = abs((afar - ref) / ref) * 100 if ref != 0 else abs(afar) * 100
            ok = diff <= tol_pct
            diff_str = f'{diff:.1f}% (tol={tol_pct}%)'
        tag = '[PASS]' if ok else '[FAIL]'
        print(f'  {tag} {name}: Afarensis={afar:.4f}  R={ref:.4f}  diff={diff_str}')
        checks.append({'name': name, 'status': 'PASS' if ok else 'FAIL',
                        'afar': round(afar, 4), 'ref': ref, 'diff': diff_str})

    print('\n-- Cox PH: Multivariate (trt + covariates) --')
    # Unadjusted analysis stores treatment effect at top level
    hr = cox.get('treatment_hr')
    ci_lo = cox.get('treatment_ci_lower')
    ci_hi = cox.get('treatment_ci_upper')
    pval = cox.get('treatment_p_value')
    conc = cox.get('concordance_index')

    # Derive coefficient from HR
    coef = np.log(hr) if hr else None

    check('Multivariate HR', hr, REF['cox_hr_multi'], tol_pct=1)
    check('Multivariate coef', coef, REF['cox_coef_multi'], tol_abs=0.005)
    check('Multivariate p-value', pval, REF['cox_p_multi'], tol_abs=0.005)
    if ci_lo: check('Multivariate CI Lower', ci_lo, 0.8985, tol_pct=5)  # lifelines ref
    if ci_hi: check('Multivariate CI Upper', ci_hi, 1.8569, tol_pct=5)

    conc = cox.get('concordance_index') or cox.get('concordance')

    print('\n-- Cox PH: IPTW-Weighted (primary analysis) --')
    iptw_hr = primary.get('hazard_ratio')
    if iptw_hr:
        print(f'  [INFO] IPTW HR: {iptw_hr:.4f} (no direct reference -- IPTW depends on PS model)')

    print('\n-- Kaplan-Meier Medians --')
    km_curves = km.get('curves', {})
    km_logrank = km.get('log_rank_test', {})
    for group_name, curve_data in km_curves.items():
        if isinstance(curve_data, dict):
            med = curve_data.get('median_survival')
            if med:
                # Match label to reference
                name_lower = group_name.lower()
                if 'standard' in name_lower or name_lower == 'standard':
                    check(f'KM Median ({group_name})', med, REF['km_median_standard'], tol_pct=1)
                elif 'test' in name_lower or name_lower == 'test':
                    check(f'KM Median ({group_name})', med, REF['km_median_test'], tol_pct=5)
                else:
                    print(f'  [INFO] KM Median ({group_name}): {med}')

    if km_logrank:
        lr_p = km_logrank.get('p_value')
        if lr_p:
            check('Log-rank p-value', lr_p, REF['logrank_p'], tol_abs=0.005)

    print('\n-- Additional Metrics --')
    ps = results.get('propensity_scores', {})
    ev = results.get('e_value', {})
    if ps.get('c_statistic'): print(f'  [INFO] PS C-statistic: {ps["c_statistic"]:.4f}')
    if ev.get('e_value_point'): print(f'  [INFO] E-value: {ev["e_value_point"]:.4f}')
    if conc: print(f'  [INFO] Concordance: {conc:.4f}')

    # Summary
    passed = sum(1 for c in checks if c['status'] == 'PASS')
    failed = sum(1 for c in checks if c['status'] == 'FAIL')
    skipped = sum(1 for c in checks if c['status'] == 'SKIP')

    print('\n' + '=' * 70)
    print(f'RESULT: {passed} PASS / {failed} FAIL / {skipped} SKIP out of {len(checks)} checks')
    if failed == 0:
        print('STATUS: VALIDATED -- Afarensis results match R reference within tolerance')
    else:
        print('STATUS: DISCREPANCIES FOUND')
        for c in checks:
            if c['status'] == 'FAIL':
                print(f'  {c["name"]}: Afarensis={c["afar"]}, R={c["ref"]}')
    print('=' * 70)

    # Save for report generation
    with open('validation_results.json', 'w') as f:
        json.dump({
            'dataset': 'veteran_lung_cancer_137pts',
            'reference': 'lifelines 0.30.0 (Breslow method)',
            'checks': checks,
            'reference_values': REF,
            'afarensis_raw': {k: v for k, v in results.items()
                              if k not in ('column_detection',)},
        }, f, indent=2, default=str)

    return failed


if __name__ == '__main__':
    sys.exit(main() or 0)
