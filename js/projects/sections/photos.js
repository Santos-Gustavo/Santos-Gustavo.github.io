// js/projects/sections/photos.js

import { appState } from "#state/app-state.js";
import { deletePhotoViaFunction } from "#database/db-photos.js";
import { AREAS } from "#config/app-options.js";


let initialized = false;

export function initPhotosSection() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handlePhotoClick);
  document.addEventListener("change", handlePhotoChange);
  document.addEventListener("input", handlePhotoInput);

  installTemporaryPhotoBridge();
}

export function addPhotoItem() {
  const photos = getPhotosState();

  photos.push({
    id: crypto.randomUUID(),
    photoId: null,
    dataUrl: "",
    file: null,
    storagePath: null,
    signedUrl: null,
    fileUrl: null,
    type: "during",
    area: "",
    desc: "",
    worker: "",
  });

  syncPhotosState(photos);
  renderPhotos();
}

export async function removePhoto(photoId) {
  const photos = getPhotosState();
  const photo = photos.find((item) => String(item.id) === String(photoId));

  if (!photo) return;

  const hasPersistedDbRow = Boolean(photo.photoId);

  if (hasPersistedDbRow) {
    const confirmed = confirm("Apagar esta fotografia da base de dados e do armazenamento?");

    if (!confirmed) return;

    try {
      await deletePhotoViaFunction(photo.photoId);
    } catch (error) {
      console.error("Error deleting persisted photo:", error);
      alert("Erro ao apagar fotografia: " + error.message);
      return;
    }
  }

  const nextPhotos = photos.filter((item) => String(item.id) !== String(photoId));

  syncPhotosState(nextPhotos);
  renderPhotos();
}

export function renderPhotos() {
  const photoList = document.getElementById("photoList");

  if (!photoList) return;

  const photos = getPhotosState();

  if (photos.length === 0) {
    photoList.innerHTML = `
      <p class="empty-hint">
        Ainda sem fotografias neste relatório.
      </p>
    `;
    return;
  }

  photoList.innerHTML = photos.map(renderPhotoCard).join("");
}

export async function handlePhotoFile(photoId, input) {
  const file = input.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Escolha um ficheiro de imagem.");
    input.value = "";
    return;
  }

  const photos = getPhotosState();
  const photo = photos.find((item) => String(item.id) === String(photoId));

  if (!photo) return;

  try {
    const dataUrl = await fileToDataUrl(file);

    photo.file = file;
    photo.dataUrl = dataUrl;

    // If replacing a new unsaved photo, clear old upload metadata.
    // Persisted-photo replacement will be handled later when edit-existing-report is migrated.
    if (!photo.photoId) {
      photo.storagePath = null;
      photo.signedUrl = null;
      photo.fileUrl = null;
    }

    syncPhotosState(photos);
    renderPhotos();
  } catch (error) {
    console.error("Error reading photo:", error);
    alert("Erro ao carregar fotografia: " + error.message);
  }
}

export function setPhotoValue(photoId, key, value) {
  const allowedKeys = new Set(["type", "area", "desc", "worker"]);

  if (!allowedKeys.has(key)) return;

  const photos = getPhotosState();
  const photo = photos.find((item) => String(item.id) === String(photoId));

  if (!photo) return;

  photo[key] = value;

  syncPhotosState(photos);
}

function handlePhotoClick(event) {
  const actionEl = event.target.closest("[data-photo-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.photoAction;
  const photoId = actionEl.dataset.photoId;

  if (action === "add") {
    event.preventDefault();
    addPhotoItem();
    return;
  }

  if (action === "remove") {
    event.preventDefault();
    removePhoto(photoId);
  }
}

function handlePhotoChange(event) {
  const input = event.target.closest("[data-photo-input]");
  if (!input) return;

  const photoId = input.dataset.photoId;

  handlePhotoFile(photoId, input);
}

function handlePhotoInput(event) {
  const input = event.target.closest("[data-photo-field]");
  if (!input) return;

  const photoId = input.dataset.photoId;
  const key = input.dataset.photoField;

  setPhotoValue(photoId, key, input.value);
}

function renderPhotoCard(photo, index) {
  const photoId = escapeHtml(photo.id);
  const imageSrc = photo.dataUrl || photo.signedUrl || photo.fileUrl || "";

  return `
    <div class="item-card" data-photo-id="${photoId}">
      <div class="item-card-header">
        <div class="item-card-title">Foto ${index + 1}</div>

        <button
          type="button"
          class="btn-remove"
          data-photo-action="remove"
          data-photo-id="${photoId}"
        >
          Remover
        </button>
      </div>

      <div class="photo-input-area">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          data-photo-input
          data-photo-id="${photoId}"
        />

        ${
          imageSrc
            ? `<img src="${escapeHtml(imageSrc)}" style="width:100%;max-height:260px;object-fit:cover;border-radius:6px;" />`
            : `
              <div class="photo-icon-text">📷</div>
              <div class="photo-caption-small">Toque para fotografar ou escolher</div>
            `
        }
      </div>

      <div class="field" style="margin-top:10px;">
        <label>Tipo</label>
        <select
          data-photo-field="type"
          data-photo-id="${photoId}"
        >
          <option value="before"${photo.type === "before" ? " selected" : ""}>Antes</option>
          <option value="during"${photo.type === "during" ? " selected" : ""}>Durante</option>
          <option value="after"${photo.type === "after" ? " selected" : ""}>Concluído / Depois</option>
          <option value="detail"${photo.type === "detail" ? " selected" : ""}>Detalhe</option>
        </select>
      </div>

      <div class="field">
        <label>Área</label>
        <select
          data-photo-field="area"
          data-photo-id="${photoId}"
        >
          <option value="">— Selecionar —</option>
          ${renderAreaOptions(photo.area)}
        </select>
      </div>

      <div class="field">
        <label>Descrição</label>
        <input
          type="text"
          value="${escapeHtml(photo.desc || "")}"
          placeholder="Ex: Parede Norte concluída"
          data-photo-field="desc"
          data-photo-id="${photoId}"
        />
      </div>

      <div class="field">
        <label>Responsável</label>
        <input
          type="text"
          value="${escapeHtml(photo.worker || "")}"
          placeholder="Ex: João F."
          data-photo-field="worker"
          data-photo-id="${photoId}"
        />
      </div>
    </div>
  `;
}

function renderAreaOptions(selectedArea) {
  const areas = AREAS;

  return areas
    .map((area) => {
      const selected = area === selectedArea ? " selected" : "";
      return `<option value="${escapeHtml(area)}"${selected}>${escapeHtml(area)}</option>`;
    })
    .join("");
}

function getPhotosState() {

  if (!Array.isArray(appState.photos)) {
    appState.photos = [];
  }

  return appState.photos;
}

function syncPhotosState(photos) {
  appState.photos = photos;

}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));

    reader.readAsDataURL(file);
  });
}

function installTemporaryPhotoBridge() {
  // Temporary bridge for old report/review/navigation files.
  window.addPhotoItem = addPhotoItem;
  window.removePhoto = removePhoto;
  window.renderPhotos = renderPhotos;
  window.handlePhoto = handlePhotoFile;
  window.setPhoto = setPhotoValue;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}