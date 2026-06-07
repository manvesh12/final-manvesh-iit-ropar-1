package com.iitropar.dsr.controller;
import com.iitropar.dsr.entity.Project;
import com.iitropar.dsr.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    @Autowired ProjectService service;
    @Autowired com.iitropar.dsr.service.ReportService reportService;

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Project p) {
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Long actorId = null;
        if (principal instanceof com.iitropar.dsr.security.UserDetailsImpl) {
            actorId = ((com.iitropar.dsr.security.UserDetailsImpl) principal).getId();
            p.setCreatedBy(actorId);
        }
        Project created = service.createProject(p);
        
        reportService.recordWorkflowHistory(
            created.getId(),
            "PROJECT_CREATED",
            "Project '" + created.getProjectName() + "' created and started phase 'Initial Project Setup'",
            actorId != null ? actorId : 1L
        );
        
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PutMapping("/{id}/state")
    public ResponseEntity<?> updateState(@PathVariable Long id, @RequestBody java.util.Map<String, String> payload) {
        String state = payload.get("state");
        return ResponseEntity.ok(service.updateProjectState(id, state));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable Long id) {
        service.deleteProject(id);
        return ResponseEntity.ok(java.util.Map.of("message", "Project deleted successfully"));
    }
}
