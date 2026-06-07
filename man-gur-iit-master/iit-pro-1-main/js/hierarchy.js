/* ══════════════════════════════════════
   ROLE HIERARCHY & PERMISSIONS RULES
   ══════════════════════════════════════ */

/**
 * Returns true if the current user is read-only (i.e. cannot edit tables, annexures, or upload files).
 * Only Officer ('user') and Admin ('admin') have write/edit access.
 */
function isUserReadOnly() {
  if (typeof S === 'undefined' || !S || !S.role) return true;
  return S.role !== 'user' && S.role !== 'admin';
}

/**
 * Returns true if the current user has write access (Officer or Admin).
 */
function hasWriteAccess() {
  if (typeof S === 'undefined' || !S || !S.role) return false;
  return S.role === 'user' || S.role === 'admin';
}

function applyMoreAnnexureAccess(root) {
  const container = root || document.querySelector('.view.active');
  if (!container || !container.id || !container.id.startsWith('view-annexure-')) return;

  const canWrite = hasWriteAccess();
  const tableScope = container.querySelectorAll('.annexure-f-table, .annexure-k-table');
  tableScope.forEach(table => {
    table.querySelectorAll('[contenteditable], td').forEach(cell => {
      if (cell.querySelector('button, select, input, textarea')) return;
      cell.setAttribute('contenteditable', canWrite ? 'true' : 'false');
      cell.style.backgroundColor = canWrite ? '' : 'var(--off)';
      cell.style.cursor = canWrite ? '' : 'not-allowed';
    });

    table.querySelectorAll('select, input, textarea').forEach(el => {
      el.disabled = !canWrite;
      el.style.cursor = canWrite ? '' : 'not-allowed';
    });
  });

  container.querySelectorAll('button, label.btn').forEach(el => {
    const txt = (el.textContent || '').toLowerCase();
    const attr = (el.getAttribute('onclick') || '') + ' ' + (el.querySelector('input')?.getAttribute('onchange') || '');
    const isEditControl = /add|upload|delete|remove|replace|move/.test(txt) ||
      /add|upload|delete|remove|handle|move/i.test(attr);
    if (isEditControl) el.style.display = canWrite ? '' : 'none';
  });
}

/**
 * Returns true if the current user has review access (Reviewer only).
 */
function hasReviewAccess() {
  if (typeof S === 'undefined' || !S || !S.role) return false;
  return S.role === 'reviewer' || S.role === 'admin';
}

/**
 * Returns true if the current user has administrator panel access (Admin only).
 */
function hasAdminAccess() {
  if (typeof S === 'undefined' || !S || !S.role) return false;
  return S.role === 'admin';
}

/**
 * Automatically visitor-enforces role hierarchy rules on form elements,
 * content editable fields, and action buttons in the currently active view.
 */
function enforceActiveViewHierarchy() {
  // Find the currently active view
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;
  
  const viewId = activeView.id.replace('view-', '');
  
  // Decide readOnly status for the elements inside this specific view:
  // - Officer ('user') and Admin ('admin') can edit all views.
  // - Reviewer ('reviewer') and Authority ('authority') are read-only everywhere (except reviewer comments/decisions).
  let viewReadOnly = true;
  if (S.role === 'user' || S.role === 'admin') {
    viewReadOnly = false;
  } else if (S.role === 'sdlc') {
    if (viewId === 'sdlc-portal') {
      viewReadOnly = false;
    }
  }

  // 1. Inputs, Textareas, Selects
  const formElements = activeView.querySelectorAll('input, textarea, select');
  formElements.forEach(el => {
    // Exclude reviewer comments modal and district filters
    if (el.closest('#modal-review') || el.id === 'dash-district-filter') return;
    
    el.disabled = viewReadOnly;
    if (viewReadOnly) {
      el.style.backgroundColor = 'var(--off)';
      el.style.cursor = 'not-allowed';
    } else {
      el.style.backgroundColor = '';
      el.style.cursor = '';
    }
  });

  // 2. Content Editable Elements
  const editables = activeView.querySelectorAll('[contenteditable], [contenteditable="true"]');
  editables.forEach(el => {
    if (viewReadOnly) {
      el.setAttribute('contenteditable', 'false');
      el.style.backgroundColor = 'var(--off)';
      el.style.cursor = 'not-allowed';
    } else {
      el.setAttribute('contenteditable', 'true');
      el.style.backgroundColor = '';
      el.style.cursor = '';
    }
  });

  // 3. Action Buttons (Add, Save, Delete, Upload, etc.)
  const buttons = activeView.querySelectorAll('button');
  buttons.forEach(btn => {
    // Do not hide navigation buttons, close buttons, or reviewer decision panel buttons
    if (btn.closest('#reviewer-actions') || btn.closest('.top-nav') || btn.classList.contains('modal-close') || btn.closest('.header-row')) return;
    
    // Also, do not hide project-level actions or user management buttons if the user is Admin
    const onclickAttr = btn.getAttribute('onclick') || '';
    const isProjectAction = onclickAttr.includes('deleteProject') || onclickAttr.includes('newProjectModal');
    if (S.role === 'admin' && (isProjectAction || viewId === 'users')) {
      btn.style.display = '';
      return;
    }

    // Do not hide any buttons inside sdlc-portal for sdlc user
    if (S.role === 'sdlc' && viewId === 'sdlc-portal') {
      btn.style.display = '';
      return;
    }
    
    const txt = btn.textContent.toLowerCase();
    if (txt.includes('add') || txt.includes('upload') || txt.includes('save') || 
        txt.includes('delete') || txt.includes('remove') || txt.includes('submit') || 
        txt.includes('edit') || txt.includes('clear')) {
      btn.style.display = viewReadOnly ? 'none' : '';
    }
  });

  // 4. Floating Reviewer Action Bar display
  const reviewerActions = document.getElementById('reviewer-actions');
  if (reviewerActions) {
    const showReview = hasReviewAccess() && S.activeProject;
    reviewerActions.style.display = showReview ? 'flex' : 'none';
  }

  // 5. Dynamic visibility toggle for "+ New Project" button / controls
  const adminAccess = hasAdminAccess();
  const topbarNewProjBtn = document.getElementById('tb-btn-new-project');
  if (topbarNewProjBtn) {
    topbarNewProjBtn.style.display = adminAccess ? 'inline-flex' : 'none';
  }
  const viewNewProjBtn = document.getElementById('view-btn-new-project');
  if (viewNewProjBtn) {
    viewNewProjBtn.style.display = adminAccess ? 'inline-flex' : 'none';
  }
  const inlineNewProjBtns = activeView.querySelectorAll('button[onclick*="newProjectModal"]');
  inlineNewProjBtns.forEach(btn => {
    btn.style.display = adminAccess ? '' : 'none';
  });

  applyMoreAnnexureAccess(activeView);
}
