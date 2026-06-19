package com.recruit.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
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

    @JsonAlias({"confidenceScore", "confidence"})
    private BigDecimal confidenceScore;

    @JsonAlias({"rawData", "rawText"})
    private Object rawData;

    private String error;

    @JsonProperty("confidence")
    public BigDecimal getConfidence() {
        return confidenceScore;
    }

    @JsonProperty("confidence")
    public void setConfidence(BigDecimal confidence) {
        this.confidenceScore = confidence;
    }
}
