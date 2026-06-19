package com.recruit.exception;

import com.recruit.dto.ConflictCheckResult;
import lombok.Getter;

@Getter
public class InterviewConflictException extends RuntimeException {

    private final ConflictCheckResult result;

    public InterviewConflictException(ConflictCheckResult result) {
        super(result.getMessage() != null ? result.getMessage() : "面试时间冲突");
        this.result = result;
    }
}
