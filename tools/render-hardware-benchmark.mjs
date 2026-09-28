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

function summarizeHeap(samples) {
  const available = samples.filter(Boolean);
  if (available.length === 0) {
    return {
      available: false,
      sampleCount: 0,
      note: "Chromium performance.memory unavailable; no heap/GC proxy recorded."
    };
  }
  const used = available.map(sample => sample.usedJSHeapSize);
  let heapDropEventsProxy = 0;
  let largestHeapDropBytes = 0;
  for (let index = 1; index < used.length; index++) {
    const drop = used[index - 1] - used[index];
    if (drop >= 1024 * 1024) heapDropEventsProxy++;
    largestHeapDropBytes = Math.max(largestHeapDropBytes, drop);
  }
  return {
    available: true,
    sampleCount: available.length,
    startUsedJSHeapBytes: used[0],
    endUsedJSHeapBytes: used.at(-1),
    peakUsedJSHeapBytes: Math.max(...used),
    minimumUsedJSHeapBytes: Math.min(...used),
    usedJSHeapDeltaBytes: used.at(-1) - used[0],
    totalJSHeapBytes: available.at(-1).totalJSHeapSize,
    jsHeapSizeLimitBytes: available.at(-1).jsHeapSizeLimit,
    heapDropEventsProxy,
    largestHeapDropBytes,
    note:
      "heapDropEventsProxy counts >=1 MiB decreases in usedJSHeapSize; it is a GC/activity proxy, not a direct GC event counter."
  };
}

async function runCamera(page, camera, durationMs) {
  await page.goto(
    `${baseUrl}/?record=1&camera=${encodeURIComponent(camera)}`,
    { waitUntil: "networkidle", timeout: 30_000 }
  );
  await page.waitForSelector("#render-layer canvas", { timeout: 30_000 });
  await page.waitForTimeout(warmupMs);

  const heapSamples = [];
  const measurementDeadline = Date.now() + durationMs;
  while (Date.now() < measurementDeadline) {
    heapSamples.push(await page.evaluate(() => {
      const memory = performance.memory;
      return memory
        ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          }
        : null;
    }));
    await page.waitForTimeout(Math.min(1000, Math.max(0, measurementDeadline - Date.now())));
  }

  const result = await page.evaluate(() => {
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
  return {
    ...result,
    memory: summarizeHeap(heapSamples)
  };
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
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--enable-precise-memory-info",
      "--window-size=1920,1080"
    ]
  });

  try {
    let detectedDevicePixelRatio = 1;
    if (!headless) {
      const detectionContext = await browser.newContext({ viewport: null });
      try {
        const detectionPage = await detectionContext.newPage();
        detectedDevicePixelRatio = await detectionPage.evaluate(
          () => window.devicePixelRatio
        );
      } finally {
        await detectionContext.close();
      }
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: detectedDevicePixelRatio
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
    const rendererName = String(passes.orbit.webgl.renderer ?? "");
    const softwareRenderer = /swiftshader|llvmpipe|software|basic render/i.test(
      rendererName
    );
    const gate = {
      physicalHardwareRenderer: !headless && !softwareRenderer,
      orbitFpsAtLeast55: orbit.fps >= 55,
      orbitAverageFrameAtMost20Ms: orbit.averageFrameMs <= 20,
      noMeasuredLongTaskOver50Ms: orbit.maxLongTaskMs <= 50
    };
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceUrl: baseUrl,
      headed: !headless,
      detectedDevicePixelRatio,
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
