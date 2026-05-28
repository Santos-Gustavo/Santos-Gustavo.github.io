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

window.addPhotoItem = addPhotoItem;
window.removePhoto = removePhoto;
window.handlePhoto = handlePhoto;
window.setPhoto = setPhoto;

