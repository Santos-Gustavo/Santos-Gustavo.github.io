// js/reports/report-preview.js

export function openHtmlReportPreview(html) {
  if (typeof html !== "string" || html.trim() === "") {
    throw new Error("HTML do relatório está vazio.");
  }

  const blob = new Blob([html], {
    type: "text/html;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");

  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("O navegador bloqueou a abertura do relatório.");
  }

  // Do not revoke immediately. The new tab needs time to load the Blob URL.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);

  return opened;
}