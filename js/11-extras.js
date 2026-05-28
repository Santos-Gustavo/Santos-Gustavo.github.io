// ── EXTRAS ──────────────────────────────────────────────────────────
function addExtra() {
  S.extras.push({ id: uid(), ref:'', title:'', desc:'', cost:'', status:'pending', approvedBy:'', approvalMethod:'', approvalDate:'', deadline:'' });
  renderExtras();
}
function removeExtra(id) { S.extras = S.extras.filter(e=>e.id!==id); renderExtras(); }
function renderExtras() {
  const rn = document.getElementById('p-reportNum').value || '000';
  document.getElementById('extrasList').innerHTML = S.extras.map((e, i) => {
    e.ref = 'EX-' + String(rn).padStart(3,'0') + '-' + String(i+1).padStart(3,'0');
    return `
    <div class="item-card">
      <div class="item-card-header">
        <div class="item-card-title">Extra ${i+1} <span style="font-size:11px;color:#9ca3af;font-family:monospace;">${e.ref}</span></div>
        <button class="btn-remove" onclick="removeExtra(${e.id})">Remover</button>
      </div>
      <div class="field"><label>Título</label>
        <input type="text" value="${esc(e.title)}" placeholder="Ex: Reforço de fundação — Pilar P3" oninput="setExtra(${e.id},'title',this.value)" />
      </div>
      <div class="field"><label>Descrição</label>
        <textarea placeholder="Descreva o trabalho extra..." oninput="setExtra(${e.id},'desc',this.value)">${esc(e.desc)}</textarea>
      </div>
      <div class="field"><label>Custo (€, s/ IVA)</label>
        <input type="number" value="${esc(e.cost)}" placeholder="320" min="0" step="0.01" oninput="setExtra(${e.id},'cost',this.value)" />
      </div>
      <div class="field"><label>Estado</label>
        <select onchange="setExtra(${e.id},'status',this.value);renderExtras()">
          <option value="pending"${e.status==='pending'?' selected':''}>Aguarda aprovação</option>
          <option value="approved"${e.status==='approved'?' selected':''}>Aprovado</option>
        </select>
      </div>
      ${e.status==='approved' ? `
        <div class="field"><label>Aprovado por</label>
          <input type="text" value="${esc(e.approvedBy)}" placeholder="Ex: Sr. Monteiro" oninput="setExtra(${e.id},'approvedBy',this.value)" />
        </div>
        <div class="field"><label>Método de aprovação</label>
          <select onchange="setExtra(${e.id},'approvalMethod',this.value)">
            <option value="">— Selecionar —</option>
            <option value="Email escrito"${e.approvalMethod==='Email escrito'?' selected':''}>Email escrito</option>
            <option value="WhatsApp"${e.approvalMethod==='WhatsApp'?' selected':''}>WhatsApp</option>
            <option value="Presencial"${e.approvalMethod==='Presencial'?' selected':''}>Presencial</option>
            <option value="Assinatura em documento"${e.approvalMethod==='Assinatura em documento'?' selected':''}>Assinatura em documento</option>
          </select>
        </div>
        <div class="field"><label>Data de aprovação</label>
          <input type="date" value="${esc(e.approvalDate)}" onchange="setExtra(${e.id},'approvalDate',this.value)" />
        </div>` : `
        <div class="field"><label>Prazo de resposta solicitado</label>
          <input type="date" value="${esc(e.deadline)}" onchange="setExtra(${e.id},'deadline',this.value)" />
        </div>`}
    </div>`;
  }).join('');
}
function setExtra(id, k, v) { const e = S.extras.find(x=>x.id===id); if(e) e[k]=v; }

window.addExtra = addExtra;
window.removeExtra = removeExtra;
window.setExtra = setExtra;

