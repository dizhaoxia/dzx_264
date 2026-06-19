package com.recruit.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class SearchResultDTO {

    private String query;
    private String sortBy;
    private Integer page;
    private Integer size;
    private Long total;
    private List<Item> items;

    @Data
    public static class Item {
        private Long candidateId;
        private String name;
        private Long positionId;
        private String positionTitle;
        private String currentStage;
        private Integer workYears;
        private String education;
        private String source;
        private BigDecimal confidenceScore;
        private LocalDateTime updatedAt;
        private List<String> skills;
        private Double rank;
        private String snippet;
    }
}
