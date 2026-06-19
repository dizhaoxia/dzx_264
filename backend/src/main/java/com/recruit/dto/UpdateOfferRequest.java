package com.recruit.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateOfferRequest {

    private String salaryPackage;

    private LocalDate onboardingDate;
}
