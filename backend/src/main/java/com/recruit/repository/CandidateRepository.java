package com.recruit.repository;

import com.recruit.entity.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidateRepository extends JpaRepository<Candidate, Long> {
    List<Candidate> findByPositionIdOrderByCardOrderAsc(Long positionId);

    List<Candidate> findByPositionIdAndCurrentStageOrderByCardOrderAsc(Long positionId, String currentStage);

    Optional<Candidate> findByIdAndVersion(Long id, Integer version);

    @Modifying
    @Query("UPDATE Candidate c SET c.cardOrder = :cardOrder WHERE c.id = :id")
    int updateCardOrder(@Param("id") Long id, @Param("cardOrder") Integer cardOrder);

    @Query("SELECT COALESCE(MAX(c.cardOrder), 0) + 1 FROM Candidate c WHERE c.positionId = :positionId AND c.currentStage = :currentStage")
    Integer getNextCardOrder(@Param("positionId") Long positionId, @Param("currentStage") String currentStage);

    @Query("SELECT c FROM Candidate c WHERE c.positionId = :positionId ORDER BY " +
           "CASE c.currentStage " +
           "WHEN '初筛' THEN 1 " +
           "WHEN '一面' THEN 2 " +
           "WHEN '二面' THEN 3 " +
           "WHEN 'HR面' THEN 4 " +
           "WHEN 'Offer' THEN 5 " +
           "WHEN '已淘汰' THEN 6 " +
           "ELSE 7 END, c.cardOrder ASC")
    List<Candidate> findAllByPositionIdOrderedByStage(@Param("positionId") Long positionId);
}
