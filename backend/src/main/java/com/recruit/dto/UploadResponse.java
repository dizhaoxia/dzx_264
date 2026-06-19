package com.recruit.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UploadResponse {
    private Long candidateId;
    private String fileName;
    private String status;
    private String message;
}
