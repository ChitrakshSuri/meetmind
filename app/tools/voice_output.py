import asyncio
import logging
import uuid
from elevenlabs import AsyncElevenLabs
from app.config import settings

logger = logging.getLogger(__name__)


async def generate_voice_summary(text: str) -> str:
    if not settings.elevenlabs_api_key:
        logger.warning("ELEVENLABS_API_KEY not set — skipping voice summary")
        return ""

    try:
        client = AsyncElevenLabs(api_key=settings.elevenlabs_api_key)
        chunks: list[bytes] = []
        async for chunk in client.text_to_speech.convert(
            voice_id=settings.elevenlabs_voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        ):
            chunks.append(chunk)

        audio_bytes = b"".join(chunks)
        path = f"/tmp/summary_{uuid.uuid4().hex}.mp3"
        await asyncio.to_thread(_write_bytes, path, audio_bytes)
        logger.info(f"Voice summary saved to {path}")
        return path
    except Exception as e:
        logger.error(f"Failed to generate voice summary: {e}")
        return ""


def _write_bytes(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)
