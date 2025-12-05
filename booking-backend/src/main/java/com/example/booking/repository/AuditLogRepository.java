package com.example.booking.repository;

import com.example.booking.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<AuditLog> findByActionOrderByCreatedAtDesc(String action, Pageable pageable);
    
    @Query("SELECT a FROM AuditLog a WHERE a.resourceType = :resourceType AND a.resourceId = :resourceId ORDER BY a.createdAt DESC")
    List<AuditLog> findByResource(@Param("resourceType") String resourceType, @Param("resourceId") Long resourceId);
    
    Page<AuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(OffsetDateTime start, OffsetDateTime end, Pageable pageable);
}
