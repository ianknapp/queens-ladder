import { NextRequest, NextResponse } from "next/server";
import { verifyCaptureSecret } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { capturePayloadSchema, ingestCapture } from "@/lib/ingest";

export async function POST(request: NextRequest) {
  if (!verifyCaptureSecret(request.headers.get("x-capture-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server yet." },
      { status: 503 },
    );
  }

  try {
    const json = await request.json();
    const parsed = capturePayloadSchema.parse(json);
    const result = await ingestCapture(parsed);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
