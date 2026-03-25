"""
BioGPT Service — Microsoft's biomedical language model.

Runs locally via Hugging Face transformers (no API key needed).
Model: microsoft/biogpt (347M parameters, fits in ~1.5GB RAM).

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
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Lazy-load the model to avoid slow startup
_model = None
_tokenizer = None
_model_loading = False


def _load_model():
    """Load BioGPT model (lazy, first call only). ~1.5GB download on first run."""
    global _model, _tokenizer, _model_loading

    if _model is not None:
        return _model, _tokenizer

    if _model_loading:
        return None, None

    _model_loading = True
    try:
        from transformers import BioGptTokenizer, BioGptForCausalLM
        import torch

        logger.info("Loading BioGPT model (microsoft/biogpt)...")
        _tokenizer = BioGptTokenizer.from_pretrained("microsoft/biogpt")
        _model = BioGptForCausalLM.from_pretrained("microsoft/biogpt")

        # Use GPU if available, otherwise CPU
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = _model.to(device)
        _model.eval()

        logger.info(f"BioGPT loaded on {device} ({sum(p.numel() for p in _model.parameters()) / 1e6:.0f}M params)")
        return _model, _tokenizer
    except Exception as e:
        logger.warning(f"BioGPT model load failed: {e}. Biomedical generation will be unavailable.")
        _model_loading = False
        return None, None


class BioGPTService:
    """Biomedical text generation using Microsoft BioGPT."""

    def __init__(self):
        self._available = None

    @property
    def is_available(self) -> bool:
        """Check if BioGPT is loaded and ready."""
        if self._available is None:
            model, tokenizer = _load_model()
            self._available = model is not None
        return self._available

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

        Returns:
            Dict with 'text' (generated text), 'model', 'tokens_generated'.
        """
        model, tokenizer = _load_model()
        if model is None:
            return {
                "text": f"[BioGPT unavailable] {prompt}",
                "model": "biogpt-unavailable",
                "tokens_generated": 0,
                "error": "Model not loaded. Install: pip install transformers torch",
            }

        def _run():
            import torch
            device = next(model.parameters()).device

            inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=max_new_tokens,
                    temperature=max(temperature, 0.01),
                    top_p=top_p,
                    num_return_sequences=num_return_sequences,
                    do_sample=temperature > 0.01,
                    pad_token_id=tokenizer.eos_token_id,
                )

            generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
            tokens_gen = outputs.shape[1] - inputs["input_ids"].shape[1]
            return generated, tokens_gen

        loop = asyncio.get_event_loop()
        generated_text, tokens = await loop.run_in_executor(None, _run)

        return {
            "text": generated_text,
            "model": "microsoft/biogpt",
            "tokens_generated": tokens,
            "prompt_length": len(prompt),
        }

    async def summarize_clinical_evidence(
        self, title: str, abstract: str
    ) -> Dict[str, Any]:
        """Generate a biomedical summary of a clinical paper."""
        prompt = f"The study titled \"{title}\" found that {abstract[:300]}"
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
        model, tokenizer = _load_model()
        if model is None:
            return {
                "status": "unavailable",
                "model": "microsoft/biogpt",
                "error": "Model not loaded",
            }

        import torch
        device = str(next(model.parameters()).device)
        params = sum(p.numel() for p in model.parameters()) / 1e6
        return {
            "status": "ready",
            "model": "microsoft/biogpt",
            "parameters_millions": round(params),
            "device": device,
            "vocab_size": tokenizer.vocab_size,
        }


# Singleton
biogpt_service = BioGPTService()
