package com.iitropar.dsr.service;

import com.iitropar.dsr.entity.Project;
import com.iitropar.dsr.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Iterator;
import java.util.List;

@Service
public class ProjectService {
    @Autowired private ProjectRepository repository;
    @Autowired private ReportService reportService;

    public Project createProject(Project p) { return repository.save(p); }
    public List<Project> getAll() { return repository.findAll(); }
    public List<Project> getAllForUser(Long userId) { return repository.findByCreatedBy(userId); }
    public Project getById(Long id) { return repository.findById(id).orElseThrow(); }

    public Project updateProjectState(Long id, String state) {
        Project p = getById(id);
        String oldState = p.getProjectState();
        
        int oldProgress = calculateProgress(oldState);
        int newProgress = calculateProgress(state);
        
        String oldPhase = getPhaseName(oldProgress);
        String newPhase = getPhaseName(newProgress);
        
        p.setProjectState(state);
        Project saved = repository.save(p);
        
        Long actorId = getCurrentUserId();
        if (actorId == null) actorId = p.getCreatedBy() != null ? p.getCreatedBy() : 1L;
        
        // Audit phase transition
        if (!oldPhase.equals(newPhase)) {
            reportService.recordWorkflowHistory(
                p.getId(),
                "PROJECT_PHASE_CHANGED",
                "Project phase transitioned from '" + oldPhase + "' to '" + newPhase + "' (" + newProgress + "% progress)",
                actorId
            );
        }
        
        // Audit uploads
        auditDocumentUploads(p.getId(), oldState, state, actorId);
        
        return saved;
    }

    private Long getCurrentUserId() {
        try {
            Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            if (principal instanceof com.iitropar.dsr.security.UserDetailsImpl) {
                return ((com.iitropar.dsr.security.UserDetailsImpl) principal).getId();
            }
        } catch (Exception e) {}
        return null;
    }

    private String getPhaseName(int progress) {
        if (progress >= 100) return "Pending Authority E-Signatures";
        if (progress > 80) return "Finalizing Annexures & Tables";
        if (progress > 40) return "Uploading Chapters & Plates";
        return "Initial Project Setup";
    }

    private int calculateProgress(String stateJson) {
        if (stateJson == null || stateJson.trim().isEmpty()) {
            return 0;
        }
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(stateJson);
            
            int totalWeight = 0;
            int filledWeight = 0;
            
            // 1. Front Matter (weight 15)
            totalWeight += 15;
            if (root.has("frontMatter")) {
                JsonNode fm = root.get("frontMatter");
                int fmFields = 0;
                int fmFilled = 0;
                Iterator<String> fieldNames = fm.fieldNames();
                while (fieldNames.hasNext()) {
                    fmFields++;
                    String val = fm.get(fieldNames.next()).asText();
                    if (val != null && !val.trim().isEmpty()) {
                        fmFilled++;
                    }
                }
                if (fmFields > 0) {
                    filledWeight += (fmFilled * 15) / fmFields;
                }
            }
            
            // 2. Chapters (weight 25)
            totalWeight += 25;
            if (root.has("chapters")) {
                JsonNode chapters = root.get("chapters");
                if (chapters.isArray() && chapters.size() > 0) {
                    int chapCount = chapters.size();
                    int uploadedChaps = 0;
                    if (root.has("chapterPDFs")) {
                        JsonNode chapPdfs = root.get("chapterPDFs");
                        for (JsonNode chap : chapters) {
                            if (chap.has("id")) {
                                String chapId = chap.get("id").asText();
                                if (chapPdfs.has(chapId) && chapPdfs.get(chapId).isArray() && chapPdfs.get(chapId).size() > 0) {
                                    uploadedChaps++;
                                }
                            }
                        }
                    }
                    filledWeight += (uploadedChaps * 25) / chapCount;
                }
            }
            
            // 3. Plates (weight 15)
            totalWeight += 15;
            if (root.has("plates")) {
                JsonNode plates = root.get("plates");
                if (plates.isArray() && plates.size() > 0) {
                    int plateCount = plates.size();
                    int uploadedPlates = 0;
                    for (JsonNode plate : plates) {
                        if (plate.has("pages") && plate.get("pages").isArray() && plate.get("pages").size() > 0) {
                            uploadedPlates++;
                        }
                    }
                    filledWeight += (uploadedPlates * 15) / plateCount;
                }
            }
            
            // 4. Tables / Annexures (weight 35)
            totalWeight += 35;
            int uploadCount = 0;
            if (root.has("uploadedPDFs")) {
                JsonNode uploaded = root.get("uploadedPDFs");
                String[] keys = {"cover", "cert", "toc", "pref", "anx1", "anx2", "anx3", "anx4", "anx5", "anx6", "anx7"};
                for (String key : keys) {
                    if (uploaded.has(key) && uploaded.get(key).isArray() && uploaded.get(key).size() > 0) {
                        uploadCount++;
                    }
                }
            }
            filledWeight += (uploadCount * 35) / 11;
            
            // 5. Signatures (weight 10)
            totalWeight += 10;
            if (root.has("signatures")) {
                JsonNode signatures = root.get("signatures");
                if (signatures.isArray() && signatures.size() > 0) {
                    int sigCount = signatures.size();
                    int signedCount = 0;
                    for (JsonNode sig : signatures) {
                        if (sig.has("signed") && sig.get("signed").asBoolean()) {
                            signedCount++;
                        }
                    }
                    filledWeight += (signedCount * 10) / sigCount;
                }
            }
            
            if (totalWeight == 0) return 0;
            return (filledWeight * 100) / totalWeight;
        } catch (Exception e) {
            return 0;
        }
    }

    private void auditDocumentUploads(Long projectId, String oldState, String newState, Long actorId) {
        if (newState == null || newState.trim().isEmpty()) return;
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode newRoot = mapper.readTree(newState);
            JsonNode oldRoot = (oldState != null && !oldState.trim().isEmpty()) ? mapper.readTree(oldState) : null;
            
            // 1. Audit uploadedPDFs (cover, cert, toc, pref, anx1-anx7)
            if (newRoot.has("uploadedPDFs")) {
                JsonNode newUploaded = newRoot.get("uploadedPDFs");
                JsonNode oldUploaded = (oldRoot != null && oldRoot.has("uploadedPDFs")) ? oldRoot.get("uploadedPDFs") : null;
                
                String[] keys = {"cover", "cert", "toc", "pref", "anx1", "anx2", "anx3", "anx4", "anx5", "anx6", "anx7"};
                for (String key : keys) {
                    boolean hasNewPages = newUploaded.has(key) && newUploaded.get(key).isArray() && newUploaded.get(key).size() > 0;
                    boolean hadOldPages = oldUploaded != null && oldUploaded.has(key) && oldUploaded.get(key).isArray() && oldUploaded.get(key).size() > 0;
                    
                    if (hasNewPages && !hadOldPages) {
                        String friendlyName = key.startsWith("anx") ? "Annexure " + key.substring(3).toUpperCase() : key.substring(0, 1).toUpperCase() + key.substring(1);
                        reportService.recordWorkflowHistory(
                            projectId,
                            "DOCUMENT_UPLOADED",
                            "Uploaded document for " + friendlyName,
                            actorId
                        );
                    } else if (!hasNewPages && hadOldPages) {
                        String friendlyName = key.startsWith("anx") ? "Annexure " + key.substring(3).toUpperCase() : key.substring(0, 1).toUpperCase() + key.substring(1);
                        reportService.recordWorkflowHistory(
                            projectId,
                            "DOCUMENT_DELETED",
                            "Deleted document for " + friendlyName,
                            actorId
                        );
                    }
                }
            }
            
            // 2. Audit chapters uploads
            if (newRoot.has("chapters")) {
                JsonNode newChapters = newRoot.get("chapters");
                JsonNode oldChapters = (oldRoot != null && oldRoot.has("chapters")) ? oldRoot.get("chapters") : null;
                
                if (newChapters.isArray()) {
                    for (JsonNode newCh : newChapters) {
                        if (newCh.has("id") && newCh.has("fileName") && !newCh.get("fileName").isNull()) {
                            String chId = newCh.get("id").asText();
                            String newFileName = newCh.get("fileName").asText();
                            
                            boolean isNewUpload = true;
                            if (oldChapters != null && oldChapters.isArray()) {
                                for (JsonNode oldCh : oldChapters) {
                                    if (oldCh.has("id") && oldCh.get("id").asText().equals(chId)) {
                                        if (oldCh.has("fileName") && !oldCh.get("fileName").isNull()) {
                                            if (oldCh.get("fileName").asText().equals(newFileName)) {
                                                isNewUpload = false;
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                            if (isNewUpload && !newFileName.trim().isEmpty()) {
                                String chName = newCh.has("name") ? newCh.get("name").asText() : "Unknown Chapter";
                                reportService.recordWorkflowHistory(
                                    projectId,
                                    "DOCUMENT_UPLOADED",
                                    "Uploaded chapter document '" + newFileName + "' for Chapter '" + chName + "'",
                                    actorId
                                );
                            }
                        }
                    }
                }
            }
            
            // 3. Audit plates uploads
            if (newRoot.has("plates")) {
                JsonNode newPlates = newRoot.get("plates");
                JsonNode oldPlates = (oldRoot != null && oldRoot.has("plates")) ? oldRoot.get("plates") : null;
                
                if (newPlates.isArray()) {
                    for (JsonNode newPl : newPlates) {
                        if (newPl.has("id") && newPl.has("fileName") && !newPl.get("fileName").isNull()) {
                            String plId = newPl.get("id").asText();
                            String newFileName = newPl.get("fileName").asText();
                            
                            boolean isNewUpload = true;
                            if (oldPlates != null && oldPlates.isArray()) {
                                for (JsonNode oldPl : oldPlates) {
                                    if (oldPl.has("id") && oldPl.get("id").asText().equals(plId)) {
                                        if (oldPl.has("fileName") && !oldPl.get("fileName").isNull()) {
                                            if (oldPl.get("fileName").asText().equals(newFileName)) {
                                                isNewUpload = false;
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                            if (isNewUpload && !newFileName.trim().isEmpty()) {
                                String plName = newPl.has("name") ? newPl.get("name").asText() : "Unknown Plate";
                                reportService.recordWorkflowHistory(
                                    projectId,
                                    "DOCUMENT_UPLOADED",
                                    "Uploaded plate document '" + newFileName + "' for Plate '" + plName + "'",
                                    actorId
                                );
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Ignore exceptions in auditor
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteProject(Long id) {
        repository.deleteWorkflowHistoryByProjectId(id);
        repository.deleteReportsByProjectId(id);
        repository.deleteCommentsByProjectId(id);
        repository.deleteDSRFilesByProjectId(id);
        repository.deleteSectionsByProjectId(id);
        repository.deleteApprovalsByProjectId(id);
        repository.deleteById(id);
    }
}
