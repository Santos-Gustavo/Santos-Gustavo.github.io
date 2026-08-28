import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type GetSharedReportRequest = {
  token?: string;
};

type JsonResponseBody = Record<string, unknown>;

const PHOTO_BUCKET = "project-photos";
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60;

// Every failure mode below — missing token, malformed token, never-issued token,
// expired link, revoked link — returns this exact status/body. Distinguishing them
// would turn this endpoint into an oracle for guessing valid-but-expired vs.
// never-existed tokens. See docs/features/CLIENT-SHARE-LINK-001.md AC-01.8/AC-03.1.
const UNAVAILABLE_RESPONSE = {
  ok: false,
  message: "Este link não está disponível.",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: JsonResponseBody): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function unavailableResponse(): Response {
  return jsonResponse(404, UNAVAILABLE_RESPONSE);
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

// base64url, unpadded — matches the token shape minted by create_report_share_link.
// Length is loosely bounded (not tied to the exact 32-byte encoding) so tightening the
// token size later doesn't require touching this endpoint.
function isPlausibleToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,128}$/.test(value);
}

async function parseJsonBody(req: Request): Promise<GetSharedReportRequest> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Strips every internal id from the report document before it leaves this function.
// renderReportHtml() (the shared client-side renderer) never reads these fields — it
// builds its own display slug from project.clientName / meta.reportNumber — so nothing
// user-visible is lost. See §3.7's "explicit allowlist, not a filtered table row".
function stripInternalIds(snapshot: Record<string, unknown>): Record<string, unknown> {
  const meta = (snapshot.meta && typeof snapshot.meta === "object")
    ? { ...(snapshot.meta as Record<string, unknown>), reportId: null, projectId: null }
    : snapshot.meta;

  const company = (snapshot.company && typeof snapshot.company === "object")
    ? { ...(snapshot.company as Record<string, unknown>), id: null }
    : snapshot.company;

  const project = (snapshot.project && typeof snapshot.project === "object")
    ? { ...(snapshot.project as Record<string, unknown>), id: null, clientId: null }
    : snapshot.project;

  const photos = Array.isArray(snapshot.photos)
    ? snapshot.photos.map((photo) =>
      photo && typeof photo === "object" ? { ...photo, id: null } : photo
    )
    : snapshot.photos;

  return { ...snapshot, meta, company, project, photos };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const body = await parseJsonBody(req);

    if (!isPlausibleToken(body.token)) {
      return unavailableResponse();
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const tokenHash = await sha256Hex(body.token);

    const { data: reportRows, error: rpcError } = await adminClient.rpc(
      "get_report_by_share_token",
      { p_token_hash: tokenHash },
    );

    if (rpcError) {
      console.error("get_report_by_share_token error:", rpcError);
      return unavailableResponse();
    }

    const reportRow = Array.isArray(reportRows) ? reportRows[0] : null;

    if (!reportRow?.snapshot_json) {
      return unavailableResponse();
    }

    const snapshot = reportRow.snapshot_json as Record<string, unknown>;
    const photos = Array.isArray(snapshot.photos) ? snapshot.photos : [];

    const storagePaths = Array.from(
      new Set(
        photos
          .map((photo) => (photo && typeof photo === "object" ? (photo as Record<string, unknown>).storagePath : null))
          .filter((path): path is string => typeof path === "string" && path.trim() !== ""),
      ),
    );

    let signedUrlByPath = new Map<string, string>();

    if (storagePaths.length > 0) {
      const { data: signedUrls, error: signError } = await adminClient.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(storagePaths, SIGNED_URL_EXPIRES_SECONDS);

      if (signError) {
        console.error("createSignedUrls error:", signError);
      } else {
        signedUrlByPath = new Map(
          (signedUrls || [])
            .filter((item) => item?.path && item?.signedUrl)
            .map((item) => [item.path as string, item.signedUrl as string]),
        );
      }
    }

    const hydratedSnapshot = {
      ...snapshot,
      photos: photos.map((photo) => {
        if (!photo || typeof photo !== "object") return photo;

        const storagePath = (photo as Record<string, unknown>).storagePath;

        return {
          ...photo,
          displayUrl: typeof storagePath === "string" ? (signedUrlByPath.get(storagePath) || "") : "",
        };
      }),
    };

    return jsonResponse(200, {
      ok: true,
      report: stripInternalIds(hydratedSnapshot),
    });
  } catch (error) {
    console.error("get-shared-report fatal error:", error);
    return unavailableResponse();
  }
});
