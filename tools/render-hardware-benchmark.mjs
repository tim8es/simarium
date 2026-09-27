import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const externalUrl = argument("--url", process.env.SIMARIUM_BENCHMARK_URL ?? "");
const host = "127.0.0.1";
const port = Number(argument("--port", "4173"));
const output = argument("--output", "render-hardware-report.json");
const warmupMs = Number(argument("--warmup-ms", "30000"));
const orbitMs = Number(argument("--orbit-ms", "120000"));
const secondaryMs = Number(argument("--secondary-ms", "60000"));
const headless = process.argv.includes("--headless");
const baseUrl = externalUrl || `http://${host}:${port}`;

let preview;

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not become ready at ${url}`);
}

async function runCamera(page, camera, durationMs) {
  await page.goto(
    `${baseUrl}/?record=1&camera=${encodeURIComponent(camera)}`,
    { waitUntil: "networkidle", timeout: 30_000 }
  );
  await page.waitForSelector("#render-layer canvas", { timeout: 30_000 });
  await page.waitForTimeout(warmupMs + durationMs);

  return page.evaluate(() => {
    const canvas = document.querySelector("#render-layer canvas");
    const gl = canvas?.getContext("webgl2");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const metrics = window.__SIMARIUM_BENCHMARK_METRICS__;
    if (!metrics) throw new Error("Benchmark metrics are unavailable");
    return {
      metrics,
      browser: {
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      webgl: {
        version: gl?.getParameter(gl.VERSION) ?? null,
        vendor: debug
          ? gl?.getParameter(debug.UNMASKED_VENDOR_WEBGL)
          : gl?.getParameter(gl.VENDOR) ?? null,
        renderer: debug
          ? gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl?.getParameter(gl.RENDERER) ?? null
      }
    };
  });
}

try {
  if (!externalUrl) {
    preview = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      [
        "run",
        "preview:render",
        "--",
        "--host",
        host,
        "--port",
        String(port)
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env
      }
    );
    preview.stdout.on("data", chunk => process.stdout.write(chunk));
    preview.stderr.on("data", chunk => process.stderr.write(chunk));
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({
    headless,
    args: ["--enable-webgl", "--ignore-gpu-blocklist"]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const passes = {};
    for (const [camera, durationMs] of [
      ["orbit", orbitMs],
      ["macro", secondaryMs],
      ["follow", secondaryMs]
    ]) {
      process.stdout.write(
        `Running ${camera}: warmup ${warmupMs / 1000}s + measurement ${durationMs / 1000}s\n`
      );
      passes[camera] = await runCamera(page, camera, durationMs);
    }

    const orbit = passes.orbit.metrics;
    const gate = {
      orbitFpsAtLeast55: orbit.fps >= 55,
      orbitAverageFrameAtMost20Ms: orbit.averageFrameMs <= 20,
      noMeasuredLongTaskOver50Ms: orbit.maxLongTaskMs <= 50
    };
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceUrl: baseUrl,
      headed: !headless,
      configuredDurationsMs: {
        warmup: warmupMs,
        orbit: orbitMs,
        macro: secondaryMs,
        follow: secondaryMs
      },
      passes,
      gate,
      gatePassed: Object.values(gate).every(Boolean),
      note:
        "Hardware evidence is valid only when this recorder is run on the target physical laptop with hardware acceleration enabled."
    };

    await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(`Report written to ${output}\n`);
    if (!report.gatePassed) process.exitCode = 2;
  } finally {
    await browser.close();
  }
} finally {
  if (preview) {
    preview.kill("SIGTERM");
  }
}
