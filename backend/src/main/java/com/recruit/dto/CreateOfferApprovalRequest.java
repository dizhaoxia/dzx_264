package com.recruit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateOfferApprovalRequest {

    @NotNull(message = "候选人ID不能为空")
    private Long candidateId;

    @NotBlank(message = "薪酬方案不能为空")
    private String salaryPackage;

    @NotNull(message = "入职日期不能为空")
    private LocalDate onboardingDate;
}
