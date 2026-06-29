// GET /api/report-status?outputKey=...&failureKey=...
// Polls S3 for the async result. Returns:
//   { status: "pending" }                  -> still running (incl. cold start)
//   { status: "done", report: {...} }      -> finished, parsed report
//   { status: "failed", error: "..." }     -> inference error
import { NextResponse } from "next/server";
import { s3Exists, s3GetText, parseReport } from "@/lib/aws";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const outputKey = searchParams.get("outputKey");
    const failureKey = searchParams.get("failureKey");

    if (!outputKey) {
      return NextResponse.json({ error: "Missing outputKey." }, { status: 400 });
    }

    // Check for a failure object first.
    if (failureKey && (await s3Exists(failureKey))) {
      const body = await s3GetText(failureKey);
      let message = body;
      try {
        message = JSON.parse(body).message || body;
      } catch {}
      return NextResponse.json({ status: "failed", error: message });
    }

    // Then for the result.
    if (await s3Exists(outputKey)) {
      const body = await s3GetText(outputKey);
      const report = parseReport(body);
      if (report?.error) {
        return NextResponse.json({ status: "failed", error: report.error });
      }
      return NextResponse.json({ status: "done", report });
    }

    return NextResponse.json({ status: "pending" });
  } catch (err) {
    console.error("[report-status]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to check status." },
      { status: 500 }
    );
  }
}
