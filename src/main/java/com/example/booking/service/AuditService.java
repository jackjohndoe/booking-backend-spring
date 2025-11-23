package com.example.booking.service;

import com.example.booking.entity.User;

/**
 * Service for logging admin actions and important operations
 */
public interface AuditService {
    void logAdminAction(User admin, String action, String resourceType, Long resourceId, String description);
    void logAction(User user, String action, String resourceType, Long resourceId, String description);
}
