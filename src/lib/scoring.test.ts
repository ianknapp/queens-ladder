import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSeason,
  ensureTrackedPlaceScores,
  formatPlace,
  pointsForPlace,
  rankFriends,
} from "./scoring";
import type { DailyRow, LeaderboardEntry } from "./types";

function entry(
  name: string,
  timeMs: number | null,
  extras: Partial<LeaderboardEntry> = {},
): LeaderboardEntry {
  return {
    rank: extras.rank ?? null,
    displayName: name,
    profileUrl: extras.profileUrl ?? `https://linkedin.com/in/${name}`,
    profileId: extras.profileId ?? name,
    linkedinUrn: null,
    avatarUrl: null,
    timeMs,
    visibility: extras.visibility ?? "score",
    noHints: extras.noHints ?? true,
    noMistakes: extras.noMistakes ?? true,
  };
}

function rankOf(entries: LeaderboardEntry[], name: string) {
  const result = rankFriends(entries);
  const ranked = result.get(name);
  assert.ok(ranked, `${name} should be ranked`);
  return ranked;
}

describe("place points", () => {
  it("awards the place number, capped at 10", () => {
    assert.equal(pointsForPlace(1), 1);
    assert.equal(pointsForPlace(10), 10);
    assert.equal(pointsForPlace(11), 10);
    assert.equal(pointsForPlace(25), 10);
  });

  it("formats ordinals", () => {
    assert.equal(formatPlace(1), "1st");
    assert.equal(formatPlace(2), "2nd");
    assert.equal(formatPlace(3), "3rd");
    assert.equal(formatPlace(4), "4th");
    assert.equal(formatPlace(11), "11th");
    assert.equal(formatPlace(21), "21st");
  });
});

describe("rankFriends", () => {
  it("gives 1 / 2 / 3 for unique times", () => {
    const ranked = rankFriends([
      entry("a", 8000),
      entry("b", 9000),
      entry("c", 10000),
    ]);
    assert.deepEqual(ranked.get("a"), { friendRank: 1, points: 1 });
    assert.deepEqual(ranked.get("b"), { friendRank: 2, points: 2 });
    assert.deepEqual(ranked.get("c"), { friendRank: 3, points: 3 });
  });

  it("uses competition ranking so a 3-way tie for first makes the next person 4th", () => {
    const ranked = rankFriends([
      entry("a", 8000),
      entry("b", 8000),
      entry("c", 8000),
      entry("d", 9000),
    ]);
    assert.deepEqual(ranked.get("a"), { friendRank: 1, points: 1 });
    assert.deepEqual(ranked.get("b"), { friendRank: 1, points: 1 });
    assert.deepEqual(ranked.get("c"), { friendRank: 1, points: 1 });
    assert.deepEqual(ranked.get("d"), { friendRank: 4, points: 4 });
  });

  it("caps points at 10 while keeping the true place", () => {
    const entries = Array.from({ length: 12 }, (_, index) =>
      entry(`p${index + 1}`, (index + 1) * 1000),
    );
    assert.deepEqual(rankOf(entries, "p10"), { friendRank: 10, points: 10 });
    assert.deepEqual(rankOf(entries, "p11"), { friendRank: 11, points: 10 });
    assert.deepEqual(rankOf(entries, "p12"), { friendRank: 12, points: 10 });
  });

  it("ignores hidden scores when assigning place", () => {
    const ranked = rankFriends([
      entry("a", 8000),
      entry("b", null, { visibility: "played_only" }),
      entry("c", 9000),
    ]);
    assert.deepEqual(ranked.get("a"), { friendRank: 1, points: 1 });
    assert.deepEqual(ranked.get("c"), { friendRank: 2, points: 2 });
    assert.equal(ranked.get("b"), undefined);
  });
});

describe("ensureTrackedPlaceScores", () => {
  const tracked = [
    { playerId: "a", displayName: "a", profileUrl: null, avatarUrl: null },
    { playerId: "b", displayName: "b", profileUrl: null, avatarUrl: null },
  ];

  function row(playerId: string, extras: Partial<DailyRow> = {}): DailyRow {
    return {
      playerId,
      displayName: playerId,
      profileUrl: null,
      avatarUrl: null,
      isTracked: true,
      linkedinRank: extras.linkedinRank === undefined ? null : extras.linkedinRank,
      timeMs: extras.timeMs === undefined ? 8000 : extras.timeMs,
      visibility: extras.visibility === undefined ? "score" : extras.visibility,
      friendRank: extras.friendRank === undefined ? 1 : extras.friendRank,
      points: extras.points === undefined ? 1 : extras.points,
    };
  }

  it("does not invent scores when a game was not captured", () => {
    const rows = ensureTrackedPlaceScores([], tracked, false);
    assert.equal(rows.length, 0);
  });

  it("gives 10 to tracked friends who missed a captured game", () => {
    const rows = ensureTrackedPlaceScores([row("a")], tracked, true);
    const missed = rows.find((item) => item.playerId === "b");
    assert.deepEqual(missed?.points, 10);
    assert.equal(missed?.friendRank, null);
  });

  it("gives 10 to a hidden score on a captured game", () => {
    const rows = ensureTrackedPlaceScores(
      [
        row("a"),
        row("b", {
          timeMs: null,
          visibility: "played_only",
          friendRank: null,
          points: null,
        }),
      ],
      tracked,
      true,
    );
    assert.equal(rows.find((item) => item.playerId === "b")?.points, 10);
  });
});

describe("buildSeason", () => {
  it("sums place points and ranks lowest first", () => {
    const rows = buildSeason([
      {
        globalAverageMs: null,
        rows: [
          {
            playerId: "a",
            displayName: "a",
            profileUrl: null,
            avatarUrl: null,
            isTracked: true,
            linkedinRank: 1,
            timeMs: 8000,
            visibility: "score",
            friendRank: 1,
            points: 1,
          },
          {
            playerId: "b",
            displayName: "b",
            profileUrl: null,
            avatarUrl: null,
            isTracked: true,
            linkedinRank: 2,
            timeMs: 9000,
            visibility: "score",
            friendRank: 2,
            points: 2,
          },
        ],
      },
    ]);
    assert.equal(rows[0]?.playerId, "a");
    assert.equal(rows[0]?.points, 1);
    assert.equal(rows[1]?.playerId, "b");
    assert.equal(rows[1]?.points, 2);
  });
});
