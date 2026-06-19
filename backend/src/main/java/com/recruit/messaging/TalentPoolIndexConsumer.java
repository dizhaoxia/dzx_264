package com.recruit.messaging;

import com.recruit.entity.Candidate;
import com.recruit.repository.CandidateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 人才库索引更新程序（模拟第二次迭代的 Elasticsearch 索引更新）。
 * 接收 RabbitMQ 消息后，将候选人「人才库状态」字段变更为「已入职」，
 * 候选人表的 search_vector 由数据库触发器自动同步，从而搜索侧可过滤已入职人员。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TalentPoolIndexConsumer {

    private final CandidateRepository candidateRepository;

    @RabbitListener(queues = RabbitMQConfig.TALENT_POOL_ONBOARD_QUEUE)
    @Transactional
    public void handleOnboardMessage(String candidateIdStr) {
        try {
            Long candidateId = Long.parseLong(candidateIdStr.trim());
            candidateRepository.findById(candidateId).ifPresentOrElse(
                    this::markOnboarded,
                    () -> log.warn("人才库入职更新：候选人不存在 candidateId={}", candidateId)
            );
        } catch (NumberFormatException e) {
            log.error("人才库入职更新消息格式错误: {}", candidateIdStr);
        } catch (Exception e) {
            log.error("处理人才库入职更新消息失败: {}", candidateIdStr, e);
            throw e;
        }
    }

    private void markOnboarded(Candidate candidate) {
        if ("已入职".equals(candidate.getTalentPoolStatus())) {
            log.info("人才库状态已为「已入职」，跳过: candidateId={}", candidate.getId());
            return;
        }
        candidate.setTalentPoolStatus("已入职");
        candidateRepository.save(candidate);
        log.info("人才库状态已更新为「已入职」: candidateId={}", candidate.getId());
    }
}
