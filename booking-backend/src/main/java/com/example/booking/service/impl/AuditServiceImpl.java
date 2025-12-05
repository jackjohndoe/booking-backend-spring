package com.example.booking.service.impl;

import com.example.booking.entity.AuditLog;
import com.example.booking.entity.User;
import com.example.booking.repository.AuditLogRepository;
import com.example.booking.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;

@Service
@Transactional
public class AuditServiceImpl implements AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditServiceImpl(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Override
    public void logAdminAction(User admin, String action, String resourceType, Long resourceId, String description) {
        if (admin == null || admin.getRole() != User.Role.ADMIN) {
            return; // Only log for admin users
        }
        logAction(admin, action, resourceType, resourceId, description);
    }

    @Override
    public void logAction(User user, String action, String resourceType, Long resourceId, String description) {
        if (user == null) {
            return;
        }

        HttpServletRequest request = getCurrentRequest();
        String ipAddress = request != null ? getClientIpAddress(request) : null;
        String userAgent = request != null ? request.getHeader("User-Agent") : null;

        AuditLog auditLog = AuditLog.builder()
                .user(user)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .description(description)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build();

        auditLogRepository.save(auditLog);
    }

    private HttpServletRequest getCurrentRequest() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attributes != null ? attributes.getRequest() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
