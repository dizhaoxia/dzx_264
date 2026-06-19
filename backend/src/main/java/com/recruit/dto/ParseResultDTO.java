package com.recruit.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class ParseResultDTO {
    private String name;
    private String phone;
    private String email;
    private Integer workYears;
    private List<String> skills;
    private BigDecimal confidenceScore;
    private Map<String, Object> rawData;
    private String error;
}
