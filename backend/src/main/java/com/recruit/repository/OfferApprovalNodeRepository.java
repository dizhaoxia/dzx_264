package com.recruit.repository;

import com.recruit.entity.OfferApprovalNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OfferApprovalNodeRepository extends JpaRepository<OfferApprovalNode, Long> {

    List<OfferApprovalNode> findByApprovalIdOrderByNodeOrderAsc(Long approvalId);
}
