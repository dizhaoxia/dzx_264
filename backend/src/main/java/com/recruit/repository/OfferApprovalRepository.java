package com.recruit.repository;

import com.recruit.entity.OfferApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OfferApprovalRepository extends JpaRepository<OfferApproval, Long> {

    Optional<OfferApproval> findFirstByCandidateIdOrderByCreatedAtDesc(Long candidateId);

    Optional<OfferApproval> findByCandidateIdAndStatus(Long candidateId, String status);
}
