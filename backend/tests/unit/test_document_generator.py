"""Unit tests for DocumentGenerator from app.services.document_generator."""
import pytest

from app.services.document_generator import DocumentGenerator


@pytest.fixture
def gen(tmp_path):
    """Create a DocumentGenerator that writes artifacts to a temp directory."""
    return DocumentGenerator(artifact_dir=str(tmp_path / "artifacts"))


# ---------------------------------------------------------------------------
# SAR HTML generation
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestSARHTML:

    def test_sar_html_returns_string(self, gen):
        html = gen.generate_sar_html()
        assert isinstance(html, str)

    def test_sar_html_contains_html_tag(self, gen):
        html = gen.generate_sar_html()
        assert "<html" in html

    def test_sar_html_contains_executive_summary(self, gen):
        html = gen.generate_sar_html()
        assert "Executive Summary" in html

    def test_sar_html_contains_conclusions(self, gen):
        html = gen.generate_sar_html()
        assert "Conclusions" in html

    def test_sar_html_with_custom_project(self, gen):
        project = {"protocol": "CUSTOM-001", "title": "Custom Study"}
        html = gen.generate_sar_html(project=project)
        assert "CUSTOM-001" in html


# ---------------------------------------------------------------------------
# SAR DOCX generation
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestSARDOCX:

    def test_sar_docx_returns_bytes(self, gen):
        docx_bytes = gen.generate_sar_docx()
        assert isinstance(docx_bytes, bytes)

    def test_sar_docx_non_empty(self, gen):
        docx_bytes = gen.generate_sar_docx()
        assert len(docx_bytes) > 100


# ---------------------------------------------------------------------------
# Evidence table HTML
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestEvidenceTableHTML:

    def test_evidence_table_html_default(self, gen):
        html = gen.generate_evidence_table_html()
        assert "<html" in html
        assert "<table" in html
        assert "Evidence Summary Table" in html

    def test_evidence_table_multiple_records(self, gen):
        records = [
            {"source_id": "PMID:111", "title": "Study A", "year": 2022},
            {"source_id": "PMID:222", "title": "Study B", "year": 2023},
            {"source_id": "NCT00001", "title": "Trial C", "year": 2021},
        ]
        html = gen.generate_evidence_table_html(evidence=records)
        assert "Study A" in html
        assert "Study B" in html
        assert "Trial C" in html
        # Should contain table rows
        assert html.count("<tr>") >= 3


# ---------------------------------------------------------------------------
# Statistical Analysis Plan HTML
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestSAPHTML:

    def test_sap_html_returns_string(self, gen):
        html = gen.generate_statistical_analysis_plan_html()
        assert isinstance(html, str)

    def test_sap_html_contains_statistical_methods(self, gen):
        html = gen.generate_statistical_analysis_plan_html()
        assert "Statistical" in html
        assert "Methods" in html or "Analysis" in html
