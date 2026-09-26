import { describe, expect, it } from "vitest";
import { parseUiToWorkerMessage } from "../packages/sim-runtime/src/protocol.ts";

describe("runtime speed contract", () => {
  it("accepts only the supported time-control multipliers", () => {
    for (const speed of [1, 5, 20, 100] as const) {
      expect(parseUiToWorkerMessage({ type: "SET_SPEED", requestId: `speed-${speed}`, speed })).toEqual({
        type: "SET_SPEED",
        requestId: `speed-${speed}`,
        speed
      });
    }

    for (const speed of [0, 2, 10, 50, 101]) {
      expect(() => parseUiToWorkerMessage({ type: "SET_SPEED", requestId: "invalid-speed", speed })).toThrow(
        /1, 5, 20, 100/
      );
    }
  });
});
