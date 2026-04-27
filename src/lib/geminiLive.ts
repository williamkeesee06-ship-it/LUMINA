/**
 * LUMINA — Gemini Live API client.
 *
 * Real-time bidirectional voice with Gemini's native-audio model. Browser opens
 * WSS directly using a short-lived ephemeral token issued by /api/lumina-live-token.
 *
 * Audio I/O:
 *   - Capture mic at 16kHz mono PCM16 (a dedicated AudioContext at sampleRate=16000)
 *   - Stream to Gemini as base64 PCM in `realtimeInput.audio`
 *   - Receive base64 PCM 24kHz from Gemini, queue + play through a 24kHz AudioContext
 *
 * Two AudioContexts are required because the Web Audio API resamples on output;
 * mixing a 24kHz buffer through a 48kHz context plays it ~2x sped up ("chipmunk").
 */

export type LuminaLiveStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "thinking"
  | "error"
  | "closed";

export interface LuminaLiveCallbacks {
  onStatus?: (status: LuminaLiveStatus) => void;
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  onModelTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

interface TokenResponse {
  name: string;
  expireTime: string;
  model: string;
}

const ENDPOINT_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const FRAME_SIZE = 2048; // ~128ms at 16kHz — good real-time tradeoff

export class LuminaLiveSession {
  private ws: WebSocket | null = null;
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private playbackQueue: AudioBufferSourceNode[] = [];
  private nextPlaybackTime = 0;
  private setupSent = false;
  private cb: LuminaLiveCallbacks;
  private inputTranscriptBuffer = "";
  private outputTranscriptBuffer = "";
  private modelSpeaking = false;

  constructor(callbacks: LuminaLiveCallbacks = {}) {
    this.cb = callbacks;
  }

  async start(): Promise<void> {
    this.emitStatus("connecting");

    // 1. Get ephemeral token from our backend
    let token: TokenResponse;
    try {
      const res = await fetch("/api/lumina-live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Token fetch ${res.status}: ${err.slice(0, 200)}`);
      }
      token = (await res.json()) as TokenResponse;
    } catch (err) {
      this.fail(`Token error: ${(err as Error).message}`);
      throw err;
    }

    // 2. Request microphone
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      this.fail(`Microphone access denied: ${(err as Error).message}`);
      throw err;
    }

    // 3. Build AudioContexts (separate sample rates)
    const AC: typeof AudioContext =
      (window.AudioContext as typeof AudioContext) ||
      ((window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext as typeof AudioContext);
    if (!AC) {
      this.fail("Web Audio API not supported in this browser.");
      throw new Error("no_audio_context");
    }
    try {
      this.inputCtx = new AC({ sampleRate: INPUT_RATE });
      this.outputCtx = new AC({ sampleRate: OUTPUT_RATE });
    } catch {
      // Some browsers (Safari) ignore sampleRate. Fall back and resample manually below.
      this.inputCtx = new AC();
      this.outputCtx = new AC();
    }
    // Some browsers require resume on a user gesture (toggle is one).
    if (this.inputCtx.state === "suspended") await this.inputCtx.resume();
    if (this.outputCtx.state === "suspended") await this.outputCtx.resume();

    // 4. Open WebSocket
    const tokenName = encodeURIComponent(token.name);
    const wsUrl = `${ENDPOINT_BASE}?access_token=${tokenName}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => this.handleOpen(token);
    this.ws.onmessage = (ev) => this.handleMessage(ev);
    this.ws.onerror = () => this.fail("WebSocket error.");
    this.ws.onclose = (ev) => this.handleClose(ev);
  }

  stop(): void {
    this.emitStatus("closed");
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;

    // Stop audio capture
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        /* noop */
      }
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* noop */
      }
    }
    this.processor = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    // Cancel queued playback
    for (const node of this.playbackQueue) {
      try {
        node.stop();
      } catch {
        /* noop */
      }
    }
    this.playbackQueue = [];

    if (this.inputCtx) {
      this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }
    if (this.outputCtx) {
      this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }

    this.cb.onClose?.();
  }

  /** True if currently connected. */
  isActive(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ---------- internals ----------

  private handleOpen(token: TokenResponse): void {
    if (!this.ws) return;
    // Setup message — must be the first frame
    const setup = {
      setup: {
        model: `models/${token.model}`,
      },
    };
    this.ws.send(JSON.stringify(setup));
    this.setupSent = true;
    this.startCapture();
    this.emitStatus("listening");
  }

  private startCapture(): void {
    if (!this.inputCtx || !this.mediaStream) return;
    this.sourceNode = this.inputCtx.createMediaStreamSource(this.mediaStream);
    // ScriptProcessor is deprecated but universally supported and adequate here.
    // Buffer size 2048 = ~128ms at 16kHz; small enough for low latency.
    this.processor = this.inputCtx.createScriptProcessor(FRAME_SIZE, 1, 1);
    this.processor.onaudioprocess = (e) => this.handleAudioFrame(e);
    this.sourceNode.connect(this.processor);
    // Connect to destination so onaudioprocess actually fires (some browsers need it).
    // We use a gain of 0 to keep it silent.
    const muteNode = this.inputCtx.createGain();
    muteNode.gain.value = 0;
    this.processor.connect(muteNode);
    muteNode.connect(this.inputCtx.destination);
  }

  private handleAudioFrame(e: AudioProcessingEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.setupSent) return;
    const input = e.inputBuffer.getChannelData(0);

    // If the AudioContext didn't honor our 16kHz request, resample.
    let frame: Float32Array = input;
    const ctxRate = this.inputCtx?.sampleRate ?? INPUT_RATE;
    if (Math.abs(ctxRate - INPUT_RATE) > 1) {
      frame = downsampleFloat32(input, ctxRate, INPUT_RATE);
    }

    const pcm16 = float32ToInt16(frame);
    const b64 = arrayBufferToBase64(pcm16.buffer);
    const msg = {
      realtimeInput: {
        audio: {
          data: b64,
          mimeType: `audio/pcm;rate=${INPUT_RATE}`,
        },
      },
    };
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {
      /* socket closed mid-frame */
    }
  }

  private handleMessage(ev: MessageEvent): void {
    let payload: unknown;
    try {
      const text = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
      payload = JSON.parse(text);
    } catch {
      return;
    }
    const data = payload as LiveServerMessage;

    if (data.setupComplete) {
      // Already in listening state — nothing extra to do.
      return;
    }

    const sc = data.serverContent;
    if (sc) {
      // Audio out
      const parts = sc.modelTurn?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData;
        if (inline?.data && inline.mimeType?.startsWith("audio/pcm")) {
          this.queuePlayback(inline.data);
          if (!this.modelSpeaking) {
            this.modelSpeaking = true;
            this.emitStatus("speaking");
          }
        }
      }

      // Transcripts
      if (sc.inputTranscription?.text) {
        this.inputTranscriptBuffer += sc.inputTranscription.text;
        this.cb.onUserTranscript?.(this.inputTranscriptBuffer, false);
      }
      if (sc.outputTranscription?.text) {
        this.outputTranscriptBuffer += sc.outputTranscription.text;
        this.cb.onModelTranscript?.(this.outputTranscriptBuffer, false);
      }

      // Turn boundaries
      if (sc.turnComplete) {
        if (this.outputTranscriptBuffer) {
          this.cb.onModelTranscript?.(this.outputTranscriptBuffer, true);
          this.outputTranscriptBuffer = "";
        }
        if (this.inputTranscriptBuffer) {
          this.cb.onUserTranscript?.(this.inputTranscriptBuffer, true);
          this.inputTranscriptBuffer = "";
        }
        this.modelSpeaking = false;
        this.emitStatus("listening");
      }

      // Interruption — model was cut off by user voice
      if (sc.interrupted) {
        this.cancelPlayback();
        this.modelSpeaking = false;
        this.emitStatus("listening");
      }
    }

    if (data.toolCall) {
      // No tools wired through Live for now — acknowledge so the session continues.
      const responses =
        data.toolCall.functionCalls?.map((fc) => ({
          id: fc.id,
          name: fc.name,
          response: { result: { ok: false, message: "Tool not available in live mode." } },
        })) ?? [];
      this.ws?.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }

    if (data.goAway) {
      // Server is about to close — let onclose handle teardown.
    }
  }

  private queuePlayback(b64: string): void {
    if (!this.outputCtx) return;
    const bytes = base64ToUint8(b64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const float = int16ToFloat32(pcm);

    // The output context might not have honored our 24kHz request. Build a buffer
    // at OUTPUT_RATE and let the context resample, OR resample manually.
    const ctxRate = this.outputCtx.sampleRate;
    let playbackData: Float32Array = float;
    if (Math.abs(ctxRate - OUTPUT_RATE) > 1) {
      playbackData = upsampleFloat32(float, OUTPUT_RATE, ctxRate);
    }

    const buf = this.outputCtx.createBuffer(1, playbackData.length, ctxRate);
    buf.getChannelData(0).set(playbackData);

    const node = this.outputCtx.createBufferSource();
    node.buffer = buf;
    node.connect(this.outputCtx.destination);

    const now = this.outputCtx.currentTime;
    const startAt = Math.max(now, this.nextPlaybackTime);
    node.start(startAt);
    this.nextPlaybackTime = startAt + buf.duration;

    this.playbackQueue.push(node);
    node.onended = () => {
      this.playbackQueue = this.playbackQueue.filter((n) => n !== node);
    };
  }

  private cancelPlayback(): void {
    for (const node of this.playbackQueue) {
      try {
        node.stop();
      } catch {
        /* noop */
      }
    }
    this.playbackQueue = [];
    this.nextPlaybackTime = this.outputCtx?.currentTime ?? 0;
  }

  private handleClose(ev: CloseEvent): void {
    if (ev.code !== 1000 && ev.code !== 1005) {
      this.cb.onError?.(`Connection closed (${ev.code}) ${ev.reason || ""}`.trim());
    }
    this.cb.onClose?.();
    this.emitStatus("closed");
  }

  private emitStatus(s: LuminaLiveStatus): void {
    this.cb.onStatus?.(s);
  }

  private fail(msg: string): void {
    this.cb.onError?.(msg);
    this.emitStatus("error");
  }
}

// ---------- Live API message types (subset we use) ----------

interface LiveInlineData {
  mimeType?: string;
  data?: string;
}
interface LivePart {
  text?: string;
  inlineData?: LiveInlineData;
}
interface LiveServerContent {
  modelTurn?: { parts?: LivePart[] };
  inputTranscription?: { text?: string };
  outputTranscription?: { text?: string };
  turnComplete?: boolean;
  interrupted?: boolean;
  generationComplete?: boolean;
}
interface LiveFunctionCall {
  id: string;
  name: string;
  args?: Record<string, unknown>;
}
interface LiveServerMessage {
  setupComplete?: Record<string, unknown>;
  serverContent?: LiveServerContent;
  toolCall?: { functionCalls?: LiveFunctionCall[] };
  goAway?: { timeLeft?: string };
}

// ---------- audio utils ----------

function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = input[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function int16ToFloat32(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] / 0x8000;
  }
  return out;
}

function arrayBufferToBase64(buf: ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Linear downsampling (e.g. 48000 → 16000). Lossy but acceptable for voice. */
function downsampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return input;
  const ratio = fromRate / toRate;
  const newLen = Math.floor(input.length / ratio);
  const out = new Float32Array(newLen);
  let pos = 0;
  for (let i = 0; i < newLen; i++) {
    const next = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = pos; j < next && j < input.length; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
    pos = next;
  }
  return out;
}

/** Linear upsampling (e.g. 24000 → 48000). */
function upsampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate <= fromRate) return input;
  const ratio = toRate / fromRate;
  const newLen = Math.floor(input.length * ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i / ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = srcIdx - lo;
    out[i] = input[lo] * (1 - frac) + input[hi] * frac;
  }
  return out;
}
