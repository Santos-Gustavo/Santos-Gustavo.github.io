// ── PROJECT FORM HELPERS ────────────────────────────────────────────

function clearProjectForm() {
  [
    "companyName",
    "companyTagline",
    "companyNif",
    "companyInci",
    "responsible",
    "companyPhone",
    "companyEmail",
    "projectName",
    "clientName",
    "location",
    "contractNum",
    "distributedTo"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const sentVia = document.getElementById("sentVia");
  if (sentVia) sentVia.value = "WhatsApp";
}

function loadProjectIntoForm(proj) {
  const e = proj.empresa || {};
  const o = proj.obra || {};

  setInputValue("companyName", e.companyName);
  setInputValue("companyTagline", e.companyTagline);
  setInputValue("companyNif", e.companyNif);
  setInputValue("companyInci", e.companyInci);
  setInputValue("responsible", e.responsible);
  setInputValue("companyPhone", e.companyPhone);
  setInputValue("companyEmail", e.companyEmail);

  setInputValue("projectName", o.projectName);
  setInputValue("clientName", o.clientName);
  setInputValue("location", o.location);
  setInputValue("contractNum", o.contractNum);
  setInputValue("distributedTo", o.distributedTo);
  setInputValue("sentVia", o.sentVia || "WhatsApp");

  applyDefaultReportFields({
    reportNum: (proj.lastReportNum || 0) + 1,
    distributedTo: o.distributedTo || "",
    sentVia: o.sentVia || "WhatsApp"
  });
}

function applyDefaultReportFields(options = {}) {
  const today = new Date().toISOString().split("T")[0];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  setInputValue("p-reportNum", options.reportNum || "1");
  setInputValue("p-reportDate", today);
  setInputValue("p-periodStart", weekAgo.toISOString().split("T")[0]);
  setInputValue("p-periodEnd", today);
  setInputValue("p-distributedTo", options.distributedTo || "");
  setInputValue("p-sentVia", options.sentVia || "WhatsApp");
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}