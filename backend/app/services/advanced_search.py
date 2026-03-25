"""
Advanced Search & Discovery Service for Afarensis Enterprise
Implements semantic search, embeddings, citation analysis, and intelligent recommendations
"""

import asyncio
import logging
import json
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, text
from sqlalchemy.orm import selectinload

# For embeddings (would use actual embedding service in production)
try:
    import openai
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False

from app.models import EvidenceRecord, Project, User, SavedSearch
# CRITICAL FIX: Remove circular imports - use lazy imports instead
# from app.services.llm_integration import llm_service
# from app.services.external_apis import external_api_service
from app.core.config import settings
from app.core.exceptions import ProcessingError

logger = logging.getLogger(__name__)


# CRITICAL FIX: Lazy imports to prevent circular dependencies
def get_llm_service():
    """Lazy import for LLM service to prevent circular imports"""
    from app.services.llm_integration import llm_service
    return llm_service


def get_external_api_service():
    """Lazy import for external API service to prevent circular imports"""
    from app.services.external_apis import external_api_service
    return external_api_service


class SearchType(Enum):
    """Types of search available"""
    KEYWORD = "keyword"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"
    CITATION = "citation"


@dataclass
class SearchResult:
    """Search result with relevance scoring"""
    evidence_id: str
    title: str
    abstract: str
    authors: List[str]
    journal: str
    publication_year: int
    relevance_score: float
    search_type: str
    similarity_reasons: List[str]
    citation_count: int
    related_evidence_ids: List[str]


@dataclass
class CitationNetwork:
    """Citation network analysis result"""
    evidence_id: str
    cited_by: List[str]
    cites: List[str]
    co_citation_cluster: List[str]
    centrality_score: float
    influence_score: float


class AdvancedSearchService:
    """Advanced search with semantic understanding and recommendations"""
    
    def __init__(self, db: AsyncSession, current_user: Optional[Dict[str, Any]] = None):
        self.db = db
        self.current_user = current_user
        self.user_id = current_user.get("user_id") if current_user else None
        
        # Initialize embedding model (in production, use a dedicated service)
        self.embedding_model = None
        if EMBEDDINGS_AVAILABLE:
            try:
                self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                logger.warning(f"Failed to load embedding model: {e}")
    
    async def semantic_search(
        self,
        query: str,
        project_id: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 20
    ) -> List[SearchResult]:
        """Perform semantic search using embeddings"""
        
        if not self.embedding_model:
            logger.warning("Embedding model not available, falling back to keyword search")
            return await self.keyword_search(query, project_id, filters, limit)
        
        try:
            # Generate query embedding
            query_embedding = self.embedding_model.encode(query)
            
            # Get all evidence records with their embeddings
            evidence_query = select(EvidenceRecord)
            
            if project_id:
                evidence_query = evidence_query.where(EvidenceRecord.project_id == project_id)
            
            if filters:
                evidence_query = self._apply_filters(evidence_query, filters)
            
            result = await self.db.execute(evidence_query)
            evidence_records = result.scalars().all()
            
            # Calculate similarity scores
            search_results = []
            for evidence in evidence_records:
                # Generate embedding for evidence (in production, these would be pre-computed)
                evidence_text = f"{evidence.title} {evidence.abstract}"
                evidence_embedding = self.embedding_model.encode(evidence_text)
                
                # Calculate cosine similarity
                similarity_score = self._cosine_similarity(query_embedding, evidence_embedding)
                
                # Generate similarity explanation
                similarity_reasons = await self._explain_similarity(query, evidence_text, similarity_score)
                
                search_results.append(SearchResult(
                    evidence_id=str(evidence.id),
                    title=evidence.title,
                    abstract=evidence.abstract or "",
                    authors=evidence.authors or [],
                    journal=evidence.journal or "",
                    publication_year=evidence.publication_year or 0,
                    relevance_score=similarity_score,
                    search_type="semantic",
                    similarity_reasons=similarity_reasons,
                    citation_count=await self._get_citation_count(evidence.id),
                    related_evidence_ids=await self._get_related_evidence(evidence.id)
                ))
            
            # Sort by relevance score
            search_results.sort(key=lambda x: x.relevance_score, reverse=True)
            
            return search_results[:limit]
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            # Fallback to keyword search
            return await self.keyword_search(query, project_id, filters, limit)
    
    async def hybrid_search(
        self,
        query: str,
        project_id: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 20,
        semantic_weight: float = 0.7
    ) -> List[SearchResult]:
        """Combine semantic and keyword search with weighted scoring"""
        
        # Get results from both approaches
        semantic_results = await self.semantic_search(query, project_id, filters, limit * 2)
        keyword_results = await self.keyword_search(query, project_id, filters, limit * 2)
        
        # Combine and re-rank
        combined_results = {}
        
        # Add semantic results
        for result in semantic_results:
            combined_results[result.evidence_id] = result
            result.relevance_score = result.relevance_score * semantic_weight
            result.search_type = "hybrid"
        
        # Add/update with keyword results
        for result in keyword_results:
            if result.evidence_id in combined_results:
                # Combine scores
                existing = combined_results[result.evidence_id]
                existing.relevance_score += result.relevance_score * (1 - semantic_weight)
                existing.similarity_reasons.extend(result.similarity_reasons)
            else:
                result.relevance_score = result.relevance_score * (1 - semantic_weight)
                result.search_type = "hybrid"
                combined_results[result.evidence_id] = result
        
        # Sort by combined score
        final_results = list(combined_results.values())
        final_results.sort(key=lambda x: x.relevance_score, reverse=True)
        
        return final_results[:limit]
    
    async def keyword_search(
        self,
        query: str,
        project_id: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 20
    ) -> List[SearchResult]:
        """Enhanced keyword search with ranking"""
        
        # Build search query with PostgreSQL full-text search
        search_query = select(EvidenceRecord).where(
            or_(
                EvidenceRecord.title.ilike(f"%{query}%"),
                EvidenceRecord.abstract.ilike(f"%{query}%"),
                EvidenceRecord.journal.ilike(f"%{query}%")
            )
        )
        
        if project_id:
            search_query = search_query.where(EvidenceRecord.project_id == project_id)
        
        if filters:
            search_query = self._apply_filters(search_query, filters)
        
        # Order by relevance (simple scoring)
        search_query = search_query.order_by(desc(EvidenceRecord.discovered_at))
        search_query = search_query.limit(limit)
        
        result = await self.db.execute(search_query)
        evidence_records = result.scalars().all()
        
        search_results = []
        for evidence in evidence_records:
            # Calculate keyword relevance score
            relevance_score = self._calculate_keyword_relevance(query, evidence)
            
            similarity_reasons = []
            if query.lower() in evidence.title.lower():
                similarity_reasons.append("Title match")
            if evidence.abstract and query.lower() in evidence.abstract.lower():
                similarity_reasons.append("Abstract match")
            
            search_results.append(SearchResult(
                evidence_id=str(evidence.id),
                title=evidence.title,
                abstract=evidence.abstract or "",
                authors=evidence.authors or [],
                journal=evidence.journal or "",
                publication_year=evidence.publication_year or 0,
                relevance_score=relevance_score,
                search_type="keyword",
                similarity_reasons=similarity_reasons,
                citation_count=await self._get_citation_count(evidence.id),
                related_evidence_ids=await self._get_related_evidence(evidence.id)
            ))
        
        return search_results
    
    async def get_recommendations(
        self,
        evidence_id: str,
        recommendation_type: str = "similar",
        limit: int = 10
    ) -> List[SearchResult]:
        """Get recommendations based on an evidence record"""
        
        evidence = await self.db.get(EvidenceRecord, evidence_id)
        if not evidence:
            return []
        
        if recommendation_type == "similar":
            return await self._get_similar_evidence(evidence, limit)
        elif recommendation_type == "citing":
            return await self._get_citing_evidence(evidence, limit)
        elif recommendation_type == "cited":
            return await self._get_cited_evidence(evidence, limit)
        elif recommendation_type == "co_cited":
            return await self._get_co_cited_evidence(evidence, limit)
        else:
            return await self._get_similar_evidence(evidence, limit)
    
    async def analyze_citation_network(
        self,
        evidence_ids: List[str]
    ) -> Dict[str, CitationNetwork]:
        """Analyze citation relationships between evidence records"""
        
        citation_networks = {}
        
        for evidence_id in evidence_ids:
            evidence = await self.db.get(EvidenceRecord, evidence_id)
            if not evidence:
                continue
            
            # Extract citations from evidence (would need actual citation parsing)
            cited_by = await self._find_citing_papers(evidence)
            cites = await self._extract_citations(evidence)
            
            # Find co-citation clusters
            co_citation_cluster = await self._find_co_citation_cluster(evidence_id)
            
            # Calculate network metrics
            centrality_score = await self._calculate_centrality(evidence_id, cited_by, cites)
            influence_score = await self._calculate_influence_score(evidence_id, cited_by)
            
            citation_networks[evidence_id] = CitationNetwork(
                evidence_id=evidence_id,
                cited_by=cited_by,
                cites=cites,
                co_citation_cluster=co_citation_cluster,
                centrality_score=centrality_score,
                influence_score=influence_score
            )
        
        return citation_networks
    
    async def save_search(
        self,
        name: str,
        query: str,
        search_type: str,
        filters: Optional[Dict[str, Any]] = None,
        alert_frequency: Optional[str] = None
    ) -> str:
        """Save a search for later reuse and optional alerts"""
        
        saved_search = SavedSearch(
            id=uuid.uuid4(),
            user_id=self.user_id,
            name=name,
            query=query,
            search_type=search_type,
            filters=filters or {},
            alert_frequency=alert_frequency,
            created_at=datetime.utcnow(),
            last_run=datetime.utcnow()
        )
        
        self.db.add(saved_search)
        await self.db.commit()
        
        return str(saved_search.id)
    
    async def get_saved_searches(self) -> List[Dict[str, Any]]:
        """Get user's saved searches"""
        
        query = select(SavedSearch).where(SavedSearch.user_id == self.user_id)
        result = await self.db.execute(query)
        saved_searches = result.scalars().all()
        
        return [
            {
                "id": str(search.id),
                "name": search.name,
                "query": search.query,
                "search_type": search.search_type,
                "filters": search.filters,
                "alert_frequency": search.alert_frequency,
                "created_at": search.created_at.isoformat(),
                "last_run": search.last_run.isoformat() if search.last_run else None
            }
            for search in saved_searches
        ]
    
    async def run_saved_search(self, saved_search_id: str) -> List[SearchResult]:
        """Execute a saved search"""
        
        saved_search = await self.db.get(SavedSearch, saved_search_id)
        if not saved_search or saved_search.user_id != self.user_id:
            raise ProcessingError("Saved search not found")
        
        # Update last run timestamp
        saved_search.last_run = datetime.utcnow()
        await self.db.commit()
        
        # Execute the search
        if saved_search.search_type == "semantic":
            return await self.semantic_search(
                saved_search.query,
                filters=saved_search.filters
            )
        elif saved_search.search_type == "hybrid":
            return await self.hybrid_search(
                saved_search.query,
                filters=saved_search.filters
            )
        else:
            return await self.keyword_search(
                saved_search.query,
                filters=saved_search.filters
            )
    
    # Helper methods
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    async def _explain_similarity(
        self,
        query: str,
        evidence_text: str,
        similarity_score: float
    ) -> List[str]:
        """Generate human-readable explanation for similarity"""
        
        reasons = []
        
        if similarity_score > 0.8:
            reasons.append("Very high conceptual similarity")
        elif similarity_score > 0.6:
            reasons.append("High conceptual similarity")
        elif similarity_score > 0.4:
            reasons.append("Moderate conceptual similarity")
        
        # Check for keyword overlaps
        query_words = set(query.lower().split())
        evidence_words = set(evidence_text.lower().split())
        overlap = query_words.intersection(evidence_words)
        
        if len(overlap) > 3:
            reasons.append(f"Multiple keyword matches: {', '.join(list(overlap)[:3])}")
        elif len(overlap) > 1:
            reasons.append(f"Keyword matches: {', '.join(overlap)}")
        
        return reasons
    
    def _calculate_keyword_relevance(self, query: str, evidence: EvidenceRecord) -> float:
        """Calculate keyword-based relevance score"""
        
        score = 0.0
        query_lower = query.lower()
        
        # Title matches (highest weight)
        if evidence.title and query_lower in evidence.title.lower():
            score += 0.5
        
        # Abstract matches
        if evidence.abstract and query_lower in evidence.abstract.lower():
            score += 0.3
        
        # Journal matches
        if evidence.journal and query_lower in evidence.journal.lower():
            score += 0.1
        
        # Author matches
        if evidence.authors:
            for author in evidence.authors:
                if query_lower in author.lower():
                    score += 0.1
                    break
        
        # Recent publications get slight boost
        if evidence.publication_year and evidence.publication_year >= 2020:
            score += 0.1
        
        return min(score, 1.0)
    
    def _apply_filters(self, query, filters: Dict[str, Any]):
        """Apply search filters to query"""
        
        if filters.get("publication_year_start"):
            query = query.where(EvidenceRecord.publication_year >= filters["publication_year_start"])
        
        if filters.get("publication_year_end"):
            query = query.where(EvidenceRecord.publication_year <= filters["publication_year_end"])
        
        if filters.get("journal"):
            query = query.where(EvidenceRecord.journal.ilike(f"%{filters['journal']}%"))
        
        if filters.get("source_type"):
            query = query.where(EvidenceRecord.source_type == filters["source_type"])
        
        if filters.get("authors"):
            author_filter = or_(*[
                func.array_to_string(EvidenceRecord.authors, ',').ilike(f"%{author}%")
                for author in filters["authors"]
            ])
            query = query.where(author_filter)
        
        return query
    
    async def _get_citation_count(self, evidence_id: str) -> int:
        """Get citation count for evidence (placeholder)"""
        # In production, this would query a citation database
        return 0
    
    async def _get_related_evidence(self, evidence_id: str) -> List[str]:
        """Get related evidence IDs (placeholder)"""
        # In production, this would use citation networks, semantic similarity, etc.
        return []
    
    async def _get_similar_evidence(self, evidence: EvidenceRecord, limit: int) -> List[SearchResult]:
        """Get similar evidence using embeddings"""
        
        if not self.embedding_model:
            return []
        
        # Use title + abstract as query for similarity
        query_text = f"{evidence.title} {evidence.abstract or ''}"
        return await self.semantic_search(query_text, limit=limit)
    
    async def _get_citing_evidence(self, evidence: EvidenceRecord, limit: int) -> List[SearchResult]:
        """Get evidence that cites this paper"""
        # Placeholder - would need citation database integration
        return []
    
    async def _get_cited_evidence(self, evidence: EvidenceRecord, limit: int) -> List[SearchResult]:
        """Get evidence cited by this paper"""
        # Placeholder - would need citation parsing
        return []
    
    async def _get_co_cited_evidence(self, evidence: EvidenceRecord, limit: int) -> List[SearchResult]:
        """Get evidence frequently co-cited with this paper"""
        # Placeholder - would need co-citation analysis
        return []
    
    async def _find_citing_papers(self, evidence: EvidenceRecord) -> List[str]:
        """Find papers that cite this evidence"""
        # Placeholder for citation database lookup
        return []
    
    async def _extract_citations(self, evidence: EvidenceRecord) -> List[str]:
        """Extract citations from evidence text"""
        # Placeholder for citation parsing
        return []
    
    async def _find_co_citation_cluster(self, evidence_id: str) -> List[str]:
        """Find papers frequently co-cited with this evidence"""
        # Placeholder for co-citation analysis
        return []
    
    async def _calculate_centrality(self, evidence_id: str, cited_by: List[str], cites: List[str]) -> float:
        """Calculate citation network centrality score"""
        # Simple calculation based on citation connections
        return (len(cited_by) + len(cites)) / 100.0
    
    async def _calculate_influence_score(self, evidence_id: str, cited_by: List[str]) -> float:
        """Calculate influence score based on citations"""
        # Weight recent citations more heavily
        return min(len(cited_by) / 50.0, 1.0)


# Add new model for saved searches
# Note: SavedSearch is now properly defined in app.models
