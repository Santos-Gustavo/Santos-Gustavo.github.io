// ── GETV ────────────────────────────────────────────────────────────
function getV() {
  const get = id => (document.getElementById(id) || {}).value || '';
  return {
    companyName: get('companyName'), companyTagline: get('companyTagline'),
    companyNif: get('companyNif'), companyInci: get('companyInci'),
    responsible: get('responsible'), companyPhone: get('companyPhone'),
    companyEmail: get('companyEmail'),
    projectName: get('projectName'), clientName: get('clientName'),
    location: get('location'), contractNum: get('contractNum'),
    reportNum: get('p-reportNum'),
    periodStart: get('p-periodStart'), periodEnd: get('p-periodEnd'),
    reportDate: get('p-reportDate'),
    distributedTo: get('p-distributedTo'), sentVia: get('p-sentVia'),
    progressPct: document.getElementById('progressSlider').value,
    weekSummary: get('weekSummary'),
    alertTitle: get('alertTitle'), alertDesc: get('alertDesc'),
    alertDeadline: get('alertDeadline'), alertConsequence: get('alertConsequence'),
    contractValue: get('contractValue'), financialNote: get('financialNote'),
  };
}

