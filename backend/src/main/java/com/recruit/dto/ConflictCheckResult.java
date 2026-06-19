package com.recruit.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ConflictCheckResult {

    private boolean conflict;
    private boolean interviewerConflict;
    private boolean roomConflict;
    private String message;
    private List<InterviewScheduleDTO> conflictingSchedules;
    private List<RecommendedSlot> recommendedSlots;

    @Data
    public static class RecommendedSlot {
        private LocalDateTime startTime;
        private LocalDateTime endTime;
    }
}
