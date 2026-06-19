package com.recruit.event;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Offer审批最终通过时触发的全局事件。
 * 该事件会回调看板服务（标记候选人「已录用」），
 * 并通过消息队列异步通知人才库索引更新程序（标记「已入职」）。
 */
@Getter
@RequiredArgsConstructor
public class OfferApprovedEvent {

    private final Long candidateId;
    private final Long approvalId;
}
