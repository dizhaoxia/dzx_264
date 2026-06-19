package com.recruit.controller;

import com.recruit.dto.ApprovalActionRequest;
import com.recruit.dto.CreateOfferApprovalRequest;
import com.recruit.dto.OfferApprovalDTO;
import com.recruit.dto.UpdateOfferRequest;
import com.recruit.service.OfferApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/offers")
@RequiredArgsConstructor
public class OfferApprovalController {

    private final OfferApprovalService offerApprovalService;

    @PostMapping
    public ResponseEntity<OfferApprovalDTO> create(@Valid @RequestBody CreateOfferApprovalRequest request) {
        return ResponseEntity.ok(offerApprovalService.createApproval(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OfferApprovalDTO> update(@PathVariable Long id, @RequestBody UpdateOfferRequest request) {
        return ResponseEntity.ok(offerApprovalService.updateOfferDetails(id, request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OfferApprovalDTO> getById(@PathVariable Long id) {
        OfferApprovalDTO dto = offerApprovalService.getApproval(id);
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    @GetMapping("/candidate/{candidateId}")
    public ResponseEntity<OfferApprovalDTO> getByCandidate(@PathVariable Long candidateId) {
        OfferApprovalDTO dto = offerApprovalService.getApprovalByCandidate(candidateId);
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<OfferApprovalDTO> approve(@PathVariable Long id,
                                                     @Valid @RequestBody ApprovalActionRequest request) {
        return ResponseEntity.ok(offerApprovalService.approve(id, request));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<OfferApprovalDTO> reject(@PathVariable Long id,
                                                   @Valid @RequestBody ApprovalActionRequest request) {
        return ResponseEntity.ok(offerApprovalService.reject(id, request));
    }
}
