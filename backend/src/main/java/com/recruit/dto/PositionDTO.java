package com.recruit.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class PositionDTO {
    @NotBlank(message = "职位名称不能为空")
    private String title;

    private String department;

    private String jobDescription;

    private String qualifications;

    private List<Map<String, Object>> stageTemplate;
}
