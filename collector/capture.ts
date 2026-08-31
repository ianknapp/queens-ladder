import { mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Frame, type Page, type Response } from "playwright";
import { ingestCapture } from "../src/lib/ingest";
import { leaderboardUrl, parseGameArgs, resultsUrl, type GameDef } from "../src/lib/games";
import {
  extractEntriesFromJson,
  extractEntriesFromBodyText,
  extractGlobalAverageMsFromJson,
  extractGlobalAverageMsFromText,
  mergeEntries,
  puzzleNumberFromText,
} from "../src/lib/parse-leaderboard";
import { formatMs, pacificDate } from "../src/lib/time";
import type { CaptureKind, CapturePayload, LeaderboardEntry } from "../src/lib/types";
import { hostLeaderboardAvatars } from "./host-avatars";
import { loadDotEnv } from "./load-env";

const GAMES_HUB_URL = "https://www.linkedin.com/games/";
const LOGIN_URL = `https://www.linkedin.com/login?session_redirect=${encodeURIComponent(GAMES_HUB_URL)}`;
const PROFILE_DIR = resolve(process.cwd(), ".playwright-profile");
const DATA_DIR = resolve(process.cwd(), "data");

function argValue(name: string) {
  const prefix = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

type DomCapture = {
  puzzleNumber: number | null;
  pageUrl: string;
  bodyText: string;
  entries: LeaderboardEntry[];
  globalAverageMs: number | null;
};

function extractFromDom(gameName: string): DomCapture {
  const entries: LeaderboardEntry[] = [];
  let inferredRank = 0;

  const containers = Array.from(
    document.querySelectorAll(".pr-connections-leaderboard-player__container"),
  );

  for (const container of containers) {
    if (container.querySelector(".pr-connections-leaderboard-player__nudge-button")) continue;

    const name =
      container.querySelector(".pr-connections-leaderboard-player__name-text")?.textContent?.trim() ??
      "";
    const scoreText =
      container.querySelector(".pr-connections-leaderboard-player__score")?.textContent?.trim() ?? "";
    const timeMatch = scoreText.match(/^(\d{1,2}):(\d{2})$/);
    if (!name || !timeMatch) continue;

    inferredRank += 1;
    const rankText =
      container.querySelector(".pr-connections-leaderboard-player__ranking span")?.textContent?.trim() ??
      "";
    const photo = container.querySelector(
      ".pr-connections-leaderboard-player__image-container img",
    ) as HTMLImageElement | null;
    const subtitle =
      container.querySelector(".pr-connections-leaderboard-player__subtitle-copy")?.textContent ?? "";
    const photoName = photo?.getAttribute("alt")?.trim() ?? "";
    const displayName = name === "You" && photoName ? photoName : name;
    const avatarCandidates = [
      photo?.currentSrc,
      photo?.getAttribute("data-delayed-url"),
      photo?.getAttribute("data-src"),
      photo?.getAttribute("src"),
    ];
    let avatarUrl: string | null = null;
    for (const candidate of avatarCandidates) {
      if (candidate && /^https?:/i.test(candidate) && !/static\.licdn\.com/i.test(candidate)) {
        avatarUrl = candidate;
        break;
      }
    }

    entries.push({
      rank: /^\d+$/.test(rankText) ? Number(rankText) : inferredRank,
      displayName,
      profileUrl: null,
      profileId: null,
      linkedinUrn: null,
      avatarUrl,
      timeMs: (Number(timeMatch[1]) * 60 + Number(timeMatch[2])) * 1000,
      visibility: "score",
      noHints: /no hints/i.test(subtitle) ? true : null,
      noMistakes: /no mistakes/i.test(subtitle) ? true : null,
    });
  }

  const bodyText = document.body?.innerText || "";
  const escaped = gameName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const puzzle =
    bodyText.match(new RegExp(`${escaped}\\s*#\\s*(\\d+)`, "i")) ??
    bodyText.match(/Puzzle No\.?\s*(\d+)/i);

  let globalAverageMs: number | null = null;
  const chiclets = Array.from(document.querySelectorAll(".pr-golden-chiclet"));
  for (const chiclet of chiclets) {
    const subtext = chiclet.querySelector(".pr-golden-chiclet__subtext")?.textContent ?? "";
    if (!/today.?s\s+avg/i.test(subtext)) continue;
    const clock = subtext.match(/(\d{1,2}:\d{2})/);
    if (!clock) continue;
    const parts = clock[1].split(":");
    globalAverageMs = (Number(parts[0]) * 60 + Number(parts[1])) * 1000;
    break;
  }
  if (globalAverageMs == null) {
    const avgMatch = bodyText.match(/today['’]?s\s+avg[:\s]+(\d{1,2}:\d{2})/i);
    if (avgMatch) {
      const parts = avgMatch[1].split(":");
      globalAverageMs = (Number(parts[0]) * 60 + Number(parts[1])) * 1000;
    }
  }

  return {
    puzzleNumber: puzzle ? Number(puzzle[1]) : null,
    pageUrl: location.href,
    bodyText: bodyText.slice(0, 20_000),
    entries,
    globalAverageMs,
  };
}

async function extractFromFrame(frame: Frame | Page, gameName: string): Promise<DomCapture> {
  return frame.evaluate(extractFromDom, gameName);
}

async function downloadAvatar(page: Page, url: string) {
  try {
    const response = await page.request.get(url, { timeout: 20_000 });
    if (!response.ok()) return null;
    return {
      bytes: Buffer.from(await response.body()),
      contentType: response.headers()["content-type"] ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

async function extractFromPage(page: Page, gameName: string): Promise<DomCapture> {
  const targets: Array<Frame | Page> = [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
  const captures = await Promise.all(
    targets.map(async (target) => {
      try {
        return await extractFromFrame(target, gameName);
      } catch {
        return {
          puzzleNumber: null,
          pageUrl: "frame",
          bodyText: "",
          entries: [] as LeaderboardEntry[],
          globalAverageMs: null,
        };
      }
    }),
  );

  return {
    puzzleNumber: captures.find((item) => item.puzzleNumber)?.puzzleNumber ?? null,
    pageUrl: page.url(),
    bodyText: captures.map((item) => item.bodyText).filter(Boolean).join("\n"),
    entries: mergeEntries(...captures.map((item) => item.entries)),
    globalAverageMs: captures.find((item) => item.globalAverageMs != null)?.globalAverageMs ?? null,
  };
}

async function waitForEnter(message: string) {
  const rl = createInterface({ input, output });
  try {
    await rl.question(message);
  } finally {
    rl.close();
  }
}

async function isLoggedIn(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.some((cookie) => cookie.name === "li_at" && cookie.value.length > 10);
}

async function livePage(context: BrowserContext, current?: Page) {
  if (current && !current.isClosed()) return current;
  const existing = context.pages().find((page) => !page.isClosed());
  if (existing) return existing;
  return context.newPage();
}

async function gotoOrRevive(context: BrowserContext, page: Page, url: string) {
  let target = await livePage(context, page);
  await target.bringToFront().catch(() => undefined);
  console.log(`Opening ${url}`);
  try {
    await target.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return target;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/closed|Target page|browser has been closed/i.test(message)) throw error;
    console.log("The first tab closed itself. Opening a new tab — leave this Chromium window open.");
    target = await context.newPage();
    await target.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return target;
  }
}

async function ensureLoggedIn(context: BrowserContext, page: Page, forceLogin: boolean) {
  if (!forceLogin && (await isLoggedIn(context))) return page;

  console.log("Leave the Chromium window open. Navigating to LinkedIn sign-in now.");
  page = await gotoOrRevive(context, page, LOGIN_URL);

  while (!(await isLoggedIn(context))) {
    page = await livePage(context, page);
    await waitForEnter(
      "Sign in to LinkedIn in that window, then come back here and press Enter.\n> ",
    );
    if (!(await isLoggedIn(context))) {
      console.log("Still no LinkedIn session cookie. Opening sign-in again.");
      page = await gotoOrRevive(context, page, LOGIN_URL);
    }
  }

  console.log("Logged in. Opening game leaderboards…");
  return page;
}

async function clickSeeMore(page: Page) {
  const scopes: Array<Page | ReturnType<Page["frameLocator"]>> = [
    page,
    page.frameLocator("iframe.game-launch-page__iframe"),
    page.frameLocator('iframe[title="games"]'),
    page.frameLocator("iframe"),
  ];

  for (let i = 0; i < 40; i += 1) {
    let clicked = false;
    for (const scope of scopes) {
      const candidates = [
        scope.getByRole("button", { name: /see more|show more/i }),
        scope.getByRole("link", { name: /see more|show more/i }),
        scope.getByText(/^see more$/i),
        scope.getByText(/^show more$/i),
      ];
      for (const locator of candidates) {
        try {
          const first = locator.first();
          if (await first.isVisible({ timeout: 700 })) {
            await first.scrollIntoViewIfNeeded().catch(() => undefined);
            await first.click({ timeout: 2000 });
            clicked = true;
            await page.waitForTimeout(900);
            break;
          }
        } catch {
          // try next locator
        }
      }
      if (clicked) break;
    }
    if (!clicked) break;
  }
}

async function openGame(context: BrowserContext, page: Page, game: GameDef) {
  const url = leaderboardUrl(game.slug);
  page = await gotoOrRevive(context, page, url);
  await page.waitForTimeout(2000);

  if (!page.url().includes("/leaderboard/connections")) {
    console.log(`Not on the ${game.name} connections leaderboard yet. Finish today's puzzle, then open:`);
    console.log(url);
  }

  await clickSeeMore(page);
  await page
    .waitForSelector(".pr-connections-leaderboard-player__score", { timeout: 15_000 })
    .catch(() => undefined);
  return page;
}

async function captureOnce(
  context: BrowserContext,
  page: Page,
  networkJson: unknown[],
  game: GameDef,
  kind: CaptureKind,
  dump: boolean,
) {
  networkJson.length = 0;
  page = await openGame(context, page, game);

  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(350);
  }
  await clickSeeMore(page);

  const dom = await extractFromPage(page, game.name);
  const fromNetwork = mergeEntries(...networkJson.map((item) => extractEntriesFromJson(item)));
  const fromText = extractEntriesFromBodyText(dom.bodyText);
  let entries =
    dom.entries.length > 0
      ? mergeEntries(dom.entries, fromNetwork)
      : mergeEntries(fromNetwork, fromText);
  const hosted = await hostLeaderboardAvatars(entries, (url) => downloadAvatar(page, url));
  entries = hosted.entries;
  if (hosted.uploaded > 0 || hosted.failed > 0) {
    console.log(`  avatars: ${hosted.uploaded} stored, ${hosted.failed} failed`);
  }
  const puzzleNumber = dom.puzzleNumber ?? puzzleNumberFromText(dom.bodyText, game.name);
  let globalAverageMs =
    dom.globalAverageMs ??
    extractGlobalAverageMsFromText(dom.bodyText) ??
    extractGlobalAverageMsFromJson(networkJson);

  if (globalAverageMs == null && entries.length > 0) {
    page = await gotoOrRevive(context, page, resultsUrl(game.slug));
    await page
      .waitForSelector(".pr-golden-chiclet, .pr-top__headline", { timeout: 12_000 })
      .catch(() => undefined);
    const resultsDom = await extractFromPage(page, game.name);
    globalAverageMs =
      resultsDom.globalAverageMs ??
      extractGlobalAverageMsFromText(resultsDom.bodyText) ??
      extractGlobalAverageMsFromJson(networkJson);
  }

  const payload: CapturePayload = {
    game: game.slug,
    puzzleDate: pacificDate(),
    puzzleNumber,
    capturedAt: new Date().toISOString(),
    kind,
    pageUrl: page.url(),
    entries,
    globalAverageMs,
    raw: dump
      ? { bodyText: dom.bodyText, networkCount: networkJson.length, networkJson }
      : { bodyText: dom.bodyText, networkCount: networkJson.length },
  };

  const stamp = payload.puzzleDate;
  const jsonPath = resolve(DATA_DIR, `${game.slug}-${stamp}.json`);
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  if (dump || entries.length === 0) {
    await page.screenshot({ path: resolve(DATA_DIR, `${game.slug}-${stamp}.png`), fullPage: true });
    writeFileSync(resolve(DATA_DIR, `${game.slug}-${stamp}.html`), await page.content());
  }

  console.log(`${game.name}: saved ${entries.length} rows to ${jsonPath}`);
  if (globalAverageMs != null) {
    console.log(`  LinkedIn avg ${formatMs(globalAverageMs)}`);
  }
  for (const entry of entries.slice(0, 8)) {
    console.log(`  ${entry.rank ?? "-"}  ${entry.displayName}  ${formatMs(entry.timeMs)}`);
  }

  return { page, payload };
}

async function postIngest(payload: CapturePayload): Promise<boolean> {
  if (payload.entries.length === 0) {
    console.log(`Skipping ingest for ${payload.game} because no leaderboard rows were parsed.`);
    return false;
  }

  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (hasSupabase) {
    try {
      const result = await ingestCapture(payload);
      console.log(`Ingested ${payload.game} to Supabase: ${JSON.stringify(result)}`);
      return true;
    } catch (error) {
      console.error(`Direct Supabase ingest failed for ${payload.game}:`, error);
    }
  }

  const ingestUrl = process.env.CAPTURE_INGEST_URL;
  const secret = process.env.CAPTURE_SECRET;
  if (!ingestUrl || !secret) {
    if (!hasSupabase) {
      console.log("Skipping ingest (set Supabase keys, or CAPTURE_INGEST_URL + CAPTURE_SECRET).");
    }
    return false;
  }

  try {
    const response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-capture-secret": secret,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.text();
    if (!response.ok) {
      console.error(`Ingest failed for ${payload.game} (${response.status}): ${body}`);
      return false;
    }
    console.log(`Posted ${payload.game} to ${ingestUrl}: ${body}`);
    return true;
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const code =
      cause && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: string }).code)
        : "";
    if (code === "ECONNREFUSED") {
      console.error(
        `Nothing is listening at ${ingestUrl}. Scores are saved under data/. Re-run with npm run ingest -- data/${payload.game}-YYYY-MM-DD.json`,
      );
    } else {
      console.error(`Ingest request failed for ${payload.game}:`, error);
    }
    return false;
  }
}

async function main() {
  loadDotEnv();
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(PROFILE_DIR, { recursive: true });

  const forceLogin = hasFlag("--login");
  const dump = hasFlag("--dump");
  const headed = forceLogin || hasFlag("--headed") || !hasFlag("--headless");
  const kind = (argValue("--kind") as CaptureKind | null) ?? "manual";
  const games = parseGameArgs(argValue("--game"));

  const networkJson: unknown[] = [];
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !headed,
    viewport: { width: 1280, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const attachNetwork = (target: Page) => {
    target.on("response", async (response: Response) => {
      const url = response.url();
      if (!/voyager|graphql|games/i.test(url)) return;
      const contentType = response.headers()["content-type"] ?? "";
      if (!contentType.includes("json")) return;
      try {
        networkJson.push({ url, json: await response.json() });
      } catch {
        // ignore non-json
      }
    });
  };

  context.on("page", attachNetwork);
  let page = await livePage(context);
  attachNetwork(page);
  await page.bringToFront().catch(() => undefined);

  try {
    page = await ensureLoggedIn(context, page, forceLogin);

    let captured = 0;
    let ingested = 0;

    for (const game of games) {
      console.log(`\n=== ${game.name} ===`);
      let result = await captureOnce(context, page, networkJson, game, kind, dump);
      page = result.page;

      if (result.payload.entries.length === 0 && headed && games.length === 1) {
        while (result.payload.entries.length === 0) {
          console.log(`No leaderboard rows yet. Stay on ${leaderboardUrl(game.slug)}`);
          await waitForEnter("Press Enter to scan again, or Ctrl+C to quit.\n> ");
          page = await livePage(context, page);
          result = await captureOnce(context, page, networkJson, game, kind, true);
          page = result.page;
        }
      }

      if (result.payload.entries.length > 0) captured += 1;
      if (await postIngest(result.payload)) ingested += 1;
    }

    console.log(`\nDone. ${captured}/${games.length} games captured, ${ingested}/${games.length} ingested.`);
    if (captured === 0) process.exitCode = 1;
  } finally {
    await context.close().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/closed|Target page|browser has been closed/i.test(message)) {
    console.error(
      "The Chromium window closed before LinkedIn loaded. Run `npm run capture:login` again and leave that window open.",
    );
  } else {
    console.error(error);
  }
  process.exit(1);
});
