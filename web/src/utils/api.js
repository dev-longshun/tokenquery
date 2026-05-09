import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 60000 });

api.interceptors.request.use((config) => {
  const tok = localStorage.getItem('tq_admin_token');
  if (tok && config.url?.startsWith('/admin') && !config.url.endsWith('/login')) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${tok}`;
  }
  return config;
});

api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && !err.config?.url?.includes('/usage') && !err.config?.url?.includes('/logs')) {
    localStorage.removeItem('tq_admin_token');
    if (window.location.pathname.startsWith('/admin')) {
      window.location.href = '/admin';
    }
  }
  return Promise.reject(err);
});

export function formatQuotaAsUSD(q, quotaPerUnit = 500000) {
  if (q === null || q === undefined) return '-';
  const v = Number(q) / quotaPerUnit;
  const s = v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return `$${s || '0'}`;
}

export function formatTimestamp(ts) {
  if (!ts) return '-';
  const d = new Date(Number(ts) * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
