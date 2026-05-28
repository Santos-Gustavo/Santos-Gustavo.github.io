// ── NEXT STEPS ──────────────────────────────────────────────────────
function addNextStep() { S.nextSteps.push({ id: uid(), desc:'', date:'' }); renderNextSteps(); }
function removeNextStep(id) { S.nextSteps = S.nextSteps.filter(s=>s.id!==id); renderNextSteps(); }
function renderNextSteps() {
  document.getElementById('nextStepsList').innerHTML = S.nextSteps.map((s, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <div class="item-card-title">Passo ${i+1}</div>
        <button class="btn-remove" onclick="removeNextStep(${s.id})">Remover</button>
      </div>
      <div class="field"><label>Descrição</label>
        <input type="text" value="${esc(s.desc)}" placeholder="Ex: Concluir alvenaria Fachada Sul" oninput="setStep(${s.id},'desc',this.value)" />
      </div>
      <div class="field"><label>Data prevista</label>
        <input type="date" value="${esc(s.date)}" onchange="setStep(${s.id},'date',this.value)" />
      </div>
    </div>`).join('');
}
function setStep(id, k, v) { const s = S.nextSteps.find(x=>x.id===id); if(s) s[k]=v; }

