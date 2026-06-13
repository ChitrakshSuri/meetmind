import pytest
from unittest.mock import AsyncMock, patch


async def test_generate_voice_summary_returns_mp3_path():
    from app.tools.voice_output import generate_voice_summary

    async def _fake_convert(**kwargs):
        yield b"fake-audio-data"

    mock_client = AsyncMock()
    mock_client.text_to_speech.convert = _fake_convert

    with (
        patch("app.tools.voice_output.AsyncElevenLabs", return_value=mock_client),
        patch("app.tools.voice_output.settings") as mock_settings,
        patch("app.tools.voice_output.asyncio.to_thread", new=AsyncMock(return_value=None)),
    ):
        mock_settings.elevenlabs_api_key = "fake-key"
        mock_settings.elevenlabs_voice_id = "fake-voice-id"

        result = await generate_voice_summary("The team discussed the sprint.")

    assert result.startswith("/tmp/summary_")
    assert result.endswith(".mp3")


async def test_generate_voice_summary_returns_empty_when_no_key():
    from app.tools.voice_output import generate_voice_summary

    with patch("app.tools.voice_output.settings") as mock_settings:
        mock_settings.elevenlabs_api_key = ""

        result = await generate_voice_summary("Some summary text.")

    assert result == ""
