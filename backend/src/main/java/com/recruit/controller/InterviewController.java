package com.recruit.controller;

import com.recruit.dto.ConflictCheckResult;
import com.recruit.dto.InterviewScheduleDTO;
import com.recruit.dto.InterviewScheduleRequest;
import com.recruit.entity.Interviewer;
import com.recruit.entity.MeetingRoom;
import com.recruit.exception.InterviewConflictException;
import com.recruit.service.InterviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewService interviewService;

    @GetMapping("/interviewers")
    public ResponseEntity<List<Interviewer>> listInterviewers() {
        return ResponseEntity.ok(interviewService.listInterviewers());
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<MeetingRoom>> listRooms() {
        return ResponseEntity.ok(interviewService.listRooms());
    }

    @PostMapping("/check-conflict")
    public ResponseEntity<ConflictCheckResult> checkConflict(@RequestBody Map<String, Object> body) {
        Long interviewerId = Long.valueOf(body.get("interviewerId").toString());
        Long roomId = Long.valueOf(body.get("roomId").toString());
        LocalDateTime startTime = LocalDateTime.parse(body.get("startTime").toString());
        LocalDateTime endTime = LocalDateTime.parse(body.get("endTime").toString());
        return ResponseEntity.ok(interviewService.checkConflict(interviewerId, roomId, startTime, endTime));
    }

    @PostMapping
    public ResponseEntity<InterviewScheduleDTO> schedule(@Valid @RequestBody InterviewScheduleRequest request) {
        return ResponseEntity.ok(interviewService.schedule(request));
    }

    @GetMapping("/candidate/{candidateId}")
    public ResponseEntity<List<InterviewScheduleDTO>> listByCandidate(@PathVariable Long candidateId) {
        return ResponseEntity.ok(interviewService.listByCandidate(candidateId));
    }

    @ExceptionHandler(InterviewConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(InterviewConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "success", false,
                "conflict", true,
                "message", ex.getMessage(),
                "result", ex.getResult()
        ));
    }
}
