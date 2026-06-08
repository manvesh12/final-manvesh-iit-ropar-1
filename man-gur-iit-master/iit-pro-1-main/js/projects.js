/* ══════════════════════════════════════
   PROJECTS & DASHBOARD
══════════════════════════════════════ */
let currentDistrictFilter = 'ALL';

function normalizeBackendProjects(data) {
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
  return rows.map(p => ({
    id: p.id,
    title: p.title || p.projectName || `District Survey Report - ${p.district || 'Punjab'}`,
    projectName: p.projectName || p.title,
    district: p.district || 'Punjab',
    year: p.year || '2025-26',
    mineral: p.mineral || 'Sand',
    rivers: p.rivers || 'Not specified',
    progress: Number.isFinite(Number(p.progress)) ? Number(p.progress) : 0,
    status: p.status === 'IN_PROGRESS' || p.status === 'ACTIVE' ? 'In Progress' : (p.status || 'In Progress'),
    createdAt: p.createdAt ? new Date(p.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
    signatures: Number.isFinite(Number(p.signatures)) ? Number(p.signatures) : 0,
    projectState: p.projectState || null
  }));
}

async function refreshProjectsFromBackend(renderAfter = true) {
  try {
    const data = await apiFetch('/projects');
    S.projects = normalizeBackendProjects(data);
    S.projectLoadError = '';
    S.projectsLoadedAt = new Date().toLocaleTimeString();
    updateProjectBadgeCount();
    updateTopBarProjectsDropdown();
    if (renderAfter) {
      renderProjects();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
    return S.projects;
  } catch (err) {
    S.projectLoadError = err.message || 'Failed to load projects from backend';
    if (renderAfter) renderProjects();
    throw err;
  }
}

function updateProjectBadgeCount() {
  const badgeEl = document.getElementById('badge-projs');
  if (badgeEl) badgeEl.textContent = S.projects.length;
}

function updateTopBarProjectsDropdown() {
  const dropdown = document.getElementById('tb-projects-dropdown');
  if (!dropdown) return;
  
  let html = `<a href="#" onclick="showView('projects',null); return false;">View All Projects</a>`;
  if (typeof hasAdminAccess === 'function' && hasAdminAccess()) {
    html += `<a href="#" onclick="newProjectModal(); return false;">+ Add New Project</a>`;
  }
  
  if (S.projects && S.projects.length > 0) {
    html += `<div style="height:1px; background:var(--border); margin:4px 0;"></div>`;
    html += `<div style="padding: 4px 20px; font-size:11px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:.05em;">Recent Projects</div>`;
    // Show up to 5 recent projects
    S.projects.slice(0, 5).forEach(p => {
      html += `<a href="#" onclick="openProject(${p.id}); return false;" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${p.title}">
        ${p.title} <span style="color:var(--text-soft); font-size:11px;">(${p.district})</span>
      </a>`;
    });
  }
  
  dropdown.innerHTML = html;
}

function filterDashboardByDistrict(val) {
  currentDistrictFilter = val;
  
  // Update selector UI value if it is changed programmatically
  const selector = document.getElementById('dash-district-filter');
  if (selector && selector.value !== val) selector.value = val;
  
  renderDashboard();
  renderProjects();
}

function dashPortalToast(message, type = 'info') {
  if (typeof toast === 'function') toast(message, type);
  else console.log(message);
}

function dashFocusSearch() {
  const input = document.getElementById('dash-portal-search') || document.getElementById('projects-portal-search') || document.getElementById('tb-portal-search');
  if (!input) return;
  input.focus();
  input.select();
}

function dashRunSearch(event) {
  if (event && event.key !== 'Enter') return;
  const input = document.getElementById('dash-portal-search') || document.getElementById('projects-portal-search') || document.getElementById('tb-portal-search');
  const query = (input && input.value ? input.value : '').trim().toLowerCase();
  if (!query) {
    dashPortalToast('Type a keyword, then press Enter.');
    return;
  }

  const routes = [
    { words: ['project', 'projects', 'dsr'], view: 'projects', label: 'projects' },
    { words: ['new', 'create', 'add'], action: () => newProjectModal(), label: 'new project' },
    { words: ['sign', 'signature', 'esign', 'approval'], view: 'esign', label: 'e-signature panel' },
    { words: ['workflow', 'review', 'status'], view: 'workflow', label: 'workflow' },
    { words: ['pdf', 'download', 'guideline', 'guidelines', 'generate'], view: 'generate', label: 'downloads and PDF generation' },
    { words: ['help', 'faq', 'support', 'contact', 'rti'], view: 'sdlc-portal', label: 'help and support' },
    { words: ['district', 'progress', 'dashboard'], action: () => document.getElementById('dash-main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), label: 'dashboard district section' }
  ];

  const match = routes.find(route => route.words.some(word => query.includes(word)));
  if (!match) {
    dashPortalToast('No dashboard shortcut found. Try project, workflow, sign, PDF, district, or help.', 'error');
    return;
  }

  if (match.view) showView(match.view, null);
  if (match.action) match.action();
  dashPortalToast(`Opened ${match.label}.`, 'success');
}

async function dashSharePortal() {
  const url = window.location.href.split('#')[0] + '#dashboard';
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      dashPortalToast('Dashboard link copied.', 'success');
    } else {
      window.prompt('Copy dashboard link:', url);
    }
  } catch (err) {
    window.prompt('Copy dashboard link:', url);
  }
}

async function renderDashboard() {
  const filteredProjs = currentDistrictFilter === 'ALL'
    ? S.projects
    : S.projects.filter(p => p.district === currentDistrictFilter);

  const done = filteredProjs.filter(p=>p.progress===100).length;
  const pend = filteredProjs.reduce((sum, p) => sum + Math.max(0, 5 - (Number(p.signatures) || 0)), 0);
  
  const totalEl = document.getElementById('d-total');
  const doneEl = document.getElementById('d-done');
  const sigsEl = document.getElementById('d-sigs');
  const pdfsEl = document.getElementById('d-pdfs');
  
  try {
    if (currentDistrictFilter !== 'ALL') throw new Error('Use local filtered dashboard stats');
    const stats = await apiFetch('/dashboard/stats');
    if (totalEl) totalEl.textContent = stats.totalProjects || 0;
    if (doneEl) doneEl.textContent = stats.completedReports || 0;
    if (sigsEl) sigsEl.textContent = stats.pendingReports || 0;
    if (pdfsEl) pdfsEl.textContent = stats.completedReports || 0;
  } catch (err) {
    // Fallback to local dummy data if not connected
    if (totalEl) totalEl.textContent = filteredProjs.length;
    if (doneEl) doneEl.textContent = done;
    if (sigsEl) sigsEl.textContent = pend;
    if (pdfsEl) pdfsEl.textContent = done + (filteredProjs.length > 0 ? 1 : 0);
  }

  // Update Overview progress bar fills and percentages dynamically
  const totalVal = parseInt(totalEl ? totalEl.textContent : 0) || 0;
  const doneVal = parseInt(doneEl ? doneEl.textContent : 0) || 0;
  const sigsVal = parseInt(sigsEl ? sigsEl.textContent : 0) || 0;
  const pdfsVal = parseInt(pdfsEl ? pdfsEl.textContent : 0) || 0;

  const totalPct = 100;
  const donePct = totalVal > 0 ? Math.round((doneVal / totalVal) * 100) : 0;
  const sigsPct = totalVal > 0 ? Math.min(100, Math.round((sigsVal / totalVal) * 100)) : 0;
  const pdfsPct = totalVal > 0 ? Math.round((pdfsVal / totalVal) * 100) : 0;

  const totalFill = document.getElementById('d-total-fill');
  const totalPctEl = document.getElementById('d-total-pct');
  if (totalFill) totalFill.style.width = totalPct + '%';
  if (totalPctEl) totalPctEl.textContent = totalPct + '%';

  const doneFill = document.getElementById('d-done-fill');
  const donePctEl = document.getElementById('d-done-pct');
  if (doneFill) doneFill.style.width = donePct + '%';
  if (donePctEl) donePctEl.textContent = donePct + '%';

  const sigsFill = document.getElementById('d-sigs-fill');
  const sigsPctEl = document.getElementById('d-sigs-pct');
  if (sigsFill) sigsFill.style.width = sigsPct + '%';
  if (sigsPctEl) sigsPctEl.textContent = sigsPct + '%';

  const pdfsFill = document.getElementById('d-pdfs-fill');
  const pdfsPctEl = document.getElementById('d-pdfs-pct');
  if (pdfsFill) pdfsFill.style.width = pdfsPct + '%';
  if (pdfsPctEl) pdfsPctEl.textContent = pdfsPct + '%';

  // Render District Progress Column 2
  const progressEl = document.getElementById('dash-district-progress');
  if (progressEl) {
    const districtsList = ['Jalandhar', 'Ludhiana', 'Mansa', 'Hoshiarpur', 'Pathankot', 'Rupnagar', 'Tarn Taran'];
    let progressHtml = '';
    districtsList.forEach(d => {
      const distProjs = S.projects.filter(p => p.district === d);
      const avgProgress = distProjs.length > 0 ? Math.round(distProjs.reduce((acc, p) => acc + p.progress, 0) / distProjs.length) : 0;
      const style = getDistrictStyle(d);
      progressHtml += `
        <div class="dist-progress-item">
          <span class="dist-progress-name">
            <span style="width:8px; height:8px; border-radius:50%; background:${style.border}; display:inline-block;"></span>
            ${d}
          </span>
          <div class="dist-progress-bar-container">
            <div class="dist-progress-bar">
              <div class="dist-progress-fill" style="width:${avgProgress}%; background:${style.border};"></div>
            </div>
            <span class="dist-progress-pct">${avgProgress}%</span>
          </div>
        </div>
      `;
    });
    progressEl.innerHTML = progressHtml;
  }
  
  const el = document.getElementById('dash-recent');
  if (el) {
    if (filteredProjs.length === 0) {
      el.innerHTML = `<div style="text-align:center; padding: 24px; color:var(--text-soft); font-size:13px;">No projects yet. Use <strong>+ Create New DSR Project</strong> to add one${currentDistrictFilter !== 'ALL' ? ` for ${currentDistrictFilter}` : ''}.</div>`;
    } else {
      el.innerHTML = filteredProjs.slice(0,3).map(p=>`
        <div class="file-item" style="margin-bottom:8px;cursor:pointer" onclick="openProject(${p.id})">
          <div class="file-icon" style="background:${p.progress===100?'rgba(22,163,74,0.12)':'rgba(37,99,235,0.12)'}; color:${p.progress===100?'var(--green)':'var(--primary)'}"><i data-lucide="${p.progress===100?'check-circle':'file-text'}"></i></div>
          <div class="file-info" style="flex:1; min-width:0;">
            <div class="file-name" style="display:flex; align-items:center; gap:8px;">
              ${p.title}
              ${getDistrictBadgeHTML(p.district)}
            </div>
            <div class="file-meta">${p.district} District · ${p.year}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px; flex-shrink:0;">
            <span class="badge ${p.status==='Completed'?'badge-green':p.status==='In Progress'?'badge-amber':'badge-red'}">${p.status}</span>
            <span style="font-size:10px;color:var(--text-faint)">${p.progress}%</span>
            ${hasAdminAccess() ? `<button type="button" class="btn btn-danger btn-xs" onclick="deleteProject(${p.id}, event)" title="Delete project">Delete</button>` : ''}
          </div>
        </div>`).join('');
    }
  }
  
  // Sync active district highlights on dashboard
  updateActiveDistrictUI(currentDistrictFilter !== 'ALL' ? currentDistrictFilter : (S.activeProject ? S.activeProject.district : 'Punjab'));
  renderDistrictLegends();
  if (typeof refreshDistrictBadgesInDOM === 'function') refreshDistrictBadgesInDOM();
  if (typeof updateRolePermissionUI === 'function') updateRolePermissionUI();
  initLucide();
}

let projectRenderLimit = 60;

function showMoreProjects() {
  projectRenderLimit += 60;
  renderProjects();
}
window.showMoreProjects = showMoreProjects;

function renderProjects() {
  updateTopBarProjectsDropdown();
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  const statusEl = document.getElementById('projects-load-status');
  if (statusEl) {
    if (S.projectLoadError) {
      statusEl.textContent = 'Project API error: ' + S.projectLoadError;
      statusEl.style.color = 'var(--red)';
    } else {
      statusEl.textContent = `${S.projects.length} project(s) loaded from backend${S.projectsLoadedAt ? ' at ' + S.projectsLoadedAt : ''}`;
      statusEl.style.color = 'var(--text-soft)';
    }
  }

  if (S.projectLoadError) {
    grid.innerHTML = `
      <div class="projects-empty-state">
        <div class="projects-empty-state__inner">
          <div class="projects-empty-state__icon"><i data-lucide="alert-triangle" style="width:24px;height:24px;"></i></div>
          <h3>Projects Not Loading</h3>
          <p>${S.projectLoadError}</p>
          <button type="button" class="btn btn-saffron" onclick="initApp()">Retry Load</button>
        </div>
      </div>`;
    initLucide();
    return;
  }
  
  const filteredProjs = currentDistrictFilter === 'ALL'
    ? S.projects
    : S.projects.filter(p => p.district === currentDistrictFilter);

  if (filteredProjs.length === 0) {
    const districtHint = currentDistrictFilter === 'ALL' ? '' : ` for ${currentDistrictFilter}`;
    const canCreateProject = typeof hasAdminAccess === 'function' && hasAdminAccess();
    grid.innerHTML = `
      <div class="projects-empty-state">
        <div class="projects-empty-state__inner">
          <div class="projects-empty-state__icon">
            <i data-lucide="folder-plus" style="width:24px; height:24px;"></i>
          </div>
          <h3>No DSR Projects Yet</h3>
          <p>${canCreateProject ? `Click <strong>+ New Project</strong> to create your first district survey report${districtHint}.` : `No district survey report has been created yet${districtHint}. Once Admin creates a project, it will appear here.`}</p>
          ${canCreateProject ? `<button type="button" class="btn btn-saffron" onclick="newProjectModal()">+ New Project</button>` : ''}
        </div>
      </div>`;
    initLucide();
    if (typeof updateRolePermissionUI === 'function') updateRolePermissionUI();
    return;
  }

  function getLiveProgressStatus(p) {
    if (p.status === 'Completed') return '<span style="color:var(--green)">✓ Fully Approved & Generated</span>';
    if (p.progress === 100) return '<span style="color:var(--teal)">Pending Authority E-Signatures</span>';
    if (p.progress > 80) return '<span style="color:var(--saffron)">Finalizing Annexures & Tables</span>';
    if (p.progress > 40) return '<span style="color:var(--saffron)">Uploading Chapters & Plates</span>';
    return '<span style="color:var(--text-soft)">Initial Project Setup</span>';
  }

  const visibleProjects = filteredProjs.slice(0, projectRenderLimit);
  grid.innerHTML = visibleProjects.map(p=>`
    <div class="proj-card">
      <div class="proj-card-top" style="cursor:pointer" onclick="openProject(${p.id})">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px;">
          <h3 style="font-size:14px; font-weight:700; color:var(--text);">${p.title}</h3>
          ${getDistrictBadgeHTML(p.district)}
        </div>
        <p style="font-size:12px; color:var(--text-soft);">${p.district} District · ${p.year}</p>
      </div>
      <div class="proj-card-bd">
        <div class="proj-meta">
          <span class="badge badge-navy">${p.mineral}</span>
          ${renderRiverTags(p.rivers)}
          <span class="badge ${p.status==='Completed'?'badge-green':p.status==='In Progress'?'badge-amber':'badge-red'}">${p.status}</span>
        </div>
        <div style="font-size:10.5px;color:var(--text-faint);margin-bottom:10px">Created: ${p.createdAt} · Sigs: ${p.signatures}/5</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${p.progress}%;background:${p.progress===100?'var(--green)':'linear-gradient(90deg,var(--teal),var(--teal-2))'}"></div></div>
          <span style="font-size:12px;font-weight:700;color:var(--text)">${p.progress}%</span>
        </div>
        
        <div style="background:var(--bg); padding:10px 12px; border-radius:var(--r-md); margin-bottom:16px; font-size:13px; border:1px solid var(--border-2);">
          <div style="font-weight:800; margin-bottom:6px; color:var(--text); display:flex; align-items:center; gap:6px;">
            <i data-lucide="activity" style="width:14px; height:14px; color:var(--primary);"></i> Live Progress Report
          </div>
          <div style="color:var(--text-mid); font-weight:500;">
            Current Stage: <strong>${getLiveProgressStatus(p)}</strong>
          </div>
        </div>

        <div class="proj-card-actions">
          <button type="button" class="btn btn-outline btn-sm" style="flex:1" onclick="openProject(${p.id})">Open Project</button>
          ${hasAdminAccess() ? `<button type="button" class="btn btn-danger btn-sm" onclick="deleteProject(${p.id}, event)"><i data-lucide="trash-2"></i> Delete</button>` : ''}
        </div>
      </div>
    </div>`).join('');
  if (filteredProjs.length > visibleProjects.length) {
    grid.insertAdjacentHTML('beforeend', `
      <div class="projects-load-more">
        <button type="button" class="btn btn-outline" onclick="showMoreProjects()">Show ${Math.min(60, filteredProjs.length - visibleProjects.length)} more projects</button>
      </div>`);
  }
  renderDistrictLegends();
  if (typeof refreshDistrictBadgesInDOM === 'function') refreshDistrictBadgesInDOM();
  if (typeof updateRolePermissionUI === 'function') updateRolePermissionUI();
  initLucide();
}

async function openProject(id) {
  S.activeProject = S.projects.find(p=>p.id===id);
  if (!S.activeProject) return;
  
  try {
    const projData = await apiFetch(`/projects/${id}`);
    if (projData.projectState) {
      const stateSnapshot = JSON.parse(projData.projectState);
      if (stateSnapshot.frontMatter) S.frontMatter = stateSnapshot.frontMatter;
      if (stateSnapshot.chapters) S.chapters = stateSnapshot.chapters;
      if (stateSnapshot.plates) S.plates = stateSnapshot.plates;
      if (stateSnapshot.graphs) S.graphs = stateSnapshot.graphs;
      if (stateSnapshot.graphCharts) S.graphCharts = stateSnapshot.graphCharts;
      if (stateSnapshot.signatures) S.signatures = stateSnapshot.signatures;
      if (stateSnapshot.demandDistricts) S.demandDistricts = stateSnapshot.demandDistricts;
      if (stateSnapshot.summarySources) S.summarySources = stateSnapshot.summarySources;
      if (stateSnapshot.auctionData) S.auctionData = stateSnapshot.auctionData;
      if (stateSnapshot.uploadedPDFs) S.uploadedPDFs = stateSnapshot.uploadedPDFs;
      if (stateSnapshot.chapterPDFs) S.chapterPDFs = stateSnapshot.chapterPDFs;
      S.annexureB = stateSnapshot.annexureB || [];
      S.annexureC = stateSnapshot.annexureC || [];
      S.annexureD = stateSnapshot.annexureD || [];
      S.annexureE = stateSnapshot.annexureE || [];
      S.annexureG = stateSnapshot.annexureG || [];
      S.annexureH = stateSnapshot.annexureH || [];
      S.annexureI = stateSnapshot.annexureI || [];
      S.annexureJ = stateSnapshot.annexureJ || [];
      if (stateSnapshot.sdlcData) S.sdlcData = stateSnapshot.sdlcData;
      else S.sdlcData = null;
      if (stateSnapshot.anx6PdfName) {
        S.activeProject.anx6PdfName = stateSnapshot.anx6PdfName;
        const index = S.projects.findIndex(p => p.id === S.activeProject.id);
        if (index >= 0) S.projects[index].anx6PdfName = stateSnapshot.anx6PdfName;
      }
      if (stateSnapshot.anx7PdfName) {
        S.activeProject.anx7PdfName = stateSnapshot.anx7PdfName;
        const index = S.projects.findIndex(p => p.id === S.activeProject.id);
        if (index >= 0) S.projects[index].anx7PdfName = stateSnapshot.anx7PdfName;
      }
    }
  } catch (err) {
    console.error('Could not load project state:', err);
  }

  ['report-nav','annexure-nav','tables-nav','finalize-nav'].forEach(n=>{
    const el=document.getElementById(n); if(el) el.style.display='block';
  });
  const dist = S.activeProject.district;
  
  // Update active district highlights globally
  updateActiveDistrictUI(dist);
  if (typeof updateActiveProjectCardUI === 'function') updateActiveProjectCardUI();
  
  // Filter context to active district
  filterDashboardByDistrict(dist);
  
  const fmDistEl = document.getElementById('fm-district');
  if (fmDistEl) fmDistEl.value=dist;
  
  // Fetch reviewer history and populate floating notes if any
  if (typeof checkReviewStatus === 'function') {
      checkReviewStatus(id);
  }
  
  // Open the project navigation automatically after selecting a project.
  if (typeof isSidebarPinned !== 'undefined') {
    isSidebarPinned = true;
    document.body.classList.remove('sidebar-hidden');
  }
  if (typeof updateSidebarToggleVisibility === 'function') {
    updateSidebarToggleVisibility();
  }

  const firstAllowedView = typeof getFirstAllowedProjectView === 'function'
    ? getFirstAllowedProjectView()
    : (typeof getFirstAllowedView === 'function' ? getFirstAllowedView() : 'projects');
  showView(firstAllowedView, null);
  toast('Opened: '+dist+' DSR Project','info');
}

function newProjectModal() { 
  if (typeof hasAdminAccess === 'function' && !hasAdminAccess()) {
    toast('Permission Denied: Only Administrators can create new projects.', 'error');
    alert('Permission Denied: Only Administrators can create new projects.');
    return;
  }
  const el = document.getElementById('modal-project');
  if (el) el.classList.add('open'); 
}

async function persistProjectState() {
  if (!S.activeProject || !S.activeProject.id) return;
  
  // Disable auto-save for users who only have view/comment permissions
  if (!hasWriteAccess()) return;

  // Create a snapshot of the current state for this project
  const stateSnapshot = {
    frontMatter: S.frontMatter,
    chapters: S.chapters,
    plates: S.plates,
    graphs: S.graphs,
    graphCharts: S.graphCharts,
    signatures: S.signatures,
    demandDistricts: S.demandDistricts,
    summarySources: S.summarySources,
    auctionData: S.auctionData,
    uploadedPDFs: S.uploadedPDFs,
    chapterPDFs: S.chapterPDFs,
    annexureB: S.annexureB,
    annexureC: S.annexureC,
    annexureD: S.annexureD,
    annexureE: S.annexureE,
    annexureG: S.annexureG,
    annexureH: S.annexureH,
    annexureI: S.annexureI,
    annexureJ: S.annexureJ,
    anx6PdfName: S.activeProject.anx6PdfName,
    anx7PdfName: S.activeProject.anx7PdfName,
    sdlcData: S.sdlcData
  };
  
  try {
    await apiFetch(`/projects/${S.activeProject.id}/state`, {
      method: 'PUT',
      body: JSON.stringify({ state: JSON.stringify(stateSnapshot) })
    });
  } catch (err) {
    console.error('Failed to persist project state:', err);
  }
}

async function createProject() {
  const title = document.getElementById('proj-title').value || `District Survey Report — ${document.getElementById('proj-district').value}`;
  
  const payload = {
    projectName: title,
    district: document.getElementById('proj-district').value,
    status: 'ACTIVE'
  };

  try {
    // 1. Create project in backend
    const createdProject = await apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    // 2. Format it for the frontend
    const proj = {
      id: createdProject.id, 
      title: createdProject.projectName,
      district: createdProject.district,
      year: document.getElementById('proj-year').value,
      mineral: document.getElementById('proj-mineral').value,
      rivers: document.getElementById('proj-rivers').value || 'Not specified',
      progress: 0, 
      status: 'In Progress', 
      createdAt: new Date().toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 
      signatures: 0
    };
    
    S.projects.unshift(proj);
    closeModal('modal-project');
    
    document.getElementById('proj-title').value = '';
    document.getElementById('proj-rivers').value = '';
    
    renderProjects();
    renderDashboard();
    updateProjectBadgeCount();
    openProject(proj.id);
    toast('DSR Project created successfully!','success');
    
    // 3. Persist its initial state
    await persistProjectState();

  } catch (err) {
    toast('Failed to create project: ' + err.message, 'error');
  }
}

let saveStateTimeout = null;
function debouncedSaveState() {
  if (!S.activeProject || !S.activeProject.id) return;
  if (saveStateTimeout) clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(() => {
    persistProjectState();
  }, 1000);
}

// Global auto-save listener for any input changes on the form fields
document.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    debouncedSaveState();
  }
});
document.addEventListener('change', (e) => {
  debouncedSaveState();
});

function deleteProject(id, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (typeof hasAdminAccess === 'function' && !hasAdminAccess()) {
    toast('Permission Denied: Only Administrators can delete projects.', 'error');
    return;
  }
  const proj = S.projects.find(p => p.id === id);
  if (!proj) return;

  customConfirm(
    `Permanently delete "${proj.title}" (${proj.district} District)? This action cannot be undone.`,
    async () => {
      try {
        toast("Deleting project from server...", "info");
        await apiFetch(`/projects/${id}`, {
          method: 'DELETE'
        });

        const wasActive = S.activeProject && S.activeProject.id === id;
        S.projects = S.projects.filter(p => p.id !== id);

        if (wasActive) {
          clearActiveProject();
        }

        renderProjects();
        renderDashboard();
        updateProjectBadgeCount();
        renderDistrictLegends();
        toast("Project deleted successfully!", "success");
      } catch (err) {
        toast("Failed to delete project: " + err.message, "error");
      }
    }
  );
}
