package com.recruit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MoveCardRequest {
    @NotNull(message = "候选人ID不能为空")
    private Long candidateId;

    @NotBlank(message = "目标阶段不能为空")
    private String toStage;

    private Integer newCardOrder;

    private String remark;

    private Integer version;
}
