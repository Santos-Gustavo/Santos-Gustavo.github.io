// js/reports/report-share.js

import { supabaseClient } from "#database/supabase-client.js";
import { throwIfDbError } from "#database/db-helpers.js";

const CREATE_FUNCTION_NAME = "create-report-share-link";
const REVOKE_FUNCTION_NAME = "revoke-report-share-link";

export async function createReportShareLink(reportId) {
  if (!reportId) {
    throw new Error("reportId é obrigatório.");
  }

  const { data, error } = await supabaseClient.functions.invoke(CREATE_FUNCTION_NAME, {
    body: { report_id: reportId },
  });

  if (error) {
    throw new Error(error.message || "Erro ao criar link de partilha.");
  }

  if (!data?.ok || !data.token || !data.linkId) {
    throw new Error(data?.error || "Erro ao criar link de partilha.");
  }

  return {
    linkId: data.linkId,
    token: data.token,
    expiresAt: data.expiresAt,
    shareUrl: buildShareUrl(data.token),
  };
}

export async function revokeReportShareLink(linkId) {
  if (!linkId) {
    throw new Error("linkId é obrigatório.");
  }

  const { data, error } = await supabaseClient.functions.invoke(REVOKE_FUNCTION_NAME, {
    body: { link_id: linkId },
  });

  if (error) {
    throw new Error(error.message || "Erro ao revogar link de partilha.");
  }

  if (!data?.ok) {
    throw new Error(data?.error || "Erro ao revogar link de partilha.");
  }

  return true;
}

// Latest share link (by created_at) per report_id, for the contractor's report-history
// UI — "does this report already have a link, and has the client opened it". Reads
// through report_share_links_select_own RLS (authenticated owner only); no service-role
// key is used here, this is the same anon-key client used everywhere else in the app.
export async function loadShareLinkStatusesForReports(reportIds) {
  const ids = Array.from(new Set((reportIds || []).filter(Boolean)));
  if (!ids.length) return new Map();

  const { data, error } = await supabaseClient
    .from("report_share_links")
    .select("id, report_id, expires_at, revoked_at, access_count, last_accessed_at, created_at")
    .in("report_id", ids)
    .order("created_at", { ascending: false });

  throwIfDbError(error, "Erro ao carregar estado dos links de partilha.");

  const statusByReportId = new Map();
  for (const row of data || []) {
    if (statusByReportId.has(row.report_id)) continue;
    statusByReportId.set(row.report_id, {
      linkId: row.id,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      accessCount: row.access_count,
      lastAccessedAt: row.last_accessed_at,
    });
  }
  return statusByReportId;
}

export function buildWhatsAppShareUrl(shareUrl, projectName) {
  const message =
    `Olá! Aqui está o relatório do projeto ${projectName || ""}: ${shareUrl}. ` +
    `Por favor, aceda ao link para rever o progresso documentado.`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function buildShareUrl(token) {
  return `${window.location.origin}/share.html#token=${token}`;
}
