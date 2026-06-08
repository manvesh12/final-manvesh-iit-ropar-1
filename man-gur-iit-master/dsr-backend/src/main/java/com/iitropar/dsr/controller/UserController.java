package com.iitropar.dsr.controller;

import com.iitropar.dsr.entity.Role;
import com.iitropar.dsr.entity.User;
import com.iitropar.dsr.repository.UserRepository;
import com.iitropar.dsr.service.PermissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired UserRepository userRepository;
    @Autowired PermissionService permissionService;
    @Autowired PasswordEncoder passwordEncoder;

    private User getCurrentUser() {
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.iitropar.dsr.security.UserDetailsImpl details) {
            return userRepository.findById(details.getId()).orElseThrow(() -> new RuntimeException("User not found"));
        }
        throw new RuntimeException("User not authenticated");
    }

    @GetMapping
    public ResponseEntity<?> listUsers() {
        permissionService.requireManageUsers(getCurrentUser());
        List<Map<String, Object>> users = userRepository.findAll().stream().map(this::toResponse).toList();
        return ResponseEntity.ok(users);
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody Map<String, String> payload) {
        permissionService.requireManageUsers(getCurrentUser());
        String username = required(payload, "username");
        String email = payload.getOrDefault("email", username);
        if (userRepository.existsByUsername(username)) throw new RuntimeException("Username already exists");
        if (userRepository.existsByEmail(email)) throw new RuntimeException("Email already exists");

        User user = User.builder()
                .fullName(payload.getOrDefault("fullName", username))
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(payload.getOrDefault("password", "password123")))
                .role(parseRole(payload.getOrDefault("role", "DATA_ENTRY")))
                .district(payload.getOrDefault("district", ""))
                .blockName(payload.getOrDefault("block", ""))
                .sectionName(payload.getOrDefault("section", ""))
                .accessScope(payload.getOrDefault("accessScope", ""))
                .active(Boolean.parseBoolean(payload.getOrDefault("active", "true")))
                .build();
        return ResponseEntity.ok(toResponse(userRepository.save(user)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        permissionService.requireManageUsers(getCurrentUser());
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        if (payload.containsKey("fullName")) user.setFullName(payload.get("fullName"));
        if (payload.containsKey("email")) user.setEmail(payload.get("email"));
        if (payload.containsKey("role")) user.setRole(parseRole(payload.get("role")));
        if (payload.containsKey("district")) user.setDistrict(payload.get("district"));
        if (payload.containsKey("block")) user.setBlockName(payload.get("block"));
        if (payload.containsKey("section")) user.setSectionName(payload.get("section"));
        if (payload.containsKey("accessScope")) user.setAccessScope(payload.get("accessScope"));
        if (payload.containsKey("active")) user.setActive(Boolean.parseBoolean(payload.get("active")));
        if (payload.containsKey("password") && !payload.get("password").isBlank()) {
            user.setPassword(passwordEncoder.encode(payload.get("password")));
        }
        return ResponseEntity.ok(toResponse(userRepository.save(user)));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<?> setActive(@PathVariable Long id, @RequestBody Map<String, Boolean> payload) {
        permissionService.requireManageUsers(getCurrentUser());
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        user.setActive(Boolean.TRUE.equals(payload.get("active")));
        return ResponseEntity.ok(toResponse(userRepository.save(user)));
    }

    private Map<String, Object> toResponse(User user) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", user.getId());
        data.put("fullName", user.getFullName());
        data.put("username", user.getUsername());
        data.put("email", user.getEmail());
        data.put("role", user.getRole().name());
        data.put("district", user.getDistrict());
        data.put("block", user.getBlockName());
        data.put("section", user.getSectionName());
        data.put("accessScope", user.getAccessScope());
        data.put("active", user.isActive());
        data.put("permissions", permissionService.permissionsFor(user.getRole()));
        data.put("accessLabel", permissionService.accessLabel(user.getRole()));
        return data;
    }

    private Role parseRole(String value) {
        try {
            return Role.valueOf(value.trim().toUpperCase());
        } catch (Exception e) {
            throw new RuntimeException("Invalid role: " + value);
        }
    }

    private String required(Map<String, String> payload, String key) {
        String value = payload.get(key);
        if (value == null || value.trim().isEmpty()) throw new RuntimeException(key + " is required");
        return value.trim();
    }
}
