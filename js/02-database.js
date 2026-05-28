// ── DATABASE LINK ──────────────────────────────────────────────────
// Saves using the normalized MVP schema:
//
// companies
// clients
// projects
// reports
// photos
//
// Important:
// - Do NOT put S3 access keys in frontend code.
// - This uses the Supabase browser client and the anon key.
// - Bucket used: "project-photos"

const PHOTO_BUCKET = "project-photos";

async function saveAndGenerateReport() {
  const savedData = await saveReportToSupabase();

  if (!savedData) return;

  generateReport();
}

async function saveReportToSupabase() {
  const v = getV();

  try {
    const company = await findOrCreateCompany(v);
    const client = await findOrCreateClient(company.id, v);
    const project = await findOrCreateProject(company.id, client.id, v);
    const report = await createReport(company.id, client.id, project.id, v);

    const photos = await savePhotosForReport({
      companyId: company.id,
      clientId: client.id,
      projectId: project.id,
      reportId: report.id
    });

    console.log("Saved normalized report:", {
      company,
      client,
      project,
      report,
      photos
    });

    alert("Relatório guardado com sucesso.");

    return {
      company,
      client,
      project,
      report,
      photos
    };

  } catch (error) {
    console.error("Supabase save error:", error);
    alert("Erro ao guardar relatório: " + error.message);
    return null;
  }
}


// ── COMPANIES ───────────────────────────────────────────────────────

async function findOrCreateCompany(v) {
  const name = cleanText(v.companyName);
  const nif = cleanText(v.companyNif);

  if (!name) {
    throw new Error("Nome da empresa é obrigatório.");
  }

  let query = supabaseClient
    .from("companies")
    .select("*")
    .limit(1);

  if (nif) {
    query = query.eq("nif", nif);
  } else {
    query = query.eq("name", name);
  }

  const { data: existing, error: findError } = await query.maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { data: updated, error: updateError } = await supabaseClient
      .from("companies")
      .update({
        name,
        nif: nif || existing.nif,
        impic: cleanText(v.companyInci) || existing.impic,
        responsible: cleanText(v.responsible) || existing.responsible,
        phone: cleanText(v.companyPhone) || existing.phone,
        email: cleanText(v.companyEmail) || existing.email,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const payload = {
    name,
    nif: nif || null,
    impic: cleanText(v.companyInci) || null,
    responsible: cleanText(v.responsible) || null,
    phone: cleanText(v.companyPhone) || null,
    email: cleanText(v.companyEmail) || null,
    default_vat_rate: 23.00
  };

  const { data, error } = await supabaseClient
    .from("companies")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}


// ── CLIENTS ─────────────────────────────────────────────────────────

async function findOrCreateClient(companyId, v) {
  const name = cleanText(v.clientName);

  if (!name) {
    throw new Error("Nome do cliente é obrigatório.");
  }

  const { data: existing, error: findError } = await supabaseClient
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) return existing;

  const payload = {
    company_id: companyId,
    name,
    phone: null,
    email: null,
    address: null,
    notes: null
  };

  const { data, error } = await supabaseClient
    .from("clients")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}


// ── PROJECTS ────────────────────────────────────────────────────────

async function findOrCreateProject(companyId, clientId, v) {
  const name = cleanText(v.projectName);

  if (!name) {
    throw new Error("Nome da obra é obrigatório.");
  }

  const contractNum = cleanText(v.contractNum);

  let query = supabaseClient
    .from("projects")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .limit(1);

  if (contractNum) {
    query = query.eq("contract_num", contractNum);
  } else {
    query = query.eq("name", name);
  }

  const { data: existing, error: findError } = await query.maybeSingle();

  if (findError) throw findError;

  const payload = {
    company_id: companyId,
    client_id: clientId,
    name,
    site_address: cleanText(v.location) || null,
    type_of_work: null,
    start_date: v.periodStart || null,
    expected_end_date: v.periodEnd || null,
    status: "active",
    contract_num: contractNum || null,
    contract_value: toNumberOrNull(v.contractValue),
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { data: updated, error: updateError } = await supabaseClient
      .from("projects")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const { data, error } = await supabaseClient
    .from("projects")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}


// ── REPORTS ─────────────────────────────────────────────────────────

async function createReport(companyId, clientId, projectId, v) {
  const payload = {
    company_id: companyId,
    client_id: clientId,
    project_id: projectId,

    report_num: v.reportNum ? Number(v.reportNum) : null,
    report_date: v.reportDate || new Date().toISOString().slice(0, 10),

    period_start: v.periodStart || null,
    period_end: v.periodEnd || null,

    distributed_to: cleanText(v.distributedTo) || null,
    sent_via: normalizeSentVia(v.sentVia),

    phase: cleanText(S.phase) || null,
    progress_pct: v.progressPct ? Number(v.progressPct) : 0,

    week_summary: cleanText(v.weekSummary) || null,

    alert_on: Boolean(S.alertOn),
    alert_title: cleanText(v.alertTitle) || null,
    alert_desc: cleanText(v.alertDesc) || null,
    alert_deadline: v.alertDeadline || null,
    alert_consequence: cleanText(v.alertConsequence) || null,

    incidents_on: Boolean(S.incidentsOn),

    financial_note: cleanText(v.financialNote) || null,

    works: Array.isArray(S.works) ? S.works : [],
    incidents: Array.isArray(S.incidents) ? S.incidents : [],
    extras: Array.isArray(S.extras) ? S.extras : [],
    next_steps: Array.isArray(S.nextSteps) ? S.nextSteps : [],

    status: "draft"
  };

  const { data, error } = await supabaseClient
    .from("reports")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}


// ── PHOTOS ──────────────────────────────────────────────────────────

async function savePhotosForReport({ companyId, clientId, projectId, reportId }) {
  if (!Array.isArray(S.photos) || S.photos.length === 0) {
    return [];
  }

  const insertedPhotos = [];

  for (const photo of S.photos) {
    const uploaded = await uploadPhotoIfNeeded({
      photo,
      companyId,
      projectId,
      reportId
    });

    const photoPayload = {
      company_id: companyId,
      client_id: clientId,
      project_id: projectId,
      report_id: reportId,

      file_url: uploaded.fileUrl,
      storage_path: uploaded.storagePath,
      thumbnail_url: null,

      tag: mapPhotoTag(photo.type),
      area: cleanText(photo.area) || null,
      description: cleanText(photo.desc) || null,
      worker: cleanText(photo.worker) || null,

      is_before: photo.type === "before",
      is_after: photo.type === "after",

      is_client_visible: true,

      source: "manual"
    };

    const { data, error } = await supabaseClient
      .from("photos")
      .insert(photoPayload)
      .select()
      .single();

    if (error) throw error;

    insertedPhotos.push(data);
  }

  return insertedPhotos;
}

async function uploadPhotoIfNeeded({ photo, companyId, projectId, reportId }) {
  if (photo.storagePath && photo.fileUrl) {
    return {
      storagePath: photo.storagePath,
      fileUrl: photo.fileUrl
    };
  }

  if (!photo.dataUrl) {
    return {
      storagePath: null,
      fileUrl: null
    };
  }

  const blob = dataUrlToBlob(photo.dataUrl);
  const extension = guessExtensionFromDataUrl(photo.dataUrl);
  const fileName = `${crypto.randomUUID()}.${extension}`;

  const storagePath = [
    "companies",
    companyId,
    "projects",
    projectId,
    "reports",
    reportId,
    fileName
  ].join("/");

  const { data: uploadData, error: uploadError } = await supabaseClient.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: blob.type || "image/jpeg"
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabaseClient.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadData.path);

  return {
    storagePath: uploadData.path,
    fileUrl: publicUrlData.publicUrl
  };
}


// ── DATABASE HELPERS ────────────────────────────────────────────────

function cleanText(value) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  const num = Number(value);

  return Number.isFinite(num) ? num : null;
}

function normalizeSentVia(value) {
  const text = String(value || "").toLowerCase().trim();

  if (text.includes("whatsapp")) return "whatsapp";
  if (text.includes("email")) return "email";
  if (text.includes("pdf")) return "pdf_download";
  if (text.includes("manual")) return "manual";

  return "other";
}

function mapPhotoTag(type) {
  const map = {
    before: "before",
    during: "other",
    after: "after",
    detail: "other",

    demolition: "demolition",
    plumbing: "plumbing",
    electrical: "electrical",
    flooring: "flooring",
    painting: "painting",
    carpentry: "carpentry",
    insulation: "insulation",
    issue: "issue",
    extra: "extra_work",
    extra_work: "extra_work",
    completed: "completed_work",
    completed_work: "completed_work"
  };

  return map[type] || "other";
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(",");
  const meta = parts[0];
  const base64 = parts[1];

  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

function guessExtensionFromDataUrl(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  if (dataUrl.startsWith("data:image/gif")) return "gif";
  return "jpg";
}