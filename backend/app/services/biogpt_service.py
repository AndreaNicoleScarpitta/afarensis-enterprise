"""
BioGPT Service — Microsoft's biomedical language model via Hugging Face Inference API.

Uses the hosted Inference API so no local model download is required.
Model: microsoft/BioGPT-Large (or microsoft/biogpt as fallback).

Capabilities:
  - Biomedical text generation (clinical summaries, mechanism descriptions)
  - Entity extraction from clinical text
  - Literature-grounded question answering

Usage:
    from app.services.biogpt_service import biogpt_service

    result = await biogpt_service.generate(
        "Summarize the mechanism of action of OK-432 in treating cystic hygroma"
    )
"""

import logging
import asyncio
from typing import Optional, Dict, Any

import aiohttp

from app.core.config import settings

logger = logging.getLogger(__name__)

# Hugging Face Inference API endpoints
HF_INFERENCE_URL = "https://api-inference.huggingface.co/models/microsoft/BioGPT-Large"
HF_INFERENCE_URL_FALLBACK = "https://api-inference.huggingface.co/models/microsoft/biogpt"


class BioGPTService:
    """Biomedical text generation using Microsoft BioGPT via HuggingFace Inference API."""

    def __init__(self):
        self._available = None

    def _get_api_key(self) -> Optional[str]:
        """Get the HuggingFace API key from settings."""
        return settings.HUGGINGFACE_API_KEY

    @property
    def is_available(self) -> bool:
        """Check if the HuggingFace API key is configured."""
        if self._available is None:
            self._available = bool(self._get_api_key())
            if not self._available:
                logger.warning(
                    "HUGGINGFACE_API_KEY not set. BioGPT service will return fallback responses. "
                    "Set HUGGINGFACE_API_KEY in your environment or .env file."
                )
        return self._available

    async def _call_inference_api(
        self,
        prompt: str,
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        top_p: float = 0.9,
    ) -> Dict[str, Any]:
        """Call the HuggingFace Inference API for text generation.

        Tries BioGPT-Large first, then falls back to biogpt.
        """
        api_key = self._get_api_key()
        if not api_key:
            return {
                "text": f"[BioGPT unavailable] {prompt}",
                "model": "biogpt-unavailable",
                "tokens_generated": 0,
                "error": "HUGGINGFACE_API_KEY not configured. Set it in your .env file.",
            }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_new_tokens,
                "temperature": max(temperature, 0.01),
                "top_p": top_p,
                "do_sample": temperature > 0.01,
                "return_full_text": True,
            },
            "options": {
                "wait_for_model": True,
            },
        }

        timeout = aiohttp.ClientTimeout(total=120)

        # Try primary model, then fallback
        for url in [HF_INFERENCE_URL, HF_INFERENCE_URL_FALLBACK]:
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(url, json=payload, headers=headers) as response:
                        if response.status == 200:
                            result = await response.json()

                            # HF Inference API returns a list of generated texts
                            if isinstance(result, list) and len(result) > 0:
                                generated_text = result[0].get("generated_text", "")
                            elif isinstance(result, dict):
                                generated_text = result.get("generated_text", "")
                            else:
                                generated_text = str(result)

                            model_name = url.split("/")[-1]
                            tokens_est = max(
                                len(generated_text.split()) - len(prompt.split()), 0
                            )

                            return {
                                "text": generated_text,
                                "model": f"microsoft/{model_name}",
                                "tokens_generated": tokens_est,
                                "prompt_length": len(prompt),
                            }

                        elif response.status == 503:
                            # Model is loading, try the other endpoint
                            body = await response.json()
                            logger.info(
                                f"Model at {url} is loading: {body.get('error', 'loading')}. "
                                "Trying fallback..."
                            )
                            continue

                        else:
                            error_text = await response.text()
                            logger.warning(
                                f"HF Inference API returned {response.status} for {url}: {error_text}"
                            )
                            continue

            except asyncio.TimeoutError:
                logger.warning(f"HF Inference API timed out for {url}")
                continue
            except Exception as e:
                logger.warning(f"HF Inference API error for {url}: {e}")
                continue

        # Both endpoints failed
        return {
            "text": f"[BioGPT unavailable] {prompt}",
            "model": "biogpt-unavailable",
            "tokens_generated": 0,
            "error": "HuggingFace Inference API is temporarily unavailable. Please try again later.",
        }

    async def generate(
        self,
        prompt: str,
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        top_p: float = 0.9,
        num_return_sequences: int = 1,
    ) -> Dict[str, Any]:
        """Generate biomedical text from a prompt.

        Args:
            prompt: Input text (e.g., clinical question or partial sentence).
            max_new_tokens: Maximum tokens to generate.
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative).
            top_p: Nucleus sampling threshold.
            num_return_sequences: Number of sequences (currently only 1 supported via API).

        Returns:
            Dict with 'text' (generated text), 'model', 'tokens_generated'.
        """
        return await self._call_inference_api(
            prompt=prompt,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
        )

    async def summarize_clinical_evidence(
        self, title: str, abstract: str
    ) -> Dict[str, Any]:
        """Generate a biomedical summary of a clinical paper."""
        prompt = f'The study titled "{title}" found that {abstract[:300]}'
        result = await self.generate(prompt, max_new_tokens=200, temperature=0.5)
        return {
            "summary": result["text"],
            "model": result["model"],
        }

    async def explain_mechanism(self, drug: str, condition: str) -> Dict[str, Any]:
        """Explain the mechanism of action of a drug for a condition."""
        prompt = f"The mechanism of action of {drug} in treating {condition} involves"
        result = await self.generate(prompt, max_new_tokens=256, temperature=0.3)
        return {
            "explanation": result["text"],
            "model": result["model"],
        }

    async def extract_entities(self, text: str) -> Dict[str, Any]:
        """Extract biomedical entities (drugs, diseases, genes) from text.

        Uses BioGPT's language understanding to identify clinical terms.
        Returns structured extraction (best-effort, not a dedicated NER model).
        """
        prompt = f"Extract the key biomedical entities from: {text[:500]}. The entities are:"
        result = await self.generate(prompt, max_new_tokens=150, temperature=0.1)
        return {
            "raw_extraction": result["text"],
            "model": result["model"],
        }

    async def status(self) -> Dict[str, Any]:
        """Get BioGPT service status."""
        api_key = self._get_api_key()
        if not api_key:
            return {
                "status": "unavailable",
                "model": "microsoft/BioGPT-Large",
                "error": "HUGGINGFACE_API_KEY not configured",
                "backend": "huggingface_inference_api",
            }

        # Quick health check against the API
        headers = {
            "Authorization": f"Bearer {api_key}",
        }
        timeout = aiohttp.ClientTimeout(total=10)

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(HF_INFERENCE_URL, headers=headers) as response:
                    if response.status == 200:
                        return {
                            "status": "ready",
                            "model": "microsoft/BioGPT-Large",
                            "backend": "huggingface_inference_api",
                            "api_key_configured": True,
                        }
                    else:
                        body = await response.text()
                        return {
                            "status": "loading" if response.status == 503 else "error",
                            "model": "microsoft/BioGPT-Large",
                            "backend": "huggingface_inference_api",
                            "api_key_configured": True,
                            "http_status": response.status,
                            "detail": body[:200],
                        }
        except Exception as e:
            return {
                "status": "error",
                "model": "microsoft/BioGPT-Large",
                "backend": "huggingface_inference_api",
                "api_key_configured": True,
                "error": str(e),
            }


# Singleton
biogpt_service = BioGPTService()
