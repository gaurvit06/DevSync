package com.devsync.shared;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> status(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(
            java.util.Map.of(
                "message", e.getReason() == null ? "Request rejected" : e.getReason()));
  }

  @ExceptionHandler({
    org.springframework.dao.OptimisticLockingFailureException.class,
    jakarta.persistence.OptimisticLockException.class
  })
  ResponseEntity<?> conflict(Exception e) {
    return ResponseEntity.status(409)
        .body(java.util.Map.of("message", "This item changed. Reload before saving."));
  }

  @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
  ResponseEntity<?> duplicate(Exception e) {
    return ResponseEntity.status(409)
        .body(java.util.Map.of("message", "Duplicate record or invalid relationship."));
  }

  @ExceptionHandler({
    org.springframework.web.bind.MethodArgumentNotValidException.class,
    org.springframework.http.converter.HttpMessageNotReadableException.class,
    IllegalArgumentException.class
  })
  ResponseEntity<?> invalid(Exception e) {
    return ResponseEntity.badRequest()
        .body(java.util.Map.of("message", "Invalid input. Check required fields and values."));
  }
}
