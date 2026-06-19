package com.recruit.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class CandidateDTO {
    private Long id;
    private Long positionId;
    private String name;
    private String phone;
    private String email;
    private Integer workYears;
    private List<String> skills;
    private String currentStage;
    private BigDecimal confidenceScore;
    private String resumeFileUrl;
    private Map<String, Object> parsedData;
    private Integer cardOrder;
    private Integer version;
    private String createdAt;
    private String updatedAt;
}
