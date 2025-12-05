package com.example.booking.exception;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleResourceNotFound(ResourceNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(BadRequestException ex) {
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthorized(UnauthorizedException ex) {
        return buildResponse(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(ForbiddenException ex) {
        return buildResponse(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthenticationException(AuthenticationException ex) {
        String message = "Authentication failed. " + ex.getMessage();
        if (ex instanceof BadCredentialsException) {
            message = "Invalid email or password. Please check your credentials and try again.";
        } else if (ex instanceof InsufficientAuthenticationException) {
            message = "Authentication required. Please provide a valid authentication token.";
        }
        return buildResponse(HttpStatus.UNAUTHORIZED, message);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        String message = "Access denied. You do not have permission to perform this action. " +
                "Please ensure you have the required role or ownership of the resource.";
        return buildResponse(HttpStatus.FORBIDDEN, message);
    }

    @ExceptionHandler(JwtException.class)
    public ResponseEntity<Map<String, Object>> handleJwtException(JwtException ex) {
        String message;
        if (ex instanceof ExpiredJwtException) {
            message = "Your authentication token has expired. Please log in again to obtain a new token.";
        } else if (ex instanceof MalformedJwtException) {
            message = "Invalid authentication token format. Please ensure you are using a valid JWT token.";
        } else if (ex instanceof SignatureException) {
            message = "Invalid authentication token signature. The token may have been tampered with or is invalid.";
        } else {
            message = "Authentication token validation failed: " + ex.getMessage() + 
                    ". Please log in again to obtain a new token.";
        }
        return buildResponse(HttpStatus.UNAUTHORIZED, message);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, Object> body = baseBody(HttpStatus.BAD_REQUEST, 
                "Validation failed. Please check the provided data and correct the errors below.");
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        body.put("errors", errors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return buildResponse(HttpStatus.BAD_REQUEST, 
                "Invalid request parameter: " + ex.getMessage() + ". Please check your input and try again.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex) {
        String message = "An unexpected error occurred. Please try again later. " +
                "If the problem persists, contact support with the error details.";
        Map<String, Object> body = baseBody(HttpStatus.INTERNAL_SERVER_ERROR, message);
        // Only include detailed error in development, not production
        if (ex.getMessage() != null && !ex.getMessage().isEmpty()) {
            body.put("details", ex.getMessage());
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message) {
        Map<String, Object> body = baseBody(status, message);
        return ResponseEntity.status(status).body(body);
    }

    private Map<String, Object> baseBody(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", OffsetDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return body;
    }
}
