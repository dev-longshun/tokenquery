import React, { useEffect, useState } from 'react';
import {
  Layout, Card, Table, Button, Modal, Form, Toast, Space, Typography,
  Tag, Popconfirm,
} from '@douyinfe/semi-ui';
import { IconPlus, IconEdit, IconDelete } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const { Header, Content } = Layout;
const { Title } = Typography;

export default function AdminSites() {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null=create, {...}=edit
  const [modalOpen, setModalOpen] = useState(false);
  const [formApi, setFormApi] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/sites');
      if (r.data?.success) setSites(r.data.data || []);
      else Toast.error(r.data?.message);
    } catch (e) {
      Toast.error(e.response?.data?.message || e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!localStorage.getItem('tq_admin_token')) { navigate('/admin'); return; }
    load();
  }, []);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setModalOpen(true); };

  const submit = async (values) => {
    try {
      if (editing) {
        const r = await api.put(`/admin/sites/${editing.id}`, values);
        if (!r.data?.success) throw new Error(r.data?.message);
        Toast.success('已更新');
      } else {
        const r = await api.post('/admin/sites', values);
        if (!r.data?.success) throw new Error(r.data?.message);
        Toast.success('已添加');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      Toast.error(e.response?.data?.message || e.message);
    }
  };

  const del = async (id) => {
    try {
      const r = await api.delete(`/admin/sites/${id}`);
      if (!r.data?.success) throw new Error(r.data?.message);
      Toast.success('已删除');
      load();
    } catch (e) {
      Toast.error(e.response?.data?.message || e.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('tq_admin_token');
    navigate('/admin');
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '域名 (Host)', dataIndex: 'host', width: 260 },
    { title: '站点名称', dataIndex: 'name', width: 200 },
    { title: 'NewAPI Base URL', dataIndex: 'base_url' },
    { title: '备注', dataIndex: 'note', width: 200 },
    {
      title: '状态', dataIndex: 'disabled', width: 80,
      render: (v) => v ? <Tag color='grey'>禁用</Tag> : <Tag color='green'>启用</Tag>,
    },
    {
      title: '操作', width: 160,
      render: (_, row) => (
        <Space>
          <Button size='small' icon={<IconEdit />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title='确定删除该站点？' onConfirm={() => del(row.id)}>
            <Button size='small' type='danger' icon={<IconDelete />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f7f8fa' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid var(--semi-color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title heading={4} style={{ margin: 0 }}>站点管理</Title>
        <Button onClick={logout}>退出登录</Button>
      </Header>
      <Content style={{ padding: 24, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <Card
          title={`站点列表（${sites.length}）`}
          headerExtraContent={<Button theme='solid' type='primary' icon={<IconPlus />} onClick={openCreate}>新增站点</Button>}
        >
          <Table columns={columns} dataSource={sites} rowKey='id' loading={loading} pagination={false} />
        </Card>
        <Modal title={editing ? '编辑站点' : '新增站点'} visible={modalOpen} onCancel={() => setModalOpen(false)}
          footer={null} destroyOnClose>
          <Form initValues={editing || { disabled: false }} onSubmit={submit} getFormApi={setFormApi}>
            <Form.Input field='host' label='域名 (Host)' placeholder='例如 query-hk.example.com'
              rules={[{ required: true, message: '必填' }]} />
            <Form.Input field='name' label='站点名称' placeholder='显示给客户看的名字'
              rules={[{ required: true, message: '必填' }]} />
            <Form.Input field='base_url' label='NewAPI Base URL' placeholder='https://api.example.com'
              rules={[{ required: true, message: '必填' }]} />
            <Form.TextArea field='note' label='备注' autosize rows={2} />
            <Form.Switch field='disabled' label='禁用' />
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <Space>
                <Button onClick={() => setModalOpen(false)}>取消</Button>
                <Button theme='solid' type='primary' htmlType='submit'>提交</Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
}
