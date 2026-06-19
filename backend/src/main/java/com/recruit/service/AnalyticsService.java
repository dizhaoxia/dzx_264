package com.recruit.service;

import com.recruit.dto.AnalyticsDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public AnalyticsDTO.SummaryResponse summary(LocalDate startDate, LocalDate endDate) {
        LocalDate[] range = defaultRange(startDate, endDate);
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("start", range[0])
                .addValue("end", range[1]);

        List<AnalyticsDTO.ChannelSummary> channels = jdbcTemplate.query(
                "SELECT source, " +
                "  COUNT(*) AS application_count, " +
                "  COUNT(*) FILTER (WHERE max_stage_order >= 2) AS screening_passed_count, " +
                "  CASE WHEN COUNT(*) = 0 THEN 0 " +
                "       ELSE COUNT(*) FILTER (WHERE max_stage_order >= 2)::float8 / COUNT(*) END AS screening_pass_rate, " +
                "  COUNT(*) FILTER (WHERE max_stage_order >= 5) AS offer_count, " +
                "  AVG(screening_to_offer_hours) AS avg_hours " +
                "FROM channel_application_facts " +
                "WHERE apply_date BETWEEN :start AND :end " +
                "GROUP BY source ORDER BY application_count DESC",
                params,
                (rs, rowNum) -> {
                    AnalyticsDTO.ChannelSummary s = new AnalyticsDTO.ChannelSummary();
                    s.setSource(rs.getString("source"));
                    s.setApplicationCount(rs.getLong("application_count"));
                    s.setScreeningPassedCount(rs.getLong("screening_passed_count"));
                    s.setScreeningPassRate(rs.getDouble("screening_pass_rate"));
                    s.setOfferCount(rs.getLong("offer_count"));
                    s.setAvgScreeningToOfferHours(rs.getBigDecimal("avg_hours"));
                    return s;
                });

        List<AnalyticsDTO.FunnelStage> funnel = jdbcTemplate.query(
                "SELECT '初筛' AS stage, 1 AS stage_order, COUNT(*) AS count " +
                "FROM channel_application_facts WHERE apply_date BETWEEN :start AND :end " +
                "UNION ALL SELECT '一面', 2, COUNT(*) FILTER (WHERE max_stage_order >= 2) " +
                "FROM channel_application_facts WHERE apply_date BETWEEN :start AND :end " +
                "UNION ALL SELECT '二面', 3, COUNT(*) FILTER (WHERE max_stage_order >= 3) " +
                "FROM channel_application_facts WHERE apply_date BETWEEN :start AND :end " +
                "UNION ALL SELECT 'HR面', 4, COUNT(*) FILTER (WHERE max_stage_order >= 4) " +
                "FROM channel_application_facts WHERE apply_date BETWEEN :start AND :end " +
                "UNION ALL SELECT 'Offer', 5, COUNT(*) FILTER (WHERE max_stage_order >= 5) " +
                "FROM channel_application_facts WHERE apply_date BETWEEN :start AND :end " +
                "ORDER BY stage_order",
                params,
                (rs, rowNum) -> {
                    AnalyticsDTO.FunnelStage f = new AnalyticsDTO.FunnelStage();
                    f.setStage(rs.getString("stage"));
                    f.setStageOrder(rs.getInt("stage_order"));
                    f.setCount(rs.getLong("count"));
                    return f;
                });

        AnalyticsDTO.SummaryResponse response = new AnalyticsDTO.SummaryResponse();
        response.setStartDate(range[0]);
        response.setEndDate(range[1]);
        response.setChannels(channels);
        response.setFunnel(funnel);
        return response;
    }

    public List<AnalyticsDTO.TrendPoint> trend(LocalDate startDate, LocalDate endDate) {
        LocalDate[] range = defaultRange(startDate, endDate);
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("start", range[0])
                .addValue("end", range[1]);

        return jdbcTemplate.query(
                "SELECT apply_date, source, AVG(screening_to_offer_hours) AS avg_hours, COUNT(*) AS offer_count " +
                "FROM channel_application_facts " +
                "WHERE apply_date BETWEEN :start AND :end AND screening_to_offer_hours IS NOT NULL " +
                "GROUP BY apply_date, source ORDER BY apply_date, source",
                params,
                (rs, rowNum) -> {
                    AnalyticsDTO.TrendPoint p = new AnalyticsDTO.TrendPoint();
                    p.setDate(rs.getDate("apply_date").toLocalDate());
                    p.setSource(rs.getString("source"));
                    p.setAvgHours(rs.getBigDecimal("avg_hours"));
                    p.setOfferCount(rs.getLong("offer_count"));
                    return p;
                });
    }

    @Transactional
    public int refresh() {
        jdbcTemplate.update("TRUNCATE TABLE channel_application_facts", new MapSqlParameterSource());

        MapSqlParameterSource params = new MapSqlParameterSource();
        String sql =
                "INSERT INTO channel_application_facts (candidate_id, source, apply_date, current_stage, max_stage_order, screening_to_offer_hours) " +
                "SELECT c.id, c.source, c.created_at::date, c.current_stage, " +
                "  GREATEST(COALESCE(stage_order(c.current_stage), 0), " +
                "    COALESCE((SELECT MAX(stage_order(sl.to_stage)) FROM stage_logs sl WHERE sl.candidate_id = c.id), 0)), " +
                "  CASE WHEN GREATEST(COALESCE(stage_order(c.current_stage), 0), " +
                "    COALESCE((SELECT MAX(stage_order(sl.to_stage)) FROM stage_logs sl WHERE sl.candidate_id = c.id), 0)) >= 5 " +
                "  THEN ROUND(EXTRACT(EPOCH FROM (COALESCE(" +
                "    (SELECT sl2.created_at FROM stage_logs sl2 WHERE sl2.candidate_id = c.id AND sl2.to_stage = 'Offer' ORDER BY sl2.created_at LIMIT 1), " +
                "    CASE WHEN c.current_stage = 'Offer' THEN c.created_at END) - c.created_at)) / 3600, 2) END " +
                "FROM candidates c";
        int count = jdbcTemplate.update(sql, params);
        log.info("渠道分析事实表已刷新，共 {} 条", count);
        return count;
    }

    private LocalDate[] defaultRange(LocalDate startDate, LocalDate endDate) {
        LocalDate start = startDate != null ? startDate : LocalDate.now().minusYears(1);
        LocalDate end = endDate != null ? endDate : LocalDate.now();
        return new LocalDate[]{start, end};
    }
}
