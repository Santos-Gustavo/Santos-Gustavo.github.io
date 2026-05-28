// ── INCIDENTS ────────────────────────────────────────────────────────
function addIncident() { S.incidents.push({ id: uid(), desc: '' }); renderIncidents(); }
function removeIncident(id) { S.incidents = S.incidents.filter(i=>i.id!==id); renderIncidents(); }
function renderIncidents() {
  document.getElementById('incidentList').innerHTML = S.incidents.map((inc, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <div class="item-card-title">Incidente ${i+1}</div>
        <button class="btn-remove" onclick="removeIncident(${inc.id})">Remover</button>
      </div>
      <div class="field"><label>Descrição</label>
        <textarea placeholder="Descreva o incidente ou não-conformidade..." oninput="setInc(${inc.id},'desc',this.value)">${esc(inc.desc)}</textarea>
      </div>
    </div>`).join('');
}
function setInc(id, k, v) { const i = S.incidents.find(x=>x.id===id); if(i) i[k]=v; }

