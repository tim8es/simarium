import {
  Phase1SimulationRuntimeAdapter,
  attachSimulationWorker,
  type WorkerEndpoint,
  type WorkerToUiMessage
} from "../packages/sim-runtime/src/index.js";

interface BrowserWorkerScope {
  postMessage(message: WorkerToUiMessage): void;
  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void
  ): void;
}

const scope = globalThis as unknown as BrowserWorkerScope;

const endpoint: WorkerEndpoint = {
  postMessage(message) {
    scope.postMessage(message);
  },
  addEventListener(type, listener) {
    scope.addEventListener(type, listener);
  }
};

attachSimulationWorker(endpoint, new Phase1SimulationRuntimeAdapter());
