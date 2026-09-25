import { describe, expect, it } from "vitest";
import { MassLedger } from "../packages/sim-core/src/ledger.ts";

const zero = { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 };

describe("MassLedger", () => {
  it("conserves all tracked material during internal transfer", () => {
    const ledger = new MassLedger({
      a: { carbonMg: 10, nitrogenMg: 2, phosphorusMg: 1, waterG: 5 },
      b: { ...zero }
    });
    const before = ledger.totals();

    ledger.transfer("a", "b", {
      carbonMg: 3,
      nitrogenMg: 0.5,
      phosphorusMg: 0.25,
      waterG: 1
    });

    expect(ledger.totals()).toEqual(before);
    expect(ledger.getPool("b")).toEqual({
      carbonMg: 3,
      nitrogenMg: 0.5,
      phosphorusMg: 0.25,
      waterG: 1
    });
  });

  it("rejects transfers that create material from an overdrawn source", () => {
    const ledger = new MassLedger({
      a: { carbonMg: 1, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
      b: { ...zero }
    });

    expect(() =>
      ledger.transfer("a", "b", {
        carbonMg: 2,
        nitrogenMg: 0,
        phosphorusMg: 0,
        waterG: 0
      })
    ).toThrow(/Insufficient carbonMg/);
  });


  it("clamps only machine-scale overdrafts to the exact source remainder", () => {
    const ledger = new MassLedger({
      a: { carbonMg: 0.012, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
      b: { ...zero }
    });
    let observedCarbon = -1;
    ledger.observeTransfers((event) => {
      observedCarbon = event.amount.carbonMg;
    });

    ledger.transfer("a", "b", {
      carbonMg: 0.0120000000018,
      nitrogenMg: 0,
      phosphorusMg: 0,
      waterG: 0
    });

    expect(ledger.getPool("a").carbonMg).toBe(0);
    expect(ledger.getPool("b").carbonMg).toBe(0.012);
    expect(observedCarbon).toBe(0.012);

    expect(() =>
      ledger.transfer("b", "a", {
        carbonMg: 0.01201,
        nitrogenMg: 0,
        phosphorusMg: 0,
        waterG: 0
      })
    ).toThrow(/Insufficient carbonMg/);
  });

  it("records explicit boundary flux separately from internal transfer", () => {
    const ledger = new MassLedger({
      a: { carbonMg: 1, nitrogenMg: 0, phosphorusMg: 0, waterG: 1 }
    });

    ledger.applyBoundaryFlux("a", {
      carbonMg: 2,
      nitrogenMg: 0,
      phosphorusMg: 0,
      waterG: -0.25
    });

    expect(ledger.getPool("a")).toEqual({
      carbonMg: 3,
      nitrogenMg: 0,
      phosphorusMg: 0,
      waterG: 0.75
    });
    expect(ledger.cumulativeBoundaryFlux()).toEqual({
      carbonMg: 2,
      nitrogenMg: 0,
      phosphorusMg: 0,
      waterG: -0.25
    });
  });
});
