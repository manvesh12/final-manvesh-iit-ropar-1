/* ANNEXURE C - MORE ANNEXURES */
function renderAnnexureC() {
  const el = document.getElementById('annexure-c-list');
  if (!el) return;

  if (!S.annexureC.length) {
    S.annexureC.push({
      id: Date.now(),
      name: 'Annexure C - Entry 1',
      summary: 'Upload your Annexure C PDF or image here.',
      fileName: null,
      fileSize: null,
      pages: null
    });
  }

  el.innerHTML = S.annexureC.map((p, i) => {
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
              Replace <input type="file" accept=".pdf,image/*" hidden onchange="handleAnnexureCUpload(event,${p.id})">
            </label>
            <button type="button" class="btn btn-xs btn-danger" onclick="deleteAnnexureCFile(${p.id})">Remove</button>
          </div>
        </div>`;
    } else {
      fileInfoHTML = `
        <div>
          <label class="btn btn-xs btn-outline" style="cursor:pointer;">
            📎 Upload PDF/Image <input type="file" accept=".pdf,image/*" hidden onchange="handleAnnexureCUpload(event,${p.id})">
          </label>
        </div>`;
    }

    return `
    <div class="chapter-item">
      <div class="ch-num" style="background:var(--teal)">C${i + 1}</div>
      <div class="ch-body">
        <input class="ch-name-input" value="${p.name}" oninput="S.annexureC[${i}].name=this.value" placeholder="Entry Name">
        <textarea class="ch-summary" rows="2" oninput="S.annexureC[${i}].summary=this.value" placeholder="Entry Description...">${p.summary}</textarea>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${fileInfoHTML}
        </div>
      </div>
      <div style="display:flex; gap:5px; flex-shrink:0">
        ${i > 0 ? `<button class="btn btn-xs btn-outline" onclick="moveAnnexureC(${i},-1)">↑</button>` : ''}
        ${i < S.annexureC.length - 1 ? `<button class="btn btn-xs btn-outline" onclick="moveAnnexureC(${i},1)">↓</button>` : ''}
        <button class="btn btn-xs btn-danger" onclick="deleteAnnexureCReq(${p.id})">✕</button>
      </div>
    </div>`;
  }).join('');
  if (typeof applyMoreAnnexureAccess === 'function') applyMoreAnnexureAccess(document.getElementById('view-annexure-c'));
}

function addAnnexureC() {
  S.annexureC.push({
    id: Date.now(),
    name: 'NEW ENTRY — ENTER TITLE',
    summary: 'Enter description here...',
    fileName: null,
    fileSize: null,
    pages: null
  });
  renderAnnexureC();
  if (window.debouncedSaveState) window.debouncedSaveState();
}

function deleteAnnexureCReq(id) {
  customConfirm('Remove this annexure entry completely?', () => {
    S.annexureC = S.annexureC.filter(p => p.id !== id);
    renderAnnexureC();
    if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-c');
    if (window.debouncedSaveState) window.debouncedSaveState();
    toast('Entry removed', 'info');
  });
}

function moveAnnexureC(idx, dir) {
  [S.annexureC[idx], S.annexureC[idx + dir]] = [S.annexureC[idx + dir], S.annexureC[idx]];
  renderAnnexureC();
  if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-c');
  if (window.debouncedSaveState) window.debouncedSaveState();
}

function handleAnnexureCUpload(e, id) {
  const f = e.target.files[0];
  if (!f) return;

  const p = S.annexureC.find(x => x.id === id);
  if (!p) return;

  const sizeStr = (f.size / 1024).toFixed(1) + ' KB';

  if (f.type === 'application/pdf') {
    p.fileName = f.name;
    p.fileSize = 'Processing PDF...';
    renderAnnexureC();

    if (typeof renderPdfToImages === 'function') {
      renderPdfToImages(f, (err, imgs) => {
        if (err) {
          console.error(err);
          toast('⚠️ PDF render failed, falling back to basic preview', 'error');
          const url = URL.createObjectURL(f);
          p.pages = [url];
          p.fileSize = sizeStr;
          renderAnnexureC();
          if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-c');
          if (window.debouncedSaveState) window.debouncedSaveState();
          return;
        }
        p.pages = imgs;
        p.fileSize = sizeStr;
        toast(`📄 ${f.name} processed and loaded!`, 'success');
        renderAnnexureC();
        if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-c');
        if (window.debouncedSaveState) window.debouncedSaveState();
      });
    } else {
      const url = URL.createObjectURL(f);
      p.pages = [url];
      p.fileSize = sizeStr;
      renderAnnexureC();
      if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-c');
      if (window.debouncedSaveState) window.debouncedSaveState();
    }
  } else if (f.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function (evt) {
      p.pages = [evt.target.result];
      p.fileName = f.name;
      p.fileSize = sizeStr;
      toast(`🖼️ ${f.name} uploaded successfully!`, 'success');
      renderAnnexureC();
      if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-c');
      if (window.debouncedSaveState) window.debouncedSaveState();
    };
    reader.readAsDataURL(f);
  } else {
    toast('❌ Unsupported file format. Please upload a PDF or an Image.', 'error');
  }
}

function deleteAnnexureCFile(id) {
  const p = S.annexureC.find(x => x.id === id);
  if (p) {
    p.fileName = null;
    p.fileSize = null;
    p.pages = null;
    renderAnnexureC();
    if (window.pdfPreview) window.pdfPreview.notifyUpdate('annexure-c');
    if (window.debouncedSaveState) window.debouncedSaveState();
    toast('File removed', 'success');
  }
}

window.deleteAnnexureCFile = deleteAnnexureCFile;
window.handleAnnexureCUpload = handleAnnexureCUpload;
window.addAnnexureC = addAnnexureC;
window.deleteAnnexureCReq = deleteAnnexureCReq;
window.moveAnnexureC = moveAnnexureC;
