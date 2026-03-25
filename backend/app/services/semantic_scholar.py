"""
Semantic Scholar API Integration for Afarensis Enterprise

Provides access to 200M+ academic papers with citation graphs,
author disambiguation, and semantic similarity search.
Free public API — no key required for basic usage.
See: https://api.semanticscholar.org/graph/v1/
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1"
SEMANTIC_SCHOLAR_RECOMMEND = "https://api.semanticscholar.org/recommendations/v1"

# Fields to request for each paper
PAPER_FIELDS = ",".join([
    "paperId", "externalIds", "title", "abstract",
    "authors", "year", "publicationDate", "publicationTypes",
    "journal", "venue", "citationCount", "referenceCount",
    "influentialCitationCount", "isOpenAccess", "openAccessPdf",
    "fieldsOfStudy", "s2FieldsOfStudy", "tldr",
])

AUTHOR_FIELDS = "authorId,name,affiliations,paperCount,citationCount,hIndex"


class SemanticScholarService:
    """
    Client for the Semantic Scholar Graph API.
    Rate limits: 1 req/s unauthenticated, 10 req/s with API key.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        headers: Dict[str, str] = {"User-Agent": "Afarensis-Enterprise/2.1"}
        if api_key:
            headers["x-api-key"] = api_key
        self.client = httpx.AsyncClient(
            base_url=SEMANTIC_SCHOLAR_BASE,
            headers=headers,
            timeout=30.0,
        )
        self._last_call: float = 0.0
        self._rate_interval: float = 1.1 if not api_key else 0.12  # seconds

    async def _throttle(self) -> None:
        import time
        now = time.monotonic()
        wait = self._rate_interval - (now - self._last_call)
        if wait > 0:
            await asyncio.sleep(wait)
        self._last_call = time.monotonic()

    # ── Paper Search ───────────────────────────────────────────────────────────

    async def search_papers(
        self,
        query: str,
        limit: int = 20,
        offset: int = 0,
        year_range: Optional[str] = None,     # e.g. "2018-2024"
        fields_of_study: Optional[List[str]] = None,  # e.g. ["Medicine"]
        publication_types: Optional[List[str]] = None,  # e.g. ["ClinicalTrial"]
        min_citation_count: Optional[int] = None,
        open_access_only: bool = False,
    ) -> Dict[str, Any]:
        """
        Full-text search over Semantic Scholar's paper corpus.
        Returns structured list of papers with metadata.
        """
        await self._throttle()

        params: Dict[str, Any] = {
            "query": query,
            "limit": min(limit, 100),
            "offset": offset,
            "fields": PAPER_FIELDS,
        }
        if year_range:
            params["year"] = year_range
        if fields_of_study:
            params["fieldsOfStudy"] = ",".join(fields_of_study)
        if publication_types:
            params["publicationTypes"] = ",".join(publication_types)
        if min_citation_count is not None:
            params["minCitationCount"] = min_citation_count
        if open_access_only:
            params["openAccessPdf"] = ""  # filter to OA only

        try:
            resp = await self.client.get("/paper/search", params=params)
            resp.raise_for_status()
            data = resp.json()
            papers = data.get("data", [])
            return {
                "total": data.get("total", len(papers)),
                "offset": offset,
                "papers": [self._normalize_paper(p) for p in papers],
                "source": "semantic_scholar",
                "query": query,
            }
        except httpx.HTTPStatusError as e:
            logger.error("Semantic Scholar search error: %s", e)
            return {"total": 0, "offset": 0, "papers": [], "source": "semantic_scholar", "error": str(e)}
        except Exception as e:
            logger.error("Semantic Scholar unexpected error: %s", e)
            return {"total": 0, "offset": 0, "papers": [], "source": "semantic_scholar", "error": str(e)}

    # ── Paper Lookup ───────────────────────────────────────────────────────────

    async def get_paper(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """
        Get full paper metadata by Semantic Scholar ID, DOI, ArXiv ID, etc.
        Accepts: S2 paper ID, 'DOI:10.xxxx/...', 'PMID:12345', 'ArXiv:...'
        """
        await self._throttle()
        try:
            resp = await self.client.get(
                f"/paper/{paper_id}",
                params={"fields": PAPER_FIELDS}
            )
            resp.raise_for_status()
            return self._normalize_paper(resp.json())
        except Exception as e:
            logger.warning("Paper lookup failed (%s): %s", paper_id, e)
            return None

    # ── Citations & References ────────────────────────────────────────────────

    async def get_citations(self, paper_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get papers that cite this paper."""
        await self._throttle()
        try:
            resp = await self.client.get(
                f"/paper/{paper_id}/citations",
                params={"fields": "paperId,title,year,authors,citationCount", "limit": limit}
            )
            resp.raise_for_status()
            return [self._normalize_paper(c.get("citingPaper", {})) for c in resp.json().get("data", [])]
        except Exception as e:
            logger.warning("Citations fetch failed: %s", e)
            return []

    async def get_references(self, paper_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get papers this paper cites."""
        await self._throttle()
        try:
            resp = await self.client.get(
                f"/paper/{paper_id}/references",
                params={"fields": "paperId,title,year,authors,citationCount", "limit": limit}
            )
            resp.raise_for_status()
            return [self._normalize_paper(r.get("citedPaper", {})) for r in resp.json().get("data", [])]
        except Exception as e:
            logger.warning("References fetch failed: %s", e)
            return []

    # ── Paper Recommendations ────────────────────────────────────────────────

    async def get_recommendations(
        self,
        positive_paper_ids: List[str],
        negative_paper_ids: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get paper recommendations based on a seed set (positive / negative).
        Uses the Recommendations API.
        """
        await self._throttle()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                body = {"positivePaperIds": positive_paper_ids}
                if negative_paper_ids:
                    body["negativePaperIds"] = negative_paper_ids  # type: ignore[assignment]
                resp = await client.post(
                    f"{SEMANTIC_SCHOLAR_RECOMMEND}/papers/",
                    json=body,
                    params={"limit": limit, "fields": PAPER_FIELDS},
                )
                resp.raise_for_status()
                return [self._normalize_paper(p) for p in resp.json().get("recommendedPapers", [])]
        except Exception as e:
            logger.warning("Recommendations failed: %s", e)
            return []

    # ── Author Search ────────────────────────────────────────────────────────

    async def search_authors(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for authors by name."""
        await self._throttle()
        try:
            resp = await self.client.get(
                "/author/search",
                params={"query": query, "limit": limit, "fields": AUTHOR_FIELDS}
            )
            resp.raise_for_status()
            return resp.json().get("data", [])
        except Exception as e:
            logger.warning("Author search failed: %s", e)
            return []

    # ── Regulatory-specific search helpers ────────────────────────────────────

    async def search_clinical_trials(self, query: str, limit: int = 20) -> Dict[str, Any]:
        """Search specifically for clinical trial papers."""
        return await self.search_papers(
            query=query,
            limit=limit,
            publication_types=["ClinicalTrial"],
            fields_of_study=["Medicine"],
        )

    async def search_rare_disease_evidence(
        self,
        disease_name: str,
        intervention: Optional[str] = None,
        limit: int = 30,
        year_from: int = 2015,
    ) -> Dict[str, Any]:
        """
        Targeted search for rare disease external control evidence.
        Optimized for finding natural history studies and registry data.
        """
        query_parts = [f'"{disease_name}"']
        if intervention:
            query_parts.append(f'"{intervention}"')
        query_parts.extend(["natural history OR external control OR registry"])
        query = " ".join(query_parts)

        return await self.search_papers(
            query=query,
            limit=limit,
            year_range=f"{year_from}-2024",
            fields_of_study=["Medicine"],
            min_citation_count=0,
        )

    async def search_comparability_methods(self, limit: int = 20) -> Dict[str, Any]:
        """Search for propensity score and comparability methodology papers."""
        query = (
            "propensity score weighting external control arm "
            "rare disease regulatory FDA single arm trial"
        )
        return await self.search_papers(
            query=query,
            limit=limit,
            year_range="2010-2024",
            fields_of_study=["Medicine", "Statistics"],
            min_citation_count=5,
        )

    # ── Normalization ────────────────────────────────────────────────────────

    def _normalize_paper(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert Semantic Scholar paper format → Afarensis standard evidence format.
        Compatible with EvidenceSchema on the frontend.
        """
        if not raw:
            return {}

        authors = raw.get("authors", [])
        author_names = [a.get("name", "") for a in authors if a.get("name")]

        external_ids = raw.get("externalIds") or {}
        doi = external_ids.get("DOI")
        pmid = external_ids.get("PubMed")

        tldr = raw.get("tldr") or {}
        ai_summary = tldr.get("text") if isinstance(tldr, dict) else None

        oa_pdf = raw.get("openAccessPdf") or {}
        pdf_url = oa_pdf.get("url") if isinstance(oa_pdf, dict) else None

        return {
            # Afarensis evidence fields
            "id": raw.get("paperId", ""),
            "title": raw.get("title", "Untitled"),
            "abstract": raw.get("abstract"),
            "authors": author_names,
            "publicationDate": raw.get("publicationDate") or (
                str(raw.get("year")) if raw.get("year") else None
            ),
            "source": "semanticscholar",
            "sourceId": raw.get("paperId"),
            "doi": doi,
            "pmid": pmid,
            "qualityScore": self._compute_quality_score(raw),
            "aiSummary": ai_summary,
            "citationCount": raw.get("citationCount", 0),
            "influentialCitationCount": raw.get("influentialCitationCount", 0),
            "referenceCount": raw.get("referenceCount", 0),
            "isOpenAccess": raw.get("isOpenAccess", False),
            "pdfUrl": pdf_url,
            "journal": (raw.get("journal") or {}).get("name"),
            "venue": raw.get("venue"),
            "publicationTypes": raw.get("publicationTypes", []),
            "fieldsOfStudy": raw.get("fieldsOfStudy", []),
            # Raw for downstream use
            "_raw": raw,
        }

    def _compute_quality_score(self, raw: Dict[str, Any]) -> float:
        """
        Heuristic quality score 0-100 for regulatory relevance.
        Based on: citations, open access, has abstract, TLDR, journal.
        """
        score = 0.0
        citation_count = raw.get("citationCount") or 0
        # Up to 40 points from citations (log-scaled)
        import math
        if citation_count > 0:
            score += min(40.0, 10 * math.log10(citation_count + 1))
        # 20 points for having an abstract
        if raw.get("abstract"):
            score += 20
        # 15 points for open access
        if raw.get("isOpenAccess"):
            score += 15
        # 15 points for having a TLDR
        if raw.get("tldr"):
            score += 15
        # 10 points for journal publication
        if raw.get("journal"):
            score += 10
        return round(min(score, 100.0), 1)

    async def close(self) -> None:
        await self.client.aclose()
