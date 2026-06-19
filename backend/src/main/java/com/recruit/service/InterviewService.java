package com.recruit.service;

import com.recruit.dto.ConflictCheckResult;
import com.recruit.dto.InterviewScheduleDTO;
import com.recruit.dto.InterviewScheduleRequest;
import com.recruit.entity.*;
import com.recruit.exception.InterviewConflictException;
import com.recruit.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewService {

    private final InterviewScheduleRepository scheduleRepository;
    private final InterviewerRepository interviewerRepository;
    private final MeetingRoomRepository roomRepository;
    private final CandidateRepository candidateRepository;
    private final EmailService emailService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public List<Interviewer> listInterviewers() {
        return interviewerRepository.findAll();
    }

    public List<MeetingRoom> listRooms() {
        return roomRepository.findAll();
    }

    public ConflictCheckResult checkConflict(Long interviewerId, Long roomId,
                                              LocalDateTime startTime, LocalDateTime endTime) {
        ConflictCheckResult result = new ConflictCheckResult();

        List<InterviewSchedule> interviewerClashes =
                scheduleRepository.findOverlappingForInterviewer(interviewerId, startTime, endTime);
        List<InterviewSchedule> roomClashes =
                scheduleRepository.findOverlappingForRoom(roomId, startTime, endTime);

        boolean interviewerConflict = !interviewerClashes.isEmpty();
        boolean roomConflict = !roomClashes.isEmpty();
        result.setInterviewerConflict(interviewerConflict);
        result.setRoomConflict(roomConflict);
        result.setConflict(interviewerConflict || roomConflict);

        List<InterviewScheduleDTO> conflicting = new ArrayList<>();
        interviewerClashes.forEach(s -> conflicting.add(toDTO(s)));
        roomClashes.forEach(s -> {
            boolean dup = conflicting.stream().anyMatch(c -> c.getId().equals(s.getId()));
            if (!dup) conflicting.add(toDTO(s));
        });
        result.setConflictingSchedules(conflicting);

        if (result.isConflict()) {
            result.setMessage(buildConflictMessage(interviewerConflict, roomConflict));
            result.setRecommendedSlots(recommendFreeSlots(interviewerId, roomId, startTime, endTime));
        }

        return result;
    }

    private String buildConflictMessage(boolean interviewerConflict, boolean roomConflict) {
        if (interviewerConflict && roomConflict) {
            return "所选面试官与会议室在该时段均已被占用";
        }
        if (interviewerConflict) {
            return "所选面试官在该时段已被占用";
        }
        return "所选会议室在该时段已被占用";
    }

    /**
     * 基于时间段交集判断，从请求起点向后按 30 分钟步进扫描最近的空闲时段。
     * 仅当面试官与会议室在该时段均无重叠日程时视为空闲。
     */
    private List<ConflictCheckResult.RecommendedSlot> recommendFreeSlots(
            Long interviewerId, Long roomId, LocalDateTime startTime, LocalDateTime endTime) {

        Duration duration = Duration.between(startTime, endTime);
        List<ConflictCheckResult.RecommendedSlot> slots = new ArrayList<>();
        LocalDateTime cursor = startTime.plusMinutes(30);

        for (int i = 0; i < 48 && slots.size() < 3; i++) {
            LocalDateTime slotStart = cursor;
            LocalDateTime slotEnd = slotStart.plus(duration);

            boolean interviewerFree = scheduleRepository
                    .findOverlappingForInterviewer(interviewerId, slotStart, slotEnd).isEmpty();
            boolean roomFree = scheduleRepository
                    .findOverlappingForRoom(roomId, slotStart, slotEnd).isEmpty();

            if (interviewerFree && roomFree) {
                ConflictCheckResult.RecommendedSlot slot = new ConflictCheckResult.RecommendedSlot();
                slot.setStartTime(slotStart);
                slot.setEndTime(slotEnd);
                slots.add(slot);
            }
            cursor = cursor.plusMinutes(30);
        }

        return slots;
    }

    @Transactional
    public InterviewScheduleDTO schedule(InterviewScheduleRequest request) {
        if (!request.getEndTime().isAfter(request.getStartTime())) {
            throw new IllegalArgumentException("结束时间必须晚于开始时间");
        }

        ConflictCheckResult conflict = checkConflict(
                request.getInterviewerId(), request.getRoomId(),
                request.getStartTime(), request.getEndTime());
        if (conflict.isConflict()) {
            throw new InterviewConflictException(conflict);
        }

        InterviewSchedule schedule = new InterviewSchedule();
        schedule.setCandidateId(request.getCandidateId());
        schedule.setPositionId(request.getPositionId());
        schedule.setStage(request.getStage());
        schedule.setInterviewerId(request.getInterviewerId());
        schedule.setRoomId(request.getRoomId());
        schedule.setStartTime(request.getStartTime());
        schedule.setEndTime(request.getEndTime());
        schedule.setRound(request.getRound() == null ? 1 : request.getRound());
        schedule.setRemark(request.getRemark());
        schedule.setStatus("SCHEDULED");

        schedule = scheduleRepository.save(schedule);
        log.info("面试日程创建成功: id={}, candidateId={}, stage={}",
                schedule.getId(), schedule.getCandidateId(), schedule.getStage());

        sendNotification(schedule);

        return toDTO(schedule);
    }

    private void sendNotification(InterviewSchedule schedule) {
        Candidate candidate = candidateRepository.findById(schedule.getCandidateId()).orElse(null);
        Interviewer interviewer = interviewerRepository.findById(schedule.getInterviewerId()).orElse(null);
        MeetingRoom room = roomRepository.findById(schedule.getRoomId()).orElse(null);

        String candidateName = candidate != null ? candidate.getName() : "候选人#" + schedule.getCandidateId();
        String interviewerName = interviewer != null ? interviewer.getName() : "面试官";
        String roomName = room != null ? room.getName() : "待定";

        String subject = String.format("【面试通知】%s - %s", candidateName, schedule.getStage());
        String content = String.format(
                "面试日程已安排，详情如下：\n\n候选人: %s\n面试阶段: %s（第%d轮）\n面试官: %s\n会议室: %s\n时间: %s 至 %s\n备注: %s",
                candidateName,
                schedule.getStage(),
                schedule.getRound(),
                interviewerName,
                roomName,
                schedule.getStartTime().format(FMT),
                schedule.getEndTime().format(FMT),
                schedule.getRemark() == null ? "无" : schedule.getRemark());

        if (interviewer != null && interviewer.getEmail() != null) {
            emailService.sendInterviewNotification(interviewer.getEmail(), subject, content);
        }
        if (candidate != null && candidate.getEmail() != null) {
            emailService.sendInterviewNotification(candidate.getEmail(), subject, content);
        }
    }

    public List<InterviewScheduleDTO> listByCandidate(Long candidateId) {
        return scheduleRepository.findByCandidateIdOrderByStartTimeAsc(candidateId).stream()
                .map(this::toDTO)
                .toList();
    }

    private InterviewScheduleDTO toDTO(InterviewSchedule schedule) {
        InterviewScheduleDTO dto = new InterviewScheduleDTO();
        dto.setId(schedule.getId());
        dto.setCandidateId(schedule.getCandidateId());
        dto.setPositionId(schedule.getPositionId());
        dto.setStage(schedule.getStage());
        dto.setStartTime(schedule.getStartTime());
        dto.setEndTime(schedule.getEndTime());
        dto.setStatus(schedule.getStatus());
        dto.setRound(schedule.getRound());
        dto.setRemark(schedule.getRemark());
        dto.setCreatedAt(schedule.getCreatedAt());

        candidateRepository.findById(schedule.getCandidateId())
                .ifPresent(c -> dto.setCandidateName(c.getName()));
        interviewerRepository.findById(schedule.getInterviewerId())
                .ifPresent(i -> {
                    dto.setInterviewerName(i.getName());
                    dto.setInterviewerId(i.getId());
                });
        roomRepository.findById(schedule.getRoomId())
                .ifPresent(r -> {
                    dto.setRoomName(r.getName());
                    dto.setRoomId(r.getId());
                });

        return dto;
    }
}
