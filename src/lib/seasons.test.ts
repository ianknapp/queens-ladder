import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSeasonRange,
  listResolvedSeasons,
  resolveSeasonWindow,
  selectSeason,
  type SeasonRecord,
} from "./seasons";

const seasonOne: SeasonRecord = {
  slug: "2026-s1",
  name: "Season 1",
  startDate: "2026-08-31",
  endDate: null,
  isActive: true,
};

describe("seasons", () => {
  it("treats an open season as present", () => {
    const season = selectSeason([seasonOne]);
    assert.equal(season.endDate, null);
    assert.equal(season.isActive, true);
    assert.equal(formatSeasonRange(season), "Aug 31 – present");
  });

  it("uses the active season by default", () => {
    const rows: SeasonRecord[] = [
      {
        slug: "2026-s1",
        name: "Season 1",
        startDate: "2026-08-31",
        endDate: "2026-12-31",
        isActive: false,
      },
      {
        slug: "2027-s2",
        name: "Season 2",
        startDate: "2027-01-01",
        endDate: null,
        isActive: true,
      },
    ];
    assert.equal(selectSeason(rows).id, "2027-s2");
    assert.equal(selectSeason(rows, "2026-s1").id, "2026-s1");
  });

  it("falls back to the active season for an unknown slug", () => {
    assert.equal(selectSeason([seasonOne], "missing").id, "2026-s1");
    assert.equal(selectSeason([seasonOne], undefined).id, "2026-s1");
  });

  it("closes an open season the day before the next one starts", () => {
    const first = {
      id: "s1",
      name: "One",
      startDate: "2026-08-31",
    };
    const second = {
      id: "s2",
      name: "Two",
      startDate: "2027-01-01",
    };
    const window = resolveSeasonWindow(first, [first, second]);
    assert.equal(window.endDate, "2026-12-31");
  });

  it("lists seasons in start-date order", () => {
    const listed = listResolvedSeasons([
      {
        slug: "s2",
        name: "Two",
        startDate: "2027-01-01",
        endDate: null,
        isActive: true,
      },
      {
        slug: "s1",
        name: "One",
        startDate: "2026-08-31",
        endDate: null,
        isActive: false,
      },
    ]);
    assert.deepEqual(
      listed.map((season) => season.id),
      ["s1", "s2"],
    );
    assert.equal(listed[0]?.endDate, "2026-12-31");
  });
});
