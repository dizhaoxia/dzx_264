package com.recruit.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OfferApprovalDTO {

    private Long id;
    private Long candidateId;
    private String candidateName;
    private Long positionId;
    private String status;
    private String salaryPackage;
    private LocalDate onboardingDate;
    private Integer currentNode;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<NodeDTO> nodes;

    @Data
    public static class NodeDTO {
        private Long id;
        private Integer nodeOrder;
        private String roleName;
        private String approverName;
        private String status;
        private String comment;
        private LocalDateTime approvedAt;
    }
}
