import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.post('/admin/login', { username, password });
      if (r.data?.success) {
        localStorage.setItem('tq_admin_token', r.data.data.token);
        navigate('/admin/sites');
      } else {
        setError(r.data?.message || '登录失败');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="nb-card animate-fade-in-up" style={{ width: 380, maxWidth: '90vw' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-6)', textAlign: 'center', letterSpacing: '-0.03em' }}>管理员登录</h2>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="nb-label">用户名</label>
            <input className="nb-input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="nb-label">密码</label>
            <input className="nb-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', fontWeight: 600, margin: 0 }}>{error}</p>}
          <button className="nb-btn nb-btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 'var(--space-2)' }}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
