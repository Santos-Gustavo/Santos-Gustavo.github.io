// ── DB PROJECT STORE ────────────────────────────────────────────────
// Replaces localStorage project loading.
// Projects now come from Supabase.

async function loadProjects() {
  const user = await requireUser();

  const { data, error } = await supabaseClient
    .from("projects")
    .select(`
    id,
    company_id,
    client_id,
    name,
    site_address,
    type_of_work,
    start_date,
    expected_end_date,
    actual_end_date,
    status,
    contract_num,
    contract_value,
    internal_notes,
    created_at,
    updated_at,
    companies (
      id,
      owner_id,
      name,
      nif,
      impic,
      responsible,
      phone,
      email,
      address,
      logo_url,
      default_vat_rate
    ),
    clients (
      id,
      company_id,
      name,
      phone,
      email,
      nif,
      address,
      notes
    ),
    reports (
      id,
      report_num,
      report_date,
      created_at
    )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading projects:", error);
    alert("Erro ao carregar obras: " + error.message);
    return [];
  }

  const projects = (data || []).map(mapDbProjectToAppProject);

  S.projectsCache = projects;

  return projects;
}

function mapDbProjectToAppProject(row) {
  const company = row.companies || {};
  const client = row.clients || {};

  return {
    id: row.id,
    projectId: row.id,
    companyId: row.company_id,
    clientId: row.client_id,

    name: row.name || "",
    status: row.status,

    obra: {
      companyName: company.name || "",
      companyNif: company.nif || "",
      companyInci: company.impic || "",
      responsible: company.responsible || "",
      companyPhone: company.phone || "",
      companyEmail: company.email || "",

      clientName: client.name || "",
      location: row.site_address || "",
      contractNum: row.contract_num || "",
      contractValue: row.contract_value || ""
    },

    lastReportNum: getLastReportNum(row.reports || [])
  };
}

function getLastReportNum(reports) {
  if (!Array.isArray(reports) || reports.length === 0) return 0;

  return reports.reduce((max, report) => {
    const n = Number(report.report_num || 0);
    return n > max ? n : max;
  }, 0);
}

function getProjectById(id) {
  return S.projectsCache.find(project => project.id === id) || null;
}

// No-op compatibility function.
// Old app used this for localStorage. DB is now source of truth.
function saveProjects() {
  console.warn("saveProjects() ignored. Projects are now saved in Supabase.");
}