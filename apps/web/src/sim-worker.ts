/// <reference lib="webworker" />

import {
  IntegratedEcosystemRuntimeAdapter,
  attachSimulationWorker
} from "../../../packages/sim-runtime/src/index.js";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void
  ): void;
};

attachSimulationWorker(
  scope,
  new IntegratedEcosystemRuntimeAdapter(),
  {
    // One ecology tick is 30 virtual minutes. At 1x the browser advances
    // one ecology tick per real second; speed controls multiply that cadence.
    ticksPerSecondAt1x: 1,
    pulseIntervalMs: 100,
    fullSnapshotEveryTicks: 48,
    maxTicksPerPulse: 50
  }
);
