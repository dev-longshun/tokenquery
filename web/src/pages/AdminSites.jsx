import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function AdminSites() {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ host: '', name: '', base_url: '', note: '', disabled: false });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/sites');
      if (r.data?.success) setSites(r.data.data || []);
    } catch (e) {
      if (e.response?.status === 401) { navigate('/admin'); return; }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!localStorage.getItem('tq_admin_token')) { navigate('/admin'); return; }
    load();
  }, []);

  const openCreate = () => { setEditing(null); setForm({ host: '', name: '', base_url: '', note: '', disabled: false }); setError(''); setModalOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ host: s.host, name: s.name, base_url: s.base_url, note: s.note || '', disabled: s.disabled }); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        const r = await api.put(`/admin/sites/${editing.id}`, form);
        if (!r.data?.success) throw new Error(r.data?.message);
      } else {
        const r = await api.post('/admin/sites', form);
        if (!r.data?.success) throw new Error(r.data?.message);
      }
      setModalOpen(false); load();
    } catch (e) { setError(e.response?.data?.message || e.message); }
  };

  const del = async (id) => {
    if (!confirm('确定删除该站点？')) return;
    try {
      const r = await api.delete(`/admin/sites/${id}`);
      if (!r.data?.success) throw new Error(r.data?.message);
      load();
    } catch (e) { alert(e.message); }
  };

  const logout = () => { localStorage.removeItem('tq_admin_token'); navigate('/admin'); };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header style={{ borderBottom: 'var(--border)', padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>站点管理</h1>
        <button className="nb-btn nb-btn-sm nb-btn-secondary" onClick={logout}>退出登录</button>
      </header>

      <div className="container page-padding">
        <div className="animate-fade-in-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>站点列表（{sites.length}）</h2>
          <button className="nb-btn nb-btn-primary" onClick={openCreate}>+ 新增站点</button>
        </div>

        <div className="nb-card-static animate-fade-in-up animate-delay-1" style={{ padding: 0, overflow: 'auto' }}>
          <table className="nb-table">
            <thead>
              <tr>
                <th>ID</th><th>域名 (Host)</th><th>站点名称</th><th>NewAPI Base URL</th><th>备注</th><th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'rgba(26,20,35,0.4)' }}>暂无站点，点击上方按钮新增</td></tr>
              )}
              {sites.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id}</td>
                  <td style={{ fontWeight: 600 }}>{s.host}</td>
                  <td>{s.name}</td>
                  <td className="mono truncate" style={{ maxWidth: 280 }}>{s.base_url}</td>
                  <td className="truncate" style={{ maxWidth: 160 }}>{s.note || '-'}</td>
                  <td>{s.disabled ? <span className="nb-badge nb-badge-dead">禁用</span> : <span className="nb-badge nb-badge-active">启用</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button className="nb-btn nb-btn-sm nb-btn-secondary" onClick={() => openEdit(s)}>编辑</button>
                      <button className="nb-btn nb-btn-sm nb-btn-danger" onClick={() => del(s.id)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="nb-backdrop" onClick={() => setModalOpen(false)}>
          <div className="nb-card animate-fade-in-up" style={{ width: 480, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 'var(--space-6)' }}>{editing ? '编辑站点' : '新增站点'}</h3>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="nb-label">域名 (Host)</label>
                <input className="nb-input" placeholder="例如 query-hk.example.com" value={form.host} onChange={(e) => setForm(f => ({ ...f, host: e.target.value }))} required />
              </div>
              <div>
                <label className="nb-label">站点名称</label>
                <input className="nb-input" placeholder="显示给客户看的名字" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="nb-label">NewAPI Base URL</label>
                <input className="nb-input" placeholder="https://api.example.com" value={form.base_url} onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))} required />
              </div>
              <div>
                <label className="nb-label">备注</label>
                <input className="nb-input" value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input type="checkbox" id="disabled" checked={form.disabled} onChange={(e) => setForm(f => ({ ...f, disabled: e.target.checked }))} />
                <label htmlFor="disabled" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>禁用</label>
              </div>
              {error && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', fontWeight: 600, margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" className="nb-btn nb-btn-secondary" onClick={() => setModalOpen(false)}>取消</button>
                <button type="submit" className="nb-btn nb-btn-primary">提交</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
