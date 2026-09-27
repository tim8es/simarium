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

async function validationState() {
  return page.evaluate(() => {
    const api = window.__SIMARIUM_VALIDATION__;
    if (!api) throw new Error("Validation API is unavailable");
    return api.getState();
  });
}

async function setSpeed(speed) {
  await page.locator(`[data-speed='${speed}']`).click();
  await page.waitForFunction((expected) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return state?.ui?.speed === expected &&
      state?.ui?.paused === false &&
      state?.rawStats?.runtimeProfiler?.speed === expected &&
      state?.rawStats?.runtimeProfiler?.running === true;
  }, speed, { timeout: 15_000 });
}

async function answerAction(type, answers = []) {
  let index = 0;
  const onDialog = async dialog => {
    if (index >= answers.length) {
      await dialog.dismiss();
      return;
    }
    const value = answers[index++];
    await dialog.accept(String(value));
  };
  page.on("dialog", onDialog);
  try {
    await page.locator(`[data-user-action='${type}']`).click();
    if (answers.length > 0) {
      await page.waitForFunction(
        ({ expected, actionType }) => {
          const buttons = [...document.querySelectorAll("[data-user-action]")];
          return buttons.some(button => button.getAttribute("data-user-action") === actionType) &&
            expected >= 0;
        },
        { expected: answers.length, actionType: type }
      );
    }
  } finally {
    page.off("dialog", onDialog);
  }
  if (index !== answers.length) {
    throw new Error(
      `${type} expected ${answers.length} dialogs but handled ${index}`
    );
  }
}

function finiteMaterialTotals(value) {
  return value &&
    ["carbonMg", "nitrogenMg", "phosphorusMg", "waterG"].every(
      key => Number.isFinite(value[key])
    );
}

try {
  await page.goto(`${baseUrl}/?seed=7011&validation=1`, {
    waitUntil: "networkidle",
    timeout: 30_000
  });

  await page.waitForSelector(".runtime-banner.running", { timeout: 30_000 });
  await page.waitForSelector("#render-layer canvas", { timeout: 30_000 });
  await page.waitForFunction(() => Boolean(
    window.__SIMARIUM_VALIDATION__?.getState()?.rawStats
  ), undefined, { timeout: 30_000 });

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

  let advancedClock = initialClock;
  const clockDeadline = Date.now() + 8000;
  while (Date.now() < clockDeadline && advancedClock === initialClock) {
    await page.waitForTimeout(500);
    advancedClock = await worldClock.textContent();
  }
  if (!advancedClock || initialClock === advancedClock) {
    throw new Error(`World clock did not advance: ${initialClock} -> ${advancedClock}`);
  }

  for (const speed of [1, 5, 20, 100]) {
    await setSpeed(speed);
  }

  await page.locator("[data-command='pause']").click();
  await page.waitForSelector(".runtime-banner.paused");
  await page.waitForFunction(() => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return state?.ui?.paused === true &&
      state?.rawStats?.runtimeProfiler?.running === false;
  }, undefined, { timeout: 15_000 });

  const beforeStep = await validationState();
  const beforeStepTick = beforeStep.rawStats.tick;
  await page.locator("[data-world-command='step']").click();
  await page.waitForFunction((tick) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return state?.ui?.paused === true &&
      state?.rawStats?.runtimeProfiler?.running === false &&
      state?.rawStats?.tick > tick;
  }, beforeStepTick, { timeout: 15_000 });

  const pickTarget = await page.evaluate(() =>
    window.__SIMARIUM_VALIDATION__?.findPickTarget() ?? null
  );
  if (!pickTarget) {
    throw new Error("Renderer could not produce a real raycast picking target");
  }
  await page.mouse.click(pickTarget.clientX, pickTarget.clientY);
  await page.waitForFunction((entityId) =>
    window.__SIMARIUM_VALIDATION__?.getState()?.ui?.selectedEntityId === entityId,
    pickTarget.entityId,
    { timeout: 15_000 }
  );
  const selectedShortId = pickTarget.entityId.slice(
    pickTarget.entityId.lastIndexOf("#") + 1
  );
  await page.locator(".entity-card").getByText(
    new RegExp(`SELECTED · #${selectedShortId}\\b`)
  ).waitFor();
  await page.locator(".genealogy-panel .lineage-node.current").waitFor();
  await page.locator(".why-panel .reason-row").first().waitFor();

  await page.locator("[data-live-camera='follow']").click();
  await page.locator("[data-live-camera='follow'].is-active").waitFor();
  await page.waitForFunction(() =>
    window.__SIMARIUM_VALIDATION__?.getState()?.ui?.cameraMode === "follow"
  );

  const beforeSoak = await validationState();
  const initialRenderedIds = new Set(beforeSoak.renderedEntityIds);
  const initialBirths = { ...beforeSoak.rawStats.events.births };

  await setSpeed(100);
  await page.waitForTimeout(soakMs);

  await page.waitForFunction(() => {
    const stats = window.__SIMARIUM_VALIDATION__?.getState()?.rawStats;
    if (!stats?.populationSeries) return false;
    return Object.values(stats.populationSeries).some(
      points => Array.isArray(points) && points.length >= 2
    );
  }, undefined, { timeout: 30_000 });

  const afterSoak = await validationState();
  const bornAfterStart = ["folsomia", "trichorhina", "bradysia", "dalotia"]
    .some(key => (afterSoak.rawStats.events.births[key] ?? 0) >
      (initialBirths[key] ?? 0));
  if (!bornAfterStart) {
    throw new Error("Accelerated live simulation produced no post-start animal generation evidence");
  }
  const newlyRendered = afterSoak.renderedEntityIds.filter(
    id => !initialRenderedIds.has(id)
  );
  if (newlyRendered.length === 0) {
    throw new Error("Renderer did not display any entity ID created after the initial snapshot");
  }

  await page.locator("[data-bottom-tab='graphs']").click();
  await page.locator(".graph-content .series-row").first().waitFor();
  const graphRows = await page.locator(".graph-content .series-row").count();
  if (graphRows < 7) {
    throw new Error(`Population graphs missing live species series: ${graphRows}`);
  }

  await page.locator("[data-bottom-tab='foodWeb']").click();
  await page.waitForFunction(() => {
    const stats = window.__SIMARIUM_VALIDATION__?.getState()?.rawStats;
    return Array.isArray(stats?.foodWeb) &&
      stats.foodWeb.some(link => Number(link.biomassTransferMg) > 0);
  }, undefined, { timeout: 15_000 });
  await page.locator(".foodweb-content .web-edge").first().waitFor();

  await page.locator("[data-overlay='temperature']").click();
  await page.locator("[data-overlay='temperature'].is-active").waitFor();
  await page.locator("[data-bottom-tab='resources']").click();
  await page.getByText("Conservation residuals").waitFor();
  await page.locator("[data-bottom-tab='profiler']").click();
  await page.getByText("Simulation runtime").waitFor();
  await page.locator("[data-bottom-tab='events']").click();
  await page.getByText("RECENT EVENT STREAM").waitFor();

  await setSpeed(1);
  await page.locator("[data-bottom-tab='actions']").click();

  let state = await validationState();
  const waterBefore = state.rawStats.materialLedger.cumulativeBoundaryFlux.waterG;
  await answerAction("MIST_WATER", [1.25]);
  await page.waitForFunction((before) =>
    window.__SIMARIUM_VALIDATION__?.getState()
      ?.rawStats?.materialLedger?.cumulativeBoundaryFlux?.waterG > before + 1,
    waterBefore,
    { timeout: 15_000 }
  );

  state = await validationState();
  const carbonBefore = state.rawStats.materialLedger.cumulativeBoundaryFlux.carbonMg;
  await answerAction("ADD_LITTER", [100]);
  await page.waitForFunction((before) =>
    window.__SIMARIUM_VALIDATION__?.getState()
      ?.rawStats?.materialLedger?.cumulativeBoundaryFlux?.carbonMg > before + 99,
    carbonBefore,
    { timeout: 15_000 }
  );

  state = await validationState();
  const folsomiaBefore = state.rawStats.populations.folsomia_candida;
  await answerAction("INTRODUCE_ORGANISM", ["folsomia_candida", 3]);
  await page.waitForFunction((before) =>
    window.__SIMARIUM_VALIDATION__?.getState()
      ?.rawStats?.populations?.folsomia_candida >= before + 3,
    folsomiaBefore,
    { timeout: 15_000 }
  );

  state = await validationState();
  const removableId = state.renderedEntityIds.find(
    id => id.startsWith("folsomia_candida#")
  );
  if (!removableId) throw new Error("No live Folsomia render ID available for removal");
  await page.evaluate((entityId) =>
    window.__SIMARIUM_VALIDATION__?.selectEntity(entityId),
    removableId
  );
  await page.waitForFunction((entityId) =>
    window.__SIMARIUM_VALIDATION__?.getState()?.ui?.selectedEntityId === entityId,
    removableId
  );
  await answerAction("REMOVE_ORGANISM");
  await page.waitForFunction((entityId) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return !state?.renderedEntityIds?.includes(entityId) &&
      state?.rawStats?.events?.recent?.some(
        event => event.entityId === entityId && /user_removal/i.test(event.label)
      );
  }, removableId, { timeout: 15_000 });

  await answerAction("CHANGE_LIGHT", [0.5]);
  await page.waitForFunction(() => {
    const stats = window.__SIMARIUM_VALIDATION__?.getState()?.rawStats;
    return Math.abs(stats?.controls?.lightMultiplier - 0.5) < 1e-9 &&
      Math.abs(stats?.environment?.lightPar - 93) < 1e-6;
  }, undefined, { timeout: 15_000 });

  state = await validationState();
  const boundaryBeforeVent = {
    carbonMg: state.rawStats.materialLedger.cumulativeBoundaryFlux.carbonMg,
    waterG: state.rawStats.materialLedger.cumulativeBoundaryFlux.waterG
  };
  await answerAction("CHANGE_VENTILATION", [0.00005]);
  await page.waitForFunction((before) => {
    const stats = window.__SIMARIUM_VALIDATION__?.getState()?.rawStats;
    if (Math.abs(stats?.controls?.ventilationRatePerSecond - 0.00005) > 1e-12) {
      return false;
    }
    const flux = stats?.materialLedger?.cumulativeBoundaryFlux;
    return Math.abs((flux?.carbonMg ?? 0) - before.carbonMg) > 1e-9 ||
      Math.abs((flux?.waterG ?? 0) - before.waterG) > 1e-9;
  }, boundaryBeforeVent, { timeout: 20_000 });

  state = await validationState();
  const hardscapeIdsBefore = new Set(
    state.rawStats.hardscape.map(entry => entry.id)
  );
  const visualHardscapeBefore = state.dynamicHardscapeCount;
  await answerAction("PLACE_HARDSCAPE", ["wood"]);
  await page.waitForFunction(({ count, visualCount }) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return state?.rawStats?.hardscape?.length === count + 1 &&
      state?.dynamicHardscapeCount === visualCount + 1;
  }, {
    count: hardscapeIdsBefore.size,
    visualCount: visualHardscapeBefore
  }, { timeout: 15_000 });
  state = await validationState();
  const addedHardscapeId = state.rawStats.hardscape
    .map(entry => entry.id)
    .find(id => !hardscapeIdsBefore.has(id));
  if (!addedHardscapeId) throw new Error("Hardscape add did not expose an authoritative ID");

  await answerAction("REMOVE_HARDSCAPE", [addedHardscapeId]);
  await page.waitForFunction(({ id, visualCount }) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return !state?.rawStats?.hardscape?.some(entry => entry.id === id) &&
      state?.dynamicHardscapeCount === visualCount;
  }, {
    id: addedHardscapeId,
    visualCount: visualHardscapeBefore
  }, { timeout: 15_000 });

  await answerAction("CHANGE_VENTILATION", [0]);
  await page.waitForFunction(() =>
    window.__SIMARIUM_VALIDATION__?.getState()
      ?.rawStats?.controls?.ventilationRatePerSecond === 0
  );

  const keptIdsBefore = new Set(
    (await validationState()).rawStats.hardscape.map(entry => entry.id)
  );
  await answerAction("PLACE_HARDSCAPE", ["wood"]);
  await page.waitForFunction((count) =>
    window.__SIMARIUM_VALIDATION__?.getState()?.rawStats?.hardscape?.length === count + 1,
    keptIdsBefore.size,
    { timeout: 15_000 }
  );
  state = await validationState();
  const keptHardscapeId = state.rawStats.hardscape
    .map(entry => entry.id)
    .find(id => !keptIdsBefore.has(id));
  if (!keptHardscapeId) throw new Error("Persistent hardscape ID was not created");

  await answerAction("CHANGE_LIGHT", [0.65]);
  await page.waitForFunction(() =>
    Math.abs(
      window.__SIMARIUM_VALIDATION__?.getState()
        ?.rawStats?.controls?.lightMultiplier - 0.65
    ) < 1e-9
  );

  await page.waitForFunction(async () => {
    const api = window.__SIMARIUM_VALIDATION__;
    if (!api) return false;
    const saves = await api.listSaves();
    return saves.some(save => save.id === "autosave");
  }, undefined, { timeout: 45_000 });

  const materialBeforeSave = (await validationState()).rawStats.materialLedger.totals;
  if (!finiteMaterialTotals(materialBeforeSave)) {
    throw new Error("Material totals were non-finite before persistence checks");
  }

  async function manualSaveAndLoadCycle() {
    const previousMessage = (await validationState()).ui.saveMessage;
    await page.locator("[data-world-command='save']").click();
    await page.waitForFunction((previous) => {
      const message = window.__SIMARIUM_VALIDATION__?.getState()?.ui?.saveMessage;
      return typeof message === "string" &&
        /^Saved: manual-/.test(message) &&
        message !== previous;
    }, previousMessage, { timeout: 30_000 });
    const savedState = await validationState();
    const savedTime = savedState.rawStats.virtualTime;
    const savedTotals = savedState.rawStats.materialLedger.totals;
    await page.locator("[data-world-command='load']").click();
    await page.waitForFunction(() =>
      window.__SIMARIUM_VALIDATION__?.getState()?.ui?.saveMessage === "Loaded latest save"
    , undefined, { timeout: 30_000 });
    await page.waitForFunction((minimumTime) =>
      window.__SIMARIUM_VALIDATION__?.getState()?.rawStats?.virtualTime >= minimumTime
    , savedTime, { timeout: 30_000 });
    const loaded = await validationState();
    for (const key of ["carbonMg", "nitrogenMg", "phosphorusMg", "waterG"]) {
      if (Math.abs(loaded.rawStats.materialLedger.totals[key] - savedTotals[key]) > 1e-6) {
        throw new Error(
          `Material discontinuity after save/load for ${key}: ` +
          `${savedTotals[key]} -> ${loaded.rawStats.materialLedger.totals[key]}`
        );
      }
    }
    return { savedTime, savedTotals };
  }

  await manualSaveAndLoadCycle();
  await manualSaveAndLoadCycle();

  await answerAction("CHANGE_LIGHT", [1.2]);
  await answerAction("REMOVE_HARDSCAPE", [keptHardscapeId]);
  await page.waitForFunction((id) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return Math.abs(state?.rawStats?.controls?.lightMultiplier - 1.2) < 1e-9 &&
      !state?.rawStats?.hardscape?.some(entry => entry.id === id);
  }, keptHardscapeId, { timeout: 15_000 });

  await page.locator("[data-world-command='load']").click();
  await page.waitForFunction((id) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return state?.ui?.saveMessage === "Loaded latest save" &&
      Math.abs(state?.rawStats?.controls?.lightMultiplier - 0.65) < 1e-9 &&
      state?.rawStats?.hardscape?.some(entry => entry.id === id) &&
      state?.dynamicHardscapeCount >= 1;
  }, keptHardscapeId, { timeout: 30_000 });

  const beforeReloadSaveMessage = (await validationState()).ui.saveMessage;
  await page.locator("[data-world-command='save']").click();
  await page.waitForFunction((previous) => {
    const message = window.__SIMARIUM_VALIDATION__?.getState()?.ui?.saveMessage;
    return typeof message === "string" &&
      /^Saved: manual-/.test(message) &&
      message !== previous;
  }, beforeReloadSaveMessage, { timeout: 30_000 });
  const persistedBeforeReload = await validationState();
  const persistedTime = persistedBeforeReload.rawStats.virtualTime;

  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForSelector(".runtime-banner.running", { timeout: 30_000 });
  const reloadedDayZero = await worldClock.textContent();
  if (!reloadedDayZero || !/DAY 0\b/.test(reloadedDayZero)) {
    throw new Error(`Fresh page did not restart at Day 0 before explicit load: ${reloadedDayZero}`);
  }
  await page.locator("[data-world-command='load']").click();
  await page.waitForFunction(({ time, id }) => {
    const state = window.__SIMARIUM_VALIDATION__?.getState();
    return state?.ui?.saveMessage === "Loaded latest save" &&
      state?.rawStats?.virtualTime >= time &&
      state?.rawStats?.hardscape?.some(entry => entry.id === id) &&
      Math.abs(state?.rawStats?.controls?.lightMultiplier - 0.65) < 1e-9;
  }, { time: persistedTime, id: keptHardscapeId }, { timeout: 30_000 });

  const loadedClock = await worldClock.textContent();
  if (!loadedClock || /DAY 0 · 00:00/.test(loadedClock)) {
    throw new Error(`Reload/load did not restore advanced world time: ${loadedClock}`);
  }
  const loadedTime = (await validationState()).rawStats.virtualTime;
  await page.waitForFunction((time) =>
    window.__SIMARIUM_VALIDATION__?.getState()?.rawStats?.virtualTime > time
  , loadedTime, { timeout: 15_000 });

  await page.locator("[data-world-command='night-aid']").click();
  await page.getByText(/Visual night observation aid enabled/).waitFor();

  await page.evaluate(() =>
    window.__SIMARIUM_VALIDATION__?.probeWorkerError()
  );
  await page.waitForSelector(".runtime-banner.error", { timeout: 15_000 });
  const errorBanner = await page.locator(".runtime-banner.error").innerText();
  if (!/ERROR/i.test(errorBanner) || errorBanner.length < 10) {
    throw new Error(`Worker error was not surfaced to the user: ${errorBanner}`);
  }

  if (errors.length > 0) {
    throw new Error(`Browser emitted errors:\n${errors.join("\n")}`);
  }

  const finalState = await validationState();
  console.log(JSON.stringify({
    ok: true,
    initialClock,
    advancedClock,
    loadedClock,
    soakMs,
    webgl,
    newlyRenderedEntities: newlyRendered.length,
    finalTick: finalState.rawStats.tick,
    autosaveVerified: true,
    workerErrorSurfaced: true
  }, null, 2));
} finally {
  await browser.close();
}
