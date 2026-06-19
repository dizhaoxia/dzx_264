package com.recruit.service;

import com.recruit.dto.PositionDTO;
import com.recruit.entity.Position;
import com.recruit.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PositionService {

    private final PositionRepository positionRepository;

    public List<Position> findAll() {
        return positionRepository.findAllByOrderByCreatedAtDesc();
    }

    public Optional<Position> findById(Long id) {
        return positionRepository.findById(id);
    }

    @Transactional
    public Position create(PositionDTO dto) {
        Position position = new Position();
        position.setTitle(dto.getTitle());
        position.setDepartment(dto.getDepartment());
        position.setJobDescription(dto.getJobDescription());
        position.setQualifications(dto.getQualifications());
        position.setStageTemplate(dto.getStageTemplate());
        return positionRepository.save(position);
    }

    @Transactional
    public Optional<Position> update(Long id, PositionDTO dto) {
        return positionRepository.findById(id)
                .map(position -> {
                    position.setTitle(dto.getTitle());
                    position.setDepartment(dto.getDepartment());
                    position.setJobDescription(dto.getJobDescription());
                    position.setQualifications(dto.getQualifications());
                    if (dto.getStageTemplate() != null) {
                        position.setStageTemplate(dto.getStageTemplate());
                    }
                    return positionRepository.save(position);
                });
    }

    @Transactional
    public boolean delete(Long id) {
        return positionRepository.findById(id)
                .map(position -> {
                    positionRepository.delete(position);
                    return true;
                })
                .orElse(false);
    }
}
