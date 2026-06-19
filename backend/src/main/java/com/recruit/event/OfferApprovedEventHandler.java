package com.recruit.event;

import com.recruit.messaging.TalentPoolMessageProducer;
import com.recruit.service.CandidateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Offer审批最终「通过」时触发的全局事件处理器：
 * 1. 回调第一次迭代的看板服务，将候选人状态标记为「已录用」并解锁卡片；
 * 2. 通过 RabbitMQ 异步通知第二次迭代的人才库索引更新程序，将「人才库状态」变更为「已入职」。
 * 至此看板、审批、人才库三个模块的数据最终达成一致性。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OfferApprovedEventHandler {

    private final CandidateService candidateService;
    private final TalentPoolMessageProducer talentPoolMessageProducer;

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOfferApproved(OfferApprovedEvent event) {
        log.info("收到Offer审批通过事件: candidateId={}, approvalId={}",
                event.getCandidateId(), event.getApprovalId());

        candidateService.markHired(event.getCandidateId());

        talentPoolMessageProducer.notifyOnboarded(event.getCandidateId());
    }
}
