// js/share/share-client.js
//
// Standalone public entrypoint for share.html. Must never import anything under
// js/projects/, js/navigation/, js/auth/, or js/database/ — see
// docs/features/CLIENT-SHARE-LINK-001.md §3.4/AC-04.2. The only app code reused here is
// the pure, import-free report renderer.

import { APP_ENV } from "../config/env.js";
import { renderReportHtml } from "../reports/report-renderer.js";

const UNAVAILABLE_MESSAGE = "Este link não está disponível.";

async function main() {
  const mount = document.getElementById("shareMount");
  const token = readTokenFromHash();

  if (!token) {
    renderUnavailable(mount);
    return;
  }

  const payload = await fetchSharedReport(token);

  if (!payload?.ok || !payload.report) {
    renderUnavailable(mount);
    return;
  }

  let html;

  try {
    html = renderReportHtml(payload.report);
  } catch (error) {
    console.error("Failed to render shared report:", error);
    renderUnavailable(mount);
    return;
  }

  renderReportFrame(mount, html);
}

function readTokenFromHash() {
  // Deliberately location.hash, never location.search — fragments are never sent to
  // the server, so the token never appears in access logs or Referer headers.
  const hash = window.location.hash || "";
  const match = /(?:^#|&)token=([^&]+)/.exec(hash);

  if (!match) return null;

  try {
    const decoded = decodeURIComponent(match[1]);
    return decoded.trim() || null;
  } catch {
    return null;
  }
}

async function fetchSharedReport(token) {
  try {
    const response = await fetch(buildFunctionUrl(), {
      method: "POST",
      headers: {
        apikey: APP_ENV.SUPABASE_ANON_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch shared report:", error);
    return null;
  }
}

function buildFunctionUrl() {
  return `${APP_ENV.SUPABASE_URL}/functions/v1/get-shared-report`;
}

function renderUnavailable(mount) {
  if (!mount) return;
  mount.textContent = UNAVAILABLE_MESSAGE;
  mount.className = "share-status";
}

function renderReportFrame(mount, html) {
  if (!mount) return;

  const iframe = document.createElement("iframe");
  // allow-scripts + allow-modals: enough for the renderer's own print button
  // (Paged.js pagination, then window.print() — which Chrome silently ignores in a
  // sandboxed frame without allow-modals), nothing else. No allow-same-origin — the
  // frame stays isolated from this page's runtime, which has nothing sensitive in it.
  iframe.setAttribute("sandbox", "allow-scripts allow-modals");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.className = "share-frame";
  iframe.srcdoc = html;
  iframe.title = "Relatório de obra";

  mount.replaceWith(iframe);
}

main();
