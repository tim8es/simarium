import { describe, expect, it } from "vitest";
import { createIntegratedEcosystem } from "../tools/ecosystem-factory.ts";

describe("Phase 7 integrated ecosystem", () => {
  it("runs 60 virtual days with all trophic layers active and no material invariant failure", () => {
    const eco = createIntegratedEcosystem(7001);
    const stepsPerDay = 86400 / eco.world.config.fixedDtSeconds;

    for (let day = 0; day < 60; day++) {
      eco.scheduler.step(stepsPerDay);
      eco.invariants.check(eco.world);
    }

    for (const population of Object.values(eco.plants)) {
      expect(population.living().length).toBeGreaterThan(0);
      expect(
        population.eventLog().some((event) => event.type === "clone")
      ).toBe(true);
      expect(
        population.eventLog().some((event) => event.type === "death")
      ).toBe(true);
    }

    expect(
      eco.animals.folsomia.all().some((x) => x.parentId !== undefined)
    ).toBe(true);
    expect(
      eco.animals.trichorhina.all().some((x) => x.parentId !== undefined)
    ).toBe(true);
    expect(
      eco.animals.bradysia.all().some((x) => x.parentId !== undefined)
    ).toBe(true);
    expect(
      eco.animals.dalotia.all().some((x) => x.parentId !== undefined)
    ).toBe(true);

    expect(eco.world.ledger.getPool("litter").carbonMg).toBeGreaterThan(0);
    expect(
      eco.world.ledger.getPool("available_nutrients").nitrogenMg
    ).toBeGreaterThanOrEqual(0);

    const animalDeaths =
      eco.animals.folsomia.all().filter((x) => !x.alive).length +
      eco.animals.trichorhina.all().filter((x) => !x.alive).length +
      eco.animals.bradysia.all().filter((x) => !x.alive).length +
      eco.animals.dalotia.all().filter((x) => !x.alive).length;
    expect(animalDeaths).toBeGreaterThan(0);

    expect(
      eco.animals.dalotia
        .eventLog()
        .some((event) => event.type === "predation")
    ).toBe(true);

    eco.invariants.check(eco.world);
  }, 60_000);

  it("remains deterministic for the same integrated seed", () => {
    const run = (): string => {
      const eco = createIntegratedEcosystem(7011);
      eco.scheduler.runFor(10 * 86400);
      eco.invariants.check(eco.world);
      return JSON.stringify({
        pools: eco.world.ledger.snapshot(),
        folsomia: eco.animals.folsomia.all().map((x) => [x.id, x.stage, x.alive]),
        trichorhina: eco.animals.trichorhina.all().map((x) => [x.id, x.stage, x.alive]),
        bradysia: eco.animals.bradysia.all().map((x) => [x.id, x.stage, x.alive, x.sex]),
        dalotia: eco.animals.dalotia.all().map((x) => [x.id, x.stage, x.alive, x.sex]),
        spatial: eco.habitat.entries()
      });
    };

    expect(run()).toBe(run());
  }, 60_000);
});
