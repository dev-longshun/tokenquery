import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LocaleProvider } from '@douyinfe/semi-ui';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import QueryPage from './pages/QueryPage';
import AdminLogin from './pages/AdminLogin';
import AdminSites from './pages/AdminSites';

ReactDOM.createRoot(document.getElementById('root')).render(
  <LocaleProvider locale={zh_CN}>
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<QueryPage />} />
        <Route path='/admin' element={<AdminLogin />} />
        <Route path='/admin/sites' element={<AdminSites />} />
      </Routes>
    </BrowserRouter>
  </LocaleProvider>,
);
