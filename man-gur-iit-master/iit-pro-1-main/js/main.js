/* ══════════════════════════════════════
   ENTRY POINT / BOOTSTRAP
══════════════════════════════════════ */
let currentFontScale = 100;
window.changeFontSize = function(delta) {
  if (delta === 0) {
    currentFontScale = 100;
  } else {
    currentFontScale = Math.min(120, Math.max(85, currentFontScale + delta * 5));
  }
  document.documentElement.style.fontSize = `${(currentFontScale / 100) * 15}px`;
};

window.addEventListener('DOMContentLoaded',()=>{
  if (typeof repairMainContentStructure === 'function') {
    repairMainContentStructure();
    setTimeout(repairMainContentStructure, 0);
  }
  // Initialize workflow checklist listener when section is clicked
  const workflowView = document.getElementById('view-workflow');
  if (workflowView) {
    workflowView.addEventListener('click', renderWorkflowChecklist, {once:true});
  }
  
  // Clean up overlays and other elements on load
  console.log("DSR Portal initialized successfully.");
  if (window.initLucide) initLucide();

  // Global listener to default empty cells to 'NUL' on blur/focusout
  document.body.addEventListener('focusout', function(e) {
    if (e.target.tagName === 'TD' && (e.target.contentEditable === 'true' || e.target.hasAttribute('contenteditable'))) {
      const text = e.target.innerText.trim();
      if (text === '') {
        e.target.innerText = 'NUL';
        // Dispatch input event to trigger any calculation bindings attached
        const inputEvent = new Event('input', { bubbles: true });
        e.target.dispatchEvent(inputEvent);
      }
    }
  });
});

function enforceReviewerReadOnly() {
    if (typeof enforceActiveViewHierarchy === 'function') {
        enforceActiveViewHierarchy();
    }
}

window.reviewerNotes = {};
window.reviewerNotesMinimized = localStorage.getItem('reviewerNotesMinimized') !== '0';

function applyReviewerNotesMinimizedState() {
    const box = document.getElementById('reviewer-floating-notes');
    const btn = document.getElementById('reviewer-notes-minimize-btn');
    if (!box) return;

    box.classList.toggle('is-minimized', !!window.reviewerNotesMinimized);
    if (btn) {
        btn.title = window.reviewerNotesMinimized ? 'Expand reviewer notes' : 'Minimize reviewer notes';
        btn.setAttribute('aria-label', btn.title);
        btn.innerHTML = window.reviewerNotesMinimized
            ? '<i data-lucide="maximize-2" style="width:14px; height:14px;"></i>'
            : '<i data-lucide="minus" style="width:14px; height:14px;"></i>';
    }
    if (window.initLucide) initLucide();
}

function toggleReviewerNotesMinimized() {
    window.reviewerNotesMinimized = !window.reviewerNotesMinimized;
    localStorage.setItem('reviewerNotesMinimized', window.reviewerNotesMinimized ? '1' : '0');
    applyReviewerNotesMinimizedState();
}
window.toggleReviewerNotesMinimized = toggleReviewerNotesMinimized;

function loadReviewerNoteForView(viewId, viewTitle) {
    const notesBox = document.getElementById('reviewer-floating-notes');
    if (typeof S === 'undefined' || !hasReviewAccess() || !S.activeProject) {
        if (notesBox) notesBox.style.display = 'none';
        return;
    }
    // Only show for content views
    if (['dashboard', 'workflow', 'users', 'history'].includes(viewId)) {
        if (notesBox) notesBox.style.display = 'none';
        return;
    }
    if (notesBox) notesBox.style.display = 'flex';
    applyReviewerNotesMinimizedState();
    document.getElementById('reviewer-notes-section-title').textContent = viewTitle || viewId;
    document.getElementById('reviewer-section-note').value = window.reviewerNotes[viewId] || '';
    document.getElementById('reviewer-section-note').dataset.viewId = viewId;
    
    if (window.lucide) window.lucide.createIcons();
}

function saveReviewerNote() {
    const el = document.getElementById('reviewer-section-note');
    const viewId = el.dataset.viewId;
    if (viewId) {
        window.reviewerNotes[viewId] = el.value;
    }
}

function openReviewModal() {
    // Auto-populate from reviewerNotes
    let aggregated = '';
    for (let [viewId, note] of Object.entries(window.reviewerNotes)) {
        if (note.trim()) {
            aggregated += `[${viewId.toUpperCase()}]\n${note.trim()}\n\n`;
        }
    }
    document.getElementById('review-aggregated-notes').value = aggregated.trim();
    document.getElementById('modal-review').classList.add('open');
}

async function submitReviewReturn() {
    const comments = document.getElementById('review-aggregated-notes').value.trim();
    if (!comments) { toast('Please enter review comments', 'error'); return; }
    if (!S.activeProject) { toast('No active project', 'error'); return; }

    try {
        await apiSubmitWorkflowAction(S.activeProject.id, 'RETURN', comments);
        toast('Report returned to Data Entry', 'success');
        
        // Clear notes
        window.reviewerNotes = {};
        if (S.activeProject) {
            localStorage.removeItem(`reviewerNotes_${S.activeProject.id}`);
        }
        const noteArea = document.getElementById('reviewer-section-note');
        if (noteArea) noteArea.value = '';
        
        closeModal('modal-review');
        if (typeof renderProjects === 'function') renderProjects();
        showView('dashboard', null);
    } catch (e) {
        toast('Error returning report: ' + e.message, 'error');
    }
}

async function submitReviewApprove() {
    if (!S.activeProject) return;
    try {
        await apiSubmitWorkflowAction(S.activeProject.id, 'APPROVE', 'Section review approved');
        toast('Sections Approved!', 'success');
        if (typeof renderProjects === 'function') renderProjects();
        showView('dashboard', null);
    } catch (e) {
        toast('Error approving report: ' + e.message, 'error');
    }
}

// Automatically check history when dashboard loads or project opens
async function checkReviewStatus(projectId) {
    if (S.role !== 'user') return; // Only show alert to data entry
    try {
        const history = await apiFetchReportHistory(projectId);
        if (history && history.length > 0) {
            const latest = history[0];
            if (latest.action === 'RETURN') {
                const banner = document.getElementById('dash-review-banner');
                if (banner) {
                    banner.innerHTML = `
                        <div style="background:var(--amber-lt); border:1px solid var(--amber); border-radius:var(--r-md); padding:16px; display:flex; align-items:start; gap:12px;">
                            <i data-lucide="alert-circle" style="color:var(--amber); width:20px; height:20px; flex-shrink:0; margin-top:2px;"></i>
                            <div>
                                <div style="font-weight:700; color:var(--text); font-size:14px; margin-bottom:4px;">Report Returned for Review</div>
                                <div style="font-size:13px; color:var(--text-mid);">${latest.remarks || 'No comments provided.'}</div>
                            </div>
                        </div>
                    `;
                    banner.style.display = 'block';
                    if (window.initLucide) initLucide();
                }
                const notifDot = document.getElementById('tb-notif-dot');
                if (notifDot) notifDot.style.display = 'block';
                
                // Parse the aggregated remarks and populate reviewerNotes so DEO can see them in floating boxes!
                if (latest.remarks) {
                    window.reviewerNotes = {};
                    const sections = latest.remarks.split('[');
                    for (let sec of sections) {
                        if (!sec.trim()) continue;
                        const endIdx = sec.indexOf(']');
                        if (endIdx !== -1) {
                            const key = sec.substring(0, endIdx).toLowerCase().trim();
                            const val = sec.substring(endIdx + 1).trim();
                            if (val) window.reviewerNotes[key] = val;
                        }
                    }
                    if (window.renderReviewerNotes) renderReviewerNotes();
                }
            }
        }
    } catch (e) {
        console.error('Error fetching review status:', e);
    }
}

async function renderHistoryTable() {
    if (!S.activeProject) return;
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading history...</td></tr>';
    try {
        const history = await apiFetchReportHistory(S.activeProject.id);
        if (!history || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No history available</td></tr>';
            return;
        }
        
        let html = '';
        history.forEach(log => {
            const dateStr = new Date(log.performedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            let badgeCls = 'badge-gray';
            if (log.action === 'APPROVE') badgeCls = 'badge-green';
            if (log.action === 'RETURN' || log.action === 'REJECT') badgeCls = 'badge-amber';
            if (log.action === 'SUBMIT') badgeCls = 'badge-blue';
            if (log.action === 'WARNING_IGNORED' || log.action === 'WARNING_IGNORED_SAME_CONTENT') badgeCls = 'badge-red';
            
            html += `<tr>
                <td>${dateStr}</td>
                <td><span class="badge ${badgeCls}">${log.action}</span></td>
                <td>User ID: ${log.performedBy}</td>
                <td>${log.remarks || '-'}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">Failed to load history</td></tr>`;
    }
}



function toggleNotificationDropdown() {
  const dd = document.getElementById('tb-notif-dropdown');
  if (dd) {
    dd.classList.toggle('show');
  }
}

function updateNotificationUI(returnedReports) {
  const dot = document.getElementById('tb-notif-dot');
  const list = document.getElementById('tb-notif-list');
  if (!dot || !list) return;
  if (returnedReports && returnedReports.length > 0) {
    dot.style.display = 'block';
    let html = '';
    returnedReports.forEach(r => {
      html += `<div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="openProjectAndWorkflow(${r.projectId})">
        <div style="font-size: 13px; font-weight: 600; color: #b91c1c;">Project Returned</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Project ID: ${r.projectId} needs revision.</div>
      </div>`;
    });
    list.innerHTML = html;
  } else {
    dot.style.display = 'none';
    list.innerHTML = '<div style="padding: 8px; color: #666; font-size: 13px; text-align: center;">No new notifications</div>';
  }
}

function openProjectAndWorkflow(projectId) {
  toggleNotificationDropdown();
  const proj = S.projects.find(p => p.id === projectId);
  if (proj) {
    S.activeProject = proj;
    showView('workflow', null);
  }
}

async function syncNotificationsAndReviewStatus() {
  if (typeof S === 'undefined' || S.role !== 'user') return; // Only for DEO/Officer
  const banner = document.getElementById('dash-review-banner');
  const dot = document.getElementById('tb-notif-dot');
  const list = document.getElementById('tb-notif-list');
  
  if (banner) {
    banner.style.display = 'none';
    banner.innerHTML = '';
  }
  if (dot) dot.style.display = 'none';
  if (list) list.innerHTML = '<div style="padding: 8px; color: var(--text-soft); font-size: 13px; text-align: center;">No new notifications</div>';
  
  let bannerHtml = '';
  let notifHtml = '';
  let hasUnresolvedReturn = false;
  
  if (!S.projects) return;
  
  for (let p of S.projects) {
    try {
      const history = await apiFetchReportHistory(p.id);
      if (history && history.length > 0) {
        const latest = history[0];
        if (latest.action === 'RETURN' || latest.action === 'REJECT') {
          hasUnresolvedReturn = true;
          
          // Add to dashboard banner
          if (banner) {
            bannerHtml += `
              <div style="background:var(--amber-lt); border:1.5px solid var(--amber); border-radius:var(--r-md); padding:16px; margin-bottom:12px; display:flex; flex-direction:column; gap:10px; box-shadow: 0 4px 12px rgba(245,158,11,0.15);">
                <div style="display:flex; align-items:start; gap:12px;">
                  <i data-lucide="alert-circle" style="color:var(--amber); width:20px; height:20px; flex-shrink:0; margin-top:2px;"></i>
                  <div style="flex:1;">
                    <div style="font-weight:700; color:var(--text); font-size:14px; margin-bottom:2px;">
                      Project "${p.title}" (${p.district}) Returned for Revision
                    </div>
                    <div style="font-size:11px; color:var(--text-faint); margin-bottom:6px;">
                      Returned by Reviewer · ${new Date(latest.performedAt).toLocaleString()}
                    </div>
                    <div style="font-size:13px; color:var(--text-mid); background:var(--card); border: 1px solid var(--border-2); padding: 10px; border-radius: 6px; font-style: italic;">
                      ${latest.remarks || 'No comments provided.'}
                    </div>
                  </div>
                </div>
                
                <!-- Reply Section -->
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:4px; padding-left:32px;">
                  <textarea id="reply-text-${p.id}" placeholder="Type your reply to the reviewer here..." style="width:100%; min-height:60px; padding:10px; border-radius:6px; border:1px solid var(--border-2); background:var(--bg); color:var(--text); font-size:12.5px; resize:vertical; outline:none;" oninput="this.style.borderColor='var(--amber)'" onblur="this.style.borderColor='var(--border-2)'"></textarea>
                  <div style="display:flex; justify-content:flex-end;">
                    <button class="btn btn-navy btn-sm" onclick="submitDeoReply(${p.id})" style="padding: 6px 16px; font-size: 12px; background:var(--primary); font-weight:700; border-radius:6px;">Submit Reply & Remarks</button>
                  </div>
                </div>
              </div>
            `;
          }
          
          // Add to topbar dropdown list
          notifHtml += `
            <div style="padding: 10px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="openProjectAndWorkflow(${p.id})">
              <div style="font-size: 13px; font-weight: 600; color: #ef4444; display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%;"></span>
                Project Returned
              </div>
              <div style="font-size: 12px; color: var(--text); font-weight:500; margin-top: 4px;">Project "${p.title}" needs revision.</div>
              <div style="font-size: 11px; color: var(--text-soft); margin-top: 2px; font-style:italic; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">"${latest.remarks || ''}"</div>
            </div>
          `;
        }
      }
    } catch (e) {
      console.error('Error syncing project status:', p.id, e);
    }
  }
  
  if (hasUnresolvedReturn) {
    if (dot) dot.style.display = 'block';
    if (list && notifHtml) list.innerHTML = notifHtml;
    if (banner && bannerHtml) {
      banner.innerHTML = bannerHtml;
      banner.style.display = 'block';
      banner.style.border = 'none';
      banner.style.background = 'transparent';
      banner.style.padding = '0';
      if (window.initLucide) initLucide();
    }
  }
}

async function submitDeoReply(projectId) {
  const textEl = document.getElementById(`reply-text-${projectId}`);
  const remarks = textEl ? textEl.value.trim() : '';
  if (!remarks) { toast('Please enter a reply message', 'error'); return; }
  
  try {
    await apiFetch(`/reports/${projectId}/workflow`, {
      method: 'POST',
      body: JSON.stringify({ action: 'DEO_REPLY', remarks: remarks })
    });
    toast('Reply submitted successfully!', 'success');
    
    // Clear textarea
    if (textEl) textEl.value = '';
    
    // Refresh notifications and status
    await syncNotificationsAndReviewStatus();
    
    if (typeof renderProjects === 'function') renderProjects();
    if (typeof renderHistoryTable === 'function' && S.activeProject && S.activeProject.id === projectId) {
      renderHistoryTable();
    }
  } catch (e) {
    toast('Failed to send reply: ' + e.message, 'error');
  }
}

// Mouse movement live grid spotlight tracker for all subpages
window.addEventListener('mousemove', (e) => {
  document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
  document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
});

// Page transition exit handler with horizontal slide animation direction
document.addEventListener('DOMContentLoaded', () => {
  const transitionLinks = document.querySelectorAll('a[href$=".html"], a.nav-link-item, a.btn-premium-cta');
  transitionLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetUrl = this.getAttribute('href');
      if (targetUrl && !targetUrl.startsWith('#') && !targetUrl.startsWith('javascript:')) {
        e.preventDefault();
        // If transitioning back to home page, slide right (simulate going back)
        if (targetUrl.includes('index.html') || targetUrl === '/' || targetUrl === '') {
          document.body.classList.add('slide-to-right');
        } else {
          document.body.classList.add('slide-to-left');
        }
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 400);
      }
    });
  });
});
