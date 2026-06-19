-- ============================================================
-- V3: 面试日程管理与冲突检测 + Offer多级审批流 + 人才库状态统一
-- ============================================================

-- 1. 候选人新增字段：卡片锁定标记、人才库状态
ALTER TABLE candidates ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN talent_pool_status VARCHAR(50) NOT NULL DEFAULT '在库';

CREATE INDEX idx_candidates_locked ON candidates(locked);
CREATE INDEX idx_candidates_talent_pool_status ON candidates(talent_pool_status);

-- 2. 阶段顺序函数补充「已录用」终态（招聘成功）
CREATE OR REPLACE FUNCTION stage_order(stage text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE stage
        WHEN '初筛' THEN 1
        WHEN '一面' THEN 2
        WHEN '二面' THEN 3
        WHEN 'HR面' THEN 4
        WHEN 'Offer' THEN 5
        WHEN '已淘汰' THEN 6
        WHEN '已录用' THEN 7
        ELSE 0
    END;
$$;

-- 3. 现有职位的阶段模板追加「已录用」列（用于看板展示招聘成功终态）
UPDATE positions
SET stage_template = stage_template || jsonb_build_object('name', '已录用', 'order', 7)
WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(stage_template) e WHERE e->>'name' = '已录用'
);

-- 4. 面试官表
CREATE TABLE interviewers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(255),
    title VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. 会议室表
CREATE TABLE meeting_rooms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    capacity INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. 面试日程表（时间段交集冲突检测的数据基础）
CREATE TABLE interview_schedules (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    position_id BIGINT REFERENCES positions(id),
    stage VARCHAR(100) NOT NULL,
    interviewer_id BIGINT NOT NULL REFERENCES interviewers(id),
    room_id BIGINT NOT NULL REFERENCES meeting_rooms(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    round INTEGER NOT NULL DEFAULT 1,
    remark TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_interview_time CHECK (end_time > start_time)
);

CREATE INDEX idx_interview_interviewer_time ON interview_schedules(interviewer_id, start_time, end_time);
CREATE INDEX idx_interview_room_time ON interview_schedules(room_id, start_time, end_time);
CREATE INDEX idx_interview_candidate ON interview_schedules(candidate_id);
CREATE INDEX idx_interview_status ON interview_schedules(status);

-- 7. Offer审批单表
CREATE TABLE offer_approvals (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    position_id BIGINT REFERENCES positions(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    salary_package VARCHAR(255),
    onboarding_date DATE,
    current_node INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_offer_approvals_candidate ON offer_approvals(candidate_id);
CREATE INDEX idx_offer_approvals_status ON offer_approvals(status);

-- 8. Offer审批节点表（多级审批：用人主管 → HRD → 总经理）
CREATE TABLE offer_approval_nodes (
    id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL REFERENCES offer_approvals(id) ON DELETE CASCADE,
    node_order INTEGER NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    approver_name VARCHAR(100),
    approver_id BIGINT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    comment TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_node_status CHECK (status IN ('PENDING','APPROVED','REJECTED'))
);

CREATE INDEX idx_offer_nodes_approval ON offer_approval_nodes(approval_id, node_order);

-- 9. 注入演示数据：面试官
INSERT INTO interviewers (name, email, department, title) VALUES
('陈志远', 'chenzy@example.com', '技术中台', '技术总监'),
('林晓芸', 'linxy@example.com', '技术中台', '高级架构师'),
('赵建国', 'zhaojg@example.com', '人力资源部', '招聘经理'),
('孙婉婷', 'sunwt@example.com', '人力资源部', 'HRD'),
('周明辉', 'zhoumh@example.com', '总经理办公室', '总经理');

-- 10. 注入演示数据：会议室
INSERT INTO meeting_rooms (name, location, capacity) VALUES
('创新厅A', '3楼-301', 6),
('协作厅B', '3楼-302', 10),
('愿景厅C', '5楼-501', 4),
('星辰会议室', '5楼-502', 8);
