import importlib
import io
import json
import wave

import httpx
import pytest
from fastapi.testclient import TestClient

backend = importlib.import_module("backend.app")


@pytest.fixture
def client():
    return TestClient(backend.app)


def upstream(monkeypatch, handler):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(backend.httpx, "AsyncClient", lambda **kw: original(transport=transport, **kw))


def test_app_and_assets_served(client):
    assert client.get("/").status_code == 200
    assert "Your interview, in focus" in client.get("/").text
    assert client.get("/app.js").status_code == 200
    assert client.get("/styles.css").headers["x-content-type-options"] == "nosniff"


def test_health_with_available_model(client, monkeypatch):
    upstream(monkeypatch, lambda r: httpx.Response(200, json={"models": [{"name": backend.MODEL}]}))
    data = client.get("/api/health").json()
    assert data["model_ready"] is True
    assert data["whisper_loaded"] is False


def test_health_with_missing_model(client, monkeypatch):
    upstream(monkeypatch, lambda r: httpx.Response(200, json={"models": []}))
    data = client.get("/api/health").json()
    assert data["ollama"] is True
    assert data["model_ready"] is False


def test_offline_ollama_does_not_fake_answer(client, monkeypatch):
    def offline(request):
        raise httpx.ConnectError("offline", request=request)
    upstream(monkeypatch, offline)
    assert client.get("/api/health").json()["status"] == "degraded"
    events = [json.loads(x) for x in client.post("/api/answer", json={"question": "Why?"}).text.splitlines()]
    assert "error" in events[0]
    assert not any("token" in x for x in events)


@pytest.mark.parametrize("path,body", [
    ("answer", {"question": "Explain SQL", "context": {"resume": "I built a SQL report"}, "style": "technical"}),
    ("feedback", {"question": "Explain SQL", "answer": "I checked joins and types."}),
    ("question", {"category": "Technical"}),
])
def test_streamed_endpoints(client, monkeypatch, path, body):
    captured = []
    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, content='{"message":{"content":"Hello "}}\n{"message":{"content":"world"},"done":true}\n')
    upstream(monkeypatch, handler)
    response = client.post("/api/" + path, json=body)
    assert response.status_code == 200
    events = [json.loads(line) for line in response.text.splitlines()]
    assert "".join(e.get("token", "") for e in events) == "Hello world"
    assert events[-1] == {"done": True}
    assert captured[0]["stream"] is True
    assert captured[0]["messages"][0]["role"] == "system"
    assert "Never invent" in captured[0]["messages"][0]["content"]


def test_missing_model_upstream_is_explained(client, monkeypatch):
    upstream(monkeypatch, lambda r: httpx.Response(404, json={"error": "model unavailable"}))
    events = [json.loads(x) for x in client.post("/api/answer", json={"question": "Hello"}).text.splitlines()]
    assert "ollama pull" in events[0]["error"]


@pytest.mark.parametrize("body", [{"question": ""}, {"question": "a" * 6001}, {"question": "OK", "style": "fake"}])
def test_invalid_answer_input(client, body):
    assert client.post("/api/answer", json=body).status_code == 422


def test_audio_validation_and_transcription(client, monkeypatch):
    monkeypatch.setattr(backend, "transcribe_bytes", lambda data: {"text": "Explain risk", "language": "en"})
    assert client.post("/api/transcribe", files={"audio": ("a.txt", b"abc", "text/plain")}).status_code == 415
    assert client.post("/api/transcribe", files={"audio": ("a.webm", b"", "audio/webm")}).status_code == 413
    response = client.post("/api/transcribe", files={"audio": ("a.webm", b"audio fixture", "audio/webm")})
    assert response.json() == {"text": "Explain risk", "language": "en"}


def test_faster_whisper_can_decode_audio_with_installed_pyav():
    """Catch dependency combinations that fail before Whisper sees the audio."""
    from faster_whisper.audio import decode_audio

    audio = io.BytesIO()
    with wave.open(audio, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(bytes(32000))

    decoded = decode_audio(io.BytesIO(audio.getvalue()))
    assert decoded.shape == (16000,)


def test_transcription_uses_low_latency_settings(monkeypatch):
    options = {}

    class WhisperDouble:
        def transcribe(self, audio, **kwargs):
            options.update(kwargs)
            return [], type("Info", (), {"language": "en"})()

    monkeypatch.setattr(backend, "_whisper", WhisperDouble())
    assert backend.transcribe_bytes(b"audio") == {"text": "", "language": "en"}
    assert options == {
        "beam_size": 1,
        "vad_filter": True,
        "condition_on_previous_text": False,
        "without_timestamps": True,
    }


def test_oversized_audio_rejected(client):
    response = client.post("/api/transcribe", files={"audio": ("large.webm", b"a" * (15 * 1024 * 1024 + 1), "audio/webm")})
    assert response.status_code == 413


def test_transcription_failure_returns_useful_error(client, monkeypatch):
    def fail(data):
        raise ValueError("bad audio")
    monkeypatch.setattr(backend, "transcribe_bytes", fail)
    response = client.post("/api/transcribe", files={"audio": ("a.webm", b"bad", "audio/webm")})
    assert response.status_code == 503
    assert "Transcription unavailable" in response.json()["detail"]


def test_cross_site_and_untrusted_host_are_blocked(client):
    body = {"question": "Explain SQL"}
    assert client.post("/api/answer", json=body, headers={"Origin": "https://unrelated.example"}).status_code == 403
    assert client.get("/api/health", headers={"Host": "unrelated.example"}).status_code == 403


def test_context_length_bound(client):
    assert client.post("/api/answer", json={"question": "Hello", "context": {"resume": "a" * 20001}}).status_code == 422
