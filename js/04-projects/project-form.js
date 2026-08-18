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
  const o = proj.obra || {};

  setValue("companyName", o.companyName || "");
  setValue("companyNif", o.companyNif || "");
  setValue("responsible", o.responsible || "");
  setValue("companyPhone", o.companyPhone || "");
  setValue("companyEmail", o.companyEmail || "");

  setValue("projectName", proj.name || "");
  setValue("clientName", o.clientName || "");
  setValue("location", o.location || "");
  setValue("contractNum", o.contractNum || "");
  setValue("contractValue", o.contractValue || "");
}

function applyDefaultReportFields(options = {}) {
  const today = new Date().toISOString().split("T")[0];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  setInputValue("p-reportNum", options.reportNum || "1");
  setInputValue("p-reportDate", today);
  setInputValue("p-periodStart", "");
  setInputValue("p-periodEnd", "");
  setInputValue("p-distributedTo", options.distributedTo || "");
  setInputValue("p-sentVia", options.sentVia || "WhatsApp");
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}