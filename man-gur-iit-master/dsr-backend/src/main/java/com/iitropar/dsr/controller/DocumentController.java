package com.iitropar.dsr.controller;
import com.iitropar.dsr.service.DocumentService;
import com.iitropar.dsr.entity.User;
import com.iitropar.dsr.repository.UserRepository;
import com.iitropar.dsr.service.PermissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files")
public class DocumentController {
    @Autowired DocumentService service;
    @Autowired UserRepository userRepository;
    @Autowired PermissionService permissionService;

    private User getCurrentUser() {
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.iitropar.dsr.security.UserDetailsImpl details) {
            return userRepository.findById(details.getId()).orElseThrow(() -> new RuntimeException("User not found"));
        }
        throw new RuntimeException("User not authenticated");
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) throws Exception {
        permissionService.requireUpload(getCurrentUser());
        return ResponseEntity.ok(service.uploadFile(file));
    }
}
