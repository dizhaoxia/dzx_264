-- ============================================================
-- V2: 人才库全文检索引擎 + 招聘渠道分析看板
-- ============================================================

-- 1. 候选人新增字段：招聘渠道、学历
ALTER TABLE candidates ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'BOSS直聘';
ALTER TABLE candidates ADD COLUMN education VARCHAR(50);

-- 2. CJK 分词函数：在中文字符之间插入空格，使 PostgreSQL simple 文本搜索配置
--    能将每个中文字符作为独立词元建立倒排索引（无需 zhparser 扩展）。
CREATE OR REPLACE FUNCTION fts_cjk(input text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    ch text;
    result text := '';
    i int;
BEGIN
    IF input IS NULL THEN
        RETURN '';
    END IF;
    FOR i IN 1..char_length(input) LOOP
        ch := substring(input from i for 1);
        IF ch ~ '[a-zA-Z0-9]' THEN
            result := result || ch;
        ELSIF ascii(ch) BETWEEN 19968 AND 40959 THEN
            result := result || ' ' || ch || ' ';
        ELSE
            result := result || ' ';
        END IF;
    END LOOP;
    RETURN result;
END;
$$;

-- 3. 阶段顺序函数（用于渠道分析事实表聚合）
CREATE OR REPLACE FUNCTION stage_order(stage text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE stage
        WHEN '初筛' THEN 1
        WHEN '一面' THEN 2
        WHEN '二面' THEN 3
        WHEN 'HR面' THEN 4
        WHEN 'Offer' THEN 5
        WHEN '已淘汰' THEN 6
        ELSE 0
    END;
$$;

-- 4. 倒排索引列（普通列，由触发器维护更新）：
--    基于姓名、技能、简历全文构建 tsvector
ALTER TABLE candidates ADD COLUMN search_vector tsvector;

CREATE INDEX idx_candidates_search_vector ON candidates USING GIN (search_vector);
CREATE INDEX idx_candidates_source ON candidates(source);
CREATE INDEX idx_candidates_education ON candidates(education);

-- 5. 创建统一的 tsvector 计算函数（供触发器和回填使用）
CREATE OR REPLACE FUNCTION candidates_tsvector(
    p_name text,
    p_skills text[],
    p_parsed_data jsonb
) RETURNS tsvector
LANGUAGE plpgsql AS $$
BEGIN
    RETURN to_tsvector(
        'simple',
        fts_cjk(
            coalesce(p_name, '') || ' ' ||
            coalesce(array_to_string(p_skills, ' '), '') || ' ' ||
            coalesce(p_parsed_data->>'rawText', '')
        )
    );
END;
$$;

-- 6. 创建 BEFORE INSERT OR UPDATE 触发器，自动维护 search_vector
CREATE OR REPLACE FUNCTION candidates_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := candidates_tsvector(NEW.name, NEW.skills, NEW.parsed_data);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_candidates_search_vector
BEFORE INSERT OR UPDATE ON candidates
FOR EACH ROW EXECUTE FUNCTION candidates_search_vector_trigger();

-- 7. 回填已有候选人的 search_vector（如果 V1 执行后已有数据）
UPDATE candidates SET search_vector = candidates_tsvector(name, skills, parsed_data);

-- 8. 招聘渠道统计事实表（预先聚合，供分析看板查询）
CREATE TABLE channel_application_facts (
    candidate_id BIGINT PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    apply_date DATE NOT NULL,
    current_stage VARCHAR(100),
    max_stage_order INT NOT NULL DEFAULT 0,
    screening_to_offer_hours NUMERIC(10,2)
);

CREATE INDEX idx_facts_source_date ON channel_application_facts(source, apply_date);
CREATE INDEX idx_facts_date ON channel_application_facts(apply_date);
CREATE INDEX idx_facts_stage ON channel_application_facts(max_stage_order);

-- 6. 注入演示数据：示例职位
INSERT INTO positions (title, department, job_description, qualifications, stage_template, created_at, updated_at)
VALUES (
    '高级Java开发工程师',
    '技术中台',
    '负责核心交易系统的设计与开发，参与微服务架构演进。',
    '5年以上Java经验，熟悉Spring生态，英语流利优先。',
    '[{"name":"初筛","order":1},{"name":"一面","order":2},{"name":"二面","order":3},{"name":"HR面","order":4},{"name":"Offer","order":5},{"name":"已淘汰","order":6}]'::jsonb,
    now() - interval '90 day',
    now() - interval '90 day'
);

-- 7. 注入演示数据：覆盖多渠道、多阶段、多学历的候选人 + 阶段流转日志
CREATE TEMP TABLE seed_candidates (
    idx int,
    name text,
    source text,
    education text,
    work_years int,
    skills text[],
    raw_text text,
    last_progress_order int,
    eliminated boolean,
    offset_days int,
    conf numeric
) ON COMMIT DROP;

INSERT INTO seed_candidates VALUES
(1,  '张伟', 'BOSS直聘', '硕士', 7,  ARRAY['Java','Spring','MySQL','Redis'],     '7年Java后端开发经验，精通Spring微服务与高并发，英语流利，非外包。', 5, false, 82, 88),
(2,  '王芳', 'BOSS直聘', '本科', 4,  ARRAY['Java','MyBatis','MySQL'],            '4年Java开发，参与电商系统，英语读写良好。',                       3, false, 76, 75),
(3,  '李娜', 'BOSS直聘', '本科', 2,  ARRAY['Java','Spring'],                      '2年Java经验，熟悉SpringBoot，有外包经历。',                       2, true,  68, 60),
(4,  '刘洋', 'BOSS直聘', '大专', 1,  ARRAY['Java'],                              '1年Java经验，初级开发。',                                         1, false, 55, 52),
(5,  '陈静', '猎聘',     '博士', 9,  ARRAY['Java','Spring','Kafka','微服务'],     '9年Java资深开发，分布式架构经验，英语流利。',                     5, false, 88, 92),
(6,  '杨帆', '猎聘',     '硕士', 6,  ARRAY['Java','Spring','MySQL','Docker'],     '6年Java后端，熟悉容器化部署，英语可交流。',                       4, false, 70, 80),
(7,  '赵磊', '猎聘',     '本科', 3,  ARRAY['Java','SpringBoot'],                  '3年Java开发，曾外包参与银行项目。',                               2, true,  60, 58),
(8,  '黄敏', '猎聘',     '本科', 5,  ARRAY['Java','MySQL'],                       '5年Java经验，数据库优化能力突出。',                               3, false, 50, 72),
(9,  '周杰', '内推',     '硕士', 8,  ARRAY['Java','Spring','Redis','高并发'],     '8年Java高并发经验，英语流利，技术专家。',                         5, false, 78, 90),
(10, '吴婷', '内推',     '本科', 4,  ARRAY['Java','Spring','MyBatis'],           '4年Java开发，参与支付系统。',                                     4, false, 40, 76),
(11, '郑昊', '内推',     '本科', 3,  ARRAY['Java'],                              '3年Java经验，外包转正。',                                         2, true,  33, 55),
(12, '孙琳', '内推',     '大专', 2,  ARRAY['Java','MySQL'],                       '2年Java开发。',                                                   1, false, 25, 50),
(13, '马超', '校园',     '硕士', 1,  ARRAY['Java','Spring'],                      '应届硕士，Java基础扎实，英语六级。',                             3, false, 20, 65),
(14, '朱琪', '校园',     '本科', 1,  ARRAY['Java'],                              '应届本科，Java方向校招。',                                       2, false, 18, 62),
(15, '胡涛', '校园',     '本科', 1,  ARRAY['Java','MySQL'],                       '应届本科，参与过Java实训项目。',                                 2, true,  15, 58),
(16, '林雪', '校园',     '硕士', 1,  ARRAY['Java','Spring','Redis'],              '应届硕士，英语流利，潜力较大。',                                 1, false, 12, 64),
(17, '钱坤', 'BOSS直聘', '本科', 6,  ARRAY['Java','Spring','MySQL','Linux'],     '6年Java后端，熟悉Linux运维，英语读写良好。',                     4, false, 45, 82),
(18, '冯丽', '猎聘',     '硕士', 5,  ARRAY['Java','Spring','Kafka'],             '5年Java开发，消息中间件经验丰富。',                               5, false, 38, 85),
(19, '蒋勇', '内推',     '本科', 7,  ARRAY['Java','Spring','Redis','微服务'],     '7年Java经验，微服务架构师，英语流利。',                           5, false, 65, 89),
(20, '韩梅', '校园',     '本科', 1,  ARRAY['Java','SpringBoot'],                  '应届本科，Java全栈方向。',                                       2, false, 10, 60),
(21, '曹峰', 'BOSS直聘', '大专', 3,  ARRAY['Java','MySQL'],                       '3年Java开发，外包出身。',                                         2, true,  72, 56),
(22, '沈静', '猎聘',     '本科', 4,  ARRAY['Java','Spring','MySQL'],              '4年Java经验，参与SaaS平台开发。',                                3, false, 58, 74),
(23, '彭飞', '内推',     '硕士', 6,  ARRAY['Java','Spring','Docker','K8s'],       '6年Java后端，云原生经验，英语流利。',                             4, false, 30, 83),
(24, '邓超', '校园',     '硕士', 1,  ARRAY['Java','Spring','Redis'],              '应届硕士，Java与中间件方向。',                                   1, false, 8,  66);

DO $$
DECLARE
    r record;
    cid bigint;
    base_ts timestamptz;
    stage_names text[] := ARRAY['', '初筛', '一面', '二面', 'HR面', 'Offer'];
    final_stage text;
    i int;
    log_ts timestamptz;
BEGIN
    FOR r IN SELECT * FROM seed_candidates ORDER BY idx LOOP
        base_ts := now() - (r.offset_days || ' day')::interval;
        IF r.eliminated THEN
            final_stage := '已淘汰';
        ELSE
            final_stage := stage_names[r.last_progress_order];
        END IF;

        INSERT INTO candidates (
            position_id, name, phone, email, work_years, skills,
            current_stage, confidence_score, resume_file_url, parsed_data,
            created_at, updated_at, card_order, source, education
        ) VALUES (
            1, r.name,
            '13' || lpad(r.idx::text, 9, '0'),
            lower(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g')) || r.idx::text || '@example.com',
            r.work_years, r.skills, final_stage, r.conf, NULL,
            jsonb_build_object('rawText', r.raw_text, 'education', r.education),
            base_ts, base_ts + interval '1 hour', 0, r.source, r.education
        ) RETURNING id INTO cid;

        -- 写入阶段流转日志（候选人默认从「初筛」起步）
        FOR i IN 2..r.last_progress_order LOOP
            log_ts := base_ts + ((i - 1) || ' day')::interval + (r.idx || ' hour')::interval;
            INSERT INTO stage_logs (candidate_id, from_stage, to_stage, remark, created_at)
            VALUES (cid, stage_names[i - 1], stage_names[i], NULL, log_ts);
        END LOOP;

        IF r.eliminated THEN
            log_ts := base_ts + (r.last_progress_order || ' day')::interval + (r.idx || ' hour')::interval;
            INSERT INTO stage_logs (candidate_id, from_stage, to_stage, remark, created_at)
            VALUES (cid, stage_names[r.last_progress_order], '已淘汰', '未通过', log_ts);
        END IF;
    END LOOP;
END $$;

-- 8. 回填渠道分析事实表（全量聚合）
INSERT INTO channel_application_facts (candidate_id, source, apply_date, current_stage, max_stage_order, screening_to_offer_hours)
SELECT
    c.id,
    c.source,
    c.created_at::date,
    c.current_stage,
    GREATEST(
        COALESCE(stage_order(c.current_stage), 0),
        COALESCE((SELECT MAX(stage_order(sl.to_stage)) FROM stage_logs sl WHERE sl.candidate_id = c.id), 0)
    ),
    CASE
        WHEN GREATEST(
            COALESCE(stage_order(c.current_stage), 0),
            COALESCE((SELECT MAX(stage_order(sl.to_stage)) FROM stage_logs sl WHERE sl.candidate_id = c.id), 0)
        ) >= 5
        THEN ROUND(
            EXTRACT(EPOCH FROM (
                COALESCE(
                    (SELECT sl2.created_at FROM stage_logs sl2
                       WHERE sl2.candidate_id = c.id AND sl2.to_stage = 'Offer'
                       ORDER BY sl2.created_at LIMIT 1),
                    CASE WHEN c.current_stage = 'Offer' THEN c.created_at END
                ) - c.created_at
            )) / 3600, 2)
    END
FROM candidates c;
