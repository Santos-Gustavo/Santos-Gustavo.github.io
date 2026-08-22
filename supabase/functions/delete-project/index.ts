import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DeleteProjectRequest = {
  project_id?: string;
};

type JsonResponseBody = Record<string, unknown>;

const STORAGE_BUCKET = "project-photos";
const STORAGE_DELETE_BATCH_SIZE = 50;

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

async function parseJsonBody(req: Request): Promise<DeleteProjectRequest> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function chunkArray<T>(items: T[], batchSize: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }

  return chunks;
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
      "storage_path",
      "storage_paths",
      "report_id",
      "photo_id",
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

    const projectId = body.project_id;

    if (!isUuid(projectId)) {
      return jsonResponse(400, {
        ok: false,
        error: "project_id must be a valid UUID",
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

    const { data: pathRows, error: beginError } = await adminClient.rpc(
      "begin_project_delete",
      {
        p_project_id: projectId,
        p_user_id: user.id,
      },
    );

    if (beginError) {
      console.error("begin_project_delete error:", beginError);

      return jsonResponse(500, {
        ok: false,
        stage: "begin_project_delete",
        error: beginError.message,
        retryable: false,
      });
    }

    const storagePaths = Array.from(
      new Set(
        (Array.isArray(pathRows) ? pathRows : [])
          .map((row) => row?.storage_path)
          .filter((path): path is string =>
            typeof path === "string" && path.trim() !== ""
          ),
      ),
    );

    let deletedStorageCount = 0;
    const failedPaths: string[] = [];

    const batches = chunkArray(storagePaths, STORAGE_DELETE_BATCH_SIZE);

    for (const batch of batches) {
      const { error: storageError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .remove(batch);

      if (storageError) {
        console.error("Storage batch delete error:", storageError);

        failedPaths.push(...batch);
        continue;
      }

      deletedStorageCount += batch.length;
    }

    if (failedPaths.length > 0) {
      return jsonResponse(500, {
        ok: false,
        stage: "storage_delete",
        deletedStorageCount,
        failedPaths,
        retryable: true,
        message:
          "Some storage objects failed to delete. Project remains soft-locked and can be retried.",
      });
    }

    const { data: deletedRows, error: finalizeError } = await adminClient.rpc(
      "finalize_project_delete",
      {
        p_project_id: projectId,
        p_user_id: user.id,
      },
    );

    if (finalizeError) {
      console.error("finalize_project_delete error:", finalizeError);

      return jsonResponse(500, {
        ok: false,
        stage: "finalize_project_delete",
        error: finalizeError.message,
        retryable: true,
        message:
          "Storage was deleted, but DB finalization failed. Retry finalization after investigation.",
      });
    }

    const deletedRow = Array.isArray(deletedRows) ? deletedRows[0] : null;

    if (!deletedRow?.deleted_project_id) {
      return jsonResponse(404, {
        ok: false,
        stage: "finalize_project_delete",
        error: "Project not found, not authorized, or not marked for deletion",
        retryable: false,
      });
    }

    return jsonResponse(200, {
      ok: true,
      projectId,
      deletedProjectId: deletedRow.deleted_project_id,
      storagePathCount: storagePaths.length,
      deletedStorageCount,
      projectDeleted: true,
    });
  } catch (error) {
    console.error("delete-project fatal error:", error);

    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});