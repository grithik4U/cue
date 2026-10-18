# Cue

An open-source, local-first interview workspace inspired by the core workflow of Parakeet AI. This is an independent application, with original code and design. It is not affiliated with Parakeet AI.

**v0.1.0 — functional browser MVP. MIT-licensed application source.**

## What you can do

- Ask a typed question and stream an answer from your local Ollama model.
- Switch between talking points, full answer and your own notes.
- Choose concise, STAR or technical answer prompts.
- Paste CV and job text, or import a `.txt` / `.md` CV.
- Practise interview questions, write an answer and request local AI feedback.
- Capture your selected microphone and transcribe short recordings locally using faster-whisper.
- Explicitly save sessions in browser localStorage, reopen them and export Markdown.
- Use a clearly labelled, offline-compatible demo without installing an AI model.

The hosted page is a **demo**, not a hosted AI service. Its responses are illustrative templates, and its practice feedback is a checklist. To use real AI, run the source locally as below. No API key or subscription is required for the default setup.

## Start on macOS (including Apple Silicon), Linux or Windows

You need Python **3.10 or newer**; Python 3.11 is a sensible choice. Install [Python](https://www.python.org/downloads/) if your existing version is older. Install [Ollama](https://ollama.com/download), open it, and keep it running.

1. Extract `cue-source.zip` and open Terminal inside its `cue` folder.
2. Download the default model once:

   ```sh
   ollama pull qwen2.5:7b
   ```

3. On macOS or Linux:

   ```sh
   bash start.sh
   ```

4. Open **http://127.0.0.1:8000** in a recent Chrome, Edge, Safari or Firefox. The status changes to “Local AI connected” when Ollama has the configured model.

On Windows, use these commands in PowerShell instead of `bash start.sh`:

```powershell
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

For a manual macOS/Linux start:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Ollama's 7B model uses several GB of RAM. An M3 Mac with 16 GB is a reasonable target, but latency depends on memory pressure and context length; this release has not been benchmarked on your device. Close other memory-heavy applications if necessary. The first Whisper request downloads `base.en` from Hugging Face; let it finish. Later inference uses cached local models.

## A useful first session

1. Open **Your context**, paste a CV summary and job description, then choose **Apply context**.
2. Ask “Tell me about yourself” in the workspace.
3. Switch between **Talking points** and **Full answer**. The same response is displayed as paragraphs or a list; these are not two separate model calls.
4. Choose **Start listening**, grant microphone access and speak a question. After transcription appears in the composer, press **Get a cue** when the question is complete.
5. Use **Mock interview** to answer a practice question, then **Get feedback**.
6. Choose **Save session** to retain it in this browser, or **Export** to download Markdown.

## Configure your models

`.env.example` documents supported variables. It is not loaded automatically. Set them in your shell before starting:

```sh
export OLLAMA_MODEL=qwen2.5:1.5b
export WHISPER_MODEL=base.en
ollama pull qwen2.5:1.5b
bash start.sh
```

`qwen2.5:1.5b` is a smaller, less capable alternative. Set `WHISPER_MODEL=base` for multilingual transcription; the default `base.en` is English-only. Whisper uses CPU/int8 for portability; this does not use Apple Metal acceleration. Change `OLLAMA_URL` only if you intentionally want a different Ollama server. Model requests go to that configured server.

Settings reports the configured backend model when connected. Model weights are not bundled. Their licences apply separately: the default Qwen2.5 7B and the 1.5B alternative use Apache 2.0; faster-whisper uses MIT. The application MIT licence does not relicense dependencies or model weights.

## Architecture and API

The browser calls FastAPI on `127.0.0.1:8000`. FastAPI sends answer requests to Ollama on `127.0.0.1:11434` and audio requests to faster-whisper on CPU.

The frontend is dependency-free HTML, CSS and JavaScript. The backend is Python/FastAPI. No database or vendor SDK is needed.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Ollama reachability, configured model and speech-model state |
| `POST /api/answer` | Question, context, style and limited history → streamed NDJSON |
| `POST /api/question` | Category and context → one mock interview question |
| `POST /api/feedback` | Practice question and candidate answer → streamed review |
| `POST /api/transcribe` | Multipart `audio` below 15 MB → text and language |

Streaming responses contain `{"token":"..."}`, then `{"done":true}`. An inference failure produces `{"error":"..."}` rather than a fabricated answer. API schema: **http://127.0.0.1:8000/docs**.

Example:

```sh
curl -N http://127.0.0.1:8000/api/answer \
  -H 'Content-Type: application/json' \
  -d '{"question":"Explain an INNER JOIN","style":"technical","context":{"resume":"","job":"Data analyst","instructions":""}}'
```

## Privacy and persistence

- No analytics, remote fonts, accounts, paid APIs or browser speech-service dependencies.
- Raw audio is processed in memory; Cue does not write recordings or transcripts to its backend disk.
- Models and package caches are written to disk by their respective tools.
- CV/job context is kept in memory unless you opt in to remember it in this browser.
- Sessions are saved only when you choose **Save session**, up to the latest 50. Explicitly saved sessions contain transcript, suggestions and notes, but not the full CV/job context.
- Browser localStorage is not encrypted. Saved sessions and remembered context are separate. Clear each from its relevant view.
- Exported Markdown files contain the session text. You choose where those files are stored.
- The server binds to loopback and blocks unrelated browser origins/hostnames. It has no user authentication and is intended only for your own local machine. HTTPS public deployment needs a separate authenticated deployment design.
- Use transcription and AI assistance where participants and interview rules allow it.

## Scope of this release

- Microphone only: no automatic system-audio or Zoom/Teams integration.
- Speech is captured as independent ~3-second recordings and queued for transcription while the next chunk records. No speaker diarisation, word-level timing or reliable automatic question detection.
- You decide when to generate a cue after transcription. This avoids submitting an incomplete question on every short audio chunk.
- No PDF/DOCX parsing, screenshot analysis, screen reading, hidden overlay, desktop wrapper or screen-share exclusion.
- “Talking points” displays response paragraphs as a list; it is not a separate summarisation pass.
- Suggestions and feedback can be inaccurate. The prompt discourages invented experience, but you must verify what the model writes.
- Hosted deployment is a private static demo. Local inference runs only in the downloaded application.

## Troubleshooting

**Ollama is running but not connected:** run `ollama list` and check the model matches `OLLAMA_MODEL` exactly. Pull it, then click **Check connection**.

**Port 11434 is already in use:** Ollama may already be running. Do not start a second server; check `ollama list` first.

**Whisper takes time on first use:** the first request downloads a speech model. Watch the Terminal. Do not close the app before it completes. Internet access to the model provider is required at this step.

**Speech fails to install:** use a supported 64-bit Python 3.10–3.12 environment and update pip. PyAV normally includes FFmpeg libraries in its wheel; source builds or uncommon architectures may need platform dependencies. See [faster-whisper's official documentation](https://github.com/SYSTRAN/faster-whisper).

**No microphone:** use localhost, allow browser microphone access and select the correct input in your OS. The hosted demo deliberately does not record audio. Some browsers may not offer a supported recording format.

**Context appears unused:** select **Apply context** before requesting a new answer, and check you are in local mode. The demo never reads your CV to create personal claims.

## Development and verification

```sh
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q
node --check dist/app.js
node tests/frontend.test.cjs
```

API tests mock inference and transcription: they test request validation, streaming, upstream failures, audio limits and origin restrictions without downloading models. Frontend unit checks cover escaping, demo logic, session saving and the streaming parser; they are not browser layout tests. Real model speed, audio recognition quality and microphone permissions must be tested on the target device.

Dependencies have compatible version ranges rather than a frozen lockfile. Test your environment before making a distribution. No secrets are included.

## Source and contribution

`dist/` contains the UI; `backend/app.py` contains the API. `start.sh` runs the local app. This source can be modified, shared, published to your own Git repository or used commercially under MIT, subject to dependency/model licences. No public GitHub repository is created by this bundle.

Official references: [Ollama chat API](https://docs.ollama.com/api/chat), [Qwen2.5 model information](https://ollama.com/library/qwen2.5), [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
