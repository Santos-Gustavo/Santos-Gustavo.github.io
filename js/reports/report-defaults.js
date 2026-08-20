// js/reports/report-defaults.js

import { setValue } from "#forms/form-values.js";

let initialized = false;

export function initReportDefaults() {
  if (initialized) return;
  initialized = true;

  applyDefaultReportDates();
}

export function applyDefaultReportDates() {
  const today = new Date();
  const weekAgo = new Date();

  weekAgo.setDate(today.getDate() - 7);

  setValue("p-reportDate", toInputDate(today));
  setValue("p-periodEnd", toInputDate(today));
  setValue("p-periodStart", toInputDate(weekAgo));

  const reportNum = document.getElementById("p-reportNum");

  if (reportNum && !reportNum.value) {
    reportNum.value = "1";
  }
}

function toInputDate(date) {
  return date.toISOString().split("T")[0];
}