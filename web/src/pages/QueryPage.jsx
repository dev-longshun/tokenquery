import React, { useEffect, useMemo, useState } from 'react';
import { api, formatQuotaAsUSD, formatTimestamp } from '../utils/api';

const PAGE_SIZE = 20;

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
  const [filters, setFilters] = useState({ model_name: '', request_id: '', start: '', end: '' });

  useEffect(() => {
    api.get('/site').then((r) => {
      if (r.data?.success) setSiteInfo(r.data.data);
      else setSiteErr(r.data?.message || '站点未绑定');
    }).catch((e) => setSiteErr(e.message));
  }, []);

  const filterTimestamps = useMemo(() => {
    return {
      start: filters.start ? Math.floor(new Date(filters.start).getTime() / 1000) : 0,
      end: filters.end ? Math.floor(new Date(filters.end).getTime() / 1000) : 0,
    };
  }, [filters.start, filters.end]);

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
      const res = await api.get('/logs/export', { headers: { 'X-Token-Key': key }, params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers['content-disposition'] || '';
      const m = disp.match(/filename="?([^"]+)"?/i);
      a.download = m ? m[1] : `token-logs-${Date.now()}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message || '导出失败'); }
    finally { setExporting(false); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ borderBottom: 'var(--border)', padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
          令牌查询{siteInfo ? ` · ${siteInfo.name}` : ''}
        </h1>
      </header>

      <div className="container page-padding">
        {siteErr && (
          <div className="nb-card-static animate-fade-in-up" style={{ background: 'var(--yellow)', marginBottom: 'var(--space-6)' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{siteErr}</p>
          </div>
        )}

        {/* Search */}
        <div className="nb-card-static animate-fade-in-up" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="nb-label">令牌密钥</label>
              <input className="nb-input" type="password" placeholder="粘贴 sk-xxx" value={tokenKey} onChange={(e) => setTokenKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doFetch(1)} />
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.75rem', color: 'rgba(26,20,35,0.5)' }}>🔒 你的密钥仅用于实时查询，不会被存储</p>
            </div>
            <div>
              <label className="nb-label">开始时间</label>
              <input className="nb-input" type="datetime-local" value={filters.start} onChange={(e) => setFilters(f => ({ ...f, start: e.target.value }))} />
            </div>
            <div>
              <label className="nb-label">结束时间</label>
              <input className="nb-input" type="datetime-local" value={filters.end} onChange={(e) => setFilters(f => ({ ...f, end: e.target.value }))} />
            </div>
            <div>
              <label className="nb-label">模型名</label>
              <input className="nb-input" placeholder="子串匹配" value={filters.model_name} onChange={(e) => setFilters(f => ({ ...f, model_name: e.target.value }))} />
            </div>
            <div>
              <label className="nb-label">Request ID</label>
              <input className="nb-input" placeholder="精确匹配" value={filters.request_id} onChange={(e) => setFilters(f => ({ ...f, request_id: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="nb-btn nb-btn-primary" onClick={() => doFetch(1)} disabled={loading}>
              {loading ? '查询中...' : '查询'}
            </button>
            <button className="nb-btn nb-btn-secondary" onClick={handleExport} disabled={!usage || exporting}>
              {exporting ? '导出中...' : '导出 CSV'}
            </button>
          </div>
        </div>

        {error && (
          <div className="nb-card-static animate-fade-in-up" style={{ background: 'var(--red)', color: 'var(--cream)', marginBottom: 'var(--space-6)' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {/* Usage cards */}
        {usage && (
          <div className="animate-fade-in-up animate-delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <StatCard label="令牌名称" value={usage.name || '-'} bg="var(--ink)" color="var(--cream)" />
            <StatCard label="总额度" value={usage.unlimited_quota ? '无限' : formatQuotaAsUSD(usage.total_granted)} bg="var(--green)" color="var(--cream)" />
            <StatCard label="已使用" value={formatQuotaAsUSD(usage.total_used)} bg="var(--orange)" color="var(--cream)" />
            <StatCard label="剩余" value={usage.unlimited_quota ? '无限' : formatQuotaAsUSD(usage.total_available)} bg="var(--blue)" color="var(--cream)" />
          </div>
        )}

        {/* Logs table */}
        {logs.length > 0 && (
          <div className="nb-card-static animate-fade-in-up animate-delay-2" style={{ padding: 0, overflow: 'auto' }}>
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid rgba(26,20,35,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>使用日志（共 {total} 条）</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="nb-table">
                <thead>
                  <tr>
                    <th>时间</th><th>令牌</th><th>模型</th><th>用时</th>
                    <th>提示</th><th>补全</th><th>配额</th><th>流式</th><th>Request ID</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{formatTimestamp(log.created_at)}</td>
                      <td>{log.token_name || '-'}</td>
                      <td style={{ maxWidth: 200 }} className="truncate">{log.model_name || '-'}</td>
                      <td className="mono">{log.use_time ? `${log.use_time}s` : '-'}</td>
                      <td className="mono">{log.prompt_tokens}</td>
                      <td className="mono">{log.completion_tokens}</td>
                      <td className="mono">{formatQuotaAsUSD(log.quota)}</td>
                      <td>{log.is_stream ? <span className="nb-badge nb-badge-active">是</span> : <span className="nb-badge">否</span>}</td>
                      <td className="mono truncate" style={{ maxWidth: 160 }}>{log.request_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button className="nb-btn nb-btn-sm nb-btn-secondary" disabled={page <= 1} onClick={() => doFetch(page - 1)}>上一页</button>
                <span style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.8125rem', fontWeight: 600 }}>{page} / {totalPages}</span>
                <button className="nb-btn nb-btn-sm nb-btn-secondary" disabled={page >= totalPages} onClick={() => doFetch(page + 1)}>下一页</button>
              </div>
            )}
          </div>
        )}

        {!loading && logs.length === 0 && usage && (
          <div className="nb-card-static animate-fade-in-up" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <p style={{ fontSize: '0.875rem', color: 'rgba(26,20,35,0.5)' }}>暂无日志记录</p>
          </div>
        )}
      </div>

      <footer style={{ textAlign: 'center', padding: 'var(--space-6)', fontSize: '0.75rem', color: 'rgba(26,20,35,0.4)' }}>
        Powered by tokenquery
      </footer>
    </div>
  );
}

function StatCard({ label, value, bg, color }) {
  return (
    <div className="nb-card-sm" style={{ background: bg, color }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
