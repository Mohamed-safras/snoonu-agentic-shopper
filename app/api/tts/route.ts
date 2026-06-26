/** POST /api/tts — free, high-quality text-to-speech via Microsoft Edge's neural
 *  voices (msedge-tts, no API key). Body: { text, lang, voice }. Returns
 *  audio/mpeg, which the browser plays — so Sinhala/Tamil/English quality no
 *  longer depends on which voices the user's OS happens to have installed. */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { voiceFor } from "@/lib/speech/voices";
import type { Lang } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 2000; // a single reply; keeps synthesis fast and bounded
const OUTPUT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

// The slow part of TTS is the FIRST request for a voice: msedge-tts opens a
// WebSocket + TLS connection to Microsoft (~3s) before any audio flows; once
// open, synthesis is ~250ms. Creating a fresh connection per request (the old
// behaviour) paid that handshake every time, so the client-side "warm-up" never
// actually helped — each call still opened its own socket.
//
// So keep a small pool of WARM connections per voice and reuse them. The client
// prefetches every sentence in parallel, so several requests can be in flight at
// once — each takes its own connection from the pool and returns it when done.
// Idle connections past RECYCLE_MS are dropped (Microsoft closes idle sockets).
const POOL_LIMIT_PER_VOICE = 4;
const RECYCLE_MS = 4 * 60_000;

interface PooledConnection {
  tts: MsEdgeTTS;
  freedAt: number;
}
const idleConnectionsByVoice = new Map<string, PooledConnection[]>();

/** Take a warm connection for `voice` from the pool, or open a fresh one. */
async function acquireConnection(voice: string): Promise<MsEdgeTTS> {
  const pool = idleConnectionsByVoice.get(voice);
  if (pool) {
    const now = Date.now();
    while (pool.length) {
      const pooled = pool.pop();
      if (pooled && now - pooled.freedAt < RECYCLE_MS) return pooled.tts; // warm
      // else: too old — let it be garbage-collected (socket already idle-closed)
    }
  }
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT); // opens the WebSocket (the slow step)
  return tts;
}

/** Return a healthy connection to the pool for reuse (bounded per voice). */
function releaseConnection(voice: string, tts: MsEdgeTTS): void {
  let pool = idleConnectionsByVoice.get(voice);
  if (!pool) {
    pool = [];
    idleConnectionsByVoice.set(voice, pool);
  }
  if (pool.length < POOL_LIMIT_PER_VOICE)
    pool.push({ tts, freedAt: Date.now() });
}

/** Collect one synthesis into a single MP3 buffer. */
function synthesizeToBuffer(tts: MsEdgeTTS, text: string): Promise<Buffer> {
  const { audioStream } = tts.toStream(text);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", () => resolve(Buffer.concat(chunks)));
    audioStream.on("error", reject);
  });
}

/** Synthesize, reusing a warm connection. If a pooled connection turns out to be
 *  dead (Microsoft dropped it), retry once on a brand-new connection. */
async function synthesize(voice: string, text: string): Promise<Buffer> {
  const reused = await acquireConnection(voice);
  try {
    const audio = await synthesizeToBuffer(reused, text);
    releaseConnection(voice, reused); // healthy → keep it warm for the next call
    return audio;
  } catch {
    // The reused socket was stale; don't pool it back. Try once more fresh.
    const fresh = new MsEdgeTTS();
    await fresh.setMetadata(voice, OUTPUT);
    const audio = await synthesizeToBuffer(fresh, text);
    releaseConnection(voice, fresh);
    return audio;
  }
}

export async function POST(request: Request) {
  let body: { text?: string; lang?: Lang; voice?: string };
  try {
    body = (await request.json()) as {
      text?: string;
      lang?: Lang;
      voice?: string;
    };
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, MAX_CHARS);
  if (!text) return new Response("empty", { status: 400 });

  try {
    const audio = await synthesize(voiceFor(body.lang, body.voice), text);
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("tts failed", { status: 502 });
  }
}
