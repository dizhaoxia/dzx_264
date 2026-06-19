import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Button,
  DatePicker,
  Space,
  Spin,
  message,
  Tooltip,
  Table,
  Tag,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import { analyticsApi } from '@/services/api';
import type {
  AnalyticsSummary,
  TrendPoint,
  ChannelSummary,
} from '@/types';

const { RangePicker } = DatePicker;

const CHANNEL_COLORS: Record<string, string> = {
  BOSS直聘: '#1890ff',
  猎聘: '#52c41a',
  内推: '#722ed1',
  校园: '#fa8c16',
};

const fmtHours = (h: number | null | undefined) => {
  if (h === null || h === undefined) return '—';
  if (h >= 24) return `${(h / 24).toFixed(1)} 天`;
  return `${h.toFixed(1)} 小时`;
};

const fmtPct = (p: number) => `${(p * 100).toFixed(1)}%`;

const AnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(90, 'day'),
    dayjs(),
  ]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const chartRefs = useRef<Record<string, InstanceType<typeof ReactECharts> | null>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = range[0]?.format('YYYY-MM-DD');
      const end = range[1]?.format('YYYY-MM-DD');
      const [sumRes, trendRes] = await Promise.all([
        analyticsApi.summary(start, end),
        analyticsApi.trend(start, end),
      ]);
      setSummary(sumRes.data);
      setTrend(trendRes.data);
    } catch (e: any) {
      message.error(e?.message || '加载分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [range]);

  useEffect(() => {
    const handler = () => {
      Object.values(chartRefs.current).forEach((inst) =>
        inst?.getEchartsInstance()?.resize()
      );
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await analyticsApi.refresh();
      message.success(`事实表已刷新，共 ${res.data.count} 条记录`);
      await fetchData();
    } catch (e: any) {
      message.error(e?.message || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const totals = useMemo(() => {
    const channels = summary?.channels ?? [];
    const totalApps = channels.reduce((s, c) => s + c.applicationCount, 0);
    const totalScreening = channels.reduce(
      (s, c) => s + c.screeningPassedCount,
      0
    );
    const totalOffers = channels.reduce((s, c) => s + c.offerCount, 0);
    const passRate = totalApps > 0 ? totalScreening / totalApps : 0;
    const hoursRows = channels.filter(
      (c) => c.avgScreeningToOfferHours !== null && c.avgScreeningToOfferHours !== undefined
    );
    const avgHours =
      hoursRows.length > 0
        ? hoursRows.reduce((s, c) => s + (c.avgScreeningToOfferHours || 0), 0) /
          hoursRows.length
        : null;
    return {
      totalApps,
      totalScreening,
      totalOffers,
      passRate,
      avgHours,
      channelCount: channels.length,
    };
  }, [summary]);

  const channelBarOption = useMemo(() => {
    const channels = summary?.channels ?? [];
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['投递量', 'Offer数', '筛选通过率'] },
      grid: { left: 50, right: 60, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: channels.map((c) => c.source),
      },
      yAxis: [
        { type: 'value', name: '数量' },
        { type: 'value', name: '通过率', axisLabel: { formatter: '{value}%' }, max: 100 },
      ],
      series: [
        {
          name: '投递量',
          type: 'bar',
          data: channels.map((c) => c.applicationCount),
          itemStyle: { color: '#1890ff' },
        },
        {
          name: 'Offer数',
          type: 'bar',
          data: channels.map((c) => c.offerCount),
          itemStyle: { color: '#52c41a' },
        },
        {
          name: '筛选通过率',
          type: 'line',
          yAxisIndex: 1,
          data: channels.map((c) =>
            Number((c.screeningPassRate * 100).toFixed(1))
          ),
          itemStyle: { color: '#fa8c16' },
          lineStyle: { width: 2 },
        },
      ],
    };
  }, [summary]);

  const funnelOption = useMemo(() => {
    const funnel = summary?.funnel ?? [];
    const data = funnel.map((f) => ({
      name: f.stage,
      value: f.count,
    }));
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
      series: [
        {
          name: '转化漏斗',
          type: 'funnel',
          left: '10%',
          width: '80%',
          top: 20,
          bottom: 20,
          minSize: '20%',
          label: { show: true, position: 'inside', formatter: '{b} {c}' },
          itemStyle: { borderColor: '#fff', borderWidth: 1 },
          data,
          color: ['#1890ff', '#36cfc9', '#52c41a', '#722ed1', '#fa8c16'],
        },
      ],
    };
  }, [summary]);

  const trendOption = useMemo(() => {
    const dates = Array.from(new Set(trend.map((t) => t.date))).sort();
    const sources = Array.from(new Set(trend.map((t) => t.source)));
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: sources },
      grid: { left: 50, right: 30, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates.map((d) => dayjs(d).format('MM-DD')),
      },
      yAxis: {
        type: 'value',
        name: '平均耗时(小时)',
      },
      series: sources.map((src) => ({
        name: src,
        type: 'line',
        smooth: true,
        connectNulls: true,
        data: dates.map((d) => {
          const point = trend.find((t) => t.date === d && t.source === src);
          return point?.avgHours ?? null;
        }),
        itemStyle: { color: CHANNEL_COLORS[src] || '#8c8c8c' },
      })),
    };
  }, [trend]);

  const trendOfferOption = useMemo(() => {
    const dates = Array.from(new Set(trend.map((t) => t.date))).sort();
    const sources = Array.from(new Set(trend.map((t) => t.source)));
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: sources },
      grid: { left: 50, right: 30, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates.map((d) => dayjs(d).format('MM-DD')),
      },
      yAxis: { type: 'value', name: 'Offer数' },
      series: sources.map((src) => ({
        name: src,
        type: 'line',
        smooth: true,
        data: dates.map((d) => {
          const point = trend.find((t) => t.date === d && t.source === src);
          return point?.offerCount ?? 0;
        }),
        itemStyle: { color: CHANNEL_COLORS[src] || '#8c8c8c' },
      })),
    };
  }, [trend]);

  const columns: ColumnsType<ChannelSummary> = [
    {
      title: '渠道',
      dataIndex: 'source',
      render: (v: string) => (
        <Tag color={CHANNEL_COLORS[v] || 'default'}>{v}</Tag>
      ),
    },
    { title: '投递量', dataIndex: 'applicationCount', sorter: (a, b) => a.applicationCount - b.applicationCount },
    { title: '筛选通过数', dataIndex: 'screeningPassedCount' },
    {
      title: '筛选通过率',
      dataIndex: 'screeningPassRate',
      render: (v: number) => fmtPct(v),
      sorter: (a, b) => a.screeningPassRate - b.screeningPassRate,
    },
    { title: 'Offer数', dataIndex: 'offerCount', sorter: (a, b) => a.offerCount - b.offerCount },
    {
      title: '初筛→Offer平均耗时',
      dataIndex: 'avgScreeningToOfferHours',
      render: (v: number | null) => fmtHours(v),
      sorter: (a, b) => (a.avgScreeningToOfferHours ?? 0) - (b.avgScreeningToOfferHours ?? 0),
    },
  ];

  const summaryCards = [
    {
      label: '总投递量',
      value: totals.totalApps,
      unit: '人',
      icon: <ThunderboltOutlined />,
      color: '#1890ff',
    },
    {
      label: '筛选通过率',
      value: fmtPct(totals.passRate),
      icon: <RiseOutlined />,
      color: '#52c41a',
    },
    {
      label: 'Offer数',
      value: totals.totalOffers,
      unit: '人',
      icon: <CheckCircleOutlined />,
      color: '#722ed1',
    },
    {
      label: '平均初筛→Offer耗时',
      value: fmtHours(totals.avgHours),
      icon: <ClockCircleOutlined />,
      color: '#fa8c16',
    },
    {
      label: '活跃渠道数',
      value: totals.channelCount,
      unit: '个',
      icon: <ThunderboltOutlined />,
      color: '#13c2c2',
    },
  ];

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h2 className="page-header-title">招聘渠道分析看板</h2>
          <div className="page-header-subtitle">
            基于预先聚合的统计事实表，多维度对比各招聘渠道的转化与耗时
          </div>
        </div>
        <Space>
          <RangePicker
            value={range}
            onChange={(vals) => {
              if (vals && vals[0] && vals[1]) {
                setRange([vals[0], vals[1]]);
              }
            }}
            allowClear={false}
          />
          <Tooltip title="重建事实表（从候选人与阶段日志重新聚合）">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={refreshing}
            >
              刷新事实表
            </Button>
          </Tooltip>
        </Space>
      </header>

      <div className="page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : summary ? (
          <>
            <div className="analytics-summary-row">
              {summaryCards.map((c) => (
                <div className="analytics-summary-card" key={c.label}>
                  <div className="analytics-summary-label">
                    <Space>
                      <span style={{ color: c.color }}>{c.icon}</span>
                      {c.label}
                    </Space>
                  </div>
                  <div className="analytics-summary-value">
                    {c.value}
                    {c.unit && <span className="unit">{c.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="analytics-chart-card">
              <div className="analytics-chart-title">渠道对比（投递量 / Offer / 通过率）</div>
              <ReactECharts
                ref={(inst) => (chartRefs.current['bar'] = inst)}
                option={channelBarOption}
                style={{ height: 320 }}
              />
            </div>

            <div className="analytics-chart-card">
              <div className="analytics-chart-title">转化漏斗（初筛 → Offer）</div>
              {summary.funnel.length > 0 ? (
                <ReactECharts
                  ref={(inst) => (chartRefs.current['funnel'] = inst)}
                  option={funnelOption}
                  style={{ height: 320 }}
                />
              ) : (
                <Empty description="暂无漏斗数据" style={{ padding: 40 }} />
              )}
            </div>

            <div className="analytics-chart-card">
              <div className="analytics-chart-title">初筛→Offer 平均耗时趋势（小时）</div>
              {trend.length > 0 ? (
                <ReactECharts
                  ref={(inst) => (chartRefs.current['trendHours'] = inst)}
                  option={trendOption}
                  style={{ height: 300 }}
                />
              ) : (
                <Empty description="暂无耗时趋势数据" style={{ padding: 40 }} />
              )}
            </div>

            <div className="analytics-chart-card">
              <div className="analytics-chart-title">Offer 数量趋势</div>
              {trend.length > 0 ? (
                <ReactECharts
                  ref={(inst) => (chartRefs.current['trendOffer'] = inst)}
                  option={trendOfferOption}
                  style={{ height: 300 }}
                />
              ) : (
                <Empty description="暂无 Offer 趋势数据" style={{ padding: 40 }} />
              )}
            </div>

            <div className="analytics-chart-card analytics-channel-table">
              <div className="analytics-chart-title">渠道明细对比</div>
              <Table
                rowKey="source"
                columns={columns}
                dataSource={summary.channels}
                pagination={false}
                size="middle"
              />
            </div>
          </>
        ) : (
          <div className="search-empty">
            <Empty description="暂无分析数据" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
