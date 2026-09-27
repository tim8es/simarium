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

function parseWorldClock(text) {
  const match = /^DAY\s+(\d+)\s+·\s+(\d{2}):(\d{2})$/.exec(text?.trim() ?? "");
  if (!match) throw new Error(`Invalid world clock: ${text}`);
  return Number(match[1]) * 1440 + Number(match[2]) * 60 + Number(match[3]);
}

async function waitForClockChange(page, locator, previous, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let current = previous;
  while (Date.now() < deadline && current === previous) {
    await page.waitForTimeout(250);
    current = await locator.textContent();
  }
  if (!current || current === previous) {
    throw new Error(`World clock did not advance: ${previous} -> ${current}`);
  }
  return current;
}

async function withDialogs(page, responses, action) {
  const queue = [...responses];
  const handler = async (dialog) => {
    const response = queue.shift();
    if (response === undefined) {
      await dialog.dismiss();
      return;
    }
    await dialog.accept(String(response));
  };
  page.on("dialog", handler);
  try {
    await action();
    const deadline = Date.now() + 3_000;
    while (queue.length > 0 && Date.now() < deadline) {
      await page.waitForTimeout(25);
    }
    if (queue.length > 0) {
      throw new Error(`Expected ${queue.length} more dialog response(s)`);
    }
  } finally {
    page.off("dialog", handler);
  }
}

async function renderMetrics(page) {
  return page.evaluate(() => {
    const metrics = window.__SIMARIUM_RENDER_METRICS__;
    if (!metrics || typeof metrics !== "object") {
      throw new Error("Integrated renderer metrics are unavailable");
    }
    return metrics;
  });
}

async function renderedEntityIds(page) {
  return page.evaluate(() => {
    const ids = window.__SIMARIUM_RENDER_ENTITY_IDS__;
    if (!Array.isArray(ids)) {
      throw new Error("Integrated renderer entity identities are unavailable");
    }
    return ids;
  });
}

async function boundaryFlux(page) {
  await page.locator("[data-bottom-tab='resources']").click();
  const flux = page.locator(".boundary-flux");
  await flux.waitFor();
  return flux.evaluate((node) => ({
    carbonMg: Number(node.dataset.boundaryCarbonMg),
    nitrogenMg: Number(node.dataset.boundaryNitrogenMg),
    phosphorusMg: Number(node.dataset.boundaryPhosphorusMg),
    waterG: Number(node.dataset.boundaryWaterG)
  }));
}

async function applyPausedAction(page, type, dialogResponses = []) {
  await page.locator("[data-bottom-tab='actions']").click();
  const selector = `[data-action-type='${type}']`;
  const before = await page.locator(selector).count();
  await withDialogs(page, dialogResponses, async () => {
    await page.locator(`[data-user-action='${type}']`).click();
  });
  const rows = page.locator(selector);
  await rows.nth(before).waitFor({ timeout: 10_000 });
  await rows.nth(before).locator("strong").getByText("accepted", { exact: true }).waitFor({
    timeout: 10_000
  });
  await page.locator("[data-world-command='step']").click();
  await page.waitForSelector(".runtime-banner.paused");
  await page.waitForTimeout(1_200);
  return rows.nth(before);
}

async function pickVisibleEntity(page) {
  const canvas = page.locator("#render-layer canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Renderer canvas has no bounding box");

  const xs = [0.32, 0.4, 0.48, 0.56, 0.64, 0.72];
  const ys = [0.22, 0.3, 0.38, 0.46, 0.54, 0.62];
  for (const y of ys) {
    for (const x of xs) {
      await canvas.dispatchEvent("click", {
        clientX: box.x + box.width * x,
        clientY: box.y + box.height * y,
        bubbles: true
      });
      await page.waitForTimeout(180);
      const card = page.locator(".entity-card[data-entity-id][data-entity-kind='animal']");
      if (await card.count()) {
        const id = await card.first().getAttribute("data-entity-id");
        if (id) return id;
      }
    }
  }
  throw new Error("Could not pick a visible authoritative entity from the WebGL scene");
}

async function indexedDbSaveIds(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("simarium", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("worlds", "readonly");
        const request = tx.objectStore("worlds").getAll();
        request.onsuccess = () => resolve(
          request.result.map((record) => record?.metadata?.id).filter(Boolean)
        );
        request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
      });
    } finally {
      db.close();
    }
  });
}

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
  if (!initialClock || !/DAY 0\b/.test(initialClock)) {
    throw new Error(`Normal mode did not begin at Day 0: ${initialClock}`);
  }

  const shellText = await page.locator(".observation-shell").innerText();
  if (/synthetic snapshot|synthetic observation|day 61/i.test(shellText)) {
    throw new Error("Normal mode exposed synthetic/mock observation content");
  }
  if (!/not modeled/i.test(await page.locator("[data-overlay='o2']").innerText())) {
    throw new Error("O₂ is not modeled but was not labeled 'not modeled'");
  }
  if (!/proxy/i.test(await page.locator("[data-overlay='humidity']").innerText())) {
    throw new Error("Humidity proxy was not labeled as a proxy");
  }
  if (!/proxy/i.test(await page.locator("[data-overlay='co2']").innerText())) {
    throw new Error("CO₂ proxy was not labeled as a proxy");
  }

  await page.getByText(/Initial world autosaved/).waitFor({ timeout: 30_000 });
  const consumedUrl = new URL(page.url());
  if (
    consumedUrl.searchParams.has("seed") ||
    consumedUrl.searchParams.has("share")
  ) {
    throw new Error("Explicit world manifest was not consumed from the browser URL");
  }
  const initialSaveIds = await indexedDbSaveIds(page);
  if (!initialSaveIds.includes("autosave")) {
    throw new Error(`Initial IndexedDB autosave is missing: ${initialSaveIds.join(",")}`);
  }

  const advancedClock = await waitForClockChange(page, worldClock, initialClock);

  await page.locator("[data-command='pause']").click();
  await page.waitForSelector(".runtime-banner.paused");
  const pausedClock = await worldClock.textContent();
  await page.waitForTimeout(1_200);
  if ((await worldClock.textContent()) !== pausedClock) {
    throw new Error("Pause did not stop world time");
  }

  await page.locator("[data-world-command='step']").click();
  const steppedClock = await waitForClockChange(page, worldClock, pausedClock, 4_000);
  if (parseWorldClock(steppedClock) - parseWorldClock(pausedClock) !== 30) {
    throw new Error(`STEP did not advance exactly one 30-minute ecology tick: ${pausedClock} -> ${steppedClock}`);
  }

  for (const speed of [1, 5, 20, 100]) {
    await page.locator(`[data-speed='${speed}']`).click();
    await page.locator(`[data-speed='${speed}'].is-active`).waitFor();
    await page.locator("[data-bottom-tab='profiler']").click();
    await page.locator(".profiler-content").getByText(`${speed}×`, { exact: true }).waitFor({
      timeout: 4_000
    });
  }

  await page.waitForTimeout(1_500);
  await page.locator("[data-command='pause']").click();
  await page.waitForSelector(".runtime-banner.paused");

  await page.locator("[data-overlay='temperature']").click();
  await page.locator("[data-overlay='temperature'].is-active").waitFor();

  await page.locator("[data-bottom-tab='graphs']").click();
  const graphRows = page.locator(".series-row");
  await graphRows.first().waitFor();
  const graphPointCounts = await graphRows.evaluateAll(rows =>
    rows.map(row => Number(row.dataset.pointCount ?? "0"))
  );
  if (!graphPointCounts.some(count => count >= 2)) {
    throw new Error(`Population graphs did not receive live multi-sample data: ${graphPointCounts.join(",")}`);
  }

  await page.locator("[data-bottom-tab='foodWeb']").click();
  const foodEdges = page.locator(".web-edge[data-biomass-mg]");
  await foodEdges.first().waitFor({ timeout: 5_000 });
  const foodTransfers = await foodEdges.evaluateAll(edges =>
    edges.map(edge => Number(edge.dataset.biomassMg ?? "0"))
  );
  if (!foodTransfers.some(value => value > 0)) {
    throw new Error("Food web did not expose real positive transfer telemetry");
  }

  await page.locator("[data-bottom-tab='resources']").click();
  await page.getByText("Conservation residuals").waitFor();
  await page.locator("[data-bottom-tab='profiler']").click();
  await page.getByText("Simulation runtime").waitFor();
  await page.locator("[data-bottom-tab='events']").click();
  await page.getByText("RECENT EVENT STREAM").waitFor();

  const selectedId = await pickVisibleEntity(page);
  const entityCard = page.locator(`.entity-card[data-entity-id="${selectedId}"]`);
  await entityCard.waitFor();
  const genealogyCurrent = page.locator(`.genealogy-panel .lineage-node.current[data-entity-id="${selectedId}"]`);
  await genealogyCurrent.waitFor({ timeout: 5_000 });
  if (await page.locator(".why-panel .reason-row").count() === 0) {
    throw new Error("Why/state trace did not load for selected entity");
  }
  if (await page.locator(".history-panel .history-row").count() === 0) {
    throw new Error("Causal history did not load for selected entity");
  }

  await page.locator("[data-live-camera='follow']").click();
  await page.locator("[data-live-camera='follow'].is-active").waitFor();

  const waterBefore = await boundaryFlux(page);
  await applyPausedAction(page, "MIST_WATER", ["1.25"]);
  const waterAfter = await boundaryFlux(page);
  if (!(waterAfter.waterG > waterBefore.waterG + 1.0)) {
    throw new Error(`Water boundary flux did not increase: ${waterBefore.waterG} -> ${waterAfter.waterG}`);
  }

  const litterBefore = await boundaryFlux(page);
  await applyPausedAction(page, "ADD_LITTER", ["100"]);
  const litterAfter = await boundaryFlux(page);
  if (!(litterAfter.carbonMg > litterBefore.carbonMg + 90)) {
    throw new Error(`Litter boundary carbon did not increase: ${litterBefore.carbonMg} -> ${litterAfter.carbonMg}`);
  }

  const renderBeforeIntroduce = await renderMetrics(page);
  await applyPausedAction(page, "INTRODUCE_ORGANISM", ["trichorhina_tomentosa", "2"]);
  const renderAfterIntroduce = await renderMetrics(page);
  if (!(renderAfterIntroduce.totalEntities >= renderBeforeIntroduce.totalEntities + 2)) {
    throw new Error(`Introduced organisms did not reach renderer projection: ${renderBeforeIntroduce.totalEntities} -> ${renderAfterIntroduce.totalEntities}`);
  }

  await applyPausedAction(page, "CHANGE_LIGHT", ["0.5"]);
  const lightText = await page.locator("[data-overlay='light'] strong").textContent();
  if (!lightText || !/^93\s+PAR/.test(lightText)) {
    throw new Error(`Light boundary control did not affect simulation projection: ${lightText}`);
  }

  const ventilationBefore = await boundaryFlux(page);
  await applyPausedAction(page, "CHANGE_VENTILATION", ["0.01"]);
  const ventilationAfter = await boundaryFlux(page);
  if (
    Math.abs(ventilationAfter.carbonMg - ventilationBefore.carbonMg) < 1e-9 &&
    Math.abs(ventilationAfter.waterG - ventilationBefore.waterG) < 1e-9
  ) {
    throw new Error("Ventilation did not produce an explicit atmospheric boundary flux");
  }

  const hardscapeBefore = await renderMetrics(page);
  const hardscapeRow = await applyPausedAction(page, "PLACE_HARDSCAPE", ["wood"]);
  const hardscapeId = await hardscapeRow.getAttribute("data-hardscape-id");
  if (!hardscapeId) throw new Error("Placed hardscape did not retain its deterministic action identity");
  const hardscapeAdded = await renderMetrics(page);
  if (hardscapeAdded.dynamicHardscape !== hardscapeBefore.dynamicHardscape + 1) {
    throw new Error(`Hardscape was not visually added: ${hardscapeBefore.dynamicHardscape} -> ${hardscapeAdded.dynamicHardscape}`);
  }
  await applyPausedAction(page, "REMOVE_HARDSCAPE", [hardscapeId]);
  const hardscapeRemoved = await renderMetrics(page);
  if (hardscapeRemoved.dynamicHardscape !== hardscapeBefore.dynamicHardscape) {
    throw new Error(`Hardscape was not visually removed: ${hardscapeAdded.dynamicHardscape} -> ${hardscapeRemoved.dynamicHardscape}`);
  }

  await applyPausedAction(page, "REMOVE_ORGANISM");
  if (await page.locator(`.entity-card[data-entity-id="${selectedId}"]`).count()) {
    throw new Error("Removed entity remained selected in the UI");
  }
  await page.locator("[data-bottom-tab='events']").click();
  await page.getByText(/user_removal/).first().waitFor({ timeout: 5_000 });

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
  await page.locator("[data-command='pause']").click();
  await page.waitForSelector(".runtime-banner.paused");

  await page.locator("[data-world-command='save']").click();
  await page.getByText(/Saved: manual-/).waitFor({ timeout: 30_000 });
  const savedClock = await worldClock.textContent();

  await page.locator("[data-world-command='load']").click();
  await page.getByText(/Loaded latest save/).waitFor({ timeout: 30_000 });
  await page.locator("[data-command='pause']").click();
  await page.waitForSelector(".runtime-banner.paused");
  const loadedClock = await worldClock.textContent();
  if (
    !savedClock ||
    !loadedClock ||
    Math.abs(parseWorldClock(loadedClock) - parseWorldClock(savedClock)) > 60
  ) {
    throw new Error(`Load latest did not resume the saved world: ${savedClock} -> ${loadedClock}`);
  }

  await page.goto(`${baseUrl}/`, {
    waitUntil: "networkidle",
    timeout: 30_000
  });
  await page.waitForSelector(".runtime-banner.running", { timeout: 30_000 });
  await page.getByText(/Autosave resumed/).waitFor({ timeout: 30_000 });
  const resumedClock = await page.locator(".viewport-label.top-right strong").textContent();
  if (
    !savedClock ||
    !resumedClock ||
    parseWorldClock(resumedClock) < parseWorldClock(savedClock)
  ) {
    throw new Error(`Reload did not auto-resume saved world: ${savedClock} -> ${resumedClock}`);
  }
  const saveIds = await indexedDbSaveIds(page);

  await page.locator("[data-world-command='night-aid']").click();
  await page.getByText(/Visual night observation aid enabled/).waitFor();

  const preLifecycleIds = new Set(await renderedEntityIds(page));
  await page.locator("[data-speed='100']").click();
  const soakStartedAt = Date.now();
  let newLifecycleEntityId = null;
  while (Date.now() - soakStartedAt < soakMs && newLifecycleEntityId === null) {
    await page.waitForTimeout(500);
    const ids = await renderedEntityIds(page);
    newLifecycleEntityId =
      ids.find((id) => !preLifecycleIds.has(id)) ?? null;
  }
  const remainingSoakMs = soakMs - (Date.now() - soakStartedAt);
  if (remainingSoakMs > 0) {
    await page.waitForTimeout(remainingSoakMs);
  }
  await page.locator("[data-command='pause']").click();
  await page.waitForSelector(".runtime-banner.paused");

  await page.locator("[data-bottom-tab='events']").click();
  const eventText = await page.locator(".event-browser").innerText();
  if (!/(birth|reproduction|oviposition|clone)/i.test(eventText)) {
    throw new Error("Accelerated live run did not expose lifecycle turnover events");
  }
  if (newLifecycleEntityId === null) {
    throw new Error("Lifecycle turnover occurred but no new entity ID reached the renderer");
  }

  const finalRenderMetrics = await renderMetrics(page);
  if (!(finalRenderMetrics.totalEntities > 0 && finalRenderMetrics.visibleEntities > 0)) {
    throw new Error(`Renderer lost the live world during accelerated lifecycle turnover: ${JSON.stringify(finalRenderMetrics)}`);
  }

  await page.locator("[data-bottom-tab='profiler']").click();
  const profilerText = await page.locator(".profiler-content").innerText();
  if (!/Avg \/ tick/i.test(profilerText) || !/Frames emitted/i.test(profilerText)) {
    throw new Error("Profiler telemetry did not render after soak");
  }
  const profilerNumber = (pattern, label) => {
    const match = profilerText.match(pattern);
    const value = match ? Number(match[1]) : Number.NaN;
    if (!Number.isFinite(value)) {
      throw new Error(`Could not parse ${label} from worker profiler: ${profilerText}`);
    }
    return value;
  };
  const workerProfiler = {
    speed: profilerNumber(/Speed\s+(\d+(?:\.\d+)?)×/i, "speed"),
    lastStepWallMs: profilerNumber(/Last step\s+([\d.]+) ms/i, "last step"),
    emaStepWallMs: profilerNumber(/EMA step\s+([\d.]+) ms/i, "EMA step"),
    averageWallMsPerTick: profilerNumber(/Avg \/ tick\s+([\d.]+) ms/i, "average per tick"),
    backlogTicks: profilerNumber(/Backlog\s+([\d.]+) ticks/i, "backlog"),
    maxObservedBacklogTicks: profilerNumber(/Max backlog\s+([\d.]+) ticks/i, "max backlog"),
    framesEmitted: profilerNumber(/Frames emitted\s+(\d+)/i, "frames emitted")
  };
  if (workerProfiler.speed !== 100) {
    throw new Error(`Profiler did not retain 100× simulation speed: ${workerProfiler.speed}`);
  }
  const liveMemory = await page.evaluate(() => {
    const memory = performance.memory;
    return memory
      ? {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        }
      : null;
  });

  if (errors.length > 0) {
    throw new Error(`Browser emitted errors:\n${errors.join("\n")}`);
  }

  const errorPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await errorPage.goto(`${baseUrl}/?seed=7012`, {
      waitUntil: "networkidle",
      timeout: 30_000
    });
    await errorPage.waitForSelector(".runtime-banner.running", { timeout: 30_000 });
    await errorPage.locator("[data-bottom-tab='actions']").click();
    await withDialogs(errorPage, ["unknown_species", "1"], async () => {
      await errorPage.locator("[data-user-action='INTRODUCE_ORGANISM']").click();
    });
    await errorPage.waitForSelector(".runtime-banner.error", { timeout: 8_000 });
    const errorBanner = await errorPage.locator(".runtime-banner.error").innerText();
    if (!/cannot be introduced/i.test(errorBanner)) {
      throw new Error(`Worker error was not surfaced to the user: ${errorBanner}`);
    }
  } finally {
    await errorPage.close();
  }

  console.log(JSON.stringify({
    ok: true,
    initialClock,
    advancedClock,
    steppedClock,
    selectedId,
    savedClock,
    loadedClock,
    resumedClock,
    soakMs,
    saveIds,
    webgl,
    newLifecycleEntityId,
    finalRenderMetrics,
    workerProfiler,
    liveMemory
  }, null, 2));
} finally {
  await browser.close();
}
