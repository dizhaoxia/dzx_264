package com.recruit.service;

import com.recruit.dto.MoveCardRequest;
import com.recruit.dto.ParseResultDTO;
import com.recruit.dto.ReorderRequest;
import com.recruit.dto.UploadResponse;
import com.recruit.entity.Candidate;
import com.recruit.entity.StageLog;
import com.recruit.repository.CandidateRepository;
import com.recruit.repository.StageLogRepository;
import com.recruit.statemachine.StageStateMachine;
import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateService {

    private final CandidateRepository candidateRepository;
    private final StageLogRepository stageLogRepository;
    private final MinioService minioService;
    private final StageStateMachine stateMachine;

    @Value("${parser.service.url}")
    private String parserServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public List<Candidate> findByPositionId(Long positionId) {
        return candidateRepository.findAllByPositionIdOrderedByStage(positionId);
    }

    public Optional<Candidate> findById(Long id) {
        return candidateRepository.findById(id);
    }

    public List<StageLog> getStageLogs(Long candidateId) {
        return stageLogRepository.findByCandidateIdOrderByCreatedAtDesc(candidateId);
    }

    @Transactional
    public UploadResponse uploadResume(Long positionId, MultipartFile file) throws Exception {
        String fileName = file.getOriginalFilename();
        String fileUrl = minioService.uploadFile(file);

        Candidate candidate = new Candidate();
        candidate.setPositionId(positionId);
        candidate.setResumeFileUrl(fileUrl);
        candidate.setCurrentStage("初筛");
        candidate.setCardOrder(candidateRepository.getNextCardOrder(positionId, "初筛"));
        candidate = candidateRepository.save(candidate);

        asyncParseResume(candidate.getId(), fileUrl, fileName);

        return new UploadResponse(candidate.getId(), fileName, "PROCESSING", "简历已上传，正在解析中");
    }

    @Async("parseExecutor")
    public void asyncParseResume(Long candidateId, String fileUrl, String fileName) {
        try {
            log.info("开始解析简历: candidateId={}, fileName={}", candidateId, fileName);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("fileUrl", fileUrl);
            body.add("fileName", fileName);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<ParseResultDTO> response = restTemplate.postForEntity(
                    parserServiceUrl + "/parse",
                    requestEntity,
                    ParseResultDTO.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                ParseResultDTO result = response.getBody();
                updateCandidateWithParseResult(candidateId, result);
                log.info("简历解析完成: candidateId={}, name={}, confidence={}",
                        candidateId, result.getName(), result.getConfidenceScore());
            } else {
                log.error("简历解析失败: candidateId={}, status={}", candidateId, response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("简历解析异常: candidateId={}", candidateId, e);
        }
    }

    @Transactional
    public void updateCandidateWithParseResult(Long candidateId, ParseResultDTO result) {
        candidateRepository.findById(candidateId).ifPresent(candidate -> {
            candidate.setName(result.getName());
            candidate.setPhone(result.getPhone());
            candidate.setEmail(result.getEmail());
            candidate.setWorkYears(result.getWorkYears());
            candidate.setSkills(result.getSkills());
            candidate.setConfidenceScore(result.getConfidenceScore());
            candidate.setParsedData(result.getRawData());
            candidateRepository.save(candidate);
        });
    }

    @Transactional
    public Map<String, Object> moveCard(MoveCardRequest request) {
        Map<String, Object> result = new HashMap<>();

        Candidate candidate = candidateRepository.findById(request.getCandidateId())
                .orElseThrow(() -> new IllegalArgumentException("候选人不存在"));

        if (request.getVersion() != null && !request.getVersion().equals(candidate.getVersion())) {
            result.put("success", false);
            result.put("message", "数据已过期，请刷新后重试");
            result.put("conflict", true);
            return result;
        }

        String validationError = stateMachine.validateTransition(
                candidate.getCurrentStage(), request.getToStage());
        if (validationError != null) {
            result.put("success", false);
            result.put("message", validationError);
            return result;
        }

        String fromStage = candidate.getCurrentStage();
        String toStage = request.getToStage();

        if (!fromStage.equals(toStage)) {
            candidate.setCurrentStage(toStage);

            StageLog log = new StageLog();
            log.setCandidateId(candidate.getId());
            log.setFromStage(fromStage);
            log.setToStage(toStage);
            log.setRemark(request.getRemark());
            stageLogRepository.save(log);
        }

        if (request.getNewCardOrder() != null) {
            candidate.setCardOrder(request.getNewCardOrder());
        }

        try {
            candidate = candidateRepository.save(candidate);
            result.put("success", true);
            result.put("candidate", candidate);
            return result;
        } catch (OptimisticLockException e) {
            result.put("success", false);
            result.put("message", "并发冲突，请刷新后重试");
            result.put("conflict", true);
            return result;
        }
    }

    @Transactional
    public boolean reorderCards(ReorderRequest request) {
        try {
            for (ReorderRequest.ReorderItem item : request.getItems()) {
                candidateRepository.findById(item.getCandidateId()).ifPresent(candidate -> {
                    if (item.getVersion() == null || item.getVersion().equals(candidate.getVersion())) {
                        candidate.setCardOrder(item.getCardOrder());
                        candidateRepository.save(candidate);
                    }
                });
            }
            return true;
        } catch (OptimisticLockException e) {
            log.warn("排序时发生乐观锁冲突", e);
            return false;
        }
    }

    @Transactional
    public boolean delete(Long id) {
        return candidateRepository.findById(id)
                .map(candidate -> {
                    if (candidate.getResumeFileUrl() != null) {
                        try {
                            minioService.deleteFile(candidate.getResumeFileUrl());
                        } catch (Exception e) {
                            log.warn("删除简历文件失败: {}", e.getMessage());
                        }
                    }
                    candidateRepository.delete(candidate);
                    return true;
                })
                .orElse(false);
    }
}
