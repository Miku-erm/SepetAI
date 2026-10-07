import { chromium } from "@playwright/test";
import { writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { binary, directories, loadTimeline, output, probe, raw, run, temp } from "./common.js";

await directories();
const ffmpeg = await binary("ffmpeg");
const timeline = await loadTimeline();
const source = path.join(raw, "demo.webm");
await probe(source);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  // Only editorial graphics are generated here. All application footage is the
  // real browser video; these cards contain no recreated product/agent output.
  const css = `<style>*{box-sizing:border-box}body{margin:0;font-family:Arial,'Segoe UI',sans-serif;color:#174f43}.card{width:1920px;height:1080px;display:flex;flex-direction:column;justify-content:center;padding:180px;background:#f5f7ee}.eyebrow{font-size:22px;letter-spacing:6px;color:#789664;margin-bottom:34px}.title{font-size:116px;font-weight:700;letter-spacing:-6px;margin:0 0 28px}.subtitle{font-size:35px;margin:0 0 50px;color:#648259}.line{width:90px;height:5px;background:#8baa72;margin-bottom:38px}.facts{font-size:28px;line-height:1.8;color:#507263}.footer{font-size:20px;color:#789078;margin-top:60px}.badge{position:absolute;right:66px;top:32px;background:rgba(23,79,67,.96);color:white;padding:18px 28px;border-radius:12px;box-shadow:0 8px 24px #17392c20}.badge strong{font-size:30px;letter-spacing:-1px;display:block}.badge p{font-size:17px;margin:5px 0 0;color:#e1ecd6}.badge small{font-size:12px;color:#becdb7;display:block;margin-top:9px}</style>`;
  await page.setContent(`${css}<div class="badge"><strong>SepetAI</strong><p>Local AI Shopping Agent</p><small>Inspired by Palisade — Y Combinator S26</small></div>`);
  await page.screenshot({ path: path.join(temp, "intro-overlay.png"), omitBackground: true });
  await page.setContent(`${css}<div class="card"><div class="eyebrow">CONVERSATION → ACTION</div><h1 class="title">SepetAI<span style="color:#89a76d">.</span></h1><div class="subtitle">Local AI Shopping Agent</div><div class="line"></div><div class="facts">Local Qwen3 4B<br>Ollama • React • Express • SQLite<br>50 Automated Tests<br>Grounded Product Data</div><div class="footer">Software Implementation &amp; Testing Project</div></div>`);
  await page.screenshot({ path: path.join(temp, "outro.png") });
  // Font QA fixture includes every Turkish letter, separate from final artwork.
  await page.setContent(`${css}<div class="card"><div class="subtitle">Türkçe: ı İ ş Ş ç Ç ğ Ğ ü Ü ö Ö</div></div>`);
  await page.screenshot({ path: path.join(output, "font-check.png") });
} finally { await browser.close(); }

const cuts = timeline.requests.filter(r => r.response - r.submitted > 3).map(r => ({
  name: r.name, start: r.submitted + 1.5, end: r.response - 0.4,
  originalWait: r.response - r.submitted,
}));
const first = timeline.scenes[0].start;
const last = timeline.scenes.at(-1)!.end;
const intervals: { start: number; end: number; intro?: boolean }[] = [];
let cursor = first;
// Separate the intro so the overlay never crosses into assistant footage.
intervals.push({ start: first, end: timeline.scenes[0].end, intro: true });
cursor = timeline.scenes[0].end;
for (const cut of cuts) {
  if (cut.start <= cursor || cut.end <= cut.start) throw new Error("Invalid/inconsistent inference timeline");
  intervals.push({ start: cursor, end: cut.start });
  cursor = cut.end;
}
intervals.push({ start: cursor, end: last });

const segmentFiles: string[] = [];
const editMap: { rawStart: number; rawEnd: number; finalStart: number; finalEnd: number }[] = [];
let finalTime = 0;
const encode = ["-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-threads", "4", "-an", "-movflags", "+faststart"];
for (let i = 0; i < intervals.length; i++) {
  const interval = intervals[i];
  const file = path.join(temp, `segment-${i}.mp4`);
  const duration = interval.end - interval.start;
  const args = ["-y", "-hide_banner", "-ss", Math.max(0, interval.start + timeline.videoOffset).toFixed(4), "-t", duration.toFixed(4), "-i", source];
  if (interval.intro) {
    args.push("-loop", "1", "-i", path.join(temp, "intro-overlay.png"), "-filter_complex", "[0:v]scale=1920:1080:flags=lanczos,setsar=1,fps=30[base];[1:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1[title];[base][title]overlay=0:0:shortest=1[v]", "-map", "[v]");
  } else args.push("-vf", "scale=1920:1080:flags=lanczos,setsar=1,fps=30");
  args.push("-t", duration.toFixed(4), ...encode, file);
  await run(ffmpeg, args, path.join(temp, `segment-${i}.log`));
  const actualDuration = Number((await probe(file)).format.duration);
  editMap.push({ rawStart: interval.start, rawEnd: interval.end, finalStart: finalTime, finalEnd: finalTime + actualDuration });
  finalTime += actualDuration;
  segmentFiles.push(file);
}
// Target 58 seconds without speeding meaningful content. Only an intentional
// hold on the final real cart frame may be extended, by at most six seconds.
const outroDuration = 4;
const padding = Math.max(0, 58 - finalTime - outroDuration);
if (padding > 6 || finalTime + outroDuration > 60.2)
  throw new Error(`Presentation pacing outside target (${finalTime.toFixed(1)}s footage). Adjust deliberate recording holds, then record again.`);
if (padding > 0) {
  const lastFile = segmentFiles.at(-1)!;
  const padded = path.join(temp, "cart-hold.mp4");
  await run(ffmpeg, ["-y", "-hide_banner", "-i", lastFile, "-vf", `tpad=stop_mode=clone:stop_duration=${padding.toFixed(4)}`, ...encode, padded], path.join(temp, "cart-hold.log"));
  segmentFiles[segmentFiles.length - 1] = padded;
}
const outro = path.join(temp, "outro.mp4");
await run(ffmpeg, ["-y", "-hide_banner", "-loop", "1", "-framerate", "30", "-i", path.join(temp, "outro.png"), "-t", String(outroDuration), "-vf", "setsar=1,fade=t=in:st=0:d=0.25,fade=t=out:st=3.65:d=0.35:color=0xf5f7ee", ...encode, outro], path.join(temp, "outro.log"));
segmentFiles.push(outro);
// Relative generated names avoid concat quoting problems on Windows paths.
const concat = path.join(temp, "concat.txt");
await writeFile(concat, segmentFiles.map(file => `file '${path.basename(file)}'`).join("\n") + "\n");
const final = path.join(output, "SepetAI-demo.mp4");
await run(ffmpeg, ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", "-an", "-movflags", "+faststart", final], path.join(temp, "concat.log"));
const metadata = await probe(final);
const video = metadata.streams.find(s => s.codec_type === "video");
const duration = Number(metadata.format.duration);
if (!video || video.codec_name !== "h264" || video.width !== 1920 || video.height !== 1080 || video.avg_frame_rate !== "30/1" || duration < 55 || duration > 60.2 || !metadata.format.format_name.includes("mp4") || metadata.streams.some(s => s.codec_type === "audio") || (await stat(final)).size === 0)
  throw new Error(`Invalid final video: ${JSON.stringify(metadata)}`);
// Decode the entire output, not only its header, to catch corrupt/truncated media.
await run(ffmpeg, ["-v", "error", "-xerror", "-i", final, "-f", "null", "-"], path.join(temp, "decode-check.log"));
function editedTime(rawTime: number) {
  const segment = editMap.find(s => rawTime >= s.rawStart && rawTime <= s.rawEnd);
  if (!segment) throw new Error(`Inspection marker falls in a removed interval: ${rawTime}`);
  return segment.finalStart + rawTime - segment.rawStart;
}
const frameTimes: Record<string, number> = {};
for (const name of ["intro", "search", "refine", "compare", "add", "cart"]) {
  const scene = timeline.scenes.find(s => s.name === name)!;
  const seconds = name === "intro" ? 1.5 : editedTime(scene.inspect);
  frameTimes[name] = seconds;
  await run(ffmpeg, ["-y", "-v", "error", "-ss", seconds.toFixed(3), "-i", final, "-frames:v", "1", path.join(output, `frame-${name}.png`)]);
}
frameTimes.outro = duration - 2;
for (const [name, seconds] of [["outro", duration - 2], ["first", 0], ["last", duration - 0.08]] as const)
  await run(ffmpeg, ["-y", "-v", "error", "-ss", seconds.toFixed(3), "-i", final, "-frames:v", "1", path.join(output, `frame-${name}.png`)]);
await run(ffmpeg, ["-y", "-v", "error", "-ss", "1.5", "-i", final, "-frames:v", "1", path.join(output, "SepetAI-thumbnail.png")]);
const report = { file: final, duration, width: video.width, height: video.height, codec: video.codec_name, fps: video.avg_frame_rate,
  audio: false, realModel: timeline.realModel, model: timeline.model, cuts, removedSeconds: cuts.reduce((sum, cut) => sum + cut.end - cut.start, 0),
  padding, editMap, frameTimes, metadata };
await writeFile(path.join(output, "verification.json"), JSON.stringify(report, null, 2));
console.info(`PASS: ${final}\n${duration.toFixed(2)}s · 1920×1080 · 30 FPS · H.264 · muted · ${cuts.length} real inference waits cut.`);
