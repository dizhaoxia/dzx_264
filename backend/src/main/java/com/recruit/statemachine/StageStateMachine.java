package com.recruit.statemachine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class StageStateMachine {

    private static final String ELIMINATED = "已淘汰";
    private static final String OFFER = "Offer";

    private static final Set<String> PROGRESS_STAGES = Set.of(
        "初筛", "一面", "二面", "HR面"
    );

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "初筛", Set.of("一面", ELIMINATED),
        "一面", Set.of("二面", ELIMINATED, "初筛"),
        "二面", Set.of("HR面", ELIMINATED, "一面"),
        "HR面", Set.of(OFFER, ELIMINATED, "二面"),
        OFFER, Set.of(ELIMINATED),
        ELIMINATED, Set.of()
    );

    public boolean canTransition(String fromStage, String toStage) {
        if (fromStage == null || toStage == null) {
            return false;
        }

        if (fromStage.equals(toStage)) {
            return true;
        }

        if (ELIMINATED.equals(fromStage) && PROGRESS_STAGES.contains(toStage)) {
            log.warn("禁止从[{}]状态拖回[{}]进行中状态", fromStage, toStage);
            return false;
        }

        Set<String> allowed = ALLOWED_TRANSITIONS.get(fromStage);
        if (allowed == null) {
            log.warn("未知的起始阶段: {}", fromStage);
            return false;
        }

        boolean allowedTransition = allowed.contains(toStage);
        if (!allowedTransition) {
            log.warn("不允许的阶段转换: {} -> {}", fromStage, toStage);
        }

        return allowedTransition;
    }

    public String validateTransition(String fromStage, String toStage) {
        if (fromStage == null || toStage == null) {
            return "阶段不能为空";
        }

        if (fromStage.equals(toStage)) {
            return null;
        }

        if (ELIMINATED.equals(fromStage) && !ELIMINATED.equals(toStage)) {
            return "不可从「已淘汰」状态恢复到进行中状态";
        }

        Set<String> allowed = ALLOWED_TRANSITIONS.get(fromStage);
        if (allowed == null) {
            return "未知的起始阶段: " + fromStage;
        }

        if (!allowed.contains(toStage)) {
            return "不允许的阶段转换: " + fromStage + " -> " + toStage;
        }

        return null;
    }

    public boolean isEliminated(String stage) {
        return ELIMINATED.equals(stage);
    }

    public boolean isTerminalStage(String stage) {
        return ELIMINATED.equals(stage) || OFFER.equals(stage);
    }
}
