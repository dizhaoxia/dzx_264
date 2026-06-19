package com.recruit.service;

import com.recruit.dto.ApprovalActionRequest;
import com.recruit.dto.CreateOfferApprovalRequest;
import com.recruit.dto.OfferApprovalDTO;
import com.recruit.dto.UpdateOfferRequest;
import com.recruit.entity.Candidate;
import com.recruit.entity.OfferApproval;
import com.recruit.entity.OfferApprovalNode;
import com.recruit.event.OfferApprovedEvent;
import com.recruit.exception.ApprovalException;
import com.recruit.repository.CandidateRepository;
import com.recruit.repository.OfferApprovalNodeRepository;
import com.recruit.repository.OfferApprovalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OfferApprovalService {

    private static final List<String[]> DEFAULT_APPROVAL_CHAIN = List.of(
            new String[]{"1", "用人主管"},
            new String[]{"2", "HRD"},
            new String[]{"3", "总经理"}
    );

    private final OfferApprovalRepository approvalRepository;
    private final OfferApprovalNodeRepository nodeRepository;
    private final CandidateRepository candidateRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public OfferApprovalDTO createApprovalForCandidate(Long candidateId, Long positionId) {
        Optional<OfferApproval> existing = approvalRepository
                .findByCandidateIdAndStatus(candidateId, "PENDING");
        if (existing.isPresent()) {
            return toDTO(existing.get());
        }

        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new IllegalArgumentException("候选人不存在"));

        OfferApproval approval = new OfferApproval();
        approval.setCandidateId(candidateId);
        approval.setPositionId(positionId != null ? positionId : candidate.getPositionId());
        approval.setStatus("PENDING");
        approval.setCurrentNode(1);
        approval = approvalRepository.save(approval);

        createDefaultNodes(approval.getId());

        lockCandidate(candidate, true);

        log.info("Offer审批单已自动创建: approvalId={}, candidateId={}", approval.getId(), candidateId);
        return toDTO(approval);
    }

    @Transactional
    public OfferApprovalDTO createApproval(CreateOfferApprovalRequest request) {
        Optional<OfferApproval> existing = approvalRepository
                .findByCandidateIdAndStatus(request.getCandidateId(), "PENDING");
        if (existing.isPresent()) {
            throw new ApprovalException("该候选人已存在进行中的Offer审批单");
        }

        Candidate candidate = candidateRepository.findById(request.getCandidateId())
                .orElseThrow(() -> new IllegalArgumentException("候选人不存在"));

        OfferApproval approval = new OfferApproval();
        approval.setCandidateId(candidate.getId());
        approval.setPositionId(candidate.getPositionId());
        approval.setStatus("PENDING");
        approval.setCurrentNode(1);
        approval.setSalaryPackage(request.getSalaryPackage());
        approval.setOnboardingDate(request.getOnboardingDate());
        approval = approvalRepository.save(approval);

        createDefaultNodes(approval.getId());

        lockCandidate(candidate, true);

        log.info("Offer审批单已创建: approvalId={}, candidateId={}", approval.getId(), candidate.getId());
        return toDTO(approval);
    }

    private void createDefaultNodes(Long approvalId) {
        for (String[] node : DEFAULT_APPROVAL_CHAIN) {
            OfferApprovalNode n = new OfferApprovalNode();
            n.setApprovalId(approvalId);
            n.setNodeOrder(Integer.parseInt(node[0]));
            n.setRoleName(node[1]);
            n.setStatus("PENDING");
            nodeRepository.save(n);
        }
    }

    @Transactional
    public OfferApprovalDTO updateOfferDetails(Long id, UpdateOfferRequest request) {
        OfferApproval approval = approvalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("审批单不存在"));
        if (!"PENDING".equals(approval.getStatus())) {
            throw new ApprovalException("审批单已结束，无法修改");
        }
        if (request.getSalaryPackage() != null) {
            approval.setSalaryPackage(request.getSalaryPackage());
        }
        if (request.getOnboardingDate() != null) {
            approval.setOnboardingDate(request.getOnboardingDate());
        }
        approval = approvalRepository.save(approval);
        return toDTO(approval);
    }

    @Transactional
    public OfferApprovalDTO approve(Long id, ApprovalActionRequest request) {
        OfferApproval approval = approvalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("审批单不存在"));
        if (!"PENDING".equals(approval.getStatus())) {
            throw new ApprovalException("审批单已结束，无法继续审批");
        }

        List<OfferApprovalNode> nodes = nodeRepository.findByApprovalIdOrderByNodeOrderAsc(id);
        final Integer currentNodeOrder = approval.getCurrentNode();
        OfferApprovalNode currentNode = nodes.stream()
                .filter(n -> n.getNodeOrder().equals(currentNodeOrder))
                .findFirst()
                .orElseThrow(() -> new ApprovalException("未找到当前审批节点"));

        if (!"PENDING".equals(currentNode.getStatus())) {
            throw new ApprovalException("当前节点已处理");
        }

        currentNode.setStatus("APPROVED");
        currentNode.setApproverName(request.getApproverName());
        currentNode.setComment(request.getComment());
        currentNode.setApprovedAt(LocalDateTime.now());
        nodeRepository.save(currentNode);

        if (approval.getCurrentNode() < nodes.size()) {
            approval.setCurrentNode(approval.getCurrentNode() + 1);
            log.info("Offer审批节点[{}]通过，进入下一节点: approvalId={}", currentNodeOrder, id);
        } else {
            approval.setStatus("APPROVED");
            log.info("Offer审批最终通过: approvalId={}, candidateId={}", id, approval.getCandidateId());
            eventPublisher.publishEvent(new OfferApprovedEvent(approval.getCandidateId(), id));
        }

        approval = approvalRepository.save(approval);
        return toDTO(approval);
    }

    @Transactional
    public OfferApprovalDTO reject(Long id, ApprovalActionRequest request) {
        OfferApproval approval = approvalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("审批单不存在"));
        if (!"PENDING".equals(approval.getStatus())) {
            throw new ApprovalException("审批单已结束，无法继续审批");
        }

        List<OfferApprovalNode> nodes = nodeRepository.findByApprovalIdOrderByNodeOrderAsc(id);
        final Integer currentNodeOrder = approval.getCurrentNode();
        OfferApprovalNode currentNode = nodes.stream()
                .filter(n -> n.getNodeOrder().equals(currentNodeOrder))
                .findFirst()
                .orElseThrow(() -> new ApprovalException("未找到当前审批节点"));

        currentNode.setStatus("REJECTED");
        currentNode.setApproverName(request.getApproverName());
        currentNode.setComment(request.getComment());
        currentNode.setApprovedAt(LocalDateTime.now());
        nodeRepository.save(currentNode);

        approval.setStatus("REJECTED");
        approval = approvalRepository.save(approval);

        // 驳回后解除卡片锁定，允许重新处理
        candidateRepository.findById(approval.getCandidateId())
                .ifPresent(c -> lockCandidate(c, false));

        log.info("Offer审批被驳回: approvalId={}, candidateId={}", id, approval.getCandidateId());
        return toDTO(approval);
    }

    private void lockCandidate(Candidate candidate, boolean locked) {
        candidate.setLocked(locked);
        candidateRepository.save(candidate);
    }

    public OfferApprovalDTO getApproval(Long id) {
        return approvalRepository.findById(id).map(this::toDTO).orElse(null);
    }

    public OfferApprovalDTO getApprovalByCandidate(Long candidateId) {
        return approvalRepository.findFirstByCandidateIdOrderByCreatedAtDesc(candidateId)
                .map(this::toDTO).orElse(null);
    }

    private OfferApprovalDTO toDTO(OfferApproval approval) {
        OfferApprovalDTO dto = new OfferApprovalDTO();
        dto.setId(approval.getId());
        dto.setCandidateId(approval.getCandidateId());
        dto.setPositionId(approval.getPositionId());
        dto.setStatus(approval.getStatus());
        dto.setSalaryPackage(approval.getSalaryPackage());
        dto.setOnboardingDate(approval.getOnboardingDate());
        dto.setCurrentNode(approval.getCurrentNode());
        dto.setCreatedAt(approval.getCreatedAt());
        dto.setUpdatedAt(approval.getUpdatedAt());

        candidateRepository.findById(approval.getCandidateId())
                .ifPresent(c -> dto.setCandidateName(c.getName()));

        List<OfferApprovalNode> nodes = nodeRepository.findByApprovalIdOrderByNodeOrderAsc(approval.getId());
        dto.setNodes(nodes.stream().map(n -> {
            OfferApprovalDTO.NodeDTO nd = new OfferApprovalDTO.NodeDTO();
            nd.setId(n.getId());
            nd.setNodeOrder(n.getNodeOrder());
            nd.setRoleName(n.getRoleName());
            nd.setApproverName(n.getApproverName());
            nd.setStatus(n.getStatus());
            nd.setComment(n.getComment());
            nd.setApprovedAt(n.getApprovedAt());
            return nd;
        }).toList());

        return dto;
    }
}
