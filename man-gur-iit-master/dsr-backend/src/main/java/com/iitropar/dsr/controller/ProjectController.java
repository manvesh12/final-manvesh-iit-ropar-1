package com.iitropar.dsr.controller;
import com.iitropar.dsr.entity.Project;
import com.iitropar.dsr.entity.User;
import com.iitropar.dsr.repository.UserRepository;
import com.iitropar.dsr.service.PermissionService;
import com.iitropar.dsr.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    @Autowired ProjectService service;
    @Autowired com.iitropar.dsr.service.ReportService reportService;
    @Autowired UserRepository userRepository;
    @Autowired PermissionService permissionService;

    private User getCurrentUser() {
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.iitropar.dsr.security.UserDetailsImpl details) {
            return userRepository.findById(details.getId()).orElseThrow(() -> new RuntimeException("User not found"));
        }
        throw new RuntimeException("User not authenticated");
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Project p) {
        User actor = getCurrentUser();
        permissionService.requireManageProjects(actor);
        Long actorId = actor.getId();
        p.setCreatedBy(actorId);
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
        User actor = getCurrentUser();
        return ResponseEntity.ok(service.getAllVisibleTo(actor));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        User actor = getCurrentUser();
        Project project = service.getById(id);
        permissionService.requireProjectAccess(actor, project);
        return ResponseEntity.ok(project);
    }

    @PutMapping("/{id}/state")
    public ResponseEntity<?> updateState(@PathVariable Long id, @RequestBody java.util.Map<String, String> payload) {
        User actor = getCurrentUser();
        Project project = service.getById(id);
        if (!permissionService.canUpdateProjectState(actor, project)) {
            throw new org.springframework.security.access.AccessDeniedException("Update access denied for this project");
        }
        String state = payload.get("state");
        return ResponseEntity.ok(service.updateProjectState(id, state));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable Long id) {
        User actor = getCurrentUser();
        permissionService.requireManageProjects(actor);
        service.deleteProject(id);
        return ResponseEntity.ok(java.util.Map.of("message", "Project deleted successfully"));
    }
}
