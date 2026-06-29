// Server-side AWS helpers for the RadAI async inference flow.
// S3 is accessed via manual SigV4 signing + fetch (using the smithy packages that
// ship with @aws-sdk/client-sagemaker-runtime), so no extra dependency is needed.
// This module must only be imported from server code — credentials never reach the browser.
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { Hash } from "@smithy/hash-node";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SageMakerRuntimeClient } from "@aws-sdk/client-sagemaker-runtime";

export const REGION = process.env.AWS_REGION || "us-west-2";
export const BUCKET = process.env.RADAI_BUCKET;
export const ENDPOINT = process.env.RADAI_ENDPOINT;

export const smr = new SageMakerRuntimeClient({ region: REGION });

const S3_HOST = `${BUCKET}.s3.${REGION}.amazonaws.com`;
const signer = new SignatureV4({
  service: "s3",
  region: REGION,
  credentials: defaultProvider(),
  sha256: Hash.bind(null, "sha256"),
});

const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");

async function s3Fetch(method, key, { body, contentType } = {}) {
  const headers = { host: S3_HOST };
  if (contentType) headers["content-type"] = contentType;
  const request = new HttpRequest({
    method,
    protocol: "https:",
    hostname: S3_HOST,
    path: `/${encodeKey(key)}`,
    headers,
    body,
  });
  const signed = await signer.sign(request);
  return fetch(`https://${S3_HOST}/${encodeKey(key)}`, {
    method,
    headers: signed.headers,
    body,
  });
}

export async function s3Put(key, body, contentType = "application/json") {
  const res = await s3Fetch("PUT", key, { body, contentType });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`S3 PUT ${key} failed (${res.status}) ${detail}`);
  }
}

export async function s3Exists(key) {
  const res = await s3Fetch("HEAD", key);
  return res.status === 200;
}

export async function s3GetText(key) {
  const res = await s3Fetch("GET", key);
  if (!res.ok) throw new Error(`S3 GET ${key} failed (${res.status})`);
  return res.text();
}

// s3://bucket/key -> key
export function s3UriToKey(uri) {
  if (!uri) return null;
  return uri.replace(`s3://${BUCKET}/`, "");
}

// The SageMaker async output is the body our inference.py output_fn produced,
// serialized by the model server as ["<json-string>", "application/json"].
// Normalize it to a plain { section_by_section, summary } object.
export function parseReport(body) {
  let data = JSON.parse(body);
  if (Array.isArray(data)) data = JSON.parse(data[0]);
  if (typeof data === "string") data = JSON.parse(data);
  return data;
}
