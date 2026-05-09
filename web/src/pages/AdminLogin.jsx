import React, { useState } from 'react';
import { Card, Form, Button, Toast, Typography } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const { Title } = Typography;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const r = await api.post('/admin/login', values);
      if (r.data?.success) {
        localStorage.setItem('tq_admin_token', r.data.data.token);
        Toast.success('登录成功');
        navigate('/admin/sites');
      } else {
        Toast.error(r.data?.message || '登录失败');
      }
    } catch (e) {
      Toast.error(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fa' }}>
      <Card style={{ width: 360 }}>
        <Title heading={4} style={{ marginBottom: 24, textAlign: 'center' }}>管理员登录</Title>
        <Form onSubmit={onSubmit}>
          <Form.Input field='username' label='用户名' rules={[{ required: true, message: '必填' }]} />
          <Form.Input field='password' label='密码' type='password' rules={[{ required: true, message: '必填' }]} />
          <Button theme='solid' type='primary' htmlType='submit' block loading={loading} style={{ marginTop: 8 }}>登录</Button>
        </Form>
      </Card>
    </div>
  );
}
