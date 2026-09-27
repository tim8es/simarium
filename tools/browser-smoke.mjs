import { chromium } from "playwright";

const baseUrl = process.env.SIMARIUM_BROWSER_URL ?? "http://127.0.0.1:4173";
const soakMs = Number(process.env.SIMARIUM_SOAK_MS ?? 20_000);
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--use-angle=swiftshader"
  ]
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 }
});
const errors = [];
page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
page.on("console", message => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

try {
  const sharePreset = Buffer.from(JSON.stringify({
    version: 1,
    seed: 7011,
    presetId: "phase7-integrated",
    config: {}
  })).toString("base64url");

  await page.goto(`${baseUrl}/?share=${sharePreset}`, {
    waitUntil: "networkidle",
    timeout: 30_000
  });

  await page.waitForSelector(".runtime-banner.running", { timeout: 30_000 });
  await page.waitForSelector("#render-layer canvas", { timeout: 30_000 });

  const webgl = await page.locator("#render-layer canvas").evaluate(canvas => {
    const context = canvas.getContext("webgl2");
    return {
      webgl2: Boolean(context),
      width: canvas.width,
      height: canvas.height
    };
  });
  if (!webgl.webgl2 || webgl.width <= 0 || webgl.height <= 0) {
    throw new Error(`WebGL2 canvas unavailable: ${JSON.stringify(webgl)}`);
  }

  const worldClock = page.locator(".viewport-label.top-right strong");
  const initialClock = await worldClock.textContent();
  let advancedClock = initialClock;
  const clockDeadline = Date.now() + 8000;
  while (Date.now() < clockDeadline && advancedClock === initialClock) {
    await page.waitForTimeout(500);
    advancedClock = await worldClock.textContent();
  }
  if (!initialClock || !advancedClock || initialClock === advancedClock) {
    throw new Error(`World clock did not advance: ${initialClock} -> ${advancedClock}`);
  }

  await page.getByText(/Initial world autosaved/).waitFor({ timeout: 30_000 });
  const consumedUrl = new URL(page.url());
  if (
    consumedUrl.searchParams.has("seed") ||
    consumedUrl.searchParams.has("share")
  ) {
    throw new Error("Explicit world manifest was not consumed from the browser URL");
  }

  await page.locator("[data-command='pause']").click();
  await page.waitForSelector(".runtime-banner.paused");
  await page.locator("[data-speed='20']").click();
  await page.waitForSelector(".runtime-banner.running");

  await page.locator("[data-overlay='temperature']").click();
  await page.locator("[data-overlay='temperature'].is-active").waitFor();

  await page.locator("[data-bottom-tab='resources']").click();
  await page.getByText("Conservation residuals").waitFor();
  await page.locator("[data-bottom-tab='profiler']").click();
  await page.getByText("Simulation runtime").waitFor();
  await page.locator("[data-bottom-tab='events']").click();
  await page.getByText("RECENT EVENT STREAM").waitFor();

  await page.locator("[data-bottom-tab='actions']").click();
  page.once("dialog", dialog => dialog.accept("1.25"));
  await page.locator("[data-user-action='MIST_WATER']").click();
  await page.getByText("accepted", { exact: true }).waitFor({ timeout: 10_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-world-command='export']").click();
  const download = await downloadPromise;
  const exportedPath = await download.path();
  if (!exportedPath) throw new Error("Portable save export did not produce a file");
  await page.getByText(/Portable save exported/).waitFor({ timeout: 30_000 });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("[data-world-command='import']").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(exportedPath);
  await page.getByText(/Portable save imported/).waitFor({ timeout: 30_000 });

  const preSaveClock = await worldClock.textContent();
  await page.locator("[data-world-command='save']").click();
  await page.getByText(/Saved: manual-/).waitFor({ timeout: 30_000 });
  await page.locator("[data-world-command='load']").click();
  await page.getByText(/Loaded latest save/).waitFor({ timeout: 30_000 });

  const clockSeconds = value => {
    const match = /^DAY\s+(\d+)\s+·\s+(\d{2}):(\d{2})$/.exec(value ?? "");
    if (!match) return -1;
    return Number(match[1]) * 86400 + Number(match[2]) * 3600 + Number(match[3]) * 60;
  };
  const minimumResumedSeconds = clockSeconds(preSaveClock);
  await page.goto(`${baseUrl}/`, {
    waitUntil: "networkidle",
    timeout: 30_000
  });
  await page.waitForSelector(".runtime-banner.running", { timeout: 30_000 });
  await page.getByText(/Autosave resumed/).waitFor({ timeout: 30_000 });
  const resumedClock = await page.locator(".viewport-label.top-right strong").textContent();
  const resumedSeconds = clockSeconds(resumedClock);
  if (minimumResumedSeconds < 0 || resumedSeconds < minimumResumedSeconds) {
    throw new Error(`Reload did not resume saved world: ${preSaveClock} -> ${resumedClock}`);
  }

  await page.locator("[data-world-command='night-aid']").click();
  await page.getByText(/Visual night observation aid enabled/).waitFor();

  await page.locator("[data-speed='100']").click();
  await page.waitForTimeout(soakMs);

  await page.locator("[data-bottom-tab='profiler']").click();
  const profilerText = await page.locator(".profiler-content").innerText();
  if (!/Avg \/ tick/i.test(profilerText) || !/Frames emitted/i.test(profilerText)) {
    throw new Error("Profiler telemetry did not render after soak");
  }

  if (errors.length > 0) {
    throw new Error(`Browser emitted errors:\n${errors.join("\n")}`);
  }

  console.log(JSON.stringify({
    ok: true,
    initialClock,
    advancedClock,
    soakMs,
    webgl
  }, null, 2));
} finally {
  await browser.close();
}
