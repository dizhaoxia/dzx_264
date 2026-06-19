package com.recruit.repository;

import com.recruit.entity.StageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StageLogRepository extends JpaRepository<StageLog, Long> {
    List<StageLog> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);
}
