package com.recruit.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class EmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:noreply@recruit.com}")
    private String fromAddress;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    @Async("emailExecutor")
    public void sendInterviewNotification(String to, String subject, String content) {
        if (to == null || to.isBlank()) {
            log.warn("面试通知收件人邮箱为空，跳过发送。主题={}, 内容=\n{}", subject, content);
            return;
        }

        if (mailHost == null || mailHost.isBlank()) {
            log.info("[邮件通知-未配置SMTP，仅记录] 收件人={} 主题={}\n{}", to, subject, content);
            return;
        }

        try {
            JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
            if (mailSender == null) {
                log.info("[邮件通知-JavaMailSender缺失，仅记录] 收件人={} 主题={}\n{}", to, subject, content);
                return;
            }
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(content);
            mailSender.send(message);
            log.info("面试通知邮件已发送: 收件人={}, 主题={}", to, subject);
        } catch (Exception e) {
            log.warn("面试通知邮件发送失败，已降级记录。收件人={}, 主题={}, 原因={}\n{}", to, subject, e.getMessage(), content);
        }
    }
}
