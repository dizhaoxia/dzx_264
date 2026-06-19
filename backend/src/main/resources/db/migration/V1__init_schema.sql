CREATE TABLE positions (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    job_description TEXT,
    qualifications TEXT,
    stage_template JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE candidates (
    id BIGSERIAL PRIMARY KEY,
    position_id BIGINT REFERENCES positions(id),
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    work_years INTEGER,
    skills TEXT[],
    current_stage VARCHAR(100) NOT NULL DEFAULT '初筛',
    confidence_score DECIMAL(5,2),
    resume_file_url VARCHAR(500),
    parsed_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0,
    card_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE stage_logs (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    from_stage VARCHAR(100) NOT NULL,
    to_stage VARCHAR(100) NOT NULL,
    operator_id BIGINT,
    remark TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidates_position ON candidates(position_id);
CREATE INDEX idx_candidates_stage ON candidates(current_stage);
CREATE INDEX idx_stage_logs_candidate ON stage_logs(candidate_id);
