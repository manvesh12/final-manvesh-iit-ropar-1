package com.iitropar.dsr.service;

import com.iitropar.dsr.entity.Project;
import com.iitropar.dsr.entity.Role;
import com.iitropar.dsr.entity.User;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class PermissionService {
    public static final String UPLOAD = "UPLOAD";
    public static final String REVIEW = "REVIEW";
    public static final String ADMIN = "ADMIN";
    public static final String MANAGE_USERS = "MANAGE_USERS";
    public static final String MANAGE_PROJECTS = "MANAGE_PROJECTS";

    private static final Set<Role> UPLOAD_ROLES = Set.of(
            Role.ADMIN, Role.IIT_ROPAR, Role.SDLC, Role.SDO, Role.JE, Role.AXEN, Role.GIS,
            Role.OFFICER, Role.DATA_ENTRY
    );

    private static final Set<Role> REVIEW_ROLES = Set.of(
            Role.ADMIN, Role.IIT_ROPAR, Role.GIS, Role.REVIEWER, Role.REVIEWER_1, Role.REVIEWER_2,
            Role.STATE_ADMIN, Role.DISTRICT_OWNER
    );

    public boolean canUpload(User user) {
        return user != null && user.isActive() && UPLOAD_ROLES.contains(user.getRole());
    }

    public boolean canReview(User user) {
        return user != null && user.isActive() && REVIEW_ROLES.contains(user.getRole());
    }

    public boolean canManageUsers(User user) {
        return user != null && user.isActive() && user.getRole() == Role.ADMIN;
    }

    public boolean canManageProjects(User user) {
        return user != null && user.isActive() && user.getRole() == Role.ADMIN;
    }

    public boolean canAccessProject(User user, Project project) {
        if (user == null || project == null || !user.isActive()) return false;
        return true;
    }

    public boolean canAccessProjectInAssignedScope(User user, Project project) {
        if (user == null || project == null || !user.isActive()) return false;
        Role role = user.getRole();
        if (role == Role.ADMIN || role == Role.IIT_ROPAR || role == Role.REVIEWER || role == Role.REVIEWER_1 || role == Role.REVIEWER_2 || role == Role.STATE_ADMIN) {
            return true;
        }
        String userDistrict = clean(user.getDistrict());
        String projectDistrict = clean(project.getDistrict());
        return userDistrict.isBlank() || projectDistrict.isBlank() || userDistrict.equalsIgnoreCase(projectDistrict);
    }

    public boolean canUpdateProjectState(User user, Project project) {
        return canUpload(user) && canAccessProjectInAssignedScope(user, project);
    }

    public boolean canUploadModule(User user, Project project, String module, Integer chapterNo) {
        if (!canUpload(user) || !canAccessProjectInAssignedScope(user, project)) return false;
        Role role = user.getRole();
        if (role == Role.ADMIN || role == Role.OFFICER || role == Role.DATA_ENTRY) return true;
        if (role == Role.IIT_ROPAR) {
            return module.equals("frontMatter")
                    || module.equals("annexures")
                    || (module.equals("chapters") && chapterNo != null && chapterNo >= 1 && chapterNo <= 5);
        }
        if (role == Role.SDO) {
            return module.equals("annexures")
                    || (module.equals("chapters") && chapterNo != null && chapterNo >= 5 && chapterNo <= 10);
        }
        if (role == Role.GIS) {
            return module.equals("plates") || module.equals("graphs") || module.equals("annexures");
        }
        if (role == Role.SDLC) return module.equals("sdlc");
        if (role == Role.JE) return module.equals("fieldData") || module.equals("annexures");
        if (role == Role.AXEN) return module.equals("assignedSection") || module.equals("annexures");
        return false;
    }

    public List<String> permissionsFor(Role role) {
        if (role == null) return List.of();
        if (role == Role.ADMIN) return List.of(UPLOAD, REVIEW, ADMIN, MANAGE_USERS, MANAGE_PROJECTS);
        java.util.ArrayList<String> permissions = new java.util.ArrayList<>();
        if (UPLOAD_ROLES.contains(role)) permissions.add(UPLOAD);
        if (REVIEW_ROLES.contains(role)) permissions.add(REVIEW);
        return permissions;
    }

    public Map<String, Object> scopeFor(User user) {
        if (user == null) return Map.of();
        return Map.of(
                "district", clean(user.getDistrict()),
                "block", clean(user.getBlockName()),
                "section", clean(user.getSectionName()),
                "accessScope", clean(user.getAccessScope())
        );
    }

    public String accessLabel(Role role) {
        if (role == null) return "Limited";
        return switch (role) {
            case ADMIN -> "Full";
            case IIT_ROPAR -> "Survey + Reviewer";
            case SDLC -> "District-level data";
            case SDO -> "Assigned block";
            case JE -> "Field data";
            case AXEN -> "Assigned section";
            case GIS -> "Plates + Graphs + Annexures";
            case REVIEWER, REVIEWER_1, REVIEWER_2 -> "Govt review";
            case STATE_ADMIN -> "State review";
            case DISTRICT_OWNER -> "District review";
            case OFFICER, DATA_ENTRY -> "Report data entry";
        };
    }

    public void requireUpload(User user) {
        if (!canUpload(user)) throw new org.springframework.security.access.AccessDeniedException("Upload access denied for this role");
    }

    public void requireReview(User user) {
        if (!canReview(user)) throw new org.springframework.security.access.AccessDeniedException("Review access denied for this role");
    }

    public void requireManageProjects(User user) {
        if (!canManageProjects(user)) throw new org.springframework.security.access.AccessDeniedException("Only Admin can manage projects");
    }

    public void requireManageUsers(User user) {
        if (!canManageUsers(user)) throw new org.springframework.security.access.AccessDeniedException("Only Admin can manage users");
    }

    public void requireProjectAccess(User user, Project project) {
        if (!canAccessProject(user, project)) throw new org.springframework.security.access.AccessDeniedException("Project is outside this user's assigned scope");
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
