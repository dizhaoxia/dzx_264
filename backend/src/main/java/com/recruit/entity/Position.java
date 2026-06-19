package com.recruit.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Entity
@Table(name = "positions")
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private String department;

    @Column(name = "job_description", columnDefinition = "TEXT")
    private String jobDescription;

    @Column(columnDefinition = "TEXT")
    private String qualifications;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "stage_template", columnDefinition = "jsonb")
    private List<Map<String, Object>> stageTemplate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (stageTemplate == null || stageTemplate.isEmpty()) {
            stageTemplate = List.of(
                Map.of("name", "初筛", "order", 1),
                Map.of("name", "一面", "order", 2),
                Map.of("name", "二面", "order", 3),
                Map.of("name", "HR面", "order", 4),
                Map.of("name", "Offer", "order", 5),
                Map.of("name", "已淘汰", "order", 6)
            );
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
