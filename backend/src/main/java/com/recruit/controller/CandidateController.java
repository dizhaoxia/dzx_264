package com.recruit.controller;

import com.recruit.dto.MoveCardRequest;
import com.recruit.dto.ReorderRequest;
import com.recruit.dto.UploadResponse;
import com.recruit.entity.Candidate;
import com.recruit.entity.StageLog;
import com.recruit.service.CandidateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/candidates")
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService candidateService;

    @GetMapping
    public ResponseEntity<List<Candidate>> getByPosition(@RequestParam Long positionId) {
        return ResponseEntity.ok(candidateService.findByPositionId(positionId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Candidate> getById(@PathVariable Long id) {
        return candidateService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/logs")
    public ResponseEntity<List<StageLog>> getStageLogs(@PathVariable Long id) {
        return ResponseEntity.ok(candidateService.getStageLogs(id));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadResponse> uploadResume(
            @RequestParam Long positionId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false, defaultValue = "BOSS直聘") String source) throws Exception {
        UploadResponse response = candidateService.uploadResume(positionId, file, source);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @PostMapping("/move")
    public ResponseEntity<Map<String, Object>> moveCard(@Valid @RequestBody MoveCardRequest request) {
        Map<String, Object> result = candidateService.moveCard(request);
        if ((Boolean) result.get("success")) {
            return ResponseEntity.ok(result);
        }
        if (result.containsKey("conflict") && (Boolean) result.get("conflict")) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(result);
        }
        return ResponseEntity.badRequest().body(result);
    }

    @PostMapping("/reorder")
    public ResponseEntity<Map<String, Object>> reorder(@Valid @RequestBody ReorderRequest request) {
        boolean success = candidateService.reorderCards(request);
        if (success) {
            return ResponseEntity.ok(Map.of("success", true, "message", "排序更新成功"));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("success", false, "message", "并发冲突，请刷新后重试"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> delete(@PathVariable Long id) {
        boolean deleted = candidateService.delete(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "删除成功"));
        }
        return ResponseEntity.notFound().build();
    }
}
