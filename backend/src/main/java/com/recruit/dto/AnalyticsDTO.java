package com.recruit.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class AnalyticsDTO {

    @Data
    public static class ChannelSummary {
        private String source;
        private Long applicationCount;
        private Long screeningPassedCount;
        private Double screeningPassRate;
        private Long offerCount;
        private BigDecimal avgScreeningToOfferHours;
    }

    @Data
    public static class FunnelStage {
        private String stage;
        private Integer stageOrder;
        private Long count;
    }

    @Data
    public static class TrendPoint {
        private LocalDate date;
        private String source;
        private BigDecimal avgHours;
        private Long offerCount;
    }

    @Data
    public static class SummaryResponse {
        private LocalDate startDate;
        private LocalDate endDate;
        private List<ChannelSummary> channels;
        private List<FunnelStage> funnel;
    }
}
