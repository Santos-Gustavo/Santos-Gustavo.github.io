// ── INIT ────────────────────────────────────────────────────────────

async function initApp() {
  await initAuth();

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  document.getElementById("p-reportDate").value = today;
  document.getElementById("p-periodEnd").value = today;
  document.getElementById("p-periodStart").value = weekAgo.toISOString().split("T")[0];
  document.getElementById("p-reportNum").value = "1";

  renderProjectList();
}

initApp();