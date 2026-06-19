package com.recruit.repository;

import com.recruit.entity.InterviewSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InterviewScheduleRepository extends JpaRepository<InterviewSchedule, Long> {

    List<InterviewSchedule> findByCandidateIdOrderByStartTimeAsc(Long candidateId);

    @Query("SELECT s FROM InterviewSchedule s WHERE s.interviewerId = :interviewerId " +
           "AND s.status <> 'CANCELLED' " +
           "AND s.startTime < :endTime AND s.endTime > :startTime " +
           "ORDER BY s.startTime")
    List<InterviewSchedule> findOverlappingForInterviewer(
            @Param("interviewerId") Long interviewerId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    @Query("SELECT s FROM InterviewSchedule s WHERE s.roomId = :roomId " +
           "AND s.status <> 'CANCELLED' " +
           "AND s.startTime < :endTime AND s.endTime > :startTime " +
           "ORDER BY s.startTime")
    List<InterviewSchedule> findOverlappingForRoom(
            @Param("roomId") Long roomId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
}
