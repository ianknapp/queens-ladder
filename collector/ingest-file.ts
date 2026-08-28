import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ingestCapture } from "../src/lib/ingest";
import { capturePayloadSchema } from "../src/lib/ingest";
import { loadDotEnv } from "./load-env";

async function main() {
  loadDotEnv();
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run ingest -- data/<game>-YYYY-MM-DD.json");
    process.exit(1);
  }

  const parsed = capturePayloadSchema.parse(JSON.parse(readFileSync(resolve(file), "utf8")));
  const result = await ingestCapture(parsed);
  console.log(`Ingested ${file}: ${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
