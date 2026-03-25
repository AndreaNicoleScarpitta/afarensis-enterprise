"""
Real LLM Integration Service for Afarensis Enterprise
Connects to Claude, OpenAI, and other LLM providers with actual API calls
"""

import os
import asyncio
import logging
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

import httpx
import anthropic
import openai
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import ProcessingError, ValidationError

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Supported LLM providers"""
    CLAUDE = "claude"
    OPENAI = "openai"
    GEMINI = "gemini"


@dataclass
class LLMResponse:
    """Standardized LLM response format"""
    content: str
    provider: str
    model: str
    tokens_used: int
    confidence: float
    processing_time_ms: int
    metadata: Dict[str, Any]


class LLMServiceIntegration:
    """Real LLM integration service with multiple provider support"""
    
    def __init__(self):
        self.setup_clients()
        self.fallback_order = [LLMProvider.CLAUDE, LLMProvider.OPENAI, LLMProvider.GEMINI]
    
    def setup_clients(self):
        """Initialize LLM API clients"""
        # Claude/Anthropic
        self.claude_client = None
        if settings.ANTHROPIC_API_KEY:
            try:
                self.claude_client = anthropic.AsyncAnthropic(
                    api_key=settings.ANTHROPIC_API_KEY
                )
                logger.info("[OK] Claude client initialized")
            except Exception as e:
                logger.warning(f"Claude client setup failed: {e}")
        
        # OpenAI
        self.openai_client = None
        if settings.OPENAI_API_KEY:
            try:
                self.openai_client = AsyncOpenAI(
                    api_key=settings.OPENAI_API_KEY
                )
                logger.info("[OK] OpenAI client initialized")
            except Exception as e:
                logger.warning(f"OpenAI client setup failed: {e}")
        
        # Google Gemini
        self.gemini_client = None
        if settings.GOOGLE_AI_API_KEY:
            try:
                # Initialize Gemini client (would use google-generativeai)
                logger.info("[OK] Gemini client would be initialized here")
            except Exception as e:
                logger.warning(f"Gemini client setup failed: {e}")
    
    async def call_claude(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None,
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> LLMResponse:
        """Call Claude API"""
        if not self.claude_client:
            raise ProcessingError("Claude client not available")
        
        start_time = datetime.now()
        
        try:
            messages = [{"role": "user", "content": prompt}]
            
            response = await self.claude_client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt or "You are an expert in clinical evidence review and regulatory affairs.",
                messages=messages
            )
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return LLMResponse(
                content=response.content[0].text,
                provider="claude",
                model=model,
                tokens_used=response.usage.input_tokens + response.usage.output_tokens,
                confidence=0.95,  # Claude generally high confidence
                processing_time_ms=int(processing_time),
                metadata={
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "stop_reason": response.stop_reason
                }
            )
            
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            raise ProcessingError(f"Claude API error: {str(e)}")
    
    async def call_openai(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: str = "gpt-4-turbo-preview",
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> LLMResponse:
        """Call OpenAI API"""
        if not self.openai_client:
            raise ProcessingError("OpenAI client not available")
        
        start_time = datetime.now()
        
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            response = await self.openai_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return LLMResponse(
                content=response.choices[0].message.content,
                provider="openai",
                model=model,
                tokens_used=response.usage.total_tokens,
                confidence=0.90,  # Generally high confidence
                processing_time_ms=int(processing_time),
                metadata={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "finish_reason": response.choices[0].finish_reason
                }
            )
            
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            raise ProcessingError(f"OpenAI API error: {str(e)}")
    
    async def call_llm_with_fallback(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        task_type: str = "general",
        **kwargs
    ) -> LLMResponse:
        """Call LLM with automatic fallback to available providers"""
        
        # Choose optimal provider based on task type
        preferred_provider = self._get_preferred_provider(task_type)
        providers_to_try = [preferred_provider] + [p for p in self.fallback_order if p != preferred_provider]
        
        last_error = None
        
        for provider in providers_to_try:
            try:
                if provider == LLMProvider.CLAUDE and self.claude_client:
                    return await self.call_claude(prompt, system_prompt, **kwargs)
                elif provider == LLMProvider.OPENAI and self.openai_client:
                    return await self.call_openai(prompt, system_prompt, **kwargs)
                # Add Gemini support here when available
                
            except Exception as e:
                last_error = e
                logger.warning(f"{provider.value} failed, trying next provider: {e}")
                continue
        
        # All providers failed
        raise ProcessingError(f"All LLM providers failed. Last error: {last_error}")
    
    def _get_preferred_provider(self, task_type: str) -> LLMProvider:
        """Choose optimal provider based on task type"""
        task_preferences = {
            "bias_analysis": LLMProvider.CLAUDE,  # Claude excels at analysis
            "evidence_extraction": LLMProvider.CLAUDE,  # Good with structured data
            "regulatory_review": LLMProvider.CLAUDE,  # Strong reasoning
            "document_generation": LLMProvider.OPENAI,  # Good at generation
            "translation": LLMProvider.OPENAI,  # Strong multilingual
            "summarization": LLMProvider.CLAUDE,  # Excellent summarization
            "code_generation": LLMProvider.OPENAI,  # Strong coding
        }
        
        return task_preferences.get(task_type, LLMProvider.CLAUDE)

    # Specialized methods for Afarensis tasks
    
    async def analyze_bias_comprehensive(
        self,
        evidence_text: str,
        methodology: Dict[str, Any],
        results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Comprehensive bias analysis using LLM"""
        
        prompt = f"""
        Analyze the following clinical study for potential biases. Provide a comprehensive assessment across all major bias categories.

        STUDY TEXT:
        {evidence_text}

        METHODOLOGY:
        {json.dumps(methodology, indent=2)}

        RESULTS:
        {json.dumps(results, indent=2)}

        Please analyze for the following bias types and provide your assessment in JSON format:

        1. SELECTION BIAS: Patient selection, enrollment bias, differential dropout
        2. SURVIVORSHIP BIAS: Missing failed outcomes, time-to-event truncation
        3. PUBLICATION BIAS: Selective reporting, positive result emphasis
        4. REPORTING BIAS: Outcome switching, selective endpoint reporting
        5. MEASUREMENT BIAS: Assessment bias, observer bias, recall bias
        6. CONFIRMATION BIAS: Cherry-picking data, hypothesis-driven analysis
        7. CONFOUNDING: Unmeasured confounders, inadequate adjustment
        8. INFORMATION BIAS: Misclassification, recall bias
        9. TEMPORAL BIAS: Immortal time bias, time-varying confounding
        10. REGULATORY RISK: Factors that may affect regulatory acceptance

        For each bias type, provide:
        - present: boolean (is this bias detected)
        - severity: float (0.0-1.0, severity if present)
        - confidence: float (0.0-1.0, confidence in assessment)
        - evidence: list of specific text/data supporting the assessment
        - impact: string description of potential impact on study validity
        - mitigation: list of suggested strategies to address the bias

        Return only valid JSON.
        """
        
        system_prompt = """You are an expert clinical epidemiologist and biostatistician with deep expertise in bias detection for regulatory submissions. Provide thorough, evidence-based bias assessments that regulatory agencies would find credible."""
        
        response = await self.call_llm_with_fallback(
            prompt=prompt,
            system_prompt=system_prompt,
            task_type="bias_analysis",
            max_tokens=4000
        )
        
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("LLM returned invalid JSON, attempting to extract")
            return self._extract_json_from_text(response.content)
    
    async def extract_evidence_structured(
        self,
        document_text: str,
        document_type: str = "research_paper"
    ) -> Dict[str, Any]:
        """Extract structured evidence from clinical documents"""
        
        prompt = f"""
        Extract key information from this clinical document and structure it for regulatory evidence review.

        DOCUMENT TYPE: {document_type}
        DOCUMENT TEXT:
        {document_text}

        Extract the following information in JSON format:

        {{
            "study_design": {{
                "type": "string (RCT, observational, meta-analysis, etc.)",
                "phase": "string (if applicable)",
                "duration_months": "number",
                "multicenter": "boolean",
                "blinding": "string (open, single, double, etc.)"
            }},
            "population": {{
                "total_n": "number",
                "age_mean": "number",
                "age_range": "string",
                "gender_distribution": {{"female": "number (proportion)", "male": "number"}},
                "inclusion_criteria": ["list of key criteria"],
                "exclusion_criteria": ["list of key criteria"],
                "baseline_characteristics": {{"key": "value"}}
            }},
            "interventions": [
                {{
                    "name": "string",
                    "type": "string (drug, device, procedure, etc.)",
                    "dosing": "string",
                    "duration": "string",
                    "control_group": "boolean"
                }}
            ],
            "primary_endpoints": [
                {{
                    "endpoint": "string",
                    "type": "string (efficacy, safety, etc.)",
                    "measurement_time": "string",
                    "clinical_significance": "boolean"
                }}
            ],
            "key_results": {{
                "primary_endpoint_met": "boolean",
                "statistical_significance": "boolean",
                "clinical_significance": "boolean",
                "effect_size": "number or string",
                "confidence_interval": "string",
                "p_value": "number",
                "safety_profile": "string summary"
            }},
            "regulatory_context": {{
                "indication": "string",
                "target_population": "string",
                "comparator": "string",
                "regulatory_pathway": "string (if mentioned)",
                "precedent_studies": ["list if mentioned"]
            }},
            "quality_metrics": {{
                "sample_size_adequate": "boolean",
                "randomization_adequate": "boolean", 
                "blinding_adequate": "boolean",
                "dropout_rate": "number (proportion)",
                "protocol_deviations": "boolean (significant deviations noted)",
                "statistical_plan_appropriate": "boolean"
            }},
            "confidence_scores": {{
                "overall_extraction_confidence": "number (0.0-1.0)",
                "study_quality_score": "number (0.0-1.0)",
                "regulatory_relevance": "number (0.0-1.0)"
            }}
        }}

        Return only valid JSON. If information is not available, use null for that field.
        """
        
        system_prompt = """You are an expert clinical research analyst specializing in evidence extraction for regulatory submissions. Extract information accurately and completely, noting confidence levels for each extraction."""
        
        response = await self.call_llm_with_fallback(
            prompt=prompt,
            system_prompt=system_prompt,
            task_type="evidence_extraction",
            max_tokens=4000
        )
        
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            return self._extract_json_from_text(response.content)
    
    async def generate_regulatory_critique(
        self,
        evidence_package: Dict[str, Any],
        submission_context: Dict[str, Any]
    ) -> str:
        """Generate regulatory critique and recommendations"""
        
        prompt = f"""
        As a senior regulatory affairs expert, provide a comprehensive critique of this evidence package for regulatory submission.

        EVIDENCE PACKAGE:
        {json.dumps(evidence_package, indent=2)}

        SUBMISSION CONTEXT:
        {json.dumps(submission_context, indent=2)}

        Provide a detailed regulatory critique covering:

        1. EVIDENCE STRENGTH ASSESSMENT
        - Quality and quantity of evidence
        - Study design appropriateness
        - Statistical power and significance
        - Clinical meaningfulness of results

        2. BIAS AND VALIDITY CONCERNS
        - Key biases identified and their impact
        - Internal and external validity
        - Generalizability to target population
        - Risk of regulatory rejection due to bias

        3. REGULATORY PATHWAY ASSESSMENT
        - Appropriateness of chosen pathway
        - Precedent analysis and regulatory history
        - Likelihood of approval based on evidence
        - Potential regulatory questions or concerns

        4. EVIDENCE GAPS AND RECOMMENDATIONS
        - Critical gaps in the evidence package
        - Additional studies or analyses needed
        - Risk mitigation strategies
        - Timeline and resource implications

        5. STRATEGIC RECOMMENDATIONS
        - Optimal submission timing
        - Pre-submission meeting strategy
        - Response to anticipated regulatory questions
        - Alternative pathways if primary fails

        Structure as a professional regulatory assessment memo with clear recommendations.
        """
        
        system_prompt = """You are a senior regulatory affairs consultant with 20+ years of experience in FDA and EMA submissions. Provide thorough, actionable regulatory guidance that regulatory teams would find valuable."""
        
        response = await self.call_llm_with_fallback(
            prompt=prompt,
            system_prompt=system_prompt,
            task_type="regulatory_review",
            max_tokens=4000
        )
        
        return response.content
    
    async def calculate_comparability_scores(
        self,
        target_study: Dict[str, Any],
        reference_studies: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Calculate detailed comparability scores between studies"""
        
        comparability_results = []
        
        for ref_study in reference_studies:
            prompt = f"""
            Calculate detailed comparability scores between these two clinical studies for regulatory evidence review.

            TARGET STUDY:
            {json.dumps(target_study, indent=2)}

            REFERENCE STUDY:
            {json.dumps(ref_study, indent=2)}

            Calculate comparability across these dimensions (0.0 = not comparable, 1.0 = perfectly comparable):

            1. POPULATION_SIMILARITY: Demographics, inclusion/exclusion criteria, baseline characteristics
            2. ENDPOINT_ALIGNMENT: Primary/secondary endpoints, measurement methods, timing
            3. INTERVENTION_COMPARABILITY: Drug/device similarity, dosing, administration
            4. STUDY_DESIGN_ALIGNMENT: Design type, blinding, randomization, duration
            5. STATISTICAL_COMPARABILITY: Power, analysis methods, handling of missing data
            6. REGULATORY_CONTEXT: Indication, pathway, historical precedent

            For each dimension, provide:
            - score: float (0.0-1.0)
            - rationale: string explaining the score
            - key_differences: list of important differences
            - regulatory_impact: assessment of how differences affect regulatory use

            Also provide:
            - overall_comparability: weighted average score
            - regulatory_viability: assessment for regulatory use (high/medium/low)
            - recommendations: how to address comparability gaps

            Return as JSON.
            """
            
            system_prompt = """You are a expert biostatistician and regulatory scientist specializing in comparative effectiveness research. Provide precise, defensible comparability assessments."""
            
            response = await self.call_llm_with_fallback(
                prompt=prompt,
                system_prompt=system_prompt,
                task_type="regulatory_review",
                max_tokens=3000
            )
            
            try:
                result = json.loads(response.content)
                result['reference_study_id'] = ref_study.get('id', 'unknown')
                comparability_results.append(result)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse comparability analysis for study {ref_study.get('id')}")
                continue
        
        return comparability_results
    
    def _extract_json_from_text(self, text: str) -> Dict[str, Any]:
        """Extract JSON from LLM text response that might have extra content"""
        try:
            # Try to find JSON in the text
            start_idx = text.find('{')
            end_idx = text.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_text = text[start_idx:end_idx]
                return json.loads(json_text)
            else:
                logger.warning("No valid JSON found in LLM response")
                return {"error": "Could not extract valid JSON", "raw_response": text}
                
        except Exception as e:
            logger.error(f"Failed to extract JSON: {e}")
            return {"error": str(e), "raw_response": text}
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all LLM providers"""
        health_status = {}
        
        # Test Claude
        if self.claude_client:
            try:
                test_response = await self.call_claude("Hello", max_tokens=10)
                health_status['claude'] = {
                    "available": True,
                    "response_time_ms": test_response.processing_time_ms,
                    "model": test_response.model
                }
            except Exception as e:
                health_status['claude'] = {"available": False, "error": str(e)}
        else:
            health_status['claude'] = {"available": False, "error": "Client not initialized"}
        
        # Test OpenAI
        if self.openai_client:
            try:
                test_response = await self.call_openai("Hello", max_tokens=10)
                health_status['openai'] = {
                    "available": True, 
                    "response_time_ms": test_response.processing_time_ms,
                    "model": test_response.model
                }
            except Exception as e:
                health_status['openai'] = {"available": False, "error": str(e)}
        else:
            health_status['openai'] = {"available": False, "error": "Client not initialized"}
        
        return health_status


# Global instance
llm_service = LLMServiceIntegration()
