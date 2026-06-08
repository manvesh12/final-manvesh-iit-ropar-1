/* ══════════════════════════════════════
   NAVIGATION & UTILS
 ══════════════════════════════════════ */
let viewHistory = [];
let currentViewId = 'dashboard';
let isSidebarPinned = false;
let sidebarTimer;

function toggleSidebar() {
  isSidebarPinned = !isSidebarPinned;
  if (isSidebarPinned) {
    document.body.classList.remove('sidebar-hidden');
  } else {
    document.body.classList.add('sidebar-hidden');
  }
  if (window.initLucide) initLucide();
}

function expandSidebar() {
  if (isSidebarPinned) return;
  clearTimeout(sidebarTimer);
  document.body.classList.remove('sidebar-hidden');
}

function collapseSidebar() {
  if (isSidebarPinned) return;
  sidebarTimer = setTimeout(() => {
    document.body.classList.add('sidebar-hidden');
  }, 200);
}

// Initialize history state on load and preserve any valid view hash
const initialHash = window.location.hash ? window.location.hash.slice(1).trim() : null;
const initialView = initialHash && document.getElementById('view-' + initialHash) ? initialHash : currentViewId;
if (history.state === null) {
  currentViewId = initialView;
  history.replaceState({ viewId: currentViewId }, '', '#' + currentViewId);
}

window.addEventListener('popstate', (event) => {
  if (event.state && event.state.viewId) {
    const idx = viewHistory.indexOf(event.state.viewId);
    if (idx !== -1) {
      viewHistory = viewHistory.slice(0, idx);
    }
    showView(event.state.viewId, null, false);
  } else {
    viewHistory = [];
    showView('dashboard', null, false);
  }
});

async function initApp() {
  if (typeof currentDistrictFilter !== 'undefined' && !S.activeProject) currentDistrictFilter = 'ALL';
  try {
    if (typeof refreshProjectsFromBackend === 'function') {
      await refreshProjectsFromBackend(false);
    } else {
      const data = await apiFetch('/projects');
      S.projects = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
      S.projectLoadError = '';
    }
  } catch (err) {
    console.error('Failed to load projects from backend:', err);
    S.projectLoadError = err.message || 'Failed to load projects from backend';
    if (typeof toast === 'function') toast('Projects could not load: ' + S.projectLoadError, 'error');
  }

  // Fetch reports for Notifications and Workflow
  try {
    const reports = await apiFetch('/reports');
    if (reports && Array.isArray(reports)) {
      S.projects.forEach(p => {
        const rep = reports.find(r => r.projectId === p.id);
        if (rep) p.reportStatus = rep.status;
      });

      if (S.role === 'user') { // DEO / OFFICER
        if (typeof syncNotificationsAndReviewStatus === 'function') {
          syncNotificationsAndReviewStatus();
        } else {
          const returned = reports.filter(r => r.status === 'RETURNED' || r.status === 'REJECTED');
          updateNotificationUI(returned);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load reports for notifications', err);
  }

  renderDashboard();
  renderProjects();
  if (typeof updateRolePermissionUI === 'function') updateRolePermissionUI();
  const projectBadge = document.getElementById('badge-projs');
  if (projectBadge) projectBadge.textContent = S.projects.length;
  const pendingSigsBadge = document.getElementById('sb-pending-sigs');
  if (pendingSigsBadge) pendingSigsBadge.textContent = S.signatures.filter(s => !s.signed).length;
}

window.scrollToSection = function (viewId, sectionId, parentBtn) {
  showView(viewId, parentBtn);
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) {
      const card = el.closest('.card') || el;
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const oldBg = card.style.backgroundColor;
      card.style.transition = 'background-color 0.5s ease';
      card.style.backgroundColor = 'var(--yellow-lt)';
      setTimeout(() => {
        card.style.backgroundColor = oldBg;
      }, 1500);
    }
  }, 150);
};

window.toggleSubMenu = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isVisible = el.style.display === 'block';

  // Close all flyouts
  document.querySelectorAll('.flyout-menu').forEach(m => m.style.display = 'none');

  // Toggle the clicked one
  if (!isVisible) {
    el.style.display = 'block';
  }
};

window.toggleMoreAnnexuresInline = function () {
  const el = document.getElementById('inline-more-annexures');
  if (!el) return;
  const isVisible = el.style.display === 'flex';
  el.style.display = isVisible ? 'none' : 'flex';
};

function isAnnexureViewId(id) {
  return /^anx[1-7]$/.test(id) || /^annexure-[b-k]$/.test(id);
}

function isCoreAnnexureViewId(id) {
  return /^anx[1-7]$/.test(id);
}

function getAnnexureInstructionText(id) {
  const map = {
    anx1: 'Fill the source tables, upload section Excel files where needed, and use the live preview to check Annexure I before download.',
    anx2: 'Maintain lease, patta land, de-siltation, and M-Sand tables. Totals and generated PDF preview update from the table data.',
    anx3: 'Review cluster and continuation details, keep rows complete, and verify the generated Annexure III in the right preview.',
    anx4: 'Maintain individual lease routes first, then cluster transportation routes. Check the right-side preview before downloading.',
    anx5: 'Maintain Bench Mark and CORS point data. Upload Excel where useful and verify the generated Annexure V preview.',
    anx6: 'Maintain final cluster details and supporting values, then confirm the generated Annexure VI preview before download.',
    anx7: 'Maintain individual route tables first, then cluster route tables. Use the right-side preview to verify Annexure VII.',
    'annexure-f': 'Download Excel templates for each section, fill tables, then upload supporting PDF/image if needed. Verify the generated Annexure F preview.',
    'annexure-k': 'Upload supporting PDF/image if required, then maintain Proforma Auctioned Sites and Annexure A tables. Verify the final merged preview.'
  };
  return map[id] || `Upload and manage ${id.replace('annexure-', 'Annexure ').toUpperCase()} entries. Use the right-side preview to check the final output.`;
}

function buildAnnexureInstructions(id) {
  const wrap = document.createElement('div');
  wrap.className = 'annexure-line-instructions';
  wrap.innerHTML = `
    <div class="card annexure-instructions-card">
      <div class="card-hd">
        <div class="card-title">Instructions</div>
      </div>
      <div class="card-bd">
        <p>${getAnnexureInstructionText(id)}</p>
      </div>
    </div>`;
  return wrap;
}

function normalizeAnnexureViewLayout(id) {
  if (!isAnnexureViewId(id)) return;
  const view = document.getElementById('view-' + id);
  if (!view) return;
  const shouldHideInstructions = isCoreAnnexureViewId(id);

  const existingLayout = view.querySelector(':scope > .annexure-unified-layout, :scope > .annexure-line-layout, :scope > .g2');
  if (existingLayout) {
    existingLayout.classList.add('annexure-unified-layout', 'annexure-line-layout');
    const cols = Array.from(existingLayout.children);
    if (cols[0]) cols[0].classList.add('annexure-line-main');
    let instructions = existingLayout.querySelector(':scope > .annexure-line-instructions');
    if (!instructions && cols[1]) {
      cols[1].classList.add('annexure-line-instructions');
      instructions = cols[1];
    }
    if (shouldHideInstructions) {
      if (instructions) instructions.remove();
      existingLayout.classList.add('annexure-no-instructions');
      existingLayout.style.gridTemplateColumns = 'minmax(0, 1fr)';
    } else if (!instructions) {
      existingLayout.appendChild(buildAnnexureInstructions(id));
    }
    return;
  }

  const header = view.querySelector(':scope > .header-row');
  const layout = document.createElement('div');
  layout.className = 'g2 annexure-unified-layout annexure-line-layout';
  const main = document.createElement('div');
  main.className = 'annexure-line-main';

  Array.from(view.children).forEach(child => {
    if (child === header) return;
    main.appendChild(child);
  });

  layout.appendChild(main);
  if (shouldHideInstructions) {
    layout.classList.add('annexure-no-instructions');
    layout.style.gridTemplateColumns = 'minmax(0, 1fr)';
  } else {
    layout.appendChild(buildAnnexureInstructions(id));
  }
  if (header && header.nextSibling) {
    view.insertBefore(layout, header.nextSibling);
  } else {
    view.appendChild(layout);
  }
}

function refreshCoreAnnexurePreview(id) {
  if (window.pdfPreview && typeof window.pdfPreview.generateAnnexureLivePreview === 'function') {
    window.pdfPreview.generateAnnexureLivePreview(id, 80);
    return;
  }

  const fn = {
    anx1: window.exportAnx1PDF,
    anx2: window.exportAnx2PDF,
    anx3: window.exportAnx3PDF,
    anx4: window.exportAnx4PDF,
    anx5: window.exportAnx5PDF,
    anx6: window.exportAnx6PDF,
    anx7: window.exportAnx7PDF
  }[id];
  if (typeof fn !== 'function') return;

  const run = () => fn(null, true);
  if (typeof ensurePortalVendors === 'function') {
    ensurePortalVendors(['jspdf', 'autotable']).then(run).catch(err => {
      console.error('Live preview tools failed:', err);
      if (typeof toast === 'function') toast('Live preview tools could not load.', 'error');
    });
  } else {
    setTimeout(run, 80);
  }
}

function addGenericAnnexureRow(table, viewId) {
  const tbody = table ? table.querySelector('tbody') : null;
  if (!tbody) return;
  const templateRow = tbody.rows[tbody.rows.length - 1];
  const columnCount = table.querySelectorAll('thead th').length || templateRow?.cells.length || 1;
  const tr = document.createElement('tr');

  for (let i = 0; i < columnCount; i++) {
    const sourceCell = templateRow ? templateRow.cells[i] : null;
    const td = document.createElement('td');
    if (sourceCell && sourceCell.querySelector('button')) {
      td.innerHTML = sourceCell.innerHTML;
    } else if (sourceCell && sourceCell.querySelector('select')) {
      td.innerHTML = sourceCell.innerHTML;
      td.querySelectorAll('select').forEach(select => { select.selectedIndex = 0; });
    } else {
      td.contentEditable = 'true';
      td.textContent = i === 0 && /sl\.?no|sr\.?no|serial/i.test(table.querySelectorAll('thead th')[0]?.innerText || '') ? String(tbody.rows.length + 1) : 'NA';
    }
    tr.appendChild(td);
  }

  tbody.appendChild(tr);
  if (window.initLucide) window.initLucide();
  refreshCoreAnnexurePreview(viewId);
}

function addGenericAnnexureColumn(table, viewId) {
  if (!table) return;
  const headerRow = table.querySelector('thead tr');
  const actionHeader = headerRow ? Array.from(headerRow.children).find(th => th.classList.contains('no-print') || /action/i.test(th.innerText || '')) : null;
  const th = document.createElement('th');
  th.contentEditable = 'true';
  th.textContent = 'New Column';
  th.style.minWidth = '120px';
  if (headerRow) headerRow.insertBefore(th, actionHeader || null);

  table.querySelectorAll('tbody tr').forEach(row => {
    const actionCell = Array.from(row.children).find(td => td.querySelector('button') || td.classList.contains('no-print'));
    const td = document.createElement('td');
    td.contentEditable = 'true';
    td.textContent = 'NA';
    row.insertBefore(td, actionCell || null);
  });

  refreshCoreAnnexurePreview(viewId);
}

function addCoreAnnexureTableControls(id) {
  if (!isCoreAnnexureViewId(id)) return;
  const view = document.getElementById('view-' + id);
  if (!view) return;
  view.querySelectorAll('table').forEach(table => {
    if (table.dataset.liveControlsAttached === 'true') return;
    table.dataset.liveControlsAttached = 'true';
    const wrap = table.closest('.tbl-wrap') || table.parentElement;
    if (!wrap || wrap.nextElementSibling?.classList.contains('anx-table-live-actions')) return;

    const actions = document.createElement('div');
    actions.className = 'anx-table-live-actions';
    actions.innerHTML = `
      <button type="button" class="btn btn-xs btn-outline anx-live-add-row">
        <i data-lucide="plus" style="width:12px;height:12px;"></i>
        <span>Add Row</span>
      </button>
      <button type="button" class="btn btn-xs btn-outline anx-live-add-column">
        <i data-lucide="columns-3" style="width:12px;height:12px;"></i>
        <span>Add Column</span>
      </button>`;
    wrap.insertAdjacentElement('afterend', actions);

    actions.querySelector('.anx-live-add-row')?.addEventListener('click', () => {
      const block = table.closest('.card, .anx-section') || view;
      const existingAddRow = Array.from(block.querySelectorAll('button')).find(btn => {
        const text = (btn.innerText || '').trim().toLowerCase();
        const onclick = btn.getAttribute('onclick') || '';
        return btn !== actions.querySelector('.anx-live-add-row') && text.includes('add row') && !onclick.includes('addGenericAnnexureRow');
      });
      if (existingAddRow) existingAddRow.click();
      else addGenericAnnexureRow(table, id);
      refreshCoreAnnexurePreview(id);
    });

    actions.querySelector('.anx-live-add-column')?.addEventListener('click', () => addGenericAnnexureColumn(table, id));
  });
  if (window.initLucide) window.initLucide();
}

function repairMainContentStructure() {
  const workspace = document.querySelector('.app-workspace');
  const mainContent = document.querySelector('.main-content');
  const pageBody = mainContent ? mainContent.querySelector('.page-body') : null;
  if (!workspace || !mainContent || !pageBody) return;

  workspace.querySelectorAll(':scope > .view, :scope > div[id^="view-"]').forEach(view => {
    pageBody.appendChild(view);
  });

  workspace.scrollLeft = 0;
  mainContent.scrollLeft = 0;
}

function showView(id, btn, push = true) {
  repairMainContentStructure();
  if (typeof hasModuleAccess === 'function' && typeof S !== 'undefined' && S.user && !hasModuleAccess(id)) {
    if (typeof showUnauthorizedAccessError === 'function') showUnauthorizedAccessError();
    else if (typeof toast === 'function') toast('You are not authorized to access this section.', 'error');
    else alert('You are not authorized to access this section.');
    if (window.location.hash !== '#' + currentViewId) {
      history.replaceState({ viewId: currentViewId }, '', '#' + currentViewId);
    }
    return;
  }
  if (typeof ensurePortalAssetsForView === 'function' && !ensurePortalAssetsForView(id, () => showView(id, btn, push))) {
    return;
  }
  // Hide flyout menus whenever a main view changes
  document.querySelectorAll('.flyout-menu').forEach(m => m.style.display = 'none');

  if (push && currentViewId && currentViewId !== id) {
    viewHistory.push(currentViewId);
    history.pushState({ viewId: id }, '', '#' + id);
  }
  currentViewId = id;

  if (id === 'dashboard') {
    document.body.classList.add('view-dashboard-active');
  } else {
    document.body.classList.remove('view-dashboard-active');
  }
  document.body.classList.toggle('view-projects-active', id === 'projects');

  // Toggle display of back button based on history
  const backBtn = document.getElementById('tb-back-btn');
  if (backBtn) {
    backBtn.style.display = viewHistory.length > 0 ? 'flex' : 'none';
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tb-sub-nav-btn').forEach(b => b.classList.remove('active'));

  const el = document.getElementById('view-' + id);
  if (el) {
    el.classList.add('active');
    // Auto-scroll to the newly active view
    setTimeout(() => {
      const mainContent = document.querySelector('.main-content');
      if (id === 'dashboard') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        if (mainContent) {
          mainContent.scrollTop = 0;
          mainContent.scrollLeft = 0;
        }
      } else {
        el.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
        if (mainContent) mainContent.scrollLeft = 0;
      }
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    }, 50);
  }

  // Auto-expand the More Annexures inline section if viewing a sub-annexure
  if (id.startsWith('annexure-')) {
    const inlineMenu = document.getElementById('inline-more-annexures');
    if (inlineMenu) inlineMenu.style.display = 'flex';
  }

  // Highlight active sidebar item
  if (btn) {
    btn.classList.add('active');
  } else {
    // Attempt to locate and highlight matching button in sidebar
    const targetBtn = Array.from(document.querySelectorAll('.sb-item')).find(b => {
      const onclickAttr = b.getAttribute('onclick');
      return onclickAttr && onclickAttr.includes(`'${id}'`);
    });
    if (targetBtn) targetBtn.classList.add('active');
  }

  const topbarBtn = Array.from(document.querySelectorAll('.tb-sub-nav-btn')).find(b => {
    const onclickAttr = b.getAttribute('onclick') || '';
    if (id === 'dashboard') return onclickAttr.includes("'dashboard'");
    if (id === 'projects') return onclickAttr.includes("'projects'");
    if (id === 'workflow') return onclickAttr.includes("'workflow'");
    return false;
  });
  if (topbarBtn) topbarBtn.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard', 'projects': 'My DSR Projects', 'workflow': 'Report Workflow',
    'front-matter': 'Front Matter', 'chapters': 'Chapters (10)', 'plates': 'Plate Section',
    'graphs': 'Cross Section Graph Generator', 'anx1': 'Annexure I — Sand Sources',
    'anx2': 'Annexure II — Mining Leases', 'anx3': 'Annexure III — Cluster Details',
    'anx4': 'Annexure IV — Transportation Routes', 'anx5': 'Annexure V — Bench Mark & CORS',
    'anx6': 'Annexure VI — Final Cluster Details', 'anx7': 'Annexure VII — Transportation Routes',
    'annexure-b': 'Annexure B', 'annexure-c': 'Annexure C', 'annexure-d': 'Annexure D',
    'annexure-e': 'Annexure E', 'annexure-f': 'Annexure F', 'annexure-g': 'Annexure G',
    'annexure-h': 'Annexure H', 'annexure-i': 'Annexure I', 'annexure-j': 'Annexure J',
    'annexure-k': 'Annexure K', 'demand-table': 'Projected Demand Table',
    'auction-table': 'Auctioned Sites', 'summary-table': 'Source Summary Table', 'benchmark-table': 'Bench Mark & CORS',
    'esign': 'E-Signature Panel', 'generate': 'Generate Final PDF', 'history': 'Report History', 'users': 'User Management'
  };

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[id] || id;

  if (id === 'esign') renderSignatures();
  if (id === 'generate') renderFinalChecklist();
  if (id === 'chapters') renderChapters();
  if (id === 'plates') renderPlates();
  if (id === 'graphs') renderGraphs();
  if (id === 'demand-table') initDemandTable();
  if (id === 'summary-table') initSummaryTable();
  if (id === 'auction-table') initAuctionTable();
  if (id === 'workflow') updateWorkflowDistrictUI();
  if (id === 'projects' && typeof refreshProjectsFromBackend === 'function') {
    refreshProjectsFromBackend(true).catch(err => console.error('Project refresh failed', err));
  }
  if (id === 'users' && typeof renderUsers === 'function') renderUsers();
  if (id === 'benchmark-table' && typeof mountBenchmarkPanel === 'function') mountBenchmarkPanel('benchmark-table-content');
  if (id === 'anx1' && typeof renderPdfUploadUIAnx1 === 'function') renderPdfUploadUIAnx1();
  if (id === 'anx2' && typeof renderPdfUploadUIAnx2 === 'function') renderPdfUploadUIAnx2();
  if (id === 'anx3' && typeof renderPdfUploadUI === 'function') {
    renderPdfUploadUI();
    if (typeof renderCluster === 'function') renderCluster();
    if (typeof renderCont === 'function') renderCont();
  }
  if (id === 'anx4' && typeof renderPdfUploadUIAnx4 === 'function') {
    renderPdfUploadUIAnx4();
    if (typeof initRoutesTable === 'function') initRoutesTable();
    if (typeof initClustersTable === 'function') initClustersTable();
  }
  if (id === 'anx5' && typeof renderPdfUploadUIAnx5 === 'function') renderPdfUploadUIAnx5();
  if (id === 'anx6' && typeof renderPdfUploadUIAnx6 === 'function') renderPdfUploadUIAnx6();
  if (id === 'anx7' && typeof renderPdfUploadUIAnx7 === 'function') renderPdfUploadUIAnx7();
  if (id === 'annexure-b' && typeof renderAnnexureB === 'function') renderAnnexureB();
  if (id === 'annexure-c' && typeof renderAnnexureC === 'function') renderAnnexureC();
  if (id === 'annexure-d' && typeof renderAnnexureD === 'function') renderAnnexureD();
  if (id === 'annexure-e' && typeof renderAnnexureE === 'function') renderAnnexureE();
  if (id === 'annexure-f' && typeof renderAnnexureF === 'function') renderAnnexureF();
  if (id === 'annexure-g' && typeof renderAnnexureG === 'function') renderAnnexureG();
  if (id === 'annexure-h' && typeof renderAnnexureH === 'function') renderAnnexureH();
  if (id === 'annexure-i' && typeof renderAnnexureI === 'function') renderAnnexureI();
  if (id === 'annexure-j' && typeof renderAnnexureJ === 'function') renderAnnexureJ();
  if (id === 'annexure-k' && typeof renderAnnexureK === 'function') renderAnnexureK();
  if (id === 'history' && typeof renderHistoryTable === 'function') renderHistoryTable();
  if (id === 'dashboard') {
    if (typeof syncNotificationsAndReviewStatus === 'function') {
      syncNotificationsAndReviewStatus();
    } else if (S.activeProject && typeof checkReviewStatus === 'function') {
      checkReviewStatus(S.activeProject.id);
    }
  }
  if (S.activeProject && typeof updateActiveProjectCardUI === 'function') updateActiveProjectCardUI();
  normalizeAnnexureViewLayout(id);
  addCoreAnnexureTableControls(id);

  const previewSections = ['front-matter', 'chapters', 'plates', 'anx1', 'anx2', 'anx3', 'anx4', 'anx5', 'anx6', 'anx7', 'annexure-b', 'annexure-c', 'annexure-d', 'annexure-e', 'annexure-f', 'annexure-g', 'annexure-h', 'annexure-i', 'annexure-j', 'annexure-k'];
  if (window.portalPreviewTimer) {
    clearTimeout(window.portalPreviewTimer);
    window.portalPreviewTimer = null;
  }
  if (previewSections.includes(id)) {
    const openPreview = () => {
      if (currentViewId === id && window.pdfPreview) window.pdfPreview.show(id);
    };
    if (typeof runWhenIdle === 'function') {
      window.portalPreviewTimer = runWhenIdle(openPreview, 900);
    } else {
      window.portalPreviewTimer = setTimeout(openPreview, 250);
    }
  } else {
    if (window.pdfPreview) window.pdfPreview.hide();
  }

  if (id === 'dashboard' || id === 'projects') {
    renderDistrictLegends();
  } else if (typeof runWhenIdle === 'function') {
    runWhenIdle(() => renderDistrictLegends(), 900);
  }
  initLucide(el || document);

  if (typeof enforceReviewerReadOnly === 'function') {
    requestAnimationFrame(() => enforceReviewerReadOnly());
  }

  if (typeof loadReviewerNoteForView === 'function') {
    loadReviewerNoteForView(id, titles[id] || id);
  }
}

function goBackView() {
  if (viewHistory.length > 0) {
    history.back();
  }
}

let lucideRenderQueued = false;
function initLucide(root) {
  if (!window.lucide || lucideRenderQueued) return;
  lucideRenderQueued = true;
  requestAnimationFrame(() => {
    lucideRenderQueued = false;
    if (!window.lucide) return;
    try {
      if (root && root.querySelector) {
        window.lucide.createIcons({ nodes: root.querySelectorAll('i[data-lucide]') });
        return;
      }
      const scopedNodes = document.querySelectorAll([
        '.view.active i[data-lucide]',
        '.topbar i[data-lucide]',
        '.sidebar i[data-lucide]',
        '.modal.open i[data-lucide]',
        '#screen-auth.active i[data-lucide]',
        '.toast i[data-lucide]'
      ].join(','));
      window.lucide.createIcons({ nodes: scopedNodes });
    } catch (err) {
      window.lucide.createIcons();
    }
  });
}

window.addEventListener('load', () => {
  if (window.initLucide) window.initLucide();
});

function updateSidebarToggleVisibility() {
  const toggleBtn = document.getElementById('tb-sidebar-toggle');
  if (!toggleBtn) return;
  if (typeof S !== 'undefined' && S.activeProject) {
    toggleBtn.style.display = 'inline-flex';
  } else {
    toggleBtn.style.display = 'none';
  }
  if (window.initLucide) initLucide();
}

function clearActiveProject() {
  if (typeof S !== 'undefined') {
    S.activeProject = null;
    ['report-nav', 'annexure-nav', 'tables-nav', 'finalize-nav'].forEach(n => {
      const el = document.getElementById(n);
      if (el) el.style.display = 'none';
    });
    if (typeof updateActiveDistrictUI === 'function') updateActiveDistrictUI('Punjab');
    if (typeof updateActiveProjectCardUI === 'function') updateActiveProjectCardUI();
    if (typeof filterDashboardByDistrict === 'function') filterDashboardByDistrict('ALL');
    
    // Collapse and unpin sidebar when active project is cleared
    isSidebarPinned = false;
    document.body.classList.add('sidebar-hidden');
    updateSidebarToggleVisibility();
    S.annexureB = [];
    S.annexureC = [];
    S.annexureD = [];
    S.annexureE = [];
    S.annexureG = [];
    S.annexureH = [];
    S.annexureI = [];
    S.annexureJ = [];
  }
}

/* Theme logic lives in js/theme.js (loaded in <head> for instant light default) */

let confirmCallback = null;

function customConfirm(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  confirmCallback = cb;
  document.getElementById('modal-confirm').classList.add('open');
}

function doConfirm() {
  closeModal('modal-confirm');
  if (confirmCallback) confirmCallback();
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Bind close modal on clicking overlay background
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });
  if (typeof updateDarkModeIcon === 'function') updateDarkModeIcon();
});

let toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

// Global utility for formatting numbers
function fmtN(v, dec = 2) {
  const n = Number(v);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/* ── District Management System ── */
const DISTRICT_COLORS = {
  'Jalandhar': {
    // Indigo Blue (#4F46E5)
    light: { bg: 'rgba(79, 70, 229, 0.15)', border: '#4F46E5', text: '#3730a3', glow: 'rgba(79, 70, 229, 0.25)' },
    dark: { bg: 'rgba(99, 102, 241, 0.25)', border: '#818cf8', text: '#e0e7ff', glow: 'rgba(129, 140, 248, 0.4)' }
  },
  'Ludhiana': {
    // Cyan (#06B6D4)
    light: { bg: 'rgba(6, 182, 212, 0.15)', border: '#0891b2', text: '#155e75', glow: 'rgba(6, 182, 212, 0.25)' },
    dark: { bg: 'rgba(6, 182, 212, 0.25)', border: '#22d3ee', text: '#ecfeff', glow: 'rgba(34, 211, 238, 0.4)' }
  },
  'Mansa': {
    // Purple Violet (#9333EA)
    light: { bg: 'rgba(147, 51, 234, 0.15)', border: '#9333EA', text: '#6b21a8', glow: 'rgba(147, 51, 234, 0.25)' },
    dark: { bg: 'rgba(168, 85, 247, 0.25)', border: '#c084fc', text: '#faf5ff', glow: 'rgba(192, 132, 252, 0.4)' }
  },
  'Hoshiarpur': {
    // Teal (#0F766E)
    light: { bg: 'rgba(15, 118, 110, 0.15)', border: '#0F766E', text: '#115e59', glow: 'rgba(15, 118, 110, 0.25)' },
    dark: { bg: 'rgba(20, 184, 166, 0.25)', border: '#2dd4bf', text: '#f0fdfa', glow: 'rgba(45, 212, 191, 0.4)' }
  },
  'Pathankot': {
    // Orange Amber (#EA580C)
    light: { bg: 'rgba(234, 88, 12, 0.15)', border: '#EA580C', text: '#9a3412', glow: 'rgba(234, 88, 12, 0.25)' },
    dark: { bg: 'rgba(249, 115, 22, 0.25)', border: '#fb923c', text: '#fff7ed', glow: 'rgba(251, 146, 60, 0.4)' }
  },
  'Rupnagar': {
    // Rose Pink (#E11D48)
    light: { bg: 'rgba(225, 29, 72, 0.15)', border: '#E11D48', text: '#9f1239', glow: 'rgba(225, 29, 72, 0.25)' },
    dark: { bg: 'rgba(244, 63, 94, 0.25)', border: '#fda4af', text: '#fff1f2', glow: 'rgba(253, 164, 175, 0.4)' }
  },
  'Tarn Taran': {
    // Sky Blue (#0284C7)
    light: { bg: 'rgba(2, 132, 199, 0.15)', border: '#0284C7', text: '#075985', glow: 'rgba(2, 132, 199, 0.25)' },
    dark: { bg: 'rgba(14, 165, 233, 0.25)', border: '#38bdf8', text: '#f0f9ff', glow: 'rgba(56, 189, 248, 0.4)' }
  }
};

function getDistrictStyle(name, forceDark = false) {
  const cleanName = (name || '').trim();
  const isDark = forceDark || document.documentElement.classList.contains('dark');
  const dist = DISTRICT_COLORS[cleanName] || {
    light: { bg: 'rgba(79, 70, 229, 0.15)', border: '#4F46E5', text: '#3730a3', glow: 'rgba(79, 70, 229, 0.25)' },
    dark: { bg: 'rgba(99, 102, 241, 0.25)', border: '#818cf8', text: '#e0e7ff', glow: 'rgba(129, 140, 248, 0.4)' }
  };
  const themeStyle = isDark ? dist.dark : dist.light;

  // Custom topbar style overrides for high contrast on navy navbar
  const topbarBg = (isDark || forceDark) ? themeStyle.bg : 'rgba(255, 255, 255, 0.95)';
  const topbarColor = themeStyle.text;
  const topbarBorder = themeStyle.border;
  const topbarGlow = themeStyle.glow;

  return {
    bg: themeStyle.bg,
    color: themeStyle.text,
    border: themeStyle.border,
    glow: themeStyle.glow,
    topbarBg,
    topbarColor,
    topbarBorder,
    topbarGlow
  };
}

function paintDistrictThemeOnElement(el, districtName) {
  if (!el || !districtName) return;
  const style = getDistrictStyle(districtName);
  el.style.setProperty('--district-border', style.border);
  el.style.setProperty('--district-accent', style.color);
  el.style.setProperty('--district-bg', style.bg);
  el.style.setProperty('--district-glow', style.glow);
  el.dataset.district = districtName;
}

function applyDistrictBadgeStyles(el, districtName) {
  if (!el || !districtName) return;
  const style = getDistrictStyle(districtName);
  el.classList.add('district-badge');
  el.dataset.district = districtName;
  el.style.background = style.bg;
  el.style.color = style.color;
  el.style.border = `2px solid ${style.border}`;
  el.style.boxShadow = `0 1px 3px ${style.glow}`;
}

function getDistrictBadgeHTML(districtName) {
  const safe = (districtName || '').replace(/"/g, '&quot;');
  return `<span class="badge district-badge" data-district="${safe}">${districtName}</span>`;
}

function refreshDistrictBadgesInDOM() {
  document.querySelectorAll('.district-badge[data-district]').forEach((el) => {
    applyDistrictBadgeStyles(el, el.dataset.district);
  });
}

function ensureActiveProjectCardHost(containerEl) {
  if (!containerEl) return null;
  let host = containerEl.querySelector(':scope > .active-dsr-project-card-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'active-dsr-project-card-host';
    containerEl.insertBefore(host, containerEl.firstChild);
  }
  return host;
}

function ensureDistrictManagementHost(containerEl) {
  if (!containerEl) return null;
  let panel = containerEl.querySelector(':scope > #district-management-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'district-management-panel';
    containerEl.appendChild(panel);
  }
  return panel;
}

function ensureActiveProjectCardStructure(hostEl) {
  if (!hostEl) return null;
  let card = hostEl.querySelector('.active-dsr-project-card');
  if (!card) {
    hostEl.innerHTML = `
      <div class="active-dsr-project-card card" hidden>
        <div class="active-dsr-project-card__body">
          <div class="active-dsr-project-card__label">Currently Editing DSR Project</div>
          <div class="active-dsr-project-card__title"></div>
        </div>
        <span class="active-dsr-project-card__badge district-badge"></span>
      </div>`;
    card = hostEl.querySelector('.active-dsr-project-card');
  }
  return card;
}

function paintActiveProjectCard(card, project) {
  if (!card || !project) return;
  const dist = project.district;
  const titleEl = card.querySelector('.active-dsr-project-card__title');
  const badgeEl = card.querySelector('.active-dsr-project-card__badge');
  if (titleEl) titleEl.textContent = project.title;
  if (badgeEl) badgeEl.textContent = `${dist} DISTRICT`;
  paintDistrictThemeOnElement(card, dist);
  if (badgeEl) applyDistrictBadgeStyles(badgeEl, dist);
}

function updateActiveProjectCardUI() {
  const containers = [
    document.getElementById('workflow-active-district-header'),
    document.getElementById('dash-right-sidebar')
  ];

  containers.forEach((container) => {
    if (!container) return;
    const host = container.id === 'workflow-active-district-header'
      ? container
      : ensureActiveProjectCardHost(container);

    if (!S.activeProject) {
      if (container.id === 'workflow-active-district-header') {
        container.style.display = 'none';
        container.innerHTML = '';
      } else {
        const card = host.querySelector('.active-dsr-project-card');
        if (card) card.hidden = true;
      }
      return;
    }

    if (container.id === 'workflow-active-district-header') {
      container.style.display = 'block';
    }

    const card = ensureActiveProjectCardStructure(host);
    if (!card) return;
    card.hidden = false;
    paintActiveProjectCard(card, S.activeProject);
  });
}

/** Re-apply district + project themed UI after light/dark toggle (no page reload). */
function refreshThemeDependentUI() {
  if (typeof S === 'undefined' || !S) return;

  const dist = S.activeProject ? S.activeProject.district : 'Punjab';
  updateActiveDistrictUI(dist);
  updateActiveProjectCardUI();
  renderDistrictLegends();
  refreshDistrictBadgesInDOM();

  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderProjects === 'function') renderProjects();
  if (window.initLucide) initLucide();
  /* Charts are heavy — defer so district/project cards repaint first */
  if (typeof renderGraphs === 'function') {
    requestAnimationFrame(() => renderGraphs());
  }
}

function updateActiveDistrictUI(districtName) {
  const badgeEl = document.getElementById('tb-district-badge');
  if (!badgeEl) return;

  if (districtName && districtName !== 'Punjab' && districtName !== 'ALL') {
    const style = getDistrictStyle(districtName);
    badgeEl.textContent = districtName;
    badgeEl.style.backgroundColor = style.topbarBg;
    badgeEl.style.color = style.topbarColor;
    badgeEl.style.borderColor = style.topbarBorder;
    badgeEl.style.borderWidth = '2.5px';
    badgeEl.style.borderStyle = 'solid';
    badgeEl.style.borderRadius = '99px';
    badgeEl.style.padding = '6px 14px';
    badgeEl.style.fontSize = '12.5px';
    badgeEl.style.boxShadow = `0 4px 12px ${style.topbarGlow}, 0 0 0 1.5px ${style.topbarBorder}`;
    badgeEl.style.transform = 'translateY(-1px)';
    badgeEl.style.fontWeight = '700';
    badgeEl.style.textTransform = 'uppercase';
    badgeEl.style.letterSpacing = '0.04em';
    badgeEl.style.transition = 'all 0.3s ease';
    badgeEl.style.display = 'inline-flex';
    badgeEl.style.alignItems = 'center';

    badgeEl.onmouseover = () => {
      badgeEl.style.transform = 'translateY(-2px)';
      badgeEl.style.boxShadow = `0 6px 16px ${style.topbarGlow}, 0 0 0 2px ${style.topbarBorder}`;
    };
    badgeEl.onmouseout = () => {
      badgeEl.style.transform = 'translateY(-1px)';
      badgeEl.style.boxShadow = `0 4px 12px ${style.topbarGlow}, 0 0 0 1.5px ${style.topbarBorder}`;
    };

    // Update dashboard indicator badge if it exists
    const dashIndicator = document.getElementById('dash-active-district-badge');
    if (dashIndicator) {
      dashIndicator.id = 'dash-active-district-badge';
      dashIndicator.className = 'badge district-badge';
      dashIndicator.textContent = districtName;
      dashIndicator.style.fontWeight = '800';
      dashIndicator.style.transform = 'translateY(-1px)';
      applyDistrictBadgeStyles(dashIndicator, districtName);
    }
  } else {
    // Reset to default Punjab styling
    badgeEl.textContent = 'Punjab';
    badgeEl.style.backgroundColor = '';
    badgeEl.style.color = '';
    badgeEl.style.borderColor = '';
    badgeEl.style.borderWidth = '';
    badgeEl.style.borderStyle = '';
    badgeEl.style.borderRadius = '';
    badgeEl.style.padding = '';
    badgeEl.style.fontSize = '';
    badgeEl.style.boxShadow = '';
    badgeEl.style.transform = '';
    badgeEl.style.fontWeight = '';
    badgeEl.style.textTransform = '';
    badgeEl.style.letterSpacing = '';
    badgeEl.style.transition = '';
    badgeEl.style.display = '';
    badgeEl.style.alignItems = '';
    badgeEl.onmouseover = null;
    badgeEl.onmouseout = null;

    const dashIndicator = document.getElementById('dash-active-district-badge');
    if (dashIndicator) {
      dashIndicator.outerHTML = `<span id="dash-active-district-badge" class="badge" style="background:var(--off); color:var(--text-soft);">None</span>`;
    }
  }
}

function updateWorkflowDistrictUI() {
  updateActiveProjectCardUI();
  const reviewerActions = document.getElementById('reviewer-actions');
  if (reviewerActions) {
    reviewerActions.style.display = (hasReviewAccess() && S.activeProject) ? 'flex' : 'none';
  }
}

function renderDistrictLegends() {
  const dashEl = document.getElementById('dash-right-sidebar');

  const districts = ['Jalandhar', 'Ludhiana', 'Mansa', 'Hoshiarpur', 'Pathankot', 'Rupnagar', 'Tarn Taran'];

  // Dashboard right-side district card.
  const renderDetailedCard = (containerEl) => {
    if (!containerEl) return;

    const getAbbrev = (name) => {
      if (name === 'ALL') return 'ALL';
      if (name === 'Jalandhar') return 'JAL';
      if (name === 'Ludhiana') return 'LUD';
      if (name === 'Mansa') return 'MAN';
      if (name === 'Hoshiarpur') return 'HOS';
      if (name === 'Pathankot') return 'PAT';
      if (name === 'Rupnagar') return 'RUP';
      if (name === 'Tarn Taran') return 'TAR';
      return name.substring(0, 3).toUpperCase();
    };

    let listHtml = '';

    // Add "All Districts" option at the top of the detailed legend
    const isAllSelected = currentDistrictFilter === 'ALL';
    listHtml += `
      <div class="whats-new-item ${isAllSelected ? 'active-filter' : ''}" onclick="filterDashboardByDistrict('ALL')">
        <div class="whats-new-badge" style="background:#C49A58; color:var(--p-accent);">ALL</div>
        <div class="whats-new-name">All Districts (Punjab)</div>
        <div class="whats-new-arrow"><i data-lucide="chevron-right" style="width:16px; height:16px;"></i></div>
      </div>
    `;

    districts.forEach(d => {
      const isActiveFilter = currentDistrictFilter === d;
      const isActiveProj = S.activeProject && S.activeProject.district === d;
      const isSelected = isActiveFilter || isActiveProj;
      const abbrev = getAbbrev(d);

      const badgeBg = isActiveProj ? '#ffffff' : '#C49A58';
      const badgeColor = 'var(--p-accent)';
      const editingIndicator = isActiveProj ? ' <span style="font-size:9px; font-weight:800; text-transform:uppercase; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); padding:1px 5px; border-radius:3px; margin-left:6px; color:#fff;">Editing</span>' : '';

      listHtml += `
        <div class="whats-new-item ${isSelected ? 'active-filter' : ''}" onclick="filterDashboardByDistrict('${d}')">
          <div class="whats-new-badge" style="background:${badgeBg}; color:${badgeColor};">${abbrev}</div>
          <div class="whats-new-name">${d} District${editingIndicator}</div>
          <div class="whats-new-arrow"><i data-lucide="chevron-right" style="width:16px; height:16px;"></i></div>
        </div>
      `;
    });

    containerEl.innerHTML = `
      <div class="whats-new-sidebar">
        <div class="whats-new-title">
          <i data-lucide="map" style="width:18px; height:18px; color: var(--p-accent-gold);"></i>
          <span>District Management</span>
        </div>
        <p class="whats-new-desc">
          Select a district to filter context-specific surveys. The active project's district is highlighted with a white icon badge.
        </p>
        <div style="display: flex; flex-direction: column;">
          ${listHtml}
        </div>
      </div>
    `;
  };

  renderDetailedCard(ensureDistrictManagementHost(dashEl));
  if (typeof updateActiveProjectCardUI === 'function') updateActiveProjectCardUI();
  initLucide();
}

/* ── River Color Identity System ── */
const RIVER_COLORS = {
  'Sutlej': {
    light: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', text: '#065f46', glow: 'rgba(16, 185, 129, 0.25)' },
    dark: { bg: 'rgba(16, 185, 129, 0.25)', border: '#34d399', text: '#ecfdf5', glow: 'rgba(52, 211, 153, 0.4)' }
  },
  'Beas': {
    light: { bg: 'rgba(6, 182, 212, 0.15)', border: '#06B6D4', text: '#155e75', glow: 'rgba(6, 182, 212, 0.25)' },
    dark: { bg: 'rgba(6, 182, 212, 0.25)', border: '#22d3ee', text: '#ecfeff', glow: 'rgba(34, 211, 238, 0.4)' }
  },
  'Ghaggar': {
    light: { bg: 'rgba(15, 118, 110, 0.15)', border: '#0F766E', text: '#115e59', glow: 'rgba(15, 118, 110, 0.25)' },
    dark: { bg: 'rgba(15, 118, 110, 0.25)', border: '#2dd4bf', text: '#f0fdfa', glow: 'rgba(45, 212, 191, 0.4)' }
  },
  'Ravi': {
    light: { bg: 'rgba(249, 115, 22, 0.15)', border: '#F97316', text: '#9a3412', glow: 'rgba(249, 115, 22, 0.25)' },
    dark: { bg: 'rgba(249, 115, 22, 0.25)', border: '#fb923c', text: '#fff7ed', glow: 'rgba(251, 146, 60, 0.4)' }
  },
  'Yamuna': {
    light: { bg: 'rgba(37, 99, 235, 0.15)', border: '#2563EB', text: '#1e40af', glow: 'rgba(37, 99, 235, 0.25)' },
    dark: { bg: 'rgba(37, 99, 235, 0.25)', border: '#60a5fa', text: '#eff6ff', glow: 'rgba(96, 165, 250, 0.4)' }
  },
  'Chenab': {
    light: { bg: 'rgba(124, 58, 237, 0.15)', border: '#7C3AED', text: '#5b21b6', glow: 'rgba(124, 58, 237, 0.25)' },
    dark: { bg: 'rgba(124, 58, 237, 0.25)', border: '#a78bfa', text: '#faf5ff', glow: 'rgba(167, 139, 250, 0.4)' }
  },
  'Jhelum': {
    light: { bg: 'rgba(71, 85, 105, 0.15)', border: '#475569', text: '#334155', glow: 'rgba(71, 85, 105, 0.25)' },
    dark: { bg: 'rgba(71, 85, 105, 0.25)', border: '#94a3b8', text: '#cbd5e1', glow: 'rgba(148, 163, 184, 0.4)' }
  }
};

function getRiverStyle(name) {
  const cleanName = (name || '').trim();
  const isDark = document.documentElement.classList.contains('dark');
  const style = RIVER_COLORS[cleanName] || {
    light: { bg: 'rgba(71, 85, 105, 0.15)', border: '#64748b', text: '#334155', glow: 'rgba(71, 85, 105, 0.25)' },
    dark: { bg: 'rgba(71, 85, 105, 0.25)', border: '#94a3b8', text: '#cbd5e1', glow: 'rgba(148, 163, 184, 0.4)' }
  };
  const themeStyle = isDark ? style.dark : style.light;
  return {
    bg: themeStyle.bg,
    color: themeStyle.text,
    border: themeStyle.border,
    glow: themeStyle.glow
  };
}

function getRiverBadgeHTML(riverName) {
  const style = getRiverStyle(riverName);
  return `<span class="badge river-badge" style="background:${style.bg}; color:${style.color}; border: 1.5px solid ${style.border}; box-shadow: 0 1px 2px ${style.glow}; font-weight:700; transition: all 0.2s ease; cursor: pointer; display: inline-flex; align-items: center;" onmouseover="this.style.boxShadow='0 0 6px ${style.border}', this.style.transform='scale(1.03)'" onmouseout="this.style.boxShadow='0 1px 2px ${style.glow}', this.style.transform='scale(1)'">${riverName}</span>`;
}

function renderRiverTags(riversString) {
  if (!riversString || riversString === 'Not specified') return `<span class="badge" style="background:var(--off); color:var(--text-soft); border: 1px solid var(--border);">No River</span>`;
  const rivers = riversString.split(',').map(r => r.trim()).filter(r => r !== '');
  return rivers.map(r => getRiverBadgeHTML(r)).join(' ');
}
