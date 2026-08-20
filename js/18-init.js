async function initApp() {
  // Auth is now initialized by js/main.js.
  // Project rendering is triggered after login by the temporary ESM bridge.

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const reportDate = document.getElementById("p-reportDate");
  const periodEnd = document.getElementById("p-periodEnd");
  const periodStart = document.getElementById("p-periodStart");
  const reportNum = document.getElementById("p-reportNum");

  if (reportDate) reportDate.value = today;
  if (periodEnd) periodEnd.value = today;
  if (periodStart) periodStart.value = weekAgo.toISOString().split("T")[0];
  if (reportNum) reportNum.value = "1";
}

initApp();