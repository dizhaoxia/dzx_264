package com.recruit.messaging;

import com.recruit.entity.Candidate;
import com.recruit.repository.CandidateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TalentPoolMessageProducer {

    private final RabbitTemplate rabbitTemplate;
    private final CandidateRepository candidateRepository;

    /**
     * 异步通知人才库索引更新程序将候选人标记为「已入职」。
     * 若消息队列不可用，则降级为直接更新数据库，保证最终一致性。
     */
    public void notifyOnboarded(Long candidateId) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.TALENT_POOL_ONBOARD_QUEUE,
                    String.valueOf(candidateId));
            log.info("已发送人才库入职更新消息: candidateId={}", candidateId);
        } catch (AmqpException e) {
            log.warn("消息队列不可用，降级直接更新人才库状态: candidateId={}, 原因={}", candidateId, e.getMessage());
            fallbackUpdateTalentPoolStatus(candidateId);
        } catch (Exception e) {
            log.error("发送人才库入职更新消息异常: candidateId={}", candidateId, e);
            fallbackUpdateTalentPoolStatus(candidateId);
        }
    }

    private void fallbackUpdateTalentPoolStatus(Long candidateId) {
        candidateRepository.findById(candidateId).ifPresentOrElse(
                c -> {
                    c.setTalentPoolStatus("已入职");
                    candidateRepository.save(c);
                    log.info("已降级更新人才库状态为「已入职」: candidateId={}", candidateId);
                },
                () -> log.warn("降级更新人才库状态失败，候选人不存在: candidateId={}", candidateId)
        );
    }
}
