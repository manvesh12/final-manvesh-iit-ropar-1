/* ANNEXURE G - MORE ANNEXURES */
function renderAnnexureG() {
  const el = document.getElementById('annexure-g-list');
  if (!el) return;

  if (!S.annexureG.length) {
    S.annexureG.push({
      id: Date.now(),
      name: 'Annexure G - Entry 1',
      summary: 'Upload your Annexure G PDF or image here.',
      fileName: null,
      fileSize: null,
      pages: null
    });
  }

  el.innerHTML = S.annexureG.map((p, i) => {
    let fileInfoHTML = '';
    if (p.fileName) {
      fileInfoHTML = `
        <div class="file-item" style="margin-top:10px; background:var(--off); border:1px solid var(--border); max-width:480px; display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:var(--r-sm);">
          <div style="display:flex; align-items:center; gap:6px;">
            <div class="file-icon" style="background:var(--teal-lt); color:var(--teal); padding:6px; border-radius:var(--r-xs); font-size:14px;">📄</div>
            <div style="line-height:1.2;">
              <div style="font-size:11.5px; font-weight:600; color:var(--text);">${p.fileName}</div>
              <div style="font-size:9.5px; color:var(--text-faint);">${p.fileSize || ''} · ${p.pages ? p.pages.length : 0} Page(s)</div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <label class="btn btn-xs btn-outline" style="cursor:pointer; margin:0;">
              Replace <input type="file" accept=".pdf,image/*" hidden onchange="handleAnnexureGUpload(event,${p.id})">
            </label>
            <button type="button" class="btn btn-xs btn-danger" onclick="deleteAnnexureGFile(${p.id})">Remove</button>
          </div>
        </div>`;
    } else {
      fileInfoHTML = `
        <div>
          <label class="btn btn-xs btn-outline" style="cursor:pointer;">
            📎 Upload PDF/Image <input type="file" accept=".pdf,image/*" hidden onchange="handleAnnexureGUpload(event,${p.id})">
          </label>
        </div>`;
    }

    return `
    <div class="chapter-item">
      <div class="ch-num" style="background:var(--teal)">G${i + 1}</div>
      <div class="ch-body">
        <input class="ch-name-input" value="${p.name}" oninput="S.annexureG[${i}].name=this.value" placeholder="Entry Name">
        <textarea class="ch-summary" rows="2" oninput="S.annexureG[${i}].summary=this.value" placeholder="Entry Description...">${p.summary}</textarea>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${fileInfoHTML}
        </div>
      </div>
      <div style="display:flex; gap:5px; flex-shrink:0">
        ${i > 0 ? `<button class="btn btn-xs btn-outline" onclick="moveAnnexureG(${i},-1)">↑</button>` : ''}
        ${i < S.annexureG.length - 1 ? `<button class="btn btn-xs btn-outline" onclick="moveAnnexureG(${i},1)">↓</button>` : ''}
        <button class="btn btn-xs btn-danger" onclick="deleteAnnexureGReq(${p.id})">✕</button>
      </div>
    </div>`;
  }).join('');
  if (typeof applyMoreAnnexureAccess === 'function') applyMoreAnnexureAccess(document.getElementById('view-annexure-g'));
}

function addAnnexureG() {
  S.annexureG.push({
    id: Date.now(),
    name: 'NEW ENTRY — ENTER TITLE',
    summary: 'Enter description here...',
    fileName: null,
    fileSize: null,
    pages: null
  });
  renderAnnexureG();
  if (window.debouncedSaveState) window.debouncedSaveState();
}

function deleteAnnexureGReq(id) {
  customConfirm('Remove this annexure entry completely?', () => {
    S.annexureG = S.annexureG.filter(p => p.id !== id);
    renderAnnexureG();
    if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-g');
    if (window.debouncedSaveState) window.debouncedSaveState();
    toast('Entry removed', 'info');
  });
}

function moveAnnexureG(idx, dir) {
  [S.annexureG[idx], S.annexureG[idx + dir]] = [S.annexureG[idx + dir], S.annexureG[idx]];
  renderAnnexureG();
  if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-g');
  if (window.debouncedSaveState) window.debouncedSaveState();
}

function handleAnnexureGUpload(e, id) {
  const f = e.target.files[0];
  if (!f) return;

  const p = S.annexureG.find(x => x.id === id);
  if (!p) return;

  const sizeStr = (f.size / 1024).toFixed(1) + ' KB';

  if (f.type === 'application/pdf') {
    p.fileName = f.name;
    p.fileSize = 'Processing PDF...';
    renderAnnexureG();

    if (typeof renderPdfToImages === 'function') {
      renderPdfToImages(f, (err, imgs) => {
        if (err) {
          console.error(err);
          toast('⚠️ PDF render failed, falling back to basic preview', 'error');
          const url = URL.createObjectURL(f);
          p.pages = [url];
          p.fileSize = sizeStr;
          renderAnnexureG();
          if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-g');
          if (window.debouncedSaveState) window.debouncedSaveState();
          return;
        }
        p.pages = imgs;
        p.fileSize = sizeStr;
        toast(`📄 ${f.name} processed and loaded!`, 'success');
        renderAnnexureG();
        if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-g');
        if (window.debouncedSaveState) window.debouncedSaveState();
      });
    } else {
      const url = URL.createObjectURL(f);
      p.pages = [url];
      p.fileSize = sizeStr;
      renderAnnexureG();
      if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-g');
      if (window.debouncedSaveState) window.debouncedSaveState();
    }
  } else if (f.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function (evt) {
      p.pages = [evt.target.result];
      p.fileName = f.name;
      p.fileSize = sizeStr;
      toast(`🖼️ ${f.name} uploaded successfully!`, 'success');
      renderAnnexureG();
      if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-g');
      if (window.debouncedSaveState) window.debouncedSaveState();
    };
    reader.readAsDataURL(f);
  } else {
    toast('❌ Unsupported file format. Please upload a PDF or an Image.', 'error');
  }
}

function deleteAnnexureGFile(id) {
  const p = S.annexureG.find(x => x.id === id);
  if (p) {
    p.fileName = null;
    p.fileSize = null;
    p.pages = null;
    renderAnnexureG();
    if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-g');
    if (window.debouncedSaveState) window.debouncedSaveState();
    toast('File removed', 'success');
  }
}

window.deleteAnnexureGFile = deleteAnnexureGFile;
window.handleAnnexureGUpload = handleAnnexureGUpload;
window.addAnnexureG = addAnnexureG;
window.deleteAnnexureGReq = deleteAnnexureGReq;
window.moveAnnexureG = moveAnnexureG;
