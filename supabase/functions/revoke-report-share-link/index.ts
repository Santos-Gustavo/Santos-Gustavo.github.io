import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RevokeShareLinkRequest = {
  link_id?: string;
};

type JsonResponseBody = Record<string, unknown>;

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

async function parseJsonBody(req: Request): Promise<RevokeShareLinkRequest> {
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

    const forbiddenKeys = ["user_id", "company_id", "owner_id", "report_id", "token", "token_hash"];
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

    const linkId = body.link_id;

    if (!isUuid(linkId)) {
      return jsonResponse(400, {
        ok: false,
        error: "link_id must be a valid UUID",
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

    const { data: revokedRows, error: rpcError } = await adminClient.rpc(
      "revoke_report_share_link",
      {
        p_link_id: linkId,
        p_user_id: user.id,
      },
    );

    if (rpcError) {
      console.error("revoke_report_share_link error:", rpcError);

      return jsonResponse(500, {
        ok: false,
        stage: "revoke_report_share_link",
        error: rpcError.message,
      });
    }

    const revokedRow = Array.isArray(revokedRows) ? revokedRows[0] : null;

    if (!revokedRow?.revoked_link_id) {
      return jsonResponse(404, {
        ok: false,
        error: "Link not found or not authorized",
      });
    }

    return jsonResponse(200, {
      ok: true,
      revokedLinkId: revokedRow.revoked_link_id,
    });
  } catch (error) {
    console.error("revoke-report-share-link fatal error:", error);

    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});
