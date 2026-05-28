// ── WORK ITEMS ───────────────────────────────────────────────────────
function addWorkItem() {
  S.works.push({ id: uid(), type: '', area: '', status: 'done', desc: '' });
  renderWorks();
}
function removeWork(id) { S.works = S.works.filter(w => w.id !== id); renderWorks(); }
function renderWorks() {
  document.getElementById('workList').innerHTML = S.works.map((w, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <div class="item-card-title">Trabalho ${i+1}</div>
        <button class="btn-remove" onclick="removeWork(${w.id})">Remover</button>
      </div>
      <div class="field"><label>Tipo de Trabalho</label>
        <select onchange="setWork(${w.id},'type',this.value)">
          <option value="">— Selecionar —</option>${jobOpts(w.type)}
        </select>
      </div>
      <div class="field"><label>Área / Localização</label>
        <select onchange="setWork(${w.id},'area',this.value)">
          <option value="">— Selecionar —</option>${areaOpts(w.area)}
        </select>
      </div>
      <div class="field"><label>Estado</label>
        <select onchange="setWork(${w.id},'status',this.value)">
          <option value="done"${w.status==='done'?' selected':''}>Concluído</option>
          <option value="progress"${w.status==='progress'?' selected':''}>Em Curso</option>
          <option value="blocked"${w.status==='blocked'?' selected':''}>Pendente / Bloqueado</option>
        </select>
      </div>
      <div class="field"><label>Descrição</label>
        <input type="text" value="${esc(w.desc)}" placeholder="Ex: Alvenaria completa — Fachada Norte" oninput="setWork(${w.id},'desc',this.value)" />
      </div>
    </div>`).join('');
}
function setWork(id, k, v) { const w = S.works.find(x => x.id===id); if(w) w[k]=v; }

