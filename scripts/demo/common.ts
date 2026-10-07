import "dotenv/config";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const root = process.cwd();
export const raw = path.resolve("demo/raw");
export const output = path.resolve("demo/output");
export const temp = path.resolve("demo/temp");
export async function directories() {
  for (const directory of [raw, output, temp]) await mkdir(directory, { recursive: true });
}
export async function run(command: string, args: string[], log?: string) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, shell: false });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", async (code) => {
      if (log) await writeFile(log, stdout + stderr);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-3000)}`));
    });
  });
}
export async function binary(name: "ffmpeg" | "ffprobe") {
  const configured = process.env[name === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"];
  const candidates = [configured, name, path.resolve(`.local/ffmpeg/bin/${name}${process.platform === "win32" ? ".exe" : ""}`)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try { await run(candidate, ["-version"]); return candidate; } catch { /* next candidate */ }
  }
  throw new Error(`${name} missing. Install FFmpeg (including ffprobe) from https://ffmpeg.org/download.html and add bin to PATH, or set FFMPEG_PATH/FFPROBE_PATH. Portable Windows binaries may be placed in .local/ffmpeg/bin.`);
}
export async function probe(file: string) {
  await access(file);
  const executable = await binary("ffprobe");
  return JSON.parse(await run(executable, ["-v", "error", "-show_format", "-show_streams", "-of", "json", file])) as {
    format: { duration: string; format_name: string; size: string };
    streams: { codec_type: string; codec_name: string; width: number; height: number; avg_frame_rate: string }[];
  };
}
export interface Scene { name: string; start: number; end: number; inspect: number }
export interface RequestTiming {
  name: string; prompt: string; submitted: number; response: number;
  tool: string; arguments: Record<string, unknown>; resultCount: number;
  productIds: string[]; comparisonIds: string[];
}
export interface Timeline {
  version: 1; success: boolean; model: string; realModel: true; startedAt: string;
  recordingElapsed: number; videoOffset: number; rawDuration: number;
  scenes: Scene[]; requests: RequestTiming[]; cart: unknown;
}
export async function loadTimeline() {
  const timeline = JSON.parse(await readFile(path.join(raw, "timeline.json"), "utf8")) as Timeline;
  if (!timeline.success || !timeline.realModel || timeline.model !== "qwen3:4b" || timeline.requests.length !== 4)
    throw new Error("Refusing to render an incomplete/non-Qwen recording.");
  return timeline;
}
