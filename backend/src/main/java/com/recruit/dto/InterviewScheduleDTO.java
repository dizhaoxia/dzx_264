package com.recruit.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class InterviewScheduleDTO {

    private Long id;
    private Long candidateId;
    private String candidateName;
    private Long positionId;
    private String stage;
    private Long interviewerId;
    private String interviewerName;
    private Long roomId;
    private String roomName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String status;
    private Integer round;
    private String remark;
    private LocalDateTime createdAt;
}
