"""Progress-photo AI impressions: a single, narrowly-scoped local vision-model
call per photo, asking only for general posture/build observations -- never a
diagnosis, never anything outside that scope. Same resilience philosophy as
coach.py's narrate(): if Ollama isn't installed/running, the model isn't
pulled, or the call times out, the photo still saves fine with no AI note.
The app must never break or hang because local AI isn't available.

Note: vision models are considerably heavier than the text model used
elsewhere in this app. On modest hardware (no GPU, <16GB RAM) this may be
too slow to be practical -- the timeout below is intentionally generous but
finite, and the caller always has a null-note fallback path.
"""

import base64

import httpx

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_VISION_MODEL = "llava"
OLLAMA_VISION_TIMEOUT_S = 20.0

PROMPT = (
    "You are a fitness coach's assistant looking at a physique progress photo. "
    "In 1-2 short, encouraging sentences, comment ONLY on general build/posture "
    "observations relevant to strength training -- for example, shoulder "
    "position, apparent posture, or overall physique trend if a comparison "
    "isn't possible from a single image. "
    "Do NOT diagnose any medical condition, do NOT comment on body fat percentage "
    "or attractiveness, do NOT mention anything other than general training-relevant "
    "posture/build observations. If the image doesn't clearly show a person, say "
    "you can't offer an observation. Keep it brief, plain text, no markdown."
)


def generate_impression(image_bytes: bytes) -> str | None:
    """Returns a short qualitative note, or None if unavailable for any reason
    (Ollama not running, model not pulled, timeout, unexpected response)."""
    try:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        resp = httpx.post(
            OLLAMA_URL,
            json={"model": OLLAMA_VISION_MODEL, "prompt": PROMPT, "images": [encoded], "stream": False},
            timeout=OLLAMA_VISION_TIMEOUT_S,
        )
        resp.raise_for_status()
        text = resp.json().get("response", "").strip()
        return text or None
    except (httpx.HTTPError, ValueError, KeyError):
        return None
