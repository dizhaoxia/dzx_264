package com.recruit.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "channel_application_facts")
public class ChannelApplicationFact {

    @Id
    @Column(name = "candidate_id")
    private Long candidateId;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "apply_date", nullable = false)
    private LocalDate applyDate;

    @Column(name = "current_stage")
    private String currentStage;

    @Column(name = "max_stage_order")
    private Integer maxStageOrder;

    @Column(name = "screening_to_offer_hours")
    private BigDecimal screeningToOfferHours;
}
