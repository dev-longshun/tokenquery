import React, { useEffect, useMemo, useState } from 'react';
import {
  Layout, Typography, Card, Input, Button, Form, Table, DatePicker,
  Descriptions, Banner, Space, Tag, Tooltip, Pagination, Empty,
} from '@douyinfe/semi-ui';
import { IconSearch, IconDownload, IconKey } from '@douyinfe/semi-icons';
import { api, formatQuotaAsUSD, formatTimestamp } from '../utils/api';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const PAGE_SIZE = 20;

const columns = [
  { title: '时间', dataIndex: 'created_at', width: 170, render: formatTimestamp },
  { title: '令牌名称', dataIndex: 'token_name', width: 140 },
  { title: '模型', dataIndex: 'model_name', width: 200 },
  { title: '用时', dataIndex: 'use_time', width: 80, render: (v) => v ? `${v}s` : '-' },
  { title: '提示', dataIndex: 'prompt_tokens', width: 80 },
  { title: '补全', dataIndex: 'completion_tokens', width: 80 },
  {
    title: '配额', dataIndex: 'quota', width: 120,
    render: (v) => <Tooltip content={`原始: ${v}`}><span>{formatQuotaAsUSD(v)}</span></Tooltip>,
  },
  {
    title: '流式', dataIndex: 'is_stream', width: 70,
    render: (v) => v ? <Tag color='green'>是</Tag> : <Tag>否</Tag>,
  },
  {
    title: 'Request ID', dataIndex: 'request_id', width: 200,
    render: (v) => v ? (
      <Tooltip content={v}>
        <Text copyable={{ content: v }} style={{ fontFamily: 'monospace' }}>{v.slice(0, 12)}…</Text>
      </Tooltip>
    ) : '-',
  },
  {
    title: '备注', dataIndex: 'content',
    render: (v) => v ? (
      <Tooltip content={v}>
        <span style={{ display: 'inline-block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
      </Tooltip>
    ) : '-',
  },
];

export default function QueryPage() {
  const [siteInfo, setSiteInfo] = useState(null);
  const [siteErr, setSiteErr] = useState('');
  const [tokenKey, setTokenKey] = useState('');
  const [usage, setUsage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ model_name: '', request_id: '', range: null });

  useEffect(() => {
    api.get('/site').then((r) => {
      if (r.data?.success) setSiteInfo(r.data.data);
      else setSiteErr(r.data?.message || '站点未绑定');
    }).catch((e) => setSiteErr(e.message));
  }, []);

  const filterTimestamps = useMemo(() => {
    const r = filters.range;
    if (!r || r.length !== 2) return { start: 0, end: 0 };
    return {
      start: r[0] ? Math.floor(new Date(r[0]).getTime() / 1000) : 0,
      end: r[1] ? Math.floor(new Date(r[1]).getTime() / 1000) : 0,
    };
  }, [filters.range]);

  const normalizeKey = (k) => {
    let v = (k || '').trim();
    if (v.toLowerCase().startsWith('bearer ')) v = v.slice(7).trim();
    return v;
  };

  const doFetch = async (pageNum) => {
    const key = normalizeKey(tokenKey);
    if (!key) { setError('请输入令牌密钥'); return; }
    setLoading(true); setError('');
    try {
      const params = {
        page: pageNum, page_size: PAGE_SIZE,
        start_timestamp: filterTimestamps.start || undefined,
        end_timestamp: filterTimestamps.end || undefined,
        model_name: filters.model_name || undefined,
        request_id: filters.request_id || undefined,
      };
      const headers = { 'X-Token-Key': key };
      const [u, l] = await Promise.all([
        api.get('/usage', { headers }),
        api.get('/logs', { headers, params }),
      ]);
      if (u.data?.success) setUsage(u.data.data);
      else throw new Error(u.data?.message || '额度查询失败');
      if (l.data?.success) {
        setLogs(l.data.data.items || []);
        setTotal(l.data.data.total || 0);
        setPage(l.data.data.page || pageNum);
      } else throw new Error(l.data?.message || '日志查询失败');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setUsage(null); setLogs([]); setTotal(0);
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    const key = normalizeKey(tokenKey);
    if (!key) { setError('请先输入令牌密钥'); return; }
    setExporting(true);
    try {
      const params = {
        start_timestamp: filterTimestamps.start || undefined,
        end_timestamp: filterTimestamps.end || undefined,
        model_name: filters.model_name || undefined,
        request_id: filters.request_id || undefined,
      };
      const res = await api.get('/logs/export', {
        headers: { 'X-Token-Key': key },
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers['content-disposition'] || '';
      const m = disp.match(/filename="?([^"]+)"?/i);
      a.download = m ? m[1] : `token-logs-${Date.now()}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || '导出失败');
    } finally { setExporting(false); }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f7f8fa' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid var(--semi-color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconKey size='large' />
        <Title heading={4} style={{ margin: 0 }}>令牌查询{siteInfo ? ` · ${siteInfo.name}` : ''}</Title>
      </Header>
      <Content style={{ padding: 24, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {siteErr && <Banner type='warning' description={siteErr} closeIcon={null} style={{ marginBottom: 16 }} />}
        <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 20 }}>
          <Form layout='horizontal' onSubmit={() => doFetch(1)} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <Input prefix='sk-' placeholder='粘贴令牌密钥' style={{ width: 420 }} value={tokenKey} onChange={setTokenKey} mode='password' />
            <DatePicker type='dateTimeRange' style={{ width: 360 }} value={filters.range} onChange={(v) => setFilters((f) => ({ ...f, range: v }))} placeholder={['开始', '结束']} />
            <Input placeholder='模型名（子串匹配）' style={{ width: 180 }} value={filters.model_name} onChange={(v) => setFilters((f) => ({ ...f, model_name: v }))} />
            <Input placeholder='Request ID' style={{ width: 200 }} value={filters.request_id} onChange={(v) => setFilters((f) => ({ ...f, request_id: v }))} />
            <Space>
              <Button theme='solid' type='primary' icon={<IconSearch />} onClick={() => doFetch(1)} loading={loading}>查询</Button>
              <Button icon={<IconDownload />} onClick={handleExport} loading={exporting} disabled={!usage}>导出 CSV</Button>
            </Space>
          </Form>
        </Card>
        {error && <Banner type='danger' description={error} closeIcon={null} style={{ marginBottom: 16 }} />}
        {usage && (
          <Card title='额度概览' style={{ marginBottom: 16 }}>
            <Descriptions row size='large' data={[
              { key: '令牌名称', value: usage.name || '-' },
              { key: '总额度', value: usage.unlimited_quota ? '无限' : formatQuotaAsUSD(usage.total_granted) },
              { key: '已使用', value: formatQuotaAsUSD(usage.total_used) },
              { key: '剩余', value: usage.unlimited_quota ? '无限' : formatQuotaAsUSD(usage.total_available) },
              { key: '过期时间', value: (!usage.expires_at || usage.expires_at === -1) ? '永不过期' : formatTimestamp(usage.expires_at) },
            ]} />
          </Card>
        )}
        <Card title={`使用日志${total ? `（共 ${total} 条）` : ''}`} bodyStyle={{ padding: 0 }}>
          <Table columns={columns} dataSource={logs} rowKey='id' loading={loading} pagination={false}
            empty={<Empty title='暂无数据' description='输入令牌后点击查询' />} scroll={{ x: 1280 }} />
          {total > PAGE_SIZE && (
            <div style={{ padding: 16, textAlign: 'right' }}>
              <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} onChange={doFetch} showTotal />
            </div>
          )}
        </Card>
      </Content>
      <Footer style={{ textAlign: 'center', padding: 16, color: 'var(--semi-color-text-2)' }}>Powered by tokenquery</Footer>
    </Layout>
  );
}
