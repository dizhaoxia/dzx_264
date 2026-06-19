package com.recruit.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class InterviewScheduleRequest {

    @NotNull(message = "候选人ID不能为空")
    private Long candidateId;

    private Long positionId;

    @NotNull(message = "面试阶段不能为空")
    private String stage;

    @NotNull(message = "面试官ID不能为空")
    private Long interviewerId;

    @NotNull(message = "会议室ID不能为空")
    private Long roomId;

    @NotNull(message = "开始时间不能为空")
    private LocalDateTime startTime;

    @NotNull(message = "结束时间不能为空")
    private LocalDateTime endTime;

    private Integer round;

    private String remark;
}
