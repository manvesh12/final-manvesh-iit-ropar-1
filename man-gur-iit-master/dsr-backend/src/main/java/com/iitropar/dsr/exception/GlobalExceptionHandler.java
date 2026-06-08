package com.iitropar.dsr.exception;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(403).body(java.util.Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleException(Exception e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }

    @ExceptionHandler(UnchangedContentWarningException.class)
    public ResponseEntity<?> handleUnchangedContentWarningException(UnchangedContentWarningException e) {
        return ResponseEntity.status(409).body(java.util.Map.of(
            "warning", true,
            "message", e.getMessage()
        ));
    }
}
