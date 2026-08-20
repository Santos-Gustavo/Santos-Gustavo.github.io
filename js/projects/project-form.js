import { setValue } from "#forms/form-values.js";

export function clearProjectForm() {
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
    "contractValue",
    "distributedTo",
  ].forEach((id) => {
    setValue(id, "");
  });

  setValue("sentVia", "WhatsApp");
}

export function loadProjectIntoForm(project) {
  if (!project) return;

  setValue("companyName", project.companyName || "");
  setValue("companyNif", project.companyNif || "");
  setValue("companyInci", project.companyInci || "");
  setValue("responsible", project.responsible || "");
  setValue("companyPhone", project.companyPhone || "");
  setValue("companyEmail", project.companyEmail || "");

  setValue("projectName", project.name || "");
  setValue("clientName", project.clientName || "");
  setValue("location", project.location || "");
  setValue("contractNum", project.contractNum || "");
  setValue("contractValue", project.contractValue ?? "");
}

export function applyDefaultReportFields(options = {}) {
  const today = new Date().toISOString().split("T")[0];

  setValue("p-reportNum", options.reportNum || "1");
  setValue("p-reportDate", today);
  setValue("p-periodStart", "");
  setValue("p-periodEnd", "");
  setValue("p-distributedTo", options.distributedTo || "");
  setValue("p-sentVia", options.sentVia || "WhatsApp");
}