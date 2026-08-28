import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateShareLinkRequest = {
  report_id?: string;
};

type JsonResponseBody = Record<string, unknown>;

const DEFAULT_TTL_HOURS = 168;

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

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function parseJsonBody(req: Request): Promise<CreateShareLinkRequest> {
  try {
    return await req.json();
  } catch {
    return {};
  }
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

    const forbiddenKeys = [
      "user_id",
      "company_id",
      "owner_id",
      "project_id",
      "token",
      "token_hash",
    ];

    const suppliedForbiddenKeys = forbiddenKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(body, key)
    );

    if (suppliedForbiddenKeys.length > 0) {
      return jsonResponse(400, {
        ok: false,
        error: "Forbidden request fields supplied",
        forbiddenFields: suppliedForbiddenKeys,
      });
    }

    const reportId = body.report_id;

    if (!isUuid(reportId)) {
      return jsonResponse(400, {
        ok: false,
        error: "report_id must be a valid UUID",
      });
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(401, {
        ok: false,
        error: "Missing bearer token",
      });
    }

    const jwt = authHeader.replace("Bearer ", "").trim();

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(401, {
        ok: false,
        error: "Invalid or expired token",
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: linkRows, error: rpcError } = await adminClient.rpc(
      "create_report_share_link",
      {
        p_report_id: reportId,
        p_user_id: user.id,
        p_ttl_hours: DEFAULT_TTL_HOURS,
      },
    );

    if (rpcError) {
      console.error("create_report_share_link error:", rpcError);

      return jsonResponse(500, {
        ok: false,
        stage: "create_report_share_link",
        error: rpcError.message,
      });
    }

    const linkRow = Array.isArray(linkRows) ? linkRows[0] : null;

    if (!linkRow?.token) {
      return jsonResponse(404, {
        ok: false,
        error: "Report not found or not authorized",
      });
    }

    return jsonResponse(200, {
      ok: true,
      linkId: linkRow.id,
      token: linkRow.token,
      expiresAt: linkRow.expires_at,
    });
  } catch (error) {
    console.error("create-report-share-link fatal error:", error);

    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});
