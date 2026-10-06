// js/company/company-logo.js
//
// POST-RELEASE-POLISH-001 — company logo on "Dados da Empresa", shown in the
// report header. Whatever the picture's size or shape, it's normalised to one
// fixed 512×512 PNG (scaled to fit, centred, transparent padding) before
// upload, and the report shows it in a fixed-size box — so every logo ends up
// the same size.
//
// Upload / removal is saved immediately (like Estado da Obra photos), not via
// the form's "Guardar". Old logo files are never deleted: reports already
// generated keep the logo they were frozen with.

import { appState } from "#state/app-state.js";
import { updateCompanyLogo } from "#database/db-companies.js";
import { uploadCompanyLogo, getSignedPhotoUrl } from "#database/storage-service.js";

const LOGO_SIZE = 512;

let initialized = false;
let busy = false;

export function initCompanyLogo() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
}

export async function renderCompanyLogo(company) {
  const preview = document.getElementById("companyLogoPreview");
  const uploadBtn = document.getElementById("companyLogoUploadBtn");
  const removeBtn = document.getElementById("companyLogoRemoveBtn");
  const hint = document.getElementById("companyLogoHint");

  const hasCompany = Boolean(company?.id);
  const logoPath = company?.logo_url || null;

  if (uploadBtn) {
    uploadBtn.disabled = !hasCompany || busy;
    uploadBtn.textContent = busy ? "A carregar..." : logoPath ? "Alterar logótipo" : "Carregar logótipo";
  }
  if (removeBtn) {
    removeBtn.hidden = !logoPath;
    removeBtn.disabled = busy;
  }
  if (hint) {
    hint.textContent = hasCompany
      ? "Aparece no cabeçalho dos novos relatórios, sempre com o mesmo tamanho."
      : "Guarde primeiro os dados da empresa para poder carregar o logótipo.";
  }

  if (!preview) return;

  if (!logoPath) {
    preview.innerHTML = `<span class="company-logo-empty">Sem logótipo</span>`;
    preview.dataset.logoPath = "";
    return;
  }

  preview.dataset.logoPath = logoPath;
  const url = await getSignedPhotoUrl(logoPath).catch(() => null);
  // A newer render may have replaced the logo meanwhile.
  if (preview.dataset.logoPath !== logoPath) return;

  preview.innerHTML = url
    ? `<img class="company-logo-img" src="${escapeHtml(url)}" alt="Logótipo da empresa" />`
    : `<span class="company-logo-empty">Logótipo indisponível</span>`;
}

async function handleClick(event) {
  if (event.target.closest("#companyLogoUploadBtn")) {
    event.preventDefault();
    if (busy || !appState.currentCompany?.id) return;
    document.getElementById("companyLogoInput")?.click();
    return;
  }

  if (event.target.closest("#companyLogoRemoveBtn")) {
    event.preventDefault();
    if (busy || !appState.currentCompany?.id) return;
    await saveLogo(null);
  }
}

async function handleChange(event) {
  const input = event.target;
  if (input?.id !== "companyLogoInput") return;

  const file = input.files?.[0];
  input.value = "";
  if (!file || busy) return;

  const company = appState.currentCompany;
  if (!company?.id) return;

  busy = true;
  await renderCompanyLogo(company);

  try {
    const blob = await normalizeLogo(file);
    const { storagePath } = await uploadCompanyLogo({ blob, companyId: company.id });
    busy = false;
    await saveLogo(storagePath);
  } catch (error) {
    console.error("Error uploading company logo:", error);
    busy = false;
    await renderCompanyLogo(appState.currentCompany);
    alert("Erro ao carregar o logótipo: " + error.message);
  }
}

async function saveLogo(logoPath) {
  const companyId = appState.currentCompany?.id;
  if (!companyId) return;

  busy = true;
  await renderCompanyLogo(appState.currentCompany);

  try {
    const updated = await updateCompanyLogo(companyId, logoPath);
    appState.currentCompany = updated;
  } catch (error) {
    console.error("Error saving company logo:", error);
    alert("Erro ao guardar o logótipo: " + error.message);
  } finally {
    busy = false;
    await renderCompanyLogo(appState.currentCompany);
  }
}

// Any image the browser can decode → fixed LOGO_SIZE×LOGO_SIZE PNG, scaled to
// fit (never cropped or stretched), centred, transparent background.
async function normalizeLogo(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um ficheiro de imagem.");
  }

  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    throw new Error("Não foi possível ler a imagem.");
  }

  const scale = Math.min(LOGO_SIZE / width, LOGO_SIZE / height);
  const drawWidth = Math.round(width * scale);
  const drawHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = LOGO_SIZE;
  canvas.height = LOGO_SIZE;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    Math.round((LOGO_SIZE - drawWidth) / 2),
    Math.round((LOGO_SIZE - drawHeight) / 2),
    drawWidth,
    drawHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível processar a imagem."))),
      "image/png"
    );
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Formato de imagem não suportado. Use PNG ou JPG."));
    };
    image.src = url;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
