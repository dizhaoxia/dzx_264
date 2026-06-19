package com.recruit.service;

import com.recruit.dto.SearchResultDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Array;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    private static final Map<String, Integer> EDU_RANK = Map.of(
            "博士", 5, "硕士", 4, "本科", 3, "大专", 2, "高中", 1);

    private static final Pattern WORK_YEARS = Pattern.compile(
            "(经验|工作年限|工龄)\\s*(大于|超过|小于|>=|<=|>|<|=)?\\s*(\\d+(?:\\.\\d+)?)\\s*年?");

    private static final Pattern EDUCATION = Pattern.compile(
            "学历\\s*(大于|超过|小于|>=|<=|>|<|=)?\\s*(博士|硕士|本科|大专|高中)");

    public SearchResultDTO search(String rawQuery, String sortBy, Long positionId, int page, int size) {
        if (page < 1) page = 1;
        if (size < 1 || size > 100) size = 10;

        ParsedQuery parsed = parse(rawQuery);
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("positionId", positionId)
                .addValue("offset", (page - 1) * size)
                .addValue("size", size);

        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        boolean hasText = parsed.tsQuery != null && !parsed.tsQuery.isBlank();

        if (hasText) {
            params.addValue("query", parsed.tsQuery);
        }
        if (parsed.workYearsOp != null) {
            where.append(" AND c.work_years ").append(parsed.workYearsOp).append(" :workYears ");
            params.addValue("workYears", parsed.workYearsValue);
        }
        if (parsed.educationExact != null) {
            where.append(" AND c.education = :education ");
            params.addValue("education", parsed.educationExact);
        }
        if (parsed.minEduRank != null) {
            where.append(" AND ").append(eduRankExpr()).append(" >= :minEduRank ");
            params.addValue("minEduRank", parsed.minEduRank);
        }
        if (parsed.maxEduRank != null) {
            where.append(" AND ").append(eduRankExpr()).append(" <= :maxEduRank ");
            params.addValue("maxEduRank", parsed.maxEduRank);
        }
        if (positionId != null) {
            where.append(" AND c.position_id = :positionId ");
        }

        String orderBy = buildOrderBy(sortBy, hasText);

        String snippetExpr = hasText
                ? "ts_headline('simple', coalesce(c.parsed_data->>'rawText', concat(c.name, ' ', array_to_string(c.skills, ' '))), q, " +
                  "'MaxFragments=2, MinWords=5, MaxWords=30')"
                : "left(coalesce(c.parsed_data->>'rawText', concat(c.name, ' ', array_to_string(c.skills, ' '))), 160)";

        String fromJoin = hasText
                ? " FROM candidates c LEFT JOIN positions p ON p.id = c.position_id " +
                  "CROSS JOIN to_tsquery('simple', :query) AS q "
                : " FROM candidates c LEFT JOIN positions p ON p.id = c.position_id ";

        String textPred = hasText ? " AND c.search_vector @@ q " : "";
        String rankExpr = hasText ? "ts_rank(c.search_vector, q)" : "0";

        String dataSql = "SELECT c.id AS candidateId, c.name AS name, c.position_id AS positionId, " +
                "p.title AS positionTitle, c.current_stage AS currentStage, c.work_years AS workYears, " +
                "c.education AS education, c.source AS source, c.confidence_score AS confidenceScore, " +
                "c.updated_at AS updatedAt, c.skills AS skills, " + rankExpr + " AS rank, " +
                snippetExpr + " AS snippet " +
                fromJoin + where + textPred +
                " ORDER BY " + orderBy + " LIMIT :size OFFSET :offset";

        String countSql = "SELECT COUNT(*) " + fromJoin + where + textPred;

        Long total = jdbcTemplate.queryForObject(countSql, params, Long.class);
        if (total == null) total = 0L;

        List<SearchResultDTO.Item> items = jdbcTemplate.query(dataSql, params, (rs, rowNum) -> {
            SearchResultDTO.Item item = new SearchResultDTO.Item();
            item.setCandidateId(rs.getLong("candidateId"));
            item.setName(rs.getString("name"));
            item.setPositionId(rs.getObject("positionId", Long.class));
            item.setPositionTitle(rs.getString("positionTitle"));
            item.setCurrentStage(rs.getString("currentStage"));
            item.setWorkYears(rs.getObject("workYears", Integer.class));
            item.setEducation(rs.getString("education"));
            item.setSource(rs.getString("source"));
            item.setConfidenceScore(rs.getBigDecimal("confidenceScore"));
            item.setUpdatedAt(rs.getTimestamp("updatedAt").toLocalDateTime());
            item.setSkills(readStringArray(rs.getArray("skills")));
            item.setRank(rs.getDouble("rank"));
            item.setSnippet(rs.getString("snippet"));
            return item;
        });

        SearchResultDTO result = new SearchResultDTO();
        result.setQuery(rawQuery);
        result.setSortBy(sortBy == null ? "relevance" : sortBy);
        result.setPage(page);
        result.setSize(size);
        result.setTotal(total);
        result.setItems(items);
        return result;
    }

    private String buildOrderBy(String sortBy, boolean hasText) {
        if (sortBy == null) {
            return hasText ? "rank DESC, c.updated_at DESC" : "c.updated_at DESC";
        }
        switch (sortBy) {
            case "updatedAt":
                return "c.updated_at DESC";
            case "education":
                return eduRankExpr() + " DESC, c.updated_at DESC";
            case "relevance":
            default:
                return hasText ? "rank DESC, c.updated_at DESC" : "c.updated_at DESC";
        }
    }

    private String eduRankExpr() {
        return "(CASE c.education WHEN '博士' THEN 5 WHEN '硕士' THEN 4 " +
                "WHEN '本科' THEN 3 WHEN '大专' THEN 2 WHEN '高中' THEN 1 ELSE 0 END)";
    }

    private List<String> readStringArray(Array array) throws java.sql.SQLException {
        if (array == null) return List.of();
        Object arr = array.getArray();
        if (arr instanceof Object[]) {
            return Arrays.stream((Object[]) arr)
                    .map(String::valueOf)
                    .toList();
        }
        return List.of();
    }

    private ParsedQuery parse(String rawQuery) {
        ParsedQuery parsed = new ParsedQuery();
        if (rawQuery == null || rawQuery.isBlank()) {
            return parsed;
        }
        String q = rawQuery.trim();

        Matcher wm = WORK_YEARS.matcher(q);
        if (wm.find()) {
            parsed.workYearsOp = mapOp(wm.group(2), ">");
            try {
                parsed.workYearsValue = (int) Math.round(Double.parseDouble(wm.group(3)));
            } catch (NumberFormatException ignored) {
            }
            q = wm.replaceAll(" ");
        }

        Matcher em = EDUCATION.matcher(q);
        if (em.find()) {
            String op = em.group(1);
            String edu = em.group(2);
            Integer rank = EDU_RANK.get(edu);
            if (rank != null) {
                if (op == null || op.equals("=")) {
                    parsed.educationExact = edu;
                } else if (op.equals("大于") || op.equals("超过") || op.equals(">") || op.equals(">=")) {
                    parsed.minEduRank = rank;
                } else if (op.equals("小于") || op.equals("<") || op.equals("<=")) {
                    parsed.maxEduRank = rank;
                }
            }
            q = em.replaceAll(" ");
        }

        parsed.tsQuery = new BooleanQueryCompiler().compile(q);
        return parsed;
    }

    private String mapOp(String op, String defaultOp) {
        if (op == null) return defaultOp;
        return switch (op) {
            case "大于", "超过", ">" -> ">";
            case ">=" -> ">=";
            case "小于", "<" -> "<";
            case "<=" -> "<=";
            case "=" -> "=";
            default -> defaultOp;
        };
    }

    private static class ParsedQuery {
        String tsQuery;
        String workYearsOp;
        Integer workYearsValue;
        String educationExact;
        Integer minEduRank;
        Integer maxEduRank;
    }

    /**
     * 将复合布尔查询（AND/OR/NOT，含隐式 AND、括号）编译为 PostgreSQL to_tsquery 字符串。
     * 中文字符按字拆分为独立词元，与 fts_cjk 建立的倒排索引保持一致。
     */
    static class BooleanQueryCompiler {
        private List<String> tokens;
        private int pos;

        String compile(String input) {
            String normalized = input
                    .replace("&&", " AND ")
                    .replace("||", " OR ")
                    .replace("!", " NOT ")
                    .replace("(", " ( ")
                    .replace(")", " ) ");
            tokens = new ArrayList<>();
            for (String t : normalized.split("\\s+")) {
                if (!t.isEmpty()) tokens.add(t);
            }
            pos = 0;
            String result = parseOr();
            return (result == null || result.isBlank()) ? null : result;
        }

        private String parseOr() {
            String left = parseAnd();
            while (peek("OR")) {
                pos++;
                String right = parseAnd();
                left = combine(left, " | ", right);
            }
            return left;
        }

        private String parseAnd() {
            String left = parseNot();
            while (peek("AND") || isAtomStart()) {
                if (peek("AND")) pos++;
                String right = parseNot();
                left = combine(left, " & ", right);
            }
            return left;
        }

        private String parseNot() {
            if (peek("NOT")) {
                pos++;
                String operand = parseNot();
                if (operand == null || operand.isBlank()) return null;
                return "!(" + operand + ")";
            }
            return parseAtom();
        }

        private String parseAtom() {
            if (peek("(")) {
                pos++;
                String e = parseOr();
                if (peek(")")) pos++;
                return e;
            }
            if (pos < tokens.size()) {
                String tok = tokens.get(pos);
                pos++;
                return expandTerm(tok);
            }
            return null;
        }

        private boolean peek(String kw) {
            return pos < tokens.size() && tokens.get(pos).equalsIgnoreCase(kw);
        }

        private boolean isAtomStart() {
            if (pos >= tokens.size()) return false;
            String t = tokens.get(pos);
            return !t.equalsIgnoreCase("AND") && !t.equalsIgnoreCase("OR") && !t.equals(")");
        }

        private String combine(String a, String op, String b) {
            if (a == null || a.isBlank()) return b;
            if (b == null || b.isBlank()) return a;
            return "(" + a + op + b + ")";
        }

        private String expandTerm(String term) {
            List<String> lexemes = new ArrayList<>();
            StringBuilder buf = new StringBuilder();
            for (int i = 0; i < term.length(); i++) {
                char c = term.charAt(i);
                if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
                    buf.append(c);
                } else if (c >= 0x4E00 && c <= 0x9FFF) {
                    if (buf.length() > 0) {
                        lexemes.add(buf.toString());
                        buf.setLength(0);
                    }
                    lexemes.add(String.valueOf(c));
                } else {
                    if (buf.length() > 0) {
                        lexemes.add(buf.toString());
                        buf.setLength(0);
                    }
                }
            }
            if (buf.length() > 0) lexemes.add(buf.toString());
            if (lexemes.isEmpty()) return null;
            if (lexemes.size() == 1) return lexemes.get(0);
            return "(" + String.join(" & ", lexemes) + ")";
        }
    }
}
