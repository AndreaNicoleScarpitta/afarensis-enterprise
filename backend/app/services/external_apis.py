"""
External API Integration Service for Afarensis Enterprise
Real connections to PubMed, ClinicalTrials.gov, FDA, EMA, and other regulatory data sources
"""

import asyncio
import logging
import random
import xml.etree.ElementTree as ET
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import re

import aiohttp
from bs4 import BeautifulSoup

from app.core.config import settings
from app.core.exceptions import ProcessingError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Circuit breaker — prevents hammering a dead service
# ---------------------------------------------------------------------------

class CircuitBreaker:
    """Per-service circuit breaker: CLOSED → OPEN (after N failures) → HALF-OPEN.

    Fix 6 enhancements:
    * ``status`` property for monitoring endpoint.
    * ``total_failures`` / ``total_trips`` counters for observability.
    * ``half_open`` state tracking — allows exactly one probe request.
    """

    def __init__(self, failure_threshold: int = 5, recovery_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_seconds = recovery_seconds
        self._consecutive_failures = 0
        self._opened_at: Optional[float] = None
        self._half_open = False
        # Counters for monitoring
        self._total_failures = 0
        self._total_successes = 0
        self._total_trips = 0
        self._last_failure_at: Optional[float] = None
        self._last_success_at: Optional[float] = None

    @property
    def state(self) -> str:
        """Current state: 'closed', 'open', or 'half_open'."""
        if self._opened_at is None:
            return "closed"
        elapsed = datetime.now().timestamp() - self._opened_at
        if elapsed >= self.recovery_seconds:
            return "half_open"
        return "open"

    @property
    def is_open(self) -> bool:
        s = self.state
        if s == "closed":
            return False
        if s == "half_open":
            # Allow exactly one probe, then flip back
            self._half_open = True
            return False
        return True

    def record_success(self):
        self._consecutive_failures = 0
        self._opened_at = None
        self._half_open = False
        self._total_successes += 1
        self._last_success_at = datetime.now().timestamp()

    def record_failure(self):
        self._consecutive_failures += 1
        self._total_failures += 1
        self._last_failure_at = datetime.now().timestamp()
        if self._half_open:
            # Probe failed — reopen immediately
            self._opened_at = datetime.now().timestamp()
            self._half_open = False
            self._total_trips += 1
            logger.warning("Circuit breaker re-opened after failed half-open probe")
        elif self._consecutive_failures >= self.failure_threshold:
            self._opened_at = datetime.now().timestamp()
            self._total_trips += 1
            logger.warning(
                "Circuit breaker OPEN after %d consecutive failures (recovery in %ds)",
                self._consecutive_failures, self.recovery_seconds,
            )

    @property
    def status(self) -> dict:
        """Monitoring-friendly status snapshot."""
        return {
            "state": self.state,
            "consecutive_failures": self._consecutive_failures,
            "total_failures": self._total_failures,
            "total_successes": self._total_successes,
            "total_trips": self._total_trips,
            "failure_threshold": self.failure_threshold,
            "recovery_seconds": self.recovery_seconds,
            "last_failure_at": self._last_failure_at,
            "last_success_at": self._last_success_at,
        }


class ExternalAPIService:
    """Integration with external regulatory and medical databases.

    Resilience features
    ~~~~~~~~~~~~~~~~~~~
    * **Rate limiting** — per-service sliding window.
    * **Exponential backoff with jitter** — retries on transient errors and
      HTTP 429/5xx responses (default 3 attempts).
    * **Circuit breaker** — after 5 consecutive failures the service is
      short-circuited for 60 s, returning empty results instantly instead
      of burning timeout budget on a dead upstream.
    """

    def __init__(self):
        self.session_timeout = aiohttp.ClientTimeout(total=30, connect=10)
        self.rate_limits = {
            'pubmed': {'calls_per_second': 3, 'last_call': 0},
            'clinicaltrials': {'calls_per_second': 2, 'last_call': 0},
            'fda': {'calls_per_second': 1, 'last_call': 0},
            'openalex': {'calls_per_second': 10, 'last_call': 0},
        }
        self._circuit_breakers: Dict[str, CircuitBreaker] = {
            'pubmed': CircuitBreaker(),
            'clinicaltrials': CircuitBreaker(),
            'fda': CircuitBreaker(),
            'openalex': CircuitBreaker(),
            'semantic_scholar': CircuitBreaker(failure_threshold=3, recovery_seconds=120.0),
            'ema': CircuitBreaker(),
        }

    # ── Fix 6: Circuit breaker status + graceful degradation ─────────

    def get_circuit_breaker_status(self) -> Dict[str, dict]:
        """Return status of all circuit breakers for the /health/circuit-breakers endpoint."""
        return {name: cb.status for name, cb in self._circuit_breakers.items()}

    def is_service_available(self, service: str) -> bool:
        """Check if a service is available (circuit breaker not open)."""
        cb = self._circuit_breakers.get(service)
        if cb is None:
            return True
        return not cb.is_open

    async def search_with_degradation(
        self,
        service: str,
        search_func,
        *args,
        **kwargs,
    ) -> list:
        """Execute a search function with graceful degradation.

        If the circuit breaker is open, returns an empty list instead of
        raising an error.  This allows multi-source discovery to continue
        even when one upstream is down.
        """
        cb = self._circuit_breakers.get(service)
        if cb and cb.is_open:
            logger.warning(
                "Circuit breaker OPEN for %s — returning empty results (graceful degradation)",
                service,
            )
            return []
        try:
            return await search_func(*args, **kwargs)
        except ProcessingError as exc:
            logger.warning("Degraded response for %s: %s", service, exc)
            return []

    async def _rate_limit_wait(self, service: str):
        """Enforce rate limiting for external APIs"""
        if service in self.rate_limits:
            current_time = datetime.now().timestamp()
            last_call = self.rate_limits[service]['last_call']
            min_interval = 1.0 / self.rate_limits[service]['calls_per_second']

            time_since_last = current_time - last_call
            if time_since_last < min_interval:
                sleep_time = min_interval - time_since_last
                await asyncio.sleep(sleep_time)

            self.rate_limits[service]['last_call'] = datetime.now().timestamp()

    async def _fetch_with_retry(
        self,
        service: str,
        method: str,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        max_retries: int = 3,
        parse: str = "json",          # "json" | "text"
    ) -> Any:
        """HTTP GET/POST with exponential backoff, jitter and circuit breaker.

        Returns parsed response body on success, raises ProcessingError on
        exhausted retries.
        """
        cb = self._circuit_breakers.get(service)
        if cb and cb.is_open:
            logger.warning("Circuit breaker OPEN for %s — returning empty", service)
            raise ProcessingError(f"{service} circuit breaker is open (recent failures). Try again later.")

        last_exc: Optional[Exception] = None
        for attempt in range(max_retries):
            await self._rate_limit_wait(service)
            try:
                async with aiohttp.ClientSession(timeout=self.session_timeout) as session:
                    async with session.request(method, url, params=params, headers=headers) as resp:
                        # Retry on 429 / 5xx
                        if resp.status == 429 or resp.status >= 500:
                            retry_after = int(resp.headers.get("Retry-After", 2 ** attempt))
                            jitter = random.uniform(0, 1)
                            wait = min(retry_after + jitter, 30)
                            logger.warning(
                                "%s returned %d (attempt %d/%d) — retrying in %.1fs",
                                service, resp.status, attempt + 1, max_retries, wait,
                            )
                            await asyncio.sleep(wait)
                            continue

                        if resp.status != 200:
                            raise ProcessingError(f"{service} HTTP {resp.status}")

                        if cb:
                            cb.record_success()

                        if parse == "json":
                            return await resp.json(content_type=None)
                        return await resp.text()

            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_exc = exc
                if attempt < max_retries - 1:
                    wait = 2 ** attempt + random.uniform(0, 1)
                    logger.warning(
                        "%s network error (attempt %d/%d): %s — retrying in %.1fs",
                        service, attempt + 1, max_retries, exc, wait,
                    )
                    await asyncio.sleep(wait)
                else:
                    if cb:
                        cb.record_failure()
                    raise ProcessingError(f"{service} API error after {max_retries} attempts: {exc}")

        # Shouldn't reach here, but safety net
        if cb:
            cb.record_failure()
        raise ProcessingError(f"{service} API error after {max_retries} attempts: {last_exc}")

    # PubMed Integration

    async def search_pubmed(
        self,
        query: str,
        max_results: int = 50,
        publication_years: Optional[Tuple[int, int]] = None,
        study_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Search PubMed for literature"""

        await self._rate_limit_wait('pubmed')

        # Build search query
        search_terms = [query]

        if publication_years:
            start_year, end_year = publication_years
            search_terms.append(f'("{start_year}"[PDAT] : "{end_year}"[PDAT])')

        if study_types:
            type_filters = []
            study_type_mapping = {
                'rct': 'randomized controlled trial[Publication Type]',
                'meta_analysis': 'meta-analysis[Publication Type]',
                'systematic_review': 'systematic review[Publication Type]',
                'clinical_trial': 'clinical trial[Publication Type]',
                'observational': 'observational study[Publication Type]'
            }
            for study_type in study_types:
                if study_type.lower() in study_type_mapping:
                    type_filters.append(study_type_mapping[study_type.lower()])

            if type_filters:
                search_terms.append('(' + ' OR '.join(type_filters) + ')')

        full_query = ' AND '.join(search_terms)

        try:
            # Step 1: Search for PMIDs
            search_params = {
                'db': 'pubmed',
                'term': full_query,
                'retmax': min(max_results, 200),  # PubMed limit
                'retmode': 'json',
                'sort': 'relevance'
            }

            if settings.PUBMED_API_KEY:
                search_params['api_key'] = settings.PUBMED_API_KEY

            search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            search_data = await self._fetch_with_retry(
                "pubmed", "GET", search_url, params=search_params,
            )
            pmids = search_data.get('esearchresult', {}).get('idlist', [])

            if not pmids:
                return []

            # Step 2: Fetch detailed records (uses its own retry internally)
            return await self._fetch_pubmed_details_safe(pmids[:max_results])

        except Exception as e:
            logger.error(f"PubMed search failed: {e}")
            raise ProcessingError(f"PubMed API error: {str(e)}")

    async def _fetch_pubmed_details_safe(self, pmids: List[str]) -> List[Dict[str, Any]]:
        """Fetch detailed PubMed records with per-batch retry and jitter."""
        batch_size = 50
        all_articles = []
        failed_batches = 0

        for i in range(0, len(pmids), batch_size):
            batch_pmids = pmids[i:i + batch_size]

            fetch_params = {
                'db': 'pubmed',
                'id': ','.join(batch_pmids),
                'retmode': 'xml'
            }
            if settings.PUBMED_API_KEY:
                fetch_params['api_key'] = settings.PUBMED_API_KEY

            fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

            try:
                xml_content = await self._fetch_with_retry(
                    "pubmed", "GET", fetch_url, params=fetch_params, parse="text",
                )
                articles = self._parse_pubmed_xml(xml_content)
                all_articles.extend(articles)
            except ProcessingError:
                failed_batches += 1
                logger.warning("PubMed batch %d–%d failed after retries, skipping", i, i + batch_size)

            # Rate limiting between batches
            if i + batch_size < len(pmids):
                await asyncio.sleep(0.5)

        if failed_batches:
            logger.warning("PubMed: %d/%d batches failed", failed_batches,
                           (len(pmids) + batch_size - 1) // batch_size)

        return all_articles

    async def _fetch_pubmed_details(self, session: aiohttp.ClientSession, pmids: List[str]) -> List[Dict[str, Any]]:
        """Legacy method — delegates to _fetch_pubmed_details_safe."""
        return await self._fetch_pubmed_details_safe(pmids)

    def _parse_pubmed_xml(self, xml_content: str) -> List[Dict[str, Any]]:
        """Parse PubMed XML response"""

        try:
            root = ET.fromstring(xml_content)
            articles = []

            for article_elem in root.findall('.//PubmedArticle'):
                try:
                    # Extract basic information
                    pmid = article_elem.find('.//PMID').text if article_elem.find('.//PMID') is not None else None

                    # Title
                    title_elem = article_elem.find('.//ArticleTitle')
                    title = title_elem.text if title_elem is not None else "No title available"

                    # Abstract
                    abstract_texts = []
                    for abstract_elem in article_elem.findall('.//Abstract/AbstractText'):
                        abstract_texts.append(abstract_elem.text or "")
                    abstract = ' '.join(abstract_texts)

                    # Authors
                    authors = []
                    for author_elem in article_elem.findall('.//Author'):
                        last_name = author_elem.find('LastName')
                        first_name = author_elem.find('ForeName')
                        if last_name is not None:
                            author_name = last_name.text or ""
                            if first_name is not None:
                                author_name += f", {first_name.text or ''}"
                            authors.append(author_name)

                    # Journal
                    journal_elem = article_elem.find('.//Journal/Title')
                    journal = journal_elem.text if journal_elem is not None else "Unknown journal"

                    # Publication date
                    pub_date = None
                    pub_year = None
                    date_elem = article_elem.find('.//PubDate/Year')
                    if date_elem is not None:
                        pub_year = int(date_elem.text)

                    month_elem = article_elem.find('.//PubDate/Month')
                    day_elem = article_elem.find('.//PubDate/Day')

                    if pub_year:
                        month = month_elem.text if month_elem is not None else "1"
                        day = day_elem.text if day_elem is not None else "1"
                        try:
                            pub_date = f"{pub_year}-{month.zfill(2)}-{day.zfill(2)}"
                        except Exception:
                            pub_date = f"{pub_year}-01-01"

                    # DOI
                    doi = None
                    for id_elem in article_elem.findall('.//ArticleId'):
                        if id_elem.get('IdType') == 'doi':
                            doi = id_elem.text
                            break

                    # Study type detection
                    study_type = self._detect_study_type(title, abstract)

                    article_data = {
                        'pmid': pmid,
                        'title': title,
                        'abstract': abstract,
                        'authors': authors,
                        'journal': journal,
                        'publication_date': pub_date,
                        'publication_year': pub_year,
                        'doi': doi,
                        'url': f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else None,
                        'study_type': study_type,
                        'source': 'pubmed',
                        'extracted_at': datetime.utcnow().isoformat()
                    }

                    articles.append(article_data)

                except Exception as e:
                    logger.warning(f"Failed to parse PubMed article: {e}")
                    continue

            return articles

        except Exception as e:
            logger.error(f"Failed to parse PubMed XML: {e}")
            return []

    def _detect_study_type(self, title: str, abstract: str) -> str:
        """Detect study type from title and abstract"""

        text = (title + " " + abstract).lower()

        # Study type patterns
        if any(pattern in text for pattern in ['randomized', 'randomised', 'rct', 'placebo-controlled']):
            return 'randomized_controlled_trial'
        elif any(pattern in text for pattern in ['meta-analysis', 'systematic review', 'meta analysis']):
            return 'meta_analysis'
        elif any(pattern in text for pattern in ['cohort study', 'longitudinal', 'prospective']):
            return 'cohort_study'
        elif any(pattern in text for pattern in ['case-control', 'case control']):
            return 'case_control_study'
        elif any(pattern in text for pattern in ['cross-sectional', 'survey']):
            return 'cross_sectional_study'
        elif 'case report' in text:
            return 'case_report'
        else:
            return 'observational_study'

    # ClinicalTrials.gov Integration

    async def search_clinical_trials(
        self,
        condition: str,
        intervention: Optional[str] = None,
        phase: Optional[str] = None,
        status: Optional[List[str]] = None,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """Search ClinicalTrials.gov using the v2 API (no API key required).

        API docs: https://clinicaltrials.gov/data-api/api
        """
        await self._rate_limit_wait('clinicaltrials')

        # Use query.term for general search (handles compound queries better
        # than query.cond which requires exact condition names)
        params: Dict[str, Any] = {
            'query.term': condition,
            'pageSize': min(max_results, 100),
            'format': 'json',
        }
        if intervention:
            params['query.intr'] = intervention
        if phase:
            params['filter.phase'] = phase
        if status:
            params['filter.overallStatus'] = '|'.join(status)

        try:
            url = "https://clinicaltrials.gov/api/v2/studies"
            data = await self._fetch_with_retry("clinicaltrials", "GET", url, params=params)
            return self._parse_clinical_trials_v2(data)
        except Exception as e:
            logger.error(f"ClinicalTrials.gov search failed: {e}")
            raise ProcessingError(f"ClinicalTrials.gov API error: {str(e)}")

    def _parse_clinical_trials_v2(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse ClinicalTrials.gov v2 API response into normalised records."""
        studies = data.get('studies', [])
        results = []
        for study in studies:
            try:
                proto = study.get('protocolSection', {})
                ident = proto.get('identificationModule', {})
                status_mod = proto.get('statusModule', {})
                desc_mod = proto.get('descriptionModule', {})
                design_mod = proto.get('designModule', {})
                arms_mod = proto.get('armsInterventionsModule', {})
                proto.get('outcomesModule', {})
                eligibility = proto.get('eligibilityModule', {})
                proto.get('contactsLocationsModule', {})
                sponsor_mod = proto.get('sponsorCollaboratorsModule', {})

                nct_id = ident.get('nctId', '')
                title = ident.get('briefTitle', '') or ident.get('officialTitle', '')
                summary = desc_mod.get('briefSummary', '')
                detailed = desc_mod.get('detailedDescription', '')

                # Interventions
                interventions = []
                for arm in arms_mod.get('interventions', []):
                    interventions.append(arm.get('name', ''))

                # Conditions
                conditions = proto.get('conditionsModule', {}).get('conditions', [])

                # Sponsor
                lead_sponsor = sponsor_mod.get('leadSponsor', {})
                sponsor_name = lead_sponsor.get('name', '')

                # Dates / phase / enrollment
                start_date = status_mod.get('startDateStruct', {}).get('date', '')
                completion_date = status_mod.get('completionDateStruct', {}).get('date', '')
                overall_status = status_mod.get('overallStatus', '')
                phases = design_mod.get('phases', [])
                enrollment = design_mod.get('enrollmentInfo', {}).get('count')

                # Year from start date
                start_year = None
                if start_date:
                    try:
                        start_year = int(start_date.split('-')[0]) if '-' in start_date else int(start_date[-4:])
                    except (ValueError, IndexError):
                        pass

                results.append({
                    'nct_id': nct_id,
                    'source_id': nct_id,
                    'title': title,
                    'description': summary or detailed,
                    'abstract': summary,
                    'conditions': conditions,
                    'interventions': interventions,
                    'sponsors': [sponsor_name] if sponsor_name else [],
                    'phase': ', '.join(phases) if phases else None,
                    'overall_status': overall_status,
                    'enrollment': enrollment,
                    'start_date': start_date,
                    'completion_date': completion_date,
                    'start_year': start_year,
                    'publication_year': start_year,
                    'url': f"https://clinicaltrials.gov/study/{nct_id}",
                    'structured_data': {
                        'study_type': design_mod.get('studyType', ''),
                        'phases': phases,
                        'enrollment': enrollment,
                        'overall_status': overall_status,
                        'eligibility_criteria': eligibility.get('eligibilityCriteria', ''),
                    },
                })
            except Exception as e:
                logger.warning(f"Failed to parse CT.gov study: {e}")
                continue

        logger.info(f"ClinicalTrials.gov v2 returned {len(results)} studies")
        return results

    def _parse_clinical_trials_response(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse ClinicalTrials.gov API response"""

        try:
            studies = data.get('StudyFieldsResponse', {}).get('StudyFields', [])
            parsed_studies = []

            for study in studies:
                try:
                    # Helper function to safely get field value
                    def get_field(field_name: str, index: int = 0) -> Optional[str]:
                        field_data = study.get(field_name, [])
                        if isinstance(field_data, list) and len(field_data) > index:
                            return field_data[index]
                        return None

                    parsed_study = {
                        'nct_id': get_field('NCTId'),
                        'brief_title': get_field('BriefTitle'),
                        'official_title': get_field('OfficialTitle'),
                        'brief_summary': get_field('BriefSummary'),
                        'detailed_description': get_field('DetailedDescription'),
                        'conditions': study.get('Condition', []),
                        'interventions': study.get('InterventionName', []),
                        'phase': get_field('Phase'),
                        'study_type': get_field('StudyType'),
                        'status': get_field('OverallStatus'),
                        'start_date': get_field('StartDate'),
                        'completion_date': get_field('CompletionDate'),
                        'primary_outcomes': study.get('PrimaryOutcomeMeasure', []),
                        'secondary_outcomes': study.get('SecondaryOutcomeMeasure', []),
                        'enrollment': get_field('EnrollmentCount'),
                        'gender': get_field('Gender'),
                        'min_age': get_field('MinimumAge'),
                        'max_age': get_field('MaximumAge'),
                        'sponsor': get_field('LeadSponsorName'),
                        'countries': study.get('LocationCountry', []),
                        'url': f"https://clinicaltrials.gov/ct2/show/{get_field('NCTId')}" if get_field('NCTId') else None,
                        'source': 'clinicaltrials.gov',
                        'extracted_at': datetime.utcnow().isoformat()
                    }

                    parsed_studies.append(parsed_study)

                except Exception as e:
                    logger.warning(f"Failed to parse clinical trial: {e}")
                    continue

            return parsed_studies

        except Exception as e:
            logger.error(f"Failed to parse ClinicalTrials.gov response: {e}")
            return []

    # FDA Integration

    async def search_fda_guidance(
        self,
        topic: str,
        document_type: Optional[str] = None,
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """Search FDA guidance documents"""

        await self._rate_limit_wait('fda')

        try:
            # FDA doesn't have a public API, so we'll scrape the guidance search
            search_params = {
                'search_term': topic,
                'sort_by': 'relevance'
            }

            if document_type:
                search_params['document_type'] = document_type

            async with aiohttp.ClientSession(timeout=self.session_timeout) as session:
                # Note: This is a simplified example. Real implementation would need
                # to handle FDA's actual search interface
                url = "https://www.fda.gov/regulatory-information/search-fda-guidance-documents"

                headers = {
                    'User-Agent': 'Afarensis-Enterprise-Research-Tool/1.0'
                }

                async with session.get(url, params=search_params, headers=headers) as response:
                    if response.status != 200:
                        logger.warning(f"FDA guidance search returned {response.status}")
                        return []

                    html_content = await response.text()
                    return self._parse_fda_guidance_html(html_content, max_results)

        except Exception as e:
            logger.error(f"FDA guidance search failed: {e}")
            return []

    def _parse_fda_guidance_html(self, html_content: str, max_results: int) -> List[Dict[str, Any]]:
        """Parse FDA guidance search results from HTML"""

        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            guidance_docs = []

            # Look for guidance document links (simplified parsing)
            for link in soup.find_all('a', href=True)[:max_results]:
                if 'guidance' in link['href'].lower():
                    guidance_docs.append({
                        'title': link.get_text(strip=True),
                        'url': link['href'] if link['href'].startswith('http') else f"https://www.fda.gov{link['href']}",
                        'source': 'fda_guidance',
                        'extracted_at': datetime.utcnow().isoformat()
                    })

            return guidance_docs[:max_results]

        except Exception as e:
            logger.error(f"Failed to parse FDA guidance HTML: {e}")
            return []

    # EMA Integration

    async def search_ema_documents(
        self,
        therapeutic_area: str,
        document_type: Optional[str] = None,
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """Search EMA documents and guidelines"""

        await self._rate_limit_wait('ema')

        try:
            # EMA document search
            search_params = {
                'query': therapeutic_area,
                'type': document_type or 'guideline',
                'size': min(max_results, 100)
            }

            async with aiohttp.ClientSession(timeout=self.session_timeout) as session:
                url = "https://www.ema.europa.eu/en/search/search"

                headers = {
                    'User-Agent': 'Afarensis-Enterprise-Research-Tool/1.0'
                }

                async with session.get(url, params=search_params, headers=headers) as response:
                    if response.status != 200:
                        logger.warning(f"EMA document search returned {response.status}")
                        return []

                    html_content = await response.text()
                    return self._parse_ema_documents_html(html_content, max_results)

        except Exception as e:
            logger.error(f"EMA document search failed: {e}")
            return []

    def _parse_ema_documents_html(self, html_content: str, max_results: int) -> List[Dict[str, Any]]:
        """Parse EMA document search results"""

        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            documents = []

            # Look for document links (simplified parsing)
            for item in soup.find_all(['div', 'article'], class_=re.compile('search-result'))[:max_results]:
                title_elem = item.find(['h3', 'h2', 'a'])
                link_elem = item.find('a', href=True)

                if title_elem and link_elem:
                    documents.append({
                        'title': title_elem.get_text(strip=True),
                        'url': link_elem['href'] if link_elem['href'].startswith('http') else f"https://www.ema.europa.eu{link_elem['href']}",
                        'source': 'ema',
                        'extracted_at': datetime.utcnow().isoformat()
                    })

            return documents[:max_results]

        except Exception as e:
            logger.error(f"Failed to parse EMA documents HTML: {e}")
            return []

    # OpenAlex Integration

    async def search_openalex(
        self,
        query: str,
        max_results: int = 50,
    ) -> List[Dict[str, Any]]:
        """Search OpenAlex for academic works. No API key required.

        OpenAlex API docs: https://docs.openalex.org/
        Rate limit: 10 req/sec for polite pool (with email in User-Agent)
        """
        await self._rate_limit_wait('openalex')

        try:
            params = {
                'search': query,
                'per_page': min(max_results, 200),
                'sort': 'relevance_score:desc',
                'filter': 'type:article',
            }

            headers = {
                'User-Agent': f'Afarensis-Enterprise/2.1 (mailto:{settings.PUBMED_EMAIL or "admin@afarensis.com"})',
            }

            url = "https://api.openalex.org/works"
            data = await self._fetch_with_retry(
                "openalex", "GET", url, params=params, headers=headers,
            )
            results = []

            for work in data.get('results', []):
                # Extract authors
                authors = []
                for authorship in work.get('authorships', [])[:10]:
                    author = authorship.get('author', {})
                    name = author.get('display_name', '')
                    if name:
                        authors.append(name)

                # Extract journal
                primary_location = work.get('primary_location', {}) or {}
                source = primary_location.get('source', {}) or {}
                journal = source.get('display_name', '')

                # Extract year
                pub_year = work.get('publication_year')

                # Extract DOI
                doi = work.get('doi', '') or ''
                if doi.startswith('https://doi.org/'):
                    doi = doi[16:]

                # Build structured data
                structured = {
                    'openalex_id': work.get('id', ''),
                    'doi': doi,
                    'cited_by_count': work.get('cited_by_count', 0),
                    'type': work.get('type', ''),
                    'open_access': work.get('open_access', {}).get('is_oa', False),
                    'concepts': [c.get('display_name', '') for c in work.get('concepts', [])[:5]],
                }

                results.append({
                    'source_id': work.get('id', '').split('/')[-1] if work.get('id') else '',
                    'title': work.get('title', '') or '',
                    'abstract': work.get('abstract', '') or work.get('abstract_inverted_index_to_text', '') or '',
                    'authors': authors,
                    'journal': journal,
                    'publication_year': pub_year,
                    'url': doi and f'https://doi.org/{doi}' or work.get('id', ''),
                    'structured_data': structured,
                })

            logger.info(f"OpenAlex returned {len(results)} results for: {query[:50]}")
            return results

        except Exception as e:
            logger.error(f"OpenAlex search failed: {e}")
            return []

    # Comprehensive search across all sources

    async def comprehensive_evidence_search(
        self,
        query: str,
        search_config: Dict[str, Any]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Search across all available evidence sources"""

        results = {
            'pubmed_articles': [],
            'clinical_trials': [],
            'fda_guidance': [],
            'ema_documents': []
        }

        # Create search tasks
        search_tasks = []

        # PubMed search
        if search_config.get('include_pubmed', True):
            pubmed_task = self.search_pubmed(
                query=query,
                max_results=search_config.get('pubmed_max_results', 50),
                publication_years=search_config.get('publication_years'),
                study_types=search_config.get('study_types')
            )
            search_tasks.append(('pubmed_articles', pubmed_task))

        # ClinicalTrials.gov search
        if search_config.get('include_clinical_trials', True):
            trials_task = self.search_clinical_trials(
                condition=query,
                intervention=search_config.get('intervention'),
                phase=search_config.get('phase'),
                status=search_config.get('trial_status'),
                max_results=search_config.get('trials_max_results', 50)
            )
            search_tasks.append(('clinical_trials', trials_task))

        # FDA guidance search
        if search_config.get('include_fda_guidance', True):
            fda_task = self.search_fda_guidance(
                topic=query,
                max_results=search_config.get('fda_max_results', 20)
            )
            search_tasks.append(('fda_guidance', fda_task))

        # EMA documents search
        if search_config.get('include_ema_documents', True):
            ema_task = self.search_ema_documents(
                therapeutic_area=query,
                max_results=search_config.get('ema_max_results', 20)
            )
            search_tasks.append(('ema_documents', ema_task))

        # Execute all searches concurrently
        if search_tasks:
            search_results = await asyncio.gather(
                *[task for _, task in search_tasks],
                return_exceptions=True
            )

            # Collect results
            for i, (result_key, _) in enumerate(search_tasks):
                if i < len(search_results) and not isinstance(search_results[i], Exception):
                    results[result_key] = search_results[i]
                else:
                    logger.warning(f"Search failed for {result_key}: {search_results[i] if i < len(search_results) else 'Unknown error'}")

        return results

    async def health_check(self) -> Dict[str, Any]:
        """Check connectivity to external APIs"""

        health_status = {}

        # Test PubMed
        try:
            test_params = {
                'db': 'pubmed',
                'term': 'cancer',
                'retmax': 1,
                'retmode': 'json'
            }
            if settings.PUBMED_API_KEY:
                test_params['api_key'] = settings.PUBMED_API_KEY

            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
                async with session.get(url, params=test_params) as response:
                    health_status['pubmed'] = {
                        'available': response.status == 200,
                        'status_code': response.status,
                        'api_key_configured': bool(settings.PUBMED_API_KEY)
                    }
        except Exception as e:
            health_status['pubmed'] = {'available': False, 'error': str(e)}

        # Test ClinicalTrials.gov
        try:
            test_params = {
                'expr': 'cancer',
                'min_rnk': 1,
                'max_rnk': 1,
                'fmt': 'json',
                'fields': 'NCTId'
            }

            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                url = "https://clinicaltrials.gov/api/query/study_fields"
                async with session.get(url, params=test_params) as response:
                    health_status['clinicaltrials'] = {
                        'available': response.status == 200,
                        'status_code': response.status
                    }
        except Exception as e:
            health_status['clinicaltrials'] = {'available': False, 'error': str(e)}

        # Test FDA (basic connectivity)
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                url = "https://www.fda.gov"
                async with session.get(url) as response:
                    health_status['fda'] = {
                        'available': response.status == 200,
                        'status_code': response.status,
                        'note': 'Basic connectivity test - no API'
                    }
        except Exception as e:
            health_status['fda'] = {'available': False, 'error': str(e)}

        return health_status


# Global instance
external_api_service = ExternalAPIService()
