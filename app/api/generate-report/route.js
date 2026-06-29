// POST /api/generate-report
// Accepts a base64 data-URL image, stores it as the async input in S3, kicks off
// an asynchronous SageMaker inference, and returns the S3 keys the client polls.
// All AWS access happens here, server-side — credentials never reach the browser.
import { NextResponse } from "next/server";
import { InvokeEndpointAsyncCommand } from "@aws-sdk/client-sagemaker-runtime";
import { randomUUID } from "crypto";
import { smr, s3Put, BUCKET, ENDPOINT, s3UriToKey } from "@/lib/aws";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!BUCKET || !ENDPOINT) {
      return NextResponse.json(
        { error: "Server is not configured (missing RADAI_BUCKET / RADAI_ENDPOINT)." },
        { status: 500 }
      );
    }

    const { image } = await req.json();
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json(
        { error: "Provide an image as a base64 data URL." },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const inputKey = `async-input/${id}.json`;
    const payload = JSON.stringify({ task: "full_report", paths: [image] });

    await s3Put(inputKey, payload, "application/json");

    const res = await smr.send(
      new InvokeEndpointAsyncCommand({
        EndpointName: ENDPOINT,
        ContentType: "application/json",
        InputLocation: `s3://${BUCKET}/${inputKey}`,
        InferenceId: id,
      })
    );

    return NextResponse.json({
      outputKey: s3UriToKey(res.OutputLocation),
      failureKey: s3UriToKey(res.FailureLocation),
      inferenceId: res.InferenceId || id,
    });
  } catch (err) {
    console.error("[generate-report]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to start analysis." },
      { status: 500 }
    );
  }
}
