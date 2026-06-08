const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8081;

// Start build.js in watch mode for local development. Disable it for public tunnel demos.
let watcher = null;
if (process.env.DSR_NO_WATCH !== '1') {
  console.log('Starting compilation watcher...');
  watcher = spawn('node', ['build.js', '--watch'], { stdio: 'inherit' });

  watcher.on('error', (err) => {
    console.error('Failed to start build watcher:', err);
  });
} else {
  console.log('Compilation watcher disabled for stable tunnel serving.');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const workflowHistory = {};

function cacheHeaderFor(ext) {
  if (ext === '.html') return 'public, max-age=60';
  if (['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

function normalizeProject(project = {}) {
  const id = project.id || Date.now();
  const title = project.title || project.projectName || `District Survey Report - ${project.district || 'Punjab'}`;
  return {
    ...project,
    id,
    title,
    projectName: project.projectName || title,
    district: project.district || 'Punjab',
    year: project.year || '2025-26',
    mineral: project.mineral || 'Sand',
    rivers: project.rivers || 'Not specified',
    progress: Number.isFinite(Number(project.progress)) ? Number(project.progress) : 0,
    status: project.status || 'In Progress',
    createdAt: project.createdAt || new Date().toISOString(),
    signatures: Number.isFinite(Number(project.signatures)) ? Number(project.signatures) : 0
  };
}

function getStatusForFrontend(status) {
  if (!status) return 'In Progress';
  const upper = String(status).toUpperCase();
  if (upper === 'ACTIVE' || upper === 'IN_PROGRESS') return 'In Progress';
  if (upper === 'COMPLETED') return 'Completed';
  return status;
}

function readProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
      if (Array.isArray(parsed)) return parsed.map(normalizeProject);
    }
  } catch (err) {
    console.error('Error reading projects.json:', err);
  }
  return [];
}

function writeProjects(projects) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects.map(normalizeProject), null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing projects.json:', err);
    return false;
  }
}

function deleteProjectUploads(projectId) {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  try {
    fs.readdirSync(UPLOADS_DIR)
      .filter(file => file === `${projectId}.pdf` || file.startsWith(`${projectId}_`))
      .forEach(file => {
        try {
          fs.unlinkSync(path.join(UPLOADS_DIR, file));
        } catch (err) {
          console.warn(`Could not delete upload ${file}:`, err.message);
        }
      });
  } catch (err) {
    console.warn('Could not clean uploads for deleted project:', err.message);
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { resolve(body); });
    req.on('error', (err) => { reject(err); });
  });
}

function deleteFileWithRetries(filePath, retries = 5, delay = 100) {
  return new Promise((resolve) => {
    function attempt(n) {
      if (!fs.existsSync(filePath)) {
        resolve(true);
        return;
      }
      try {
        fs.unlinkSync(filePath);
        console.log(`Successfully deleted file: ${filePath}`);
        resolve(true);
      } catch (err) {
        if (n > 0) {
          console.warn(`File ${filePath} locked, retrying deletion in ${delay}ms... (attempts left: ${n})`);
          setTimeout(() => attempt(n - 1), delay);
        } else {
          console.error(`Failed to delete file ${filePath} after multiple attempts:`, err);
          resolve(false);
        }
      }
    }
    attempt(retries);
  });
}

const server = http.createServer((req, res) => {
  const urlObj = req.url.split('?');
  const pathname = decodeURIComponent(urlObj[0]);
  const queryParams = new URLSearchParams(urlObj[1] || '');

  // 1. Handle API routes
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/dashboard/stats' && req.method === 'GET') {
      const projects = readProjects();
      const completed = projects.filter(p => getStatusForFrontend(p.status) === 'Completed' || p.progress === 100).length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        totalProjects: projects.length,
        completedReports: completed,
        pendingReports: Math.max(projects.length - completed, 0)
      }));
      return;
    }

    if (pathname === '/api/reports' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    if (pathname === '/api/reports/audit-logs' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    const reportHistoryMatch = pathname.match(/^\/api\/reports\/([^/]+)\/history$/);
    if (reportHistoryMatch && req.method === 'GET') {
      const reportId = reportHistoryMatch[1];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(workflowHistory[reportId] || []));
      return;
    }

    const reportWorkflowMatch = pathname.match(/^\/api\/reports\/([^/]+)\/workflow$/);
    if (reportWorkflowMatch && req.method === 'POST') {
      readRequestBody(req).then(body => {
        try {
          const reportId = reportWorkflowMatch[1];
          const payload = JSON.parse(body || '{}');
          const entry = {
            projectId: Number(reportId) || reportId,
            action: payload.action || 'SUBMIT',
            remarks: payload.remarks || '',
            performedBy: 'local-demo-user',
            performedAt: new Date().toISOString()
          };
          workflowHistory[reportId] = [entry, ...(workflowHistory[reportId] || [])];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(entry));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      readRequestBody(req).then(body => {
        try {
          const { username, password } = JSON.parse(body || '{}');
          if (!username || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Username and password are required' }));
            return;
          }

          const email = String(username || '').toLowerCase();
          let role = 'ROLE_OFFICER';
          if (email.includes('admin')) role = 'ROLE_ADMIN';
          else if (email.includes('iit')) role = 'ROLE_IIT_ROPAR';
          else if (email.includes('sdo')) role = 'ROLE_SDO';
          else if (email.includes('sdlc')) role = 'ROLE_SDLC';
          else if (email.includes('gis')) role = 'ROLE_GIS';
          else if (email.includes('je')) role = 'ROLE_JE';
          else if (email.includes('axen')) role = 'ROLE_AXEN';
          else if (email.includes('reviewer')) role = 'ROLE_REVIEWER';

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            token: 'local-demo-token',
            username,
            email: username,
            fullName: username.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            role,
            permissions: role === 'ROLE_ADMIN' ? ['UPLOAD', 'REVIEW', 'ADMIN'] : [],
            scope: {},
            accessLabel: role.replace('ROLE_', '').replace(/_/g, ' ')
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      readRequestBody(req).then(body => {
        try {
          const { username, email, fullName } = JSON.parse(body || '{}');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            username: username || email,
            fullName: fullName || username || email
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    if (pathname === '/api/projects') {
      if (req.method === 'GET') {
        const projects = readProjects();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(projects));
        return;
      } else if (req.method === 'POST') {
        readRequestBody(req).then(body => {
          try {
            const payload = JSON.parse(body || '{}');
            if (Array.isArray(payload)) {
              writeProjects(payload);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
              return;
            }

            const projects = readProjects();
            const createdProject = normalizeProject({
              id: Date.now(),
              title: payload.title || payload.projectName,
              projectName: payload.projectName || payload.title,
              district: payload.district,
              year: payload.year,
              mineral: payload.mineral,
              rivers: payload.rivers,
              progress: 0,
              status: getStatusForFrontend(payload.status),
              createdAt: new Date().toISOString(),
              signatures: 0,
              projectState: payload.projectState || null
            });
            projects.unshift(createdProject);
            writeProjects(projects);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(createdProject));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
          }
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
        return;
      }
    }

    const projectStateMatch = pathname.match(/^\/api\/projects\/([^/]+)\/state$/);
    if (projectStateMatch && req.method === 'PUT') {
      readRequestBody(req).then(body => {
        try {
          const projectId = projectStateMatch[1];
          const payload = JSON.parse(body || '{}');
          const projects = readProjects();
          const projectIndex = projects.findIndex(p => String(p.id) === String(projectId));
          if (projectIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Project not found' }));
            return;
          }

          projects[projectIndex].projectState = payload.state || null;
          writeProjects(projects);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      });
      return;
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      if (req.method === 'GET') {
        const project = readProjects().find(p => String(p.id) === String(projectId));
        if (!project) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(project));
        return;
      }

      if (req.method === 'DELETE') {
        const projects = readProjects();
        const remaining = projects.filter(p => String(p.id) !== String(projectId));
        if (remaining.length === projects.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project not found' }));
          return;
        }
        writeProjects(remaining);
        deleteProjectUploads(projectId);
        delete workflowHistory[projectId];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
    }

    if (pathname === '/api/upload-pdf' && req.method === 'POST') {
      readRequestBody(req).then(async body => {
        try {
          const { projectId, fileName, pdf, annexureId = 'anx3' } = JSON.parse(body);
          if (!projectId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing projectId' }));
            return;
          }

          if (fileName === null || pdf === null) {
            // Delete PDF file if exists
            const destPath = path.join(UPLOADS_DIR, `${projectId}_${annexureId}.pdf`);
            await deleteFileWithRetries(destPath);
            
            if (annexureId === 'anx3') {
              const legacyPath = path.join(UPLOADS_DIR, `${projectId}.pdf`);
              await deleteFileWithRetries(legacyPath);
            }
            // Update projects.json to clear PDF metadata
            const projects = readProjects();
            const pIdx = projects.findIndex(p => p.id == projectId);
            if (pIdx !== -1) {
              const fieldName = annexureId === 'anx3' ? 'annexure3PdfName' : `${annexureId}PdfName`;
              delete projects[pIdx][fieldName];
              if (annexureId === 'anx3') {
                delete projects[pIdx]['anx3PdfName'];
              }
              writeProjects(projects);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
          }

          if (!fileName || !pdf) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
            return;
          }

          // Ensure uploads directory exists
          if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          }

          const fileBuffer = Buffer.from(pdf, 'base64');
          const destPath = path.join(UPLOADS_DIR, `${projectId}_${annexureId}.pdf`);
          fs.writeFileSync(destPath, fileBuffer);

          // Update projects.json
          const projects = readProjects();
          const pIdx = projects.findIndex(p => p.id == projectId);
          if (pIdx !== -1) {
            const fieldName = annexureId === 'anx3' ? 'annexure3PdfName' : `${annexureId}PdfName`;
            projects[pIdx][fieldName] = fileName;
            writeProjects(projects);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      });
      return;
    }

    if (pathname === '/api/download-pdf' && req.method === 'GET') {
      const projectId = queryParams.get('projectId');
      const annexureId = queryParams.get('annexureId') || 'anx3';
      const inline = queryParams.get('inline') === 'true';

      if (!projectId) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing projectId');
        return;
      }

      let filePath = path.join(UPLOADS_DIR, `${projectId}_${annexureId}.pdf`);

      // Fallback for old anx3 uploads that were saved as projectId.pdf
      if (annexureId === 'anx3' && !fs.existsSync(filePath)) {
        const oldFilePath = path.join(UPLOADS_DIR, `${projectId}.pdf`);
        if (fs.existsSync(oldFilePath)) {
          filePath = oldFilePath;
        }
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('PDF not found');
        return;
      }

      // Try to find the original filename from projects
      const projects = readProjects();
      const proj = projects.find(p => p.id == projectId);
      const fieldName = annexureId === 'anx3' ? 'annexure3PdfName' : `${annexureId}PdfName`;
      const originalName = proj ? (proj[fieldName] || proj['anx3PdfName'] || `${annexureId}.pdf`) : `${projectId}.pdf`;

      const headers = {
        'Content-Type': 'application/pdf'
      };

      if (inline) {
        headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(originalName)}"`;
      } else {
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(originalName)}"`;
      }

      res.writeHead(200, headers);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
    return;
  }

  // 2. Handle static files
  let filePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const fullPath = path.join(__dirname, filePath);

  // Basic security check to prevent directory traversal
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheHeaderFor(ext)
    });
    
    const stream = fs.createReadStream(fullPath);
    stream.on('error', (streamErr) => {
      console.error(`Error reading file ${fullPath}:`, streamErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('\n==================================================');
  console.log(`🚀 Smart DSR Portal is running at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log('==================================================\n');
});

// Ensure compiler child process is killed when the server shuts down
process.on('SIGINT', () => {
  watcher.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  watcher.kill();
  process.exit();
});
