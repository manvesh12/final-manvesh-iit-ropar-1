/* Chapters management */

function renderChapters() {
  const el = document.getElementById('chapter-list');
  if (!el) return;

  el.innerHTML = S.chapters.map((ch, i) => {
    const pageCount = S.chapterPDFs && S.chapterPDFs[ch.id] ? S.chapterPDFs[ch.id].length : 0;
    const fileInfoHTML = ch.fileName ? `
      <div class="file-item" style="margin-top:10px; background:var(--off); border:1px solid var(--border); max-width:480px; display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:var(--r-sm);">
        <div style="display:flex; align-items:center; gap:6px;">
          <div class="file-icon" style="background:var(--teal-lt); color:var(--teal); padding:6px; border-radius:var(--r-xs); font-size:14px;">PDF</div>
          <div style="line-height:1.2;">
            <div style="font-size:11.5px; font-weight:600; color:var(--text);">${ch.fileName}</div>
            <div style="font-size:9.5px; color:var(--text-faint);">${ch.fileSize || ''} - ${pageCount} Page(s)</div>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <label class="btn btn-xs btn-outline" style="cursor:pointer; margin:0;">
            Replace <input type="file" accept=".pdf" hidden onchange="handleChapterUpload(event,${ch.id})">
          </label>
          <button type="button" class="btn btn-xs btn-danger" onclick="deleteChapterFile(${ch.id})">Remove</button>
        </div>
      </div>` : `
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <label class="btn btn-xs btn-outline" style="cursor:pointer">Upload Chapter PDF <input type="file" accept=".pdf" hidden onchange="handleChapterUpload(event,${ch.id})"></label>
      </div>`;

    return `
      <div class="chapter-item">
        <div class="ch-num">${i + 1}</div>
        <div class="ch-body">
          <input class="ch-name-input" value="${ch.name || ''}" oninput="S.chapters[${i}].name=this.value">
          <textarea class="ch-summary" rows="2" oninput="S.chapters[${i}].summary=this.value">${ch.summary || ''}</textarea>
          ${fileInfoHTML}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          ${i > 0 ? `<button class="btn btn-xs btn-outline" onclick="moveChapter(${i},-1)">Up</button>` : ''}
          ${i < S.chapters.length - 1 ? `<button class="btn btn-xs btn-outline" onclick="moveChapter(${i},1)">Down</button>` : ''}
          <button class="btn btn-xs btn-danger" onclick="deleteChapter(${ch.id})">Delete</button>
        </div>
      </div>`;
  }).join('');

  if (typeof applyChapterAccess === 'function') applyChapterAccess(el);
  if (window.initLucide) window.initLucide();
}

function addChapter() {
  if (typeof canEditView === 'function' && !canEditView('chapters')) {
    toast('You do not have access to add chapters.', 'error');
    return;
  }
  S.chapters.push({ id: Date.now(), name: 'NEW CHAPTER - ENTER TITLE', summary: 'Enter chapter summary here...', fileName: null, fileSize: null });
  renderChapters();
  if (window.debouncedSaveState) window.debouncedSaveState();
}

function deleteChapter(id) {
  const idx = S.chapters.findIndex(c => c.id === id);
  if (typeof canEditChapter === 'function' && !canEditChapter(idx + 1)) {
    toast('This chapter is locked for your role.', 'error');
    return;
  }
  customConfirm('Remove this chapter completely?', () => {
    S.chapters = S.chapters.filter(c => c.id !== id);
    if (S.chapterPDFs) delete S.chapterPDFs[id];
    renderChapters();
    if (window.pdfPreview) window.pdfPreview.notifyUpdate('chapters');
    if (window.debouncedSaveState) window.debouncedSaveState();
    toast('Chapter removed', 'info');
  });
}

function moveChapter(idx, dir) {
  if (typeof canEditChapter === 'function' && (!canEditChapter(idx + 1) || !canEditChapter(idx + dir + 1))) {
    toast('Chapter movement is locked for your role.', 'error');
    return;
  }
  [S.chapters[idx], S.chapters[idx + dir]] = [S.chapters[idx + dir], S.chapters[idx]];
  renderChapters();
  if (window.pdfPreview) window.pdfPreview.notifyUpdate('chapters');
  if (window.debouncedSaveState) window.debouncedSaveState();
}

function handleChapterUpload(e, id) {
  const f = e.target.files[0];
  if (!f) return;

  const ch = S.chapters.find(x => x.id === id);
  const idx = S.chapters.findIndex(x => x.id === id);
  if (!ch) return;
  if (typeof canEditChapter === 'function' && !canEditChapter(idx + 1)) {
    toast('This chapter is locked for your role.', 'error');
    e.target.value = '';
    return;
  }

  const sizeStr = (f.size / 1024).toFixed(1) + ' KB';
  if (f.type !== 'application/pdf') {
    toast('Please upload a PDF file.', 'error');
    return;
  }

  ch.fileName = f.name;
  ch.fileSize = 'Processing PDF...';
  renderChapters();

  if (typeof renderPdfToImages !== 'function') {
    toast('PDF engine not loaded yet', 'error');
    ch.fileSize = 'Error (Engine not loaded)';
    renderChapters();
    return;
  }

  renderPdfToImages(f, (err, imgs) => {
    if (err) {
      console.error(err);
      toast('PDF render failed', 'error');
      ch.fileSize = 'Error';
      renderChapters();
      return;
    }
    if (!S.chapterPDFs) S.chapterPDFs = {};
    S.chapterPDFs[id] = imgs;
    ch.fileSize = sizeStr;
    renderChapters();
    if (window.pdfPreview) window.pdfPreview.notifyUpdate('chapters');
    toast(`${f.name} uploaded for chapter`, 'success');
    if (window.debouncedSaveState) window.debouncedSaveState();
  });
}

function deleteChapterFile(id) {
  const ch = S.chapters.find(x => x.id === id);
  const idx = S.chapters.findIndex(x => x.id === id);
  if (typeof canEditChapter === 'function' && !canEditChapter(idx + 1)) {
    toast('This chapter is locked for your role.', 'error');
    return;
  }
  if (!ch) return;
  ch.fileName = null;
  ch.fileSize = null;
  if (S.chapterPDFs) delete S.chapterPDFs[id];
  renderChapters();
  if (window.pdfPreview) window.pdfPreview.notifyUpdate('chapters');
  if (window.debouncedSaveState) window.debouncedSaveState();
  toast('Chapter PDF removed', 'success');
}

window.deleteChapterFile = deleteChapterFile;
window.handleChapterUpload = handleChapterUpload;
window.addChapter = addChapter;
window.deleteChapter = deleteChapter;
window.moveChapter = moveChapter;
