// ── STATE ──────────────────────────────────────────────────────────
const S = {
  step: 0, mode: '',
  phase: '',
  alertOn: false, incidentsOn: false,
  works: [], photos: [], incidents: [], extras: [], nextSteps: []
};

const SUPABASE_URL = "https://haiwrmwpltzhdnrqzxep.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "7BaioDK27QvB5O0b";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const JOB_TYPES = [
  'Alvenaria / Paredes',
  'AVAC / Climatização',
  'Canalização / Hidráulica',
  'Carpintaria / Madeiras',
  'Cerâmica / Azulejos',
  'Cobertura / Telhado',
  'Demolição',
  'Fachada / Revestimento Exterior',
  'Fundações / Betão Armado',
  'Gesso Cartonado',
  'Impermeabilização',
  'Instalações Elétricas',
  'Isolamento Acústico',
  'Isolamento Térmico',
  'Jardim / Arranjos Exteriores',
  'Outro',
  'Pavimento / Betonilha',
  'Pintura Exterior',
  'Pintura Interior',
  'Reboco / Estuque',
  'Serralharia / Estruturas Metálicas',
  'Vãos / Portas / Janelas'
];

const AREAS = [
  'Interior Geral',

  'Cave',
  'Rés-do-chão',
  '1.º Piso',
  '2.º Piso',
  'Cobertura / Terraço',

  'Hall / Corredor',
  'Escadas',
  'Sala',
  'Cozinha',
  'Suite',
  'Quarto 1',
  'Quarto 2',
  'Quarto 3',
  'Casa de Banho 1',
  'Casa de Banho 2',
  'Garagem',

  'Exterior',
  'Fachada Norte',
  'Fachada Sul',
  'Fachada Este',
  'Fachada Oeste',
  'Varanda',
  'Jardim',

  'Outro'
];

const STEPS = {
  weekly: [1, 2, 3, 4, 5, 6, 7, 8, 11, 12],
  legal:  [1, 2, 9, 10, 12]
};
const STEP_NAMES = {
  1:'Empresa', 2:'Obra', 3:'Progresso', 4:'Resumo', 5:'Trabalhos',
  6:'Fotos', 7:'Decisão', 8:'Incidentes', 9:'Extras',
  10:'Financeiro', 11:'Próximos Passos', 12:'Revisão'
};

// ── NAVIGATION ──────────────────────────────────────────────────────
function selectMode(mode) {
  S.mode = mode;
  showStep(STEPS[mode][0]);
}

function goNext() {
  const seq = STEPS[S.mode];
  const idx = seq.indexOf(S.step);
  if (S.step === 10) updateFinancialPreview();
  if (idx === seq.length - 2) buildReview();
  if (idx < seq.length - 1) showStep(seq[idx + 1]);
}
function goBack() {
  const seq = STEPS[S.mode];
  const idx = seq.indexOf(S.step);
  if (idx <= 0) showStep(0);
  else showStep(seq[idx - 1]);
}

function showStep(n) {
  document.getElementById(S.step === 0 ? 'step0' : 'step' + S.step).classList.remove('active');
  S.step = n;
  document.getElementById('step' + n).classList.add('active');
  if (n === 0) {
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('stepLabel').textContent = 'Escolha o tipo de relatório';
    window.scrollTo(0, 0);
    return;
  }
  const seq = STEPS[S.mode];
  const pos = seq.indexOf(n) + 1;
  const total = seq.length;
  document.getElementById('progressFill').style.width = Math.round(pos / total * 100) + '%';
  document.getElementById('stepLabel').textContent = 'Passo ' + pos + ' de ' + total + ' — ' + STEP_NAMES[n];
  window.scrollTo(0, 0);
}

// ── PHASE PICKER ────────────────────────────────────────────────────
function selectPhase(el, phase) {
  document.querySelectorAll('.phase-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  S.phase = phase;
}

// ── TOGGLES ─────────────────────────────────────────────────────────
function toggleAlert() {
  S.alertOn = !S.alertOn;
  document.getElementById('alertToggle').classList.toggle('on', S.alertOn);
  document.getElementById('alertFields').classList.toggle('hidden', !S.alertOn);
}
function toggleIncidents() {
  S.incidentsOn = !S.incidentsOn;
  document.getElementById('incidentsToggle').classList.toggle('on', S.incidentsOn);
  document.getElementById('incidentFields').classList.toggle('hidden', !S.incidentsOn);
}

// ── HELPERS ──────────────────────────────────────────────────────────
function uid() { return Date.now() + Math.random(); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function jobOpts(sel) { return JOB_TYPES.map(t => '<option value="'+esc(t)+'"'+(sel===t?' selected':'')+'>'+esc(t)+'</option>').join(''); }
function areaOpts(sel) { return AREAS.map(a => '<option value="'+esc(a)+'"'+(sel===a?' selected':'')+'>'+esc(a)+'</option>').join(''); }

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

// ── PHOTOS ──────────────────────────────────────────────────────────
function addPhotoItem() {
  S.photos.push({ id: uid(), dataUrl: '', type: 'before', area: '', desc: '', worker: '' });
  renderPhotos();
}
function removePhoto(id) { S.photos = S.photos.filter(p => p.id!==id); renderPhotos(); }
function renderPhotos() {
  document.getElementById('photoList').innerHTML = S.photos.map((p, i) => `
    <div class="item-card">
      <div class="item-card-header">
        <div class="item-card-title">Foto ${i+1}</div>
        <button class="btn-remove" onclick="removePhoto(${p.id})">Remover</button>
      </div>
      <div class="photo-input-area">
        <input type="file" accept="image/*" capture="environment" onchange="handlePhoto(${p.id},this)" />
        ${p.dataUrl
          ? '<img src="'+p.dataUrl+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:6px;" />'
          : '<div class="photo-icon-text">📷</div><div class="photo-caption-small">Toque para fotografar ou escolher</div>'}
      </div>
      <div class="field" style="margin-top:10px;"><label>Tipo</label>
        <select onchange="setPhoto(${p.id},'type',this.value)">
          <option value="before"${p.type==='before'?' selected':''}>Antes</option>
          <option value="during"${p.type==='during'?' selected':''}>Durante</option>
          <option value="after"${p.type==='after'?' selected':''}>Concluído / Depois</option>
          <option value="detail"${p.type==='detail'?' selected':''}>Detalhe</option>
        </select>
      </div>
      <div class="field"><label>Área</label>
        <select onchange="setPhoto(${p.id},'area',this.value)">
          <option value="">— Selecionar —</option>${areaOpts(p.area)}
        </select>
      </div>
      <div class="field"><label>Descrição</label>
        <input type="text" value="${esc(p.desc)}" placeholder="Ex: Parede Norte concluída" oninput="setPhoto(${p.id},'desc',this.value)" />
      </div>
      <div class="field"><label>Responsável</label>
        <input type="text" value="${esc(p.worker)}" placeholder="Ex: João F." oninput="setPhoto(${p.id},'worker',this.value)" />
      </div>
    </div>`).join('');
}
function handlePhoto(id, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { const p = S.photos.find(x=>x.id===id); if(p) p.dataUrl=e.target.result; renderPhotos(); };
  reader.readAsDataURL(file);
}
function setPhoto(id, k, v) { const p = S.photos.find(x=>x.id===id); if(p) p[k]=v; }

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

// ── EXTRAS ──────────────────────────────────────────────────────────
function addExtra() {
  S.extras.push({ id: uid(), ref:'', title:'', desc:'', cost:'', status:'pending', approvedBy:'', approvalMethod:'', approvalDate:'', deadline:'' });
  renderExtras();
}
function removeExtra(id) { S.extras = S.extras.filter(e=>e.id!==id); renderExtras(); }
function renderExtras() {
  const rn = document.getElementById('reportNum').value || '000';
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

// ── GETV ────────────────────────────────────────────────────────────
function getV() {
  return {
    companyName: document.getElementById('companyName').value,
    companyTagline: document.getElementById('companyTagline').value,
    companyNif: document.getElementById('companyNif').value,
    companyInci: document.getElementById('companyInci').value,
    responsible: document.getElementById('responsible').value,
    companyPhone: document.getElementById('companyPhone').value,
    companyEmail: document.getElementById('companyEmail').value,
    projectName: document.getElementById('projectName').value,
    clientName: document.getElementById('clientName').value,
    location: document.getElementById('location').value,
    contractNum: document.getElementById('contractNum').value,
    reportNum: document.getElementById('reportNum').value,
    periodStart: document.getElementById('periodStart').value,
    periodEnd: document.getElementById('periodEnd').value,
    reportDate: document.getElementById('reportDate').value,
    distributedTo: document.getElementById('distributedTo').value,
    sentVia: document.getElementById('sentVia').value,
    progressPct: document.getElementById('progressSlider').value,
    weekSummary: document.getElementById('weekSummary').value,
    alertTitle: document.getElementById('alertTitle').value,
    alertDesc: document.getElementById('alertDesc').value,
    alertDeadline: document.getElementById('alertDeadline').value,
    alertConsequence: document.getElementById('alertConsequence').value,
    contractValue: document.getElementById('contractValue').value,
    financialNote: document.getElementById('financialNote').value,
  };
}

// ── DATE HELPERS ────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  const ms = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return parseInt(day)+' de '+ms[parseInt(m)-1]+' de '+y;
}
function fmtShort(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-'); return day+'/'+m+'/'+y;
}
function fmtRange(s, e) {
  if (!s && !e) return '';
  const ms = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const sa = s?s.split('-'):null, ea = e?e.split('-'):null;
  if (sa && ea) return parseInt(sa[2])+'–'+parseInt(ea[2])+' '+ms[parseInt(ea[1])-1]+' '+ea[0];
  if (sa) return parseInt(sa[2])+' '+ms[parseInt(sa[1])-1]+' '+sa[0];
  return '';
}

// ── GENERATE REPORT ──────────────────────────────────────────────────
function generateReport() {
  const v = getV();
  const rn = v.reportNum || '1';
  const clientSlug = (v.clientName||'CLIENTE').split(' ')[0].toUpperCase().replace(/[^A-Z]/g,'');
  const reportId = 'PROJ-'+clientSlug+'-'+String(rn).padStart(3,'0');

  const base = parseFloat(v.contractValue)||0;
  const approved = S.extras.filter(e=>e.status==='approved').reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
  const pending = S.extras.filter(e=>e.status==='pending').reduce((s,e)=>s+(parseFloat(e.cost)||0),0);
  const fmt = n => n.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';

  const tasksDone = S.works.filter(w=>w.status==='done').length;
  const tasksProg = S.works.filter(w=>w.status==='progress').length;
  const tasksBlk = S.works.filter(w=>w.status==='blocked').length;

  const allPhases = ['Fundações','Estrutura e Alvenaria','Impermeabilização','Cobertura','Instalações','Acabamentos'];
  const phaseIdx = allPhases.indexOf(S.phase);
  const phasesHtml = allPhases.map((p,i) => {
    let cls = 'phase-item';
    if (i < phaseIdx) cls += ' done-phase';
    else if (i === phaseIdx) cls += ' active';
    return '<div class="'+cls+'">'+(i<phaseIdx?p+' ✓':i===phaseIdx?'● '+p:p)+'</div>';
  }).join('');

  const workDone = S.works.filter(w=>w.status==='done').map(w =>
    '<li class="work-item"><div class="work-dot done"></div><div class="work-text"><span class="work-tag done">Concluído</span><br>'+(w.type?'<strong>'+esc(w.type)+'</strong> — ':'')+esc(w.desc||'—')+(w.area?'<div class="work-area">'+esc(w.area)+'</div>':'')+'</div></li>'
  ).join('') || '<li class="work-item"><div class="work-dot done"></div><div class="work-text" style="color:#9ca3af">—</div></li>';

  const workOther = S.works.filter(w=>w.status!=='done').map(w =>
    '<li class="work-item"><div class="work-dot '+w.status+'"></div><div class="work-text"><span class="work-tag '+w.status+'">'+(w.status==='progress'?'Em Curso':'Pendente')+'</span><br>'+(w.type?'<strong>'+esc(w.type)+'</strong> — ':'')+esc(w.desc||'—')+(w.area?'<div class="work-area">'+esc(w.area)+'</div>':'')+'</div></li>'
  ).join('') || '<li class="work-item"><div class="work-dot progress"></div><div class="work-text" style="color:#9ca3af">—</div></li>';

  const typeLabel = {before:'Antes',during:'Durante',after:'Concluído',detail:'Detalhe'};
  const badgeCls = {before:'before',during:'during',after:'after',detail:'detalhe'};
  const photosHtml = S.photos.map(p =>
    '<div class="photo-card">'+(p.dataUrl?'<img src="'+p.dataUrl+'" style="width:100%;height:130px;object-fit:cover;" />':'<div class="photo-placeholder '+(p.type==='after'?'done-photo':p.type)+'"><div class="photo-icon">[ ]</div><div>'+esc(p.area)+'</div></div>')+'<div class="photo-caption"><span class="caption-badge '+(badgeCls[p.type]||'')+'">'+esc(typeLabel[p.type]||p.type)+'</span><div class="caption-text">'+esc(p.desc||'—')+'</div><div class="caption-meta">'+esc(p.worker)+(p.area?' · '+esc(p.area):'')+'</div></div></div>'
  ).join('');

  const extrasHtml = S.extras.map(e =>
    '<div class="extras-card '+(e.status==='approved'?'approved-card':'pending-card')+'"><div class="extras-header"><div class="extras-title-area"><div class="extras-ref">'+esc(e.ref)+' · Ref. contrato '+esc(v.contractNum||'—')+'</div><div class="extras-title">'+esc(e.title||'—')+'</div></div><span class="extras-status '+(e.status==='approved'?'approved':'pending')+'">'+(e.status==='approved'?'Aprovado':'Aguarda aprovação')+'</span></div><div class="extras-desc">'+esc(e.desc||'—')+'</div><div class="extras-approval'+(e.status==='approved'?'':' waiting')+'">'+(e.status==='approved'?'<div class="approval-label">✓ Aprovação registada</div>Aprovado por: '+esc(e.approvedBy||'—')+'<br>Método: '+esc(e.approvalMethod||'—')+' · '+fmtShort(e.approvalDate):'<div class="approval-label">▲ Aguarda aprovação formal</div>'+(e.deadline?'Prazo de resposta: '+fmtShort(e.deadline)+'<br>':'')+'Este trabalho <strong>não será executado</strong> sem aprovação prévia por escrito.')+'</div><div class="extras-footer"><span>'+(e.status==='approved'?'Aprovado: '+fmtShort(e.approvalDate):'Pendente de aprovação')+'</span><span class="extras-cost">+ '+fmt(parseFloat(e.cost)||0)+'</span></div></div>'
  ).join('');

  const nextHtml = S.nextSteps.map((s,i) =>
    '<li class="next-step-item"><div class="step-number">'+(i+1)+'</div><div class="step-text">'+esc(s.desc||'—')+(s.date?'<div class="step-date">Previsto: '+fmtShort(s.date)+'</div>':'')+'</div></li>'
  ).join('') || '<li class="next-step-item"><div class="step-number">1</div><div class="step-text" style="color:#9ca3af">—</div></li>';

  const incHtml = (!S.incidentsOn || S.incidents.length===0)
    ? '<div class="incidents-empty"><div class="incidents-check">✓</div>Sem incidentes, não-conformidades ou ocorrências a registar neste período.</div>'
    : S.incidents.map(inc=>'<div style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:12px;">'+esc(inc.desc||'—')+'</div>').join('');

  const alertHtml = S.alertOn ? `
    <div class="section"><div class="alert">
      <strong>&#9650; ${esc(v.alertTitle||'Decisão necessária')}</strong><br>${esc(v.alertDesc||'')}
      ${v.alertDeadline?'<div class="alert-deadline">Prazo de resposta: '+fmtShort(v.alertDeadline)+(v.alertConsequence?' — '+esc(v.alertConsequence):'')+' </div>':''}
    </div></div>` : '';

  const summaryBanner = S.mode === 'weekly'
    ? `<div class="summary-banner"><strong>Resumo da Semana</strong>${esc(v.weekSummary||'—')}</div>`
    : '';

  const weeklyContent = S.mode === 'weekly' ? `
    <div class="section">
      <div class="section-title">Estado Geral da Obra</div>
      <div class="status-grid">
        <div class="status-card done"><div class="status-icon">✓</div><div class="status-number">${tasksDone}</div><div class="status-label">Concluídas</div></div>
        <div class="status-card progress"><div class="status-icon">●</div><div class="status-number">${tasksProg}</div><div class="status-label">Em Curso</div></div>
        <div class="status-card blocked"><div class="status-icon">▲</div><div class="status-number">${tasksBlk}</div><div class="status-label">Pendente</div></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Progresso Global da Obra</div>
      <div class="progress-section">
        <div class="progress-label"><span>${esc(S.phase||'Fase atual')}</span><span style="color:#3d8b5e">${v.progressPct}%</span></div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${v.progressPct}%"></div></div>
        <div class="progress-phases">${phasesHtml}</div>
      </div>
    </div>
    ${S.photos.length>0?'<div class="section"><div class="section-title">Registo Fotográfico</div><div class="photo-grid">'+photosHtml+'</div></div>':''}
    <div class="two-col">
      <div class="section"><div class="section-title">Trabalhos Concluídos esta Semana</div><ul class="work-list">${workDone}</ul></div>
      <div class="section"><div class="section-title">Em Curso e Pendentes</div><ul class="work-list">${workOther}</ul></div>
    </div>
    ${alertHtml}
    <div class="section"><div class="section-title">Incidentes e Não-Conformidades</div>${incHtml}</div>
    <div class="section">
      <div class="section-title">Próximos Passos</div>
      <ol class="next-steps-list">${nextHtml}</ol>
    </div>` : '';

  const extrasSection = S.mode === 'legal' && S.extras.length > 0
    ? `<div class="section"><div class="section-title">Trabalhos Extra / Alterações ao Contrato</div>${extrasHtml}</div>`
    : '';

  const financialSection = S.mode !== 'legal' ? '' : `<div class="section">
      <div class="section-title">Resumo Financeiro Acumulado</div>
      <table class="financial-table">
        <tr><td class="ft-label">Valor do contrato base</td><td class="ft-value">${fmt(base)}</td></tr>
        ${approved>0?'<tr><td class="ft-label ft-positive">Extras aprovados acumulados</td><td class="ft-value ft-positive">+ '+fmt(approved)+'</td></tr>':''}
        ${pending>0?'<tr><td class="ft-label ft-pending">Extras pendentes de aprovação</td><td class="ft-value ft-pending">+ '+fmt(pending)+' (pendente)</td></tr>':''}
        <tr class="ft-total"><td class="ft-label ft-total-value">Total projetado (s/ pendentes)</td><td class="ft-value ft-total-value">${fmt(base+approved)}</td></tr>
      </table>
      <div class="financial-note">${esc(v.financialNote||'Valores s/ IVA. Extras pendentes não incluídos no total até aprovação formal. Ref. contrato '+esc(v.contractNum||'—')+'.')}</div>
    </div>`;

  const ackSection = S.mode !== 'legal' ? '' : `<div class="section">
      <div class="ack-section">
        <div class="ack-header">Acuse de Recibo e Declaração do Cliente</div>
        <div class="ack-body">
          <div class="ack-notice">Eventuais discordâncias devem ser comunicadas por escrito no prazo de 48h. A falta de resposta não constitui aprovação de trabalhos extra, alterações de preço ou alterações ao projeto, salvo se tal estiver expressamente previsto no contrato.</div>
          <div class="ack-grid">
            <div class="ack-field"><label>Nome do cliente</label><div class="ack-line"></div></div>
            <div class="ack-field"><label>Data de receção</label><div class="ack-line"></div></div>
            <div class="ack-field"><label>Assinatura</label><div class="ack-line"></div></div>
            <div class="ack-field"><label>Observações</label><div class="ack-line"></div></div>
          </div>
          <div class="ack-clause">Relatório ${reportId} gerado em ${fmtShort(v.reportDate)||'—'} · ${esc(v.companyName||'—')}${v.companyNif?' · NIF '+esc(v.companyNif):''}${v.companyInci?' · INCI n.º '+esc(v.companyInci):''} · Este documento tem validade legal nos termos do art. 362.º e ss. do Código Civil Português.</div>
        </div>
      </div>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="pt"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Relatório de Obra — ${esc(v.projectName||'Obra')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;background:#f5f5f0}
.page{width:210mm;min-height:297mm;margin:0 auto;background:white}
@media print{body{background:white}.page{margin:0;box-shadow:none}@page{margin:0}.no-print{display:none}}
.header{background:#1c2b3a;color:white;padding:28px 36px 24px}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.logo-area{display:flex;align-items:center;gap:14px}
.logo-placeholder{width:44px;height:44px;border:2px solid #2e4158;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#4d6a85;text-align:center;line-height:1.2;flex-shrink:0}
.company-name{font-size:20px;font-weight:700;letter-spacing:-0.3px}
.company-tagline{font-size:11px;color:#8faabe;margin-top:2px}
.report-badge{text-align:right}
.report-badge .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8faabe}
.report-badge .number{font-size:22px;font-weight:700;color:#b88a3a;line-height:1}
.report-badge .report-id{font-size:10px;color:#6a8aab;font-family:'Courier New',monospace;margin-top:2px}
.header-info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;border-top:1px solid #2e4158;padding-top:16px}
.info-item .info-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8faabe;margin-bottom:3px}
.info-item .info-value{font-size:12px;font-weight:500;color:white}
.info-item .info-value.mono{font-family:'Courier New',monospace;font-size:11px;color:#c8d8e8}
.summary-banner{background:#f0f4f0;border-left:4px solid #3d8b5e;padding:16px 36px;font-size:13px;line-height:1.6;color:#2d4a3a}
.summary-banner strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#3d8b5e;margin-bottom:6px}
.content{padding:28px 36px}
.section{margin-bottom:28px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:14px}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.status-card{border-radius:8px;padding:14px 16px;text-align:center}
.status-card.done{background:#f0faf4;border:1px solid #b7e4c7}
.status-card.progress{background:#fff8f0;border:1px solid #fcd9a8}
.status-card.blocked{background:#fff5f5;border:1px solid #fecaca}
.status-card .status-icon{font-size:16px;font-weight:700;margin-bottom:4px;line-height:1.2}
.status-card.done .status-icon{color:#16a34a}
.status-card.progress .status-icon{color:#d97706}
.status-card.blocked .status-icon{color:#dc2626}
.status-card .status-number{font-size:24px;font-weight:700;line-height:1}
.status-card.done .status-number{color:#16a34a}
.status-card.progress .status-number{color:#d97706}
.status-card.blocked .status-number{color:#dc2626}
.status-card .status-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
.status-card.done .status-label{color:#16a34a}
.status-card.progress .status-label{color:#d97706}
.status-card.blocked .status-label{color:#dc2626}
.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.photo-card{border-radius:8px;overflow:hidden;border:1px solid #e5e7eb}
.photo-placeholder{height:130px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:11px;color:#9ca3af}
.photo-placeholder.before{background:#fef9f0}
.photo-placeholder.during{background:#f0f4ff}
.photo-placeholder.done-photo{background:#f0faf4}
.photo-placeholder.detail{background:#faf0f8}
.photo-placeholder .photo-icon{font-size:18px;font-weight:700;color:#d1d5db;letter-spacing:2px}
.photo-caption{padding:8px 12px;background:white}
.caption-badge{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 6px;border-radius:4px;margin-bottom:4px}
.caption-badge.before{background:#fef3c7;color:#92400e}
.caption-badge.during{background:#dbeafe;color:#1e40af}
.caption-badge.after{background:#dcfce7;color:#166534}
.caption-badge.detalhe{background:#f3e8ff;color:#6b21a8}
.photo-caption .caption-text{font-size:11px;color:#374151;line-height:1.4}
.photo-caption .caption-meta{font-size:10px;color:#9ca3af;margin-top:4px}
.work-list{list-style:none}
.work-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f3f4f6}
.work-item:last-child{border-bottom:none}
.work-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex-shrink:0}
.work-dot.done{background:#16a34a}
.work-dot.progress{background:#d97706}
.work-dot.blocked{background:#dc2626}
.work-text{flex:1;font-size:12px;line-height:1.5}
.work-area{font-size:10px;color:#9ca3af;font-weight:500}
.work-tag{font-size:10px;padding:1px 7px;border-radius:4px;font-weight:600}
.work-tag.done{background:#dcfce7;color:#166534}
.work-tag.progress{background:#fef9c3;color:#854d0e}
.work-tag.blocked{background:#fee2e2;color:#991b1b}
.extras-card{border-radius:8px;padding:14px 16px;margin-bottom:10px}
.extras-card.approved-card{background:#f8fdf9;border:1px solid #b7e4c7}
.extras-card.pending-card{background:#fffbf0;border:1px solid #fcd9a8}
.extras-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:12px}
.extras-title-area{flex:1}
.extras-ref{font-size:10px;color:#9ca3af;font-family:'Courier New',monospace;margin-bottom:2px}
.extras-title{font-size:12px;font-weight:600;color:#1a1a1a}
.extras-status{font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;white-space:nowrap;flex-shrink:0}
.extras-status.pending{background:#fef3c7;color:#92400e}
.extras-status.approved{background:#dcfce7;color:#166534}
.extras-desc{font-size:11px;color:#374151;line-height:1.5;margin-bottom:10px}
.extras-approval{background:#f0faf4;border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:10px;color:#374151;line-height:1.7}
.extras-approval.waiting{background:#fffbf0}
.extras-approval .approval-label{font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;font-size:10px}
.extras-approval.waiting .approval-label{color:#92400e}
.extras-footer{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
.extras-cost{font-weight:700;font-size:13px;color:#1a1a1a}
.financial-table{width:100%;border-collapse:collapse;font-size:12px}
.financial-table td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
.financial-table tr:last-child td{border-bottom:none}
.ft-label{color:#374151}
.ft-value{text-align:right;font-family:'Courier New',monospace;font-size:12px}
.ft-total td{background:#f9fafb;font-weight:700;font-size:13px;border-top:2px solid #e5e7eb}
.ft-positive{color:#d97706}
.ft-pending{color:#9ca3af;font-style:italic}
.ft-total-value{color:#1c2b3a}
.financial-note{font-size:10px;color:#9ca3af;margin-top:8px;line-height:1.5}
.incidents-empty{background:#f9fafb;border:1px dashed #e5e7eb;border-radius:8px;padding:14px 16px;font-size:11px;color:#9ca3af;text-align:center}
.incidents-check{font-size:14px;font-weight:700;color:#16a34a;margin-bottom:4px}
.next-steps-list{list-style:none}
.next-step-item{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6}
.next-step-item:last-child{border-bottom:none}
.step-number{width:20px;height:20px;border-radius:50%;background:#1c2b3a;color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.step-text{font-size:12px;line-height:1.5;flex:1}
.step-date{font-size:10px;color:#9ca3af}
.progress-section{background:#f9fafb;border-radius:8px;padding:14px 16px}
.progress-label{display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:6px}
.progress-bar-track{background:#e5e7eb;border-radius:99px;height:8px;overflow:hidden}
.progress-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#3d8b5e,#5cb884)}
.progress-phases{display:flex;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:4px}
.phase-item{font-size:10px;color:#9ca3af;text-align:center}
.phase-item.active{color:#3d8b5e;font-weight:700}
.phase-item.done-phase{color:#6b7280}
.alert{background:#fff8f0;border:1px solid #fcd9a8;border-left:4px solid #d97706;border-radius:8px;padding:12px 14px;font-size:11px;color:#78350f;line-height:1.5}
.alert strong{color:#92400e;font-size:12px}
.alert-deadline{margin-top:8px;font-size:10px;color:#a16207;font-weight:600}
.ack-section{border:1px solid #d1d5db;border-radius:8px;overflow:hidden}
.ack-header{background:#1c2b3a;color:white;padding:10px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.ack-body{padding:16px}
.ack-notice{font-size:11px;color:#374151;line-height:1.6;margin-bottom:14px;background:#f9fafb;padding:10px 12px;border-radius:6px;border-left:3px solid #9ca3af}
.ack-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px}
.ack-field{display:flex;flex-direction:column;gap:4px}
.ack-field label{font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;font-weight:700}
.ack-line{border-bottom:1px solid #374151;height:24px;width:100%}
.ack-clause{font-size:10px;color:#9ca3af;margin-top:12px;line-height:1.5;font-style:italic}
.footer{background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;display:flex;justify-content:space-between;align-items:center}
.footer-company{font-size:11px;color:#6b7280}
.footer-company strong{display:block;color:#374151;font-size:12px}
.footer-center{text-align:center;font-size:10px;color:#d1d5db}
.footer-contact{text-align:right;font-size:10px;color:#9ca3af;line-height:1.6}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.print-btn{position:fixed;bottom:24px;right:24px;background:#1c2b3a;color:white;border:none;border-radius:8px;padding:14px 20px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:999}
.legal-strip{background:#f9fafb;border-top:1px solid #e5e7eb;padding:12px 36px;font-size:9.5px;color:#9ca3af;line-height:1.7;text-align:justify}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / PDF</button>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div class="logo-area">
        <div class="logo-placeholder">LOGO</div>
        <div>
          <div class="company-name">${esc(v.companyName||'Empresa de Construção')}</div>
          <div class="company-tagline">${esc(v.companyTagline||'')}</div>
        </div>
      </div>
      <div class="report-badge">
        <div class="label">${S.mode === 'legal' ? 'Relatório Legal / Financeiro' : 'Relatório Semanal'}</div>
        <div class="number">#${String(rn).padStart(3,'0')}</div>
        <div class="report-id">${reportId}</div>
      </div>
    </div>
    <div class="header-info">
      <div class="info-item"><div class="info-label">Obra</div><div class="info-value">${esc(v.projectName||'—')}</div></div>
      <div class="info-item"><div class="info-label">Localização</div><div class="info-value">${esc(v.location||'—')}</div></div>
      <div class="info-item"><div class="info-label">Data do Relatório</div><div class="info-value">${fmtDate(v.reportDate)||'—'}</div></div>
      <div class="info-item"><div class="info-label">Cliente</div><div class="info-value">${esc(v.clientName||'—')}</div></div>
      <div class="info-item"><div class="info-label">Responsável de Obra</div><div class="info-value">${esc(v.responsible||'—')}</div></div>
      <div class="info-item"><div class="info-label">Período</div><div class="info-value">${fmtRange(v.periodStart,v.periodEnd)||'—'}</div></div>
      <div class="info-item"><div class="info-label">N.º Contrato</div><div class="info-value mono">${esc(v.contractNum||'—')}</div></div>
      <div class="info-item"><div class="info-label">Distribuído a</div><div class="info-value" style="font-size:11px">${esc(v.distributedTo||'—')}</div></div>
      <div class="info-item"><div class="info-label">Enviado via</div><div class="info-value" style="font-size:11px">${esc(v.sentVia||'—')} · ${fmtShort(v.reportDate)||'—'}</div></div>
    </div>
  </div>
  ${summaryBanner}
  <div class="content">
    ${weeklyContent}
    ${extrasSection}
    ${financialSection}
    ${ackSection}
  </div>
  <div class="legal-strip">Este relatório é emitido para efeitos de acompanhamento, comunicação e arquivo documental da obra. Não substitui o contrato de empreitada, o Livro de Obra, autos de medição, faturas, licenças, projetos aprovados, termos de responsabilidade ou aprovações formais exigidas por lei ou contrato. Trabalhos extra, alterações de preço, prazo ou projeto carecem de aprovação expressa por escrito, salvo disposição contratual em contrário.</div>
  <div class="footer">
    <div class="footer-company"><strong>${esc(v.companyName||'—')}</strong>${v.companyNif?'NIF '+esc(v.companyNif):''}${v.companyInci?' · INCI n.º '+esc(v.companyInci):''}<br>Relatório ${reportId} · gerado ${fmtShort(v.reportDate)||'—'}</div>
    <div class="footer-center">Página 1 de 1</div>
    <div class="footer-contact">${esc(v.companyEmail||'')}${v.companyPhone?' · '+esc(v.companyPhone):''}</div>
  </div>
</div>
</body></html>`;

  const blob = new Blob([html], {type:'text/html'});
  window.open(URL.createObjectURL(blob), '_blank');
}

// ── INIT ────────────────────────────────────────────────────────────
(function init() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
  document.getElementById('reportDate').value = today;
  document.getElementById('periodEnd').value = today;
  document.getElementById('periodStart').value = weekAgo.toISOString().split('T')[0];
  document.getElementById('reportNum').value = '1';
})();
