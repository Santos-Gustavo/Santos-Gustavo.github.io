// tests/e2e/fixtures/report-layout-cases.js
//
// REPORT-LAYOUT-V2 evidence cases (canonical-shaped snapshots, generated
// after the layout cutover). Photos/logo are inline SVG so no storage is needed.
import { REPORT_LAYOUT_V2_CUTOVER } from "../../../js/reports/report-renderer.js";

function photoSvg(label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,70%)"/><stop offset="1" stop-color="hsl(${hue},20%,40%)"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><text x="40" y="560" font-family="Arial" font-size="40" fill="#fff">${label}</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
const LOGO = "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="14" fill="#22252A"/><text x="60" y="76" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="46" fill="#F6F3EE">CS</text></svg>`).toString("base64");

// Exactly at the cutover (>= → v2), so the cases stay post-cutover whatever
// rollout timestamp the release step sets.
const GENERATED = REPORT_LAYOUT_V2_CUTOVER;

function base(over = {}) {
  return {
    schemaVersion: 1,
    snapshotVersion: 1,
    source: "canonical",
    meta: { reportId: "r", projectId: "p", mode: "weekly", reportNumber: 72, reportDate: "2026-10-08", periodStart: "2026-10-01", periodEnd: "2026-10-08", generatedAt: GENERATED },
    company: { id: "c", name: "Construções Silva & Filhos, Lda.", tagline: "", nif: "509123456", impic: "54321-PAR", responsible: "Rui Silva", phone: "935121546", email: "geral@construcoessilva.pt", logoPath: "x", logoUrl: LOGO },
    project: { id: "p", clientId: "cl", name: "Remodelação T3 — Rua das Flores", clientName: "António Ferreira", location: "Rua das Flores 12, 1200-195 Lisboa", contractNumber: "", contractValue: 0 },
    progress: { phase: "Acabamentos", percentage: 70, weekSummary: "Esta semana terminámos o revestimento cerâmico da casa de banho 1 e a pintura da sala. Na próxima semana instalamos o móvel de lavatório e começamos a montagem da cozinha." },
    alert: { enabled: false, title: "", description: "", deadline: null, consequence: "" },
    incidents: { enabled: true, items: [] },
    works: [],
    photos: [],
    extras: [],
    nextSteps: [],
    ...over,
  };
}

const W = (type, area, description, status) => ({ type, area, description, status });
const P = (area, stage, description, hue, worker = "") => ({ id: null, area, description, worker, stage, storagePath: "x", displayUrl: photoSvg(`${area} · ${stage}`, hue) });

const case1 = base({
  works: [
    W("Revestimento Cerâmico", "Casa de Banho 1", "Assentamento de azulejo nas paredes", "done"),
    W("Pintura Interior", "Sala", "Pintura de paredes e tetos (2 demãos)", "done"),
    W("Canalização / Hidráulica", "Cozinha", "Ligações de água e esgoto para a bancada", "in_progress"),
    W("Eletricidade", "Cozinha", "Tomadas e iluminação sob os armários", "in_progress"),
    W("Carpintaria", "Quarto 1", "Montagem de roupeiro embutido", "pending"),
    W("Pavimento / Betonilha", "Hall / Corredor", "Afagamento do soalho", "pending"),
  ],
  photos: [
    P("Casa de Banho 1", "during", "Revestimento concluído na parede do duche", 20),
    P("Sala", "after", "Pintura terminada", 200),
    P("Cozinha", "during", "Pontos de água preparados", 120),
    P("Quarto 1", "before", "Vão do roupeiro antes da montagem", 280),
  ],
  nextSteps: [
    { description: "Instalar móvel de lavatório na casa de banho 1", date: null },
    { description: "Montar módulos da cozinha", date: null },
    { description: "Afagar e envernizar o soalho do corredor", date: null },
  ],
});

const types = ["Demolição", "Alvenaria / Paredes", "Canalização / Hidráulica", "Eletricidade", "Reboco / Estuque", "Pintura Interior", "Carpintaria", "Revestimento Cerâmico", "Vãos / Portas / Janelas", "Isolamento Térmico", "Pavimento / Betonilha", "Serralharia / Estruturas Metálicas", "Pintura Exterior", "Jardim / Arranjos Exteriores"];
const areas = ["Cozinha", "Sala", "Suite", "Quarto 1", "Quarto 2", "Casa de Banho 1", "Casa de Banho 2", "Hall / Corredor", "Fachada Sul", "Cobertura / Terraço", "Garagem", "Varanda", "Exterior", "Jardim"];
const statuses = ["done", "in_progress", "pending"];
const case2 = base({
  meta: { ...base().meta, reportNumber: 73, periodStart: "2026-09-21", periodEnd: "2026-10-08" },
  project: { ...base().project, name: "Moradia V4 — Quinta do Lago", clientName: "Maria Costa", location: "Estrada da Quinta 4, Almancil", contractNumber: "CT-2026-018" },
  progress: { phase: "Instalações técnicas", percentage: 45, weekSummary: "Duas semanas de trabalho intenso: concluímos as redes de águas e esgotos no piso térreo e avançámos com a eletricidade em todos os quartos. A caixilharia chegou com atraso, mas já está em obra. Mantemos a previsão de entrega do piso térreo para o final do mês." },
  works: Array.from({ length: 16 }, (_, i) => W(types[i % types.length], areas[i % areas.length], `Tarefa ${i + 1}: ${["execução de roços e tubagem", "aplicação de primário e acabamento", "montagem e afinação", "verificação e ensaio de estanquidade"][i % 4]} conforme especificação aprovada`, statuses[i % 3])),
  photos: Array.from({ length: 8 }, (_, i) => P(areas[i], ["before", "during", "after"][i % 3], `Registo ${i + 1} da frente de trabalho`, i * 40, i % 2 ? "Equipa Silva" : "")),
  incidents: { enabled: true, items: [
    { description: "Caixilharia entregue com 6 dias de atraso pelo fornecedor.", status: "resolved" },
    { description: "Infiltração detetada junto à claraboia após chuva forte.", status: "open" },
  ] },
  nextSteps: Array.from({ length: 6 }, (_, i) => ({ description: `Próximo passo ${i + 1}: preparar frente de trabalho ${areas[i]}`, date: null })),
});

const case3 = base({
  meta: { ...base().meta, reportNumber: 12 },
  project: { ...base().project, name: "Reabilitação de fachada — Edifício Aurora", clientName: "Condomínio Edifício Aurora", location: "Av. da República 101, Lisboa", contractNumber: "AUR-2026-03" },
  progress: { phase: "Fachada", percentage: 55, weekSummary: "Andaimes montados na fachada sul e iniciada a reparação do reboco. Registámos duas ocorrências que precisam de decisão do condomínio." },
  works: [
    W("Reboco / Estuque", "Fachada Sul", "Reparação de fissuras no reboco", "in_progress"),
    W("Pintura Exterior", "Fachada Sul", "Aplicação de primário", "pending"),
    W("Serralharia / Estruturas Metálicas", "Varanda", "Tratamento de guardas metálicas", "done"),
  ],
  photos: [P("Fachada Sul", "before", "Estado inicial do reboco", 30), P("Varanda", "after", "Guardas tratadas", 210)],
  incidents: { enabled: true, items: [
    { description: "Armadura exposta na varanda do 3.º esquerdo — necessária decisão sobre tratamento.", status: "open" },
    { description: "Toldo de um condómino impede a montagem do andaime no 2.º direito.", status: "open" },
    { description: "Fornecimento de tinta atrasado — material entregue a 06/10.", status: "resolved" },
  ] },
  nextSteps: [{ description: "Reunião com a administração do condomínio", date: "2026-10-13" }],
});

const case4 = base({
  meta: { ...base().meta, reportNumber: 5, reportDate: "2026-10-08", periodStart: "2026-10-08", periodEnd: "2026-10-08" },
  company: { ...base().company, phone: "+351 213 456 789", tagline: "Obras e remodelações desde 1998" },
  project: { ...base().project, name: "Pequena reparação — Cozinha", clientName: "Joana Matos", location: "", contractNumber: "" },
  progress: { phase: "", percentage: 100, weekSummary: "Visita única para reparação de fuga na torneira e substituição do sifão." },
  works: [
    W("Outro", "Cozinha", "Substituição do sifão do lava-loiça", "done"),
    W("Outro", "", "Reparação de fuga na torneira misturadora", "done"),
    W("Canalização / Hidráulica", "Cozinha", "Teste de estanquidade", "done"),
  ],
  photos: [P("Cozinha", "after", "Sifão novo instalado", 160)],
  nextSteps: [],
});

export { case1, case2, case3, case4, GENERATED };

// Pre-cutover snapshots: one legacy-wizard shape, one canonical. Their v1
// output is pinned in report-v1-golden-*.html (rendered by the renderer as it
// was before REPORT-LAYOUT-V2), so any drift in v1 fails the spec.
export const legacyPreCutover = {
  schemaVersion: 1,
  meta: { reportId: "r-legacy", projectId: "p", mode: "weekly", reportNumber: "1", reportDate: "2026-08-20", periodStart: "2026-08-13", periodEnd: "2026-08-20", generatedAt: "2026-08-20T10:00:00.000Z" },
  company: { id: "c", name: "Empresa Antiga", tagline: "Slogan antigo", nif: "", impic: "", responsible: "", phone: "912345678", email: "" },
  project: { id: "p", clientId: "cl", name: "Obra antiga", clientName: "Cliente Antigo", location: "Porto", contractNumber: "OLD-1", contractValue: 1000 },
  progress: { phase: "Estrutura e Alvenaria", percentage: 30, weekSummary: "Resumo do relatório antigo" },
  alert: { enabled: true, title: "Decisão antiga", description: "Escolher azulejo", deadline: "2026-08-25", consequence: "Atraso" },
  incidents: { enabled: true, items: [{ description: "Incidente antigo" }] },
  works: [
    { type: "Alvenaria / Paredes", area: "Sala", description: "Antigo concluído", status: "done" },
    { type: "Outro", area: "Cozinha", description: "Antigo em curso", status: "progress" },
    { type: "Pintura Interior", area: "Quarto 1", description: "Antigo pendente", status: "blocked" },
  ],
  photos: [{ id: "ph", area: "Sala", description: "Foto antiga", worker: "Rui", stage: "during", storagePath: "x", displayUrl: "https://example.test/foto.png" }],
  extras: [],
  nextSteps: [{ description: "Passo antigo", date: "2026-08-27" }],
  financialNote: "",
};

export const canonicalPreCutover = { ...case3, meta: { ...case3.meta, generatedAt: "2026-10-08T16:30:00.000Z" } };
