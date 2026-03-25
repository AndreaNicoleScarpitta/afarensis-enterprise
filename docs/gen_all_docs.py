#!/usr/bin/env python3
"""Master script: generates all 6 Afarensis Enterprise documents."""

import subprocess, sys, os

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))

def run_script(name):
    path = os.path.join(DOCS_DIR, name)
    result = subprocess.run([sys.executable, path], cwd=DOCS_DIR)
    if result.returncode != 0:
        print(f"ERROR: {name} failed with exit code {result.returncode}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("Afarensis Enterprise - Full Documentation Suite")
    print("=" * 60)
    run_script("gen_docs_1.py")
    print()
    run_script("gen_docs_2.py")
    print()
    print("=" * 60)
    print("All 6 documents generated successfully!")
    print("=" * 60)

    # Summary
    docs = [
        "Afarensis_API_Reference_v2.1.pdf",
        "Afarensis_Reference_Guide.docx",
        "Afarensis_Tutorial.docx",
        "Afarensis_HowTo_Biostatisticians.docx",
        "Afarensis_Annotated_Report.docx",
        "Afarensis_Architecture_v2.1.docx",
    ]
    print("\nGenerated files:")
    for d in docs:
        fp = os.path.join(DOCS_DIR, d)
        if os.path.exists(fp):
            sz = os.path.getsize(fp)
            print(f"  {d:50s} {sz:>10,} bytes")
        else:
            print(f"  {d:50s} MISSING")
