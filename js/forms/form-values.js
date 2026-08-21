// js/forms/form-values.js

export function getProjectFormValues() {
  return {
    companyName: getValue("companyName"),
    companyTagline: getValue("companyTagline"),
    companyNif: getValue("companyNif"),
    companyInci: getValue("companyInci"),
    responsible: getValue("responsible"),
    companyPhone: getValue("companyPhone"),
    companyEmail: getValue("companyEmail"),

    projectName: getValue("projectName"),
    clientName: getValue("clientName"),
    location: getValue("location"),
    contractNum: getValue("contractNum"),
    contractValue: getValue("contractValue"),

    distributedTo: getValue("distributedTo"),
    sentVia: getValue("sentVia"),
  };
}

export function getReportFormValues() {
  return {
    ...getProjectFormValues(),

    reportNum: getValue("p-reportNum"),
    periodStart: getValue("p-periodStart"),
    periodEnd: getValue("p-periodEnd"),
    reportDate: getValue("p-reportDate"),

    distributedTo: getValue("p-distributedTo"),
    sentVia: getValue("p-sentVia"),

    progressPct: getValue("progressSlider"),
    weekSummary: getValue("weekSummary"),

    alertTitle: getValue("alertTitle"),
    alertDesc: getValue("alertDesc"),
    alertDeadline: getValue("alertDeadline"),
    alertConsequence: getValue("alertConsequence"),

    contractValue: getValue("contractValue"),
    financialNote: getValue("financialNote"),
  };
}

export function getValue(id) {
  return document.getElementById(id)?.value || "";
}

export function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}