# Sidequest Build Log & Engineering Journal

*Project:* Sidequest — Offline, audio-first scavenger-hunt agent for families on walks  
*Challenge:* DEV "Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass"  
*Window:* October 5 – October 11, 2026  
*Hardware:* Laptop (Windows 11, Intel Core / NVIDIA GeForce RTX 5070 Laptop GPU), iPhone Client (Safari PWA)  

---

## Day 1 — October 6, 2026: Repo Init, Architecture Spike, Schemas & Guardrails

### 1. Architectural Decisions
- **Decision: Mode A (Host Hotspot + Phone Client) vs Mode B (Standalone Phone)**
  - *Context:* The challenge mandates that the screen must be the shortest part of the walk and inference must work completely offline with open-weight models.
  - *Option A:* Laptop with RTX 5070 in a backpack hosting the local server & model endpoint over an ad-hoc / local Wi-Fi hotspot (no internet access). Phone connects as client.
  - *Option B:* Full on-device inference directly inside iPhone Safari (e.g. WebLLM / ONNX Runtime Web).
  - *Evaluation / Spike:*
    - An open-weight multimodal vision model (e.g. Gemma 3 / PaliGemma 2 / LLaVA / MiniCPM) requires 2.5GB–5.5GB of quantized weights and substantial memory bandwidth.
    - Running VLMs in WebAssembly/WebGPU inside mobile Safari on iOS is prone to aggressive WebKit memory kills (often capping single tabs at 1.5–2GB RAM) and high battery drain/thermal throttling in outdoor sunlight.
    - The RTX 5070 Laptop GPU provides fast dedicated tensor cores, easily achieving sub-second to ~1.5s multimodal vision verification latency with zero thermal throttling on the phone.
    - *Verdict:* Default to **Mode A** for production field walks to guarantee rock-solid offline reliability, low walk latency, and uncompromised model accuracy. Mode B remains an experimental stretch branch.
- **Audio Pipeline Decision:**
  - Phone client utilizes iOS Safari's native offline Web Speech API synthesis (`SpeechSynthesisUtterance`) with high-fidelity system voices, requiring 0kb network transfer and 0ms server latency. Fallback host-side Piper TTS endpoint provided for headless or browser-agnostic playback.
- **Agent Orchestration:**
  - TypeScript end-to-end. Mastra agent framework orchestrating tools: `generate_quest`, `verify_find`, `narrate`, `save_journal`.
  - Local model runtime: Ollama / llama.cpp OpenAI-compatible local API on `http://127.0.0.1:11434/v1`.

### 2. Safety Guardrails Definition
- Sidequest strictly forbids prompts encouraging:
  1. Ingestion or handling of unknown plants, mushrooms, or fungi.
  2. Approaching, cornering, or touching live wild animals.
  3. Climbing trees, fences, cliffs, or unstable terrain.
  4. Entering bodies of water (rivers, lakes, retention ponds) or walking into active traffic/roadways.
- Enforced via:
  - System prompt constraints with negative prompt boundaries.
  - Strict Zod schema verification for item safety classifications (`sensory_look`, `sensory_listen`, `touch_safe_bark_or_rock`, `count_compare`).
  - Automated Jest/Vitest unit tests asserting reject behavior on unsafe quest proposals.

### 3. Network Isolation Contract
- To strictly adhere to the offline rule, core walk loop must run with 0 WAN traffic.
- Added an automated network isolation test verifying zero outbound DNS/HTTP requests escape localhost.
- Implemented `enableOfflineIsolation()` monkey-patching Node.js `http`, `https`, and `globalThis.fetch` to reject any external destination outside localhost or local hotspot IP ranges.

### 4. Hardware Baseline & Measurements (Day 1 Spike)
- **Host System:** Windows 11 Laptop
- **GPU:** NVIDIA GeForce RTX 5070 Laptop GPU (12,231 MiB / 12 GB Dedicated VRAM)
- **Driver & CUDA:** NVIDIA Driver 592.15, CUDA Version 13.1
- **Local Inference Engine:** Ollama v0.35.1 running `llama-server` natively on CUDA
- **Model Baseline:**
  - Primary: `gemma3:4b` (Google DeepMind open weights, 2.9 GB VRAM allocated, 100% GPU offload)
  - Secondary (for eval benchmark): `gemma3:1b` (815 MB download, ~1.2 GB VRAM)
- **Cold-Start VRAM Allocation:**
  - Initial shader compilation and context reservation: ~114s one-time cold load.
  - Subsequent token generation: ~1.2s to 1.8s per response on GPU.
- **Node.js Environment:** v24.19.0 (with pure WASM SQLite `sql.js` to ensure 100% reproducible cross-platform builds without Visual Studio MSVC native compiler dependencies).

### 5. Dead Ends & Engineering Adaptations
1. **`better-sqlite3` native rebuild error on Node 24:**
   - *Problem:* Node.js 24 does not yet have prebuilt binaries for `better-sqlite3` on Windows, causing `npm install` to invoke `node-gyp` which fails without full Visual Studio C++ build tools installed.
   - *Resolution:* Switched to `sql.js` (WebAssembly-compiled SQLite). It runs 100% in JavaScript/WASM with file persistence, eliminating build-tool friction and keeping setup under 10 minutes.
2. **Schema Variation in 4B Model Generation:**
   - *Problem:* When requesting structured JSON, open-weight 4B models occasionally emit semantic synonyms (`task` vs `title`, `description` vs `promptText`, or omit optional metadata on first pass).
   - *Resolution:* Engineered a defensive normalizer `normalizeRawJson()` that intercepts and reconciles field synonyms before Zod validation, backed by an automated retry loop that prompts the model with the exact failure diff. Result: 100% schema compliance.

### 6. Test Suite Status
- Total Tests: 16 passing across 4 test suites:
  - `tests/guardrails.test.ts` (6 tests: passes safe nature prompts, strictly rejects ingestion, mushroom touching, wildlife contact, climbing, water hazard)
  - `tests/quest_schema.test.ts` (4 tests: Zod parsing, min/max item counts, boundary validation)
  - `tests/offline_isolation.test.ts` (3 tests: passes localhost, blocks outbound OpenAI, blocks external telemetry)
  - `tests/end_to_end.test.ts` (3 tests: SQLite session persistence, verified finds with honesty flags, HTML field journal export with screen-to-sky ratio)
