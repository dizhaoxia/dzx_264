package com.recruit.messaging;

import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 人才库索引更新消息队列配置。
 * 当 Offer 审批最终通过后，通过该队列异步通知「人才库索引更新程序」
 * 将候选人人才库状态变更为「已入职」，确保搜索侧可过滤已入职人员。
 */
@Configuration
public class RabbitMQConfig {

    public static final String TALENT_POOL_ONBOARD_QUEUE = "talent.pool.onboard";

    @Bean
    public Queue talentPoolOnboardQueue() {
        return new Queue(TALENT_POOL_ONBOARD_QUEUE, true);
    }
}
