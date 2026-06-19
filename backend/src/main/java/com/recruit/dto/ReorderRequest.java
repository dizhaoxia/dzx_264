package com.recruit.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class ReorderRequest {
    @NotNull(message = "职位ID不能为空")
    private Long positionId;

    @NotEmpty(message = "排序项不能为空")
    private List<ReorderItem> items;

    @Data
    public static class ReorderItem {
        @NotNull(message = "候选人ID不能为空")
        private Long candidateId;

        @NotNull(message = "排序值不能为空")
        private Integer cardOrder;

        private Integer version;
    }
}
