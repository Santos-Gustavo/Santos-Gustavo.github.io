async function createReport(projectId, v) {
  const reportNum = await getNextReportNum(projectId);

  const payload = {
    project_id: projectId,

    report_num: v.reportNum ? Number(v.reportNum) : null,
    report_date: v.reportDate || new Date().toISOString().slice(0, 10),

    period_start: v.periodStart || null,
    period_end: v.periodEnd || null,

    distributed_to: cleanText(v.distributedTo) || null,
    sent_via: normalizeSentVia(v.sentVia),

    phase: cleanText(S.phase) || null,
    progress_pct: v.progressPct ? Number(v.progressPct) : 0,

    week_summary: cleanText(v.weekSummary) || null,

    alert_on: Boolean(S.alertOn),
    alert_title: cleanText(v.alertTitle) || null,
    alert_desc: cleanText(v.alertDesc) || null,
    alert_deadline: v.alertDeadline || null,
    alert_consequence: cleanText(v.alertConsequence) || null,

    incidents_on: Boolean(S.incidentsOn),

    financial_note: cleanText(v.financialNote) || null,

    works: Array.isArray(S.works) ? S.works : [],
    incidents: Array.isArray(S.incidents) ? S.incidents : [],
    extras: Array.isArray(S.extras) ? S.extras : [],
    next_steps: Array.isArray(S.nextSteps) ? S.nextSteps : [],

    status: 0
  };

  console.log("REPORT PAYLOAD BEING SENT:", payload);

  const { data, error } = await supabaseClient
    .from("reports")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}

window.createReport = createReport;