import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SeasonRecord } from "./seasons";
import {
  readSeasonForm,
  seasonOverlapMessage,
  slugifySeasonName,
  withSeasonDraft,
} from "./season-admin";

const seasonOne: SeasonRecord = {
  slug: "2026-s1",
  name: "Season 1",
  startDate: "2026-08-31",
  endDate: "2026-11-17",
  isActive: false,
};

describe("season admin forms", () => {
  it("builds a slug from the season name", () => {
    assert.equal(slugifySeasonName(" Season 2 "), "season-2");
  });

  it("accepts an open-ended season", () => {
    const form = new FormData();
    form.set("name", "Season 2");
    form.set("slug", "2026-s2");
    form.set("startDate", "2026-11-18");
    form.set("endDate", "");
    form.set("isActive", "on");
    const result = readSeasonForm(form, false);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.endDate, null);
    assert.equal(result.value.isActive, true);
  });

  it("rejects an end date before the start date", () => {
    const form = new FormData();
    form.set("name", "Season 2");
    form.set("slug", "2026-s2");
    form.set("startDate", "2026-11-18");
    form.set("endDate", "2026-11-01");
    const result = readSeasonForm(form, false);
    assert.equal(result.ok, false);
  });

  it("allows an open season to close the day before the next one", () => {
    const rows = withSeasonDraft(
      [{ ...seasonOne, endDate: null, isActive: true }],
      {
        slug: "2026-s2",
        name: "Season 2",
        startDate: "2026-11-18",
        endDate: null,
        isActive: true,
      },
    );
    assert.equal(seasonOverlapMessage(rows), null);
    assert.equal(rows.find((season) => season.slug === "2026-s1")?.isActive, false);
  });

  it("rejects an explicit end date that runs into the next season", () => {
    const rows = withSeasonDraft([seasonOne], {
      slug: "2026-s2",
      name: "Season 2",
      startDate: "2026-11-18",
      endDate: null,
      isActive: true,
    }).map((season) => {
      if (season.slug !== "2026-s1") return season;
      return { ...season, endDate: "2026-11-20" };
    });
    assert.match(seasonOverlapMessage(rows) ?? "", /overlaps/);
  });
});
