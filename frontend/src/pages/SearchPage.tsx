import React, { useEffect, useState, useCallback } from 'react';
import {
  Input,
  Select,
  Button,
  Spin,
  Empty,
  Pagination,
  Tag,
  Tooltip,
  Typography,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BankOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { searchApi, positionApi } from '@/services/api';
import type { SearchResult, SearchSortBy, Position } from '@/types';

const { Text } = Typography;

const SORT_OPTIONS: { value: SearchSortBy; label: string }[] = [
  { value: 'relevance', label: '匹配度优先' },
  { value: 'updatedAt', label: '更新时间' },
  { value: 'education', label: '学历' },
];

const STAGE_COLORS: Record<string, string> = {
  初筛: 'default',
  一面: 'blue',
  二面: 'cyan',
  HR面: 'purple',
  Offer: 'green',
  已淘汰: 'red',
};

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SearchSortBy>('relevance');
  const [positionId, setPositionId] = useState<number | undefined>(undefined);
  const [positions, setPositions] = useState<Position[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    positionApi.getAll().then((res) => setPositions(res.data)).catch(() => {});
  }, []);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchApi.search(query, sortBy, positionId, page, size);
      setResult(res.data);
    } catch (e: any) {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [query, sortBy, positionId, page, size]);

  const handleSearch = () => {
    setPage(1);
    doSearch();
  };

  const handlePageChange = (p: number) => {
    setPage(p);
  };

  useEffect(() => {
    if (searched) {
      doSearch();
    }
  }, [page, sortBy, positionId]);

  const formatDate = (s: string) => {
    if (!s) return '';
    return s.replace('T', ' ').substring(0, 16);
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h2 className="page-header-title">人才库智能检索</h2>
          <div className="page-header-subtitle">
            支持布尔逻辑（AND / OR / NOT）与结构化过滤，毫秒级倒排索引检索
          </div>
        </div>
      </header>

      <div className="page-body">
        <div className="search-bar">
          <Input
            placeholder="例如：Java经验大于5年 AND 英语流利 NOT 外包"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            allowClear
            size="large"
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={SORT_OPTIONS}
            style={{ width: 150 }}
            size="large"
          />
          <Select
            value={positionId}
            onChange={setPositionId}
            placeholder="全部职位"
            allowClear
            style={{ width: 200 }}
            size="large"
            options={positions.map((p) => ({ value: p.id, label: p.title }))}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
            size="large"
          >
            搜索
          </Button>
          {result && (
            <Tooltip title="重新搜索">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleSearch}
                size="large"
              />
            </Tooltip>
          )}
        </div>

        <div className="search-tips">
          语法提示：<code>AND</code> 与 <code>OR</code> 或 <code>NOT</code> 非
          ；结构化过滤：<code>经验大于5年</code>、<code>经验小于3年</code>、
          <code>学历大于本科</code>、<code>学历等于硕士</code>。示例：
          <code>Java AND 经验大于5年 NOT 外包</code>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spin size="large" tip="检索中..." />
          </div>
        ) : result ? (
          <>
            <div className="search-result-count">
              共找到 <strong>{result.total}</strong> 条匹配结果
              {result.query ? `（已编译查询：${result.query}）` : ''}
            </div>

            {result.items.length === 0 ? (
              <div className="search-empty">
                <Empty description="未找到匹配的候选人" />
              </div>
            ) : (
              <div className="search-result-list">
                {result.items.map((item) => (
                  <div className="search-result-card" key={item.candidateId}>
                    <div className="search-result-head">
                      <div>
                        <span className="search-result-name">{item.name}</span>
                        <Tag
                          color={STAGE_COLORS[item.currentStage] || 'default'}
                          style={{ marginLeft: 12 }}
                        >
                          {item.currentStage}
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        匹配度 {(item.rank * 100).toFixed(1)}%
                      </Text>
                    </div>

                    <div className="search-result-meta">
                      <span>
                        <BankOutlined />
                        {item.positionTitle || `职位 #${item.positionId}`}
                      </span>
                      <span>
                        <ClockCircleOutlined />
                        {item.workYears ?? 0} 年经验
                      </span>
                      <span>
                        <TrophyOutlined />
                        {item.education || '学历未知'}
                      </span>
                      <span>
                        <EnvironmentOutlined />
                        {item.source || '未知渠道'}
                      </span>
                      <span>
                        置信度 {item.confidenceScore ?? 0}%
                      </span>
                      <span>更新于 {formatDate(item.updatedAt)}</span>
                    </div>

                    {item.snippet && (
                      <div
                        className="search-result-snippet"
                        dangerouslySetInnerHTML={{ __html: item.snippet }}
                      />
                    )}

                    {item.skills && item.skills.length > 0 && (
                      <div className="search-result-skills">
                        {item.skills.map((skill) => (
                          <Tag key={skill} color="blue" style={{ marginBottom: 0 }}>
                            {skill}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.total > size && (
              <>
                <Divider />
                <Pagination
                  current={page}
                  pageSize={size}
                  total={result.total}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  showTotal={(t) => `共 ${t} 条`}
                  style={{ textAlign: 'right', marginTop: 8 }}
                />
              </>
            )}
          </>
        ) : (
          <div className="search-empty">
            <Empty description="输入查询条件后开始检索候选人简历" />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
