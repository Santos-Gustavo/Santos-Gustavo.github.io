// ── REVIEW ──────────────────────────────────────────────────────────
function buildReview() {
  const v = getV();
  if (S.mode === 'legal') {
    const fmtR = n => n.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
    const approvedTotal = S.extras.filter(e=>e.status==='approved').reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
    const pendingTotal  = S.extras.filter(e=>e.status==='pending').reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
    document.getElementById('reviewContent').innerHTML = `
      <div class="review-section"><h3>Empresa</h3>
        <div class="review-row"><span>Nome</span><span>${esc(v.companyName)||'—'}</span></div>
        <div class="review-row"><span>Responsável</span><span>${esc(v.responsible)||'—'}</span></div>
      </div>
      <div class="review-section"><h3>Obra</h3>
        <div class="review-row"><span>Cliente</span><span>${esc(v.clientName)||'—'}</span></div>
        <div class="review-row"><span>N.º Contrato</span><span>${esc(v.contractNum)||'—'}</span></div>
        <div class="review-row"><span>Relatório n.º</span><span>${esc(v.reportNum)||'—'}</span></div>
      </div>
      <div class="review-section"><h3>Legal / Financeiro</h3>
        <div class="review-row"><span>Trabalhos extra</span><span>${S.extras.length} itens</span></div>
        <div class="review-row"><span>Aprovados</span><span>${fmtR(approvedTotal)}</span></div>
        <div class="review-row"><span>Pendentes</span><span>${fmtR(pendingTotal)}</span></div>
      </div>`;
    return;
  }
  const dn = S.works.filter(w=>w.status==='done').length;
  const pr = S.works.filter(w=>w.status==='progress').length;
  const bl = S.works.filter(w=>w.status==='blocked').length;
  document.getElementById('reviewContent').innerHTML = `
    <div class="review-section"><h3>Empresa</h3>
      <div class="review-row"><span>Nome</span><span>${esc(v.companyName)||'—'}</span></div>
      <div class="review-row"><span>Responsável</span><span>${esc(v.responsible)||'—'}</span></div>
      <div class="review-row"><span>NIF</span><span>${esc(v.companyNif)||'—'}</span></div>
    </div>
    <div class="review-section"><h3>Obra</h3>
      <div class="review-row"><span>Nome</span><span>${esc(v.projectName)||'—'}</span></div>
      <div class="review-row"><span>Cliente</span><span>${esc(v.clientName)||'—'}</span></div>
      <div class="review-row"><span>Localização</span><span>${esc(v.location)||'—'}</span></div>
      <div class="review-row"><span>Contrato</span><span>${esc(v.contractNum)||'—'}</span></div>
      <div class="review-row"><span>Relatório n.º</span><span>${esc(v.reportNum)||'—'}</span></div>
    </div>
    <div class="review-section"><h3>Progresso</h3>
      <div class="review-row"><span>Fase</span><span>${esc(S.phase)||'—'}</span></div>
      <div class="review-row"><span>Concluído</span><span>${v.progressPct}%</span></div>
      <div class="review-row"><span>Tarefas</span><span>${dn} concl. · ${pr} em curso · ${bl} pend.</span></div>
    </div>
    <div class="review-section"><h3>Conteúdo</h3>
      <div class="review-row"><span>Trabalhos</span><span>${S.works.length} itens</span></div>
      <div class="review-row"><span>Fotos</span><span>${S.photos.length} fotos</span></div>
      <div class="review-row"><span>Próximos passos</span><span>${S.nextSteps.length} itens</span></div>
      <div class="review-row"><span>Incidentes</span><span>${S.incidentsOn ? S.incidents.length+' registado(s)' : 'Sem ocorrências'}</span></div>
      <div class="review-row"><span>Alerta</span><span>${S.alertOn ? 'Sim — '+esc(v.alertTitle) : 'Não'}</span></div>
    </div>`;
}

