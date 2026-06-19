package com.recruit.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApprovalActionRequest {

    @NotBlank(message = "审批人姓名不能为空")
    private String approverName;

    private String comment;
}
