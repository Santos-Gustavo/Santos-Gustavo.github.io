// ── FINANCIAL PREVIEW ────────────────────────────────────────────────
function updateFinancialPreview() {
  const base = parseFloat(document.getElementById('contractValue').value) || 0;
  const approved = S.extras.filter(e=>e.status==='approved').reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
  const pending = S.extras.filter(e=>e.status==='pending').reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
  const fmt = n => n.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  document.getElementById('financialPreview').innerHTML = `
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:10px 14px;color:#374151;">Contrato base</td><td style="padding:10px 14px;text-align:right;font-family:monospace;">${fmt(base)}</td></tr>
        ${approved>0?'<tr><td style="padding:10px 14px;color:#d97706;">Extras aprovados</td><td style="padding:10px 14px;text-align:right;font-family:monospace;color:#d97706;">+ '+fmt(approved)+'</td></tr>':''}
        ${pending>0?'<tr><td style="padding:10px 14px;color:#9ca3af;font-style:italic;">Extras pendentes</td><td style="padding:10px 14px;text-align:right;font-family:monospace;color:#9ca3af;">+ '+fmt(pending)+' (pendente)</td></tr>':''}
        <tr style="background:#f9fafb;font-weight:700;border-top:2px solid #e5e7eb;">
          <td style="padding:10px 14px;">Total projetado</td>
          <td style="padding:10px 14px;text-align:right;font-family:monospace;">${fmt(base+approved)}</td>
        </tr>
      </table>
    </div>`;
}

window.updateFinancialPreview = updateFinancialPreview;

