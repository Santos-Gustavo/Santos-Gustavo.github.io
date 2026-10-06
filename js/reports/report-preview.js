// js/reports/report-preview.js

export function openHtmlReportPreview(html) {
  const url = createReportBlobUrl(html);
  const opened = window.open(url, "_blank");

  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("O navegador bloqueou a abertura do relatório.");
  }

  scheduleRevoke(url);
  return opened;
}

// Browsers only allow a new tab from the click itself, not after an await.
// Open a placeholder tab synchronously in the click handler, then point it at
// the report with showHtmlReportInTab once the report exists. Returns null
// when the browser blocks it.
export function openPendingReportTab() {
  const tab = window.open("", "_blank");
  if (!tab) return null;

  try {
    tab.document.title = "A gerar relatório...";
    tab.document.body.innerHTML =
      '<p style="font-family:Arial,sans-serif;padding:24px;color:#16263a">A gerar relatório...</p>';
  } catch {
    // Placeholder text is cosmetic only.
  }

  return tab;
}

export function showHtmlReportInTab(tab, html) {
  const url = createReportBlobUrl(html);
  tab.location.href = url;
  scheduleRevoke(url);
  return tab;
}

function createReportBlobUrl(html) {
  if (typeof html !== "string" || html.trim() === "") {
    throw new Error("HTML do relatório está vazio.");
  }

  const blob = new Blob([html], {
    type: "text/html;charset=utf-8",
  });

  return URL.createObjectURL(blob);
}

// Do not revoke immediately. The new tab needs time to load the Blob URL.
function scheduleRevoke(url) {
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}