// js/reports/report-share.js

import { supabaseClient } from "#database/supabase-client.js";

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

export function buildWhatsAppShareUrl(shareUrl, projectName) {
  const message =
    `Olá! Aqui está o relatório do projeto ${projectName || ""}: ${shareUrl}. ` +
    `Por favor, aceda ao link para rever o progresso documentado.`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function buildShareUrl(token) {
  return `${window.location.origin}/share.html#token=${token}`;
}
