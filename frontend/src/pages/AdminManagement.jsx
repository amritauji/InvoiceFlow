import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

const roleLabels = {
  department_user: 'Department User', accountant_1: 'Accountant 1', accountant_2: 'Accountant 2',
  accounts_team: 'Accounts Team', accounts_head: 'Accounts Head',
  ceo: 'CEO', manager: 'Manager', admin: 'Admin',
};

const roleBadgeColors = {
  admin: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  accountant_1: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  accountant_2: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  accounts_team: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  accounts_head: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ceo: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  manager: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  department_user: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

const workflowStages = [
  { icon: 'person', role: 'Dept User', desc: 'Initiator', color: 'bg-indigo-600 text-white ring-indigo-100 dark:ring-[#1e2538]' },
  { icon: 'calculate', role: 'Accountant 1', desc: 'Verification', color: 'bg-white border-2 border-indigo-600 text-indigo-600 ring-indigo-100 dark:bg-[#1e2538] dark:border-indigo-400 dark:text-indigo-400 dark:ring-[#1e2538]' },
  { icon: 'account_balance_wallet', role: 'Accountant 2', desc: 'Review', color: 'bg-white border-2 border-gray-300 text-gray-400 ring-gray-100 dark:bg-[#1e2538] dark:border-[#454653] dark:text-[#8d95b0] dark:ring-[#1e2538]' },
  { icon: 'work', role: 'Manager', desc: 'Approval', color: 'bg-white border-2 border-gray-300 text-gray-400 ring-gray-100 dark:bg-[#1e2538] dark:border-[#454653] dark:text-[#8d95b0] dark:ring-[#1e2538]' },
  { icon: 'verified_user', role: 'CEO', desc: 'Final', color: 'bg-white border-2 border-gray-300 text-gray-400 ring-gray-100 dark:bg-[#1e2538] dark:border-[#454653] dark:text-[#8d95b0] dark:ring-[#1e2538]' },
];

function UserFormModal({ isOpen, onClose, onSave, user, departments }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'department_user', department_id: '', phone: '' });
  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name, email: user.email, password: '', role: user.role, department_id: user.department_id || '', phone: user.phone || '' });
    } else {
      setForm({ full_name: '', email: '', password: '', role: 'department_user', department_id: '', phone: '' });
    }
  }, [user, isOpen]);

  if (!isOpen) return null;
  const isEdit = !!user;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1e2538] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2e3650] w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2e3650] flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#e1e3f0]">{isEdit ? 'Edit User' : 'New User'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] hover:text-gray-600 dark:hover:text-[#e1e3f0] transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Full Name</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Email</label>
            <input type="email" className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={isEdit} />
          </div>
          {!isEdit && (
            <div>
              <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Password</label>
              <input type="password" className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Role</label>
            <select className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm bg-white outline-none focus:border-indigo-500 transition-colors" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Department</label>
            <select className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm bg-white outline-none focus:border-indigo-500 transition-colors" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">None</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Phone</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2e3650] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] rounded-lg transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">{isEdit ? 'Save Changes' : 'Create User'}</button>
        </div>
      </div>
    </div>
  );
}

function DeptFormModal({ isOpen, onClose, onSave, department }) {
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  useEffect(() => {
    if (department) {
      setForm({ name: department.name, code: department.code, description: department.description || '' });
    } else {
      setForm({ name: '', code: '', description: '' });
    }
  }, [department, isOpen]);

  if (!isOpen) return null;
  const isEdit = !!department;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1e2538] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#2e3650] w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2e3650] flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#e1e3f0]">{isEdit ? 'Edit Department' : 'New Department'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Name</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Code</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={isEdit} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Description</label>
            <input className="w-full mt-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] dark:bg-[#242c42] dark:text-[#e1e3f0] rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2e3650] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] rounded-lg transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">{isEdit ? 'Save Changes' : 'Create Department'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminManagement() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const limit = 10;

  const [userModal, setUserModal] = useState({ open: false, user: null });
  const [deptModal, setDeptModal] = useState({ open: false, dept: null });

  const fetchUsers = () => {
    setLoading(true);
    api.get('/admin/users', { params: { limit, offset: userPage * limit } })
      .then(({ data }) => { setUsers(data.data); setTotalUsers(data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchDepartments = () => {
    api.get('/admin/departments')
      .then(({ data }) => setDepartments(data.data))
      .catch(() => {});
  };

  useEffect(() => { fetchUsers(); }, [userPage]);
  useEffect(() => { fetchDepartments(); }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const deptMemberCounts = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      if (u.department_id) counts[u.department_id] = (counts[u.department_id] || 0) + 1;
    });
    return counts;
  }, [users]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveUser = async (form) => {
    try {
      if (userModal.user) {
        await api.patch(`/admin/users/${userModal.user.id}`, {
          full_name: form.full_name,
          role: form.role,
          department_id: form.department_id || null,
          phone: form.phone || null,
        });
        showToast('success', 'User updated successfully');
      } else {
        await api.post('/admin/users', form);
        showToast('success', 'User created successfully');
      }
      setUserModal({ open: false, user: null });
      fetchUsers();
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Operation failed');
    }
  };

  const handleToggleUser = async (userId, currentActive) => {
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: !currentActive });
      showToast('success', currentActive ? 'User disabled' : 'User enabled');
      fetchUsers();
    } catch (err) {
      showToast('error', 'Failed to update user status');
    }
  };

  const handleSaveDept = async (form) => {
    try {
      if (deptModal.dept) {
        await api.patch(`/admin/departments/${deptModal.dept.id}`, { name: form.name, description: form.description });
        showToast('success', 'Department updated');
      } else {
        await api.post('/admin/departments', form);
        showToast('success', 'Department created');
      }
      setDeptModal({ open: false, dept: null });
      fetchDepartments();
    } catch (err) {
      showToast('error', err.response?.data?.error?.message || 'Operation failed');
    }
  };

  const totalPages = Math.ceil(totalUsers / limit);

  return (
    <div className="p-4 lg:p-6 space-y-4 min-h-[calc(100vh-4rem)] dark:bg-[#0b1326]">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 max-w-sm transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' :
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-300' :
          'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <UserFormModal isOpen={userModal.open} onClose={() => setUserModal({ open: false, user: null })} onSave={handleSaveUser} user={userModal.user} departments={departments} />
      <DeptFormModal isOpen={deptModal.open} onClose={() => setDeptModal({ open: false, dept: null })} onSave={handleSaveDept} department={deptModal.dept} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Admin Management</h1>
          <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">Configure users, departments, and approval workflows.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button onClick={() => setUserModal({ open: true, user: null })} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[16px]">person_add</span> New User
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-[#2e3650] overflow-x-auto">
        {[
          { key: 'users', label: 'Users' },
          { key: 'departments', label: 'Departments' },
          { key: 'workflow', label: 'Workflow Configuration' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 border-b-2 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-[#8d95b0] hover:text-gray-700 dark:hover:text-[#e1e3f0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Users Table */}
          <section className="lg:col-span-8 bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
            <div className="p-4 border-b border-gray-100 dark:border-[#2e3650] flex justify-between items-center">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0]">User Directory</h2>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#8d95b0] text-[16px]">search</span>
                <input
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2e3650] bg-white dark:bg-[#242c42] text-sm w-56 dark:text-[#e1e3f0] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-[#8d95b0]"
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#242c42] border-b border-gray-100 dark:border-[#2e3650]">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">User</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Department</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Role</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#2e3650]">
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-[#8d95b0]">
                      <div className="flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Loading...</div>
                    </td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-[#8d95b0]">No users found</td></tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const initials = u.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <tr key={u.id} className={`hover:bg-gray-50/60 dark:hover:bg-[#242c42]/50 transition-colors group ${!u.is_active ? 'bg-gray-50/40 dark:bg-[#0b1326]/50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${u.is_active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{initials}</div>
                              <div className="flex flex-col min-w-0">
                                <span className={`text-sm font-medium truncate ${u.is_active ? 'text-gray-900 dark:text-[#e1e3f0]' : 'text-gray-500 dark:text-[#8d95b0]'}`}>{u.full_name}</span>
                                <span className="text-xs text-gray-400 dark:text-[#8d95b0] truncate">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#8d95b0]">{u.department_name || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${roleBadgeColors[u.role] || 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'}`}>
                              {roleLabels[u.role] || u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${u.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'}`}>
                              {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setUserModal({ open: true, user: u })} className="p-1 text-gray-400 dark:text-[#8d95b0] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded" title="Edit">
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button onClick={() => handleToggleUser(u.id, u.is_active)} className={`p-1 transition-colors rounded ${u.is_active ? 'text-gray-400 dark:text-[#8d95b0] hover:text-rose-600 dark:hover:text-rose-400' : 'text-gray-400 dark:text-[#8d95b0] hover:text-emerald-600 dark:hover:text-emerald-400'}`} title={u.is_active ? 'Disable' : 'Enable'}>
                                <span className="material-symbols-outlined text-[16px]">{u.is_active ? 'block' : 'check_circle'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-[#2e3650] bg-gray-50/50 dark:bg-[#242c42]/50 flex justify-between items-center">
              <span className="text-xs text-gray-400 dark:text-[#8d95b0]">Showing {userPage * limit + 1}-{Math.min((userPage + 1) * limit, totalUsers)} of {totalUsers}</span>
              <div className="flex gap-1">
                <button className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#454653] text-gray-400 dark:text-[#8d95b0] disabled:opacity-40" disabled={userPage === 0} onClick={() => setUserPage((p) => p - 1)}>
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#454653] text-gray-400 dark:text-[#8d95b0] disabled:opacity-40" disabled={userPage >= totalPages - 1} onClick={() => setUserPage((p) => p + 1)}>
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          </section>

          {/* Side Panel */}
          <div className="lg:col-span-4 flex flex-col gap-4" style={{ minHeight: '600px' }}>
            {/* Departments */}
            <section className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0]">Departments</h2>
                <button onClick={() => setDeptModal({ open: true, dept: null })} className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1.5 rounded-lg transition-colors" title="Add Department">
                  <span className="material-symbols-outlined text-[18px]">add_business</span>
                </button>
              </div>
              <ul className="flex flex-col gap-2 overflow-y-auto flex-1">
                {departments.map((d) => (
                  <li key={d.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-200 dark:border-[#2e3650] bg-white dark:bg-[#242c42] hover:border-indigo-300 dark:hover:border-indigo-400 transition-colors group">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0] truncate">{d.name}</span>
                      <span className="text-xs text-gray-400 dark:text-[#8d95b0]">{deptMemberCounts[d.id] || 0} Members</span>
                    </div>
                    <button onClick={() => setDeptModal({ open: true, dept: d })} className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-[#8d95b0] hover:text-indigo-600 dark:hover:text-indigo-400 transition-all p-1 rounded">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* System Status */}
            <section className="bg-indigo-600 rounded-xl text-white p-5 flex flex-col justify-between shadow-sm relative overflow-hidden" style={{ height: '140px' }}>
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2 z-10">
                <span className="material-symbols-outlined text-[18px]">dns</span>
                <h3 className="text-[11px] font-bold uppercase tracking-wider">System Status</h3>
              </div>
              <div className="z-10">
                <div className="text-2xl font-bold tracking-tight">Healthy</div>
                <p className="text-xs opacity-80 mt-1">All workflow engines operational.</p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <div key={d.id} className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-5 hover:border-indigo-300 dark:hover:border-indigo-400 transition-colors group relative">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-[#e1e3f0]">{d.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{d.code}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#8d95b0]">{d.description || 'No description'}</p>
              <p className="text-xs text-gray-400 dark:text-[#8d95b0] mt-2">{deptMemberCounts[d.id] || 0} members</p>
              <button onClick={() => setDeptModal({ open: true, dept: d })} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-[#8d95b0] hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded">
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Workflow Tab */}
      {activeTab === 'workflow' && (
        <section className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-6">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-[#2e3650] pb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0]">Workflow Builder Preview</h2>
              <p className="text-xs text-gray-500 dark:text-[#8d95b0] mt-1">Standard Invoice Approval Path (4-Stage)</p>
            </div>
          </div>
          <div className="py-8 px-4 bg-gray-50 dark:bg-[#242c42] rounded-lg border border-gray-200 dark:border-[#2e3650] overflow-x-auto relative">
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-200 dark:bg-[#454653] -translate-y-1/2 z-0 hidden md:block" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 z-10 relative min-w-[700px]">
              {workflowStages.map((stage, i) => (
                <div key={i} className="flex flex-col items-center gap-3 w-32">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm relative z-10 ring-4 ring-gray-50 dark:ring-[#1e2538] ${stage.color}`}>
                    <span className="material-symbols-outlined text-[20px]">{stage.icon}</span>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-[#e1e3f0]">{stage.role}</div>
                    <div className="text-[10px] text-gray-400 dark:text-[#8d95b0] mt-0.5">{stage.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-[#242c42] rounded-lg border border-gray-200 dark:border-[#2e3650]">
              <h4 className="text-xs font-bold text-gray-900 dark:text-[#e1e3f0] uppercase tracking-wider mb-2">Flow Rules</h4>
              <ul className="space-y-1.5 text-sm text-gray-600 dark:text-[#8d95b0]">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-emerald-500 dark:text-emerald-400">check</span> All invoices route through 4 approval stages</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-emerald-500 dark:text-emerald-400">check</span> Admin can act at any stage</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-emerald-500 dark:text-emerald-400">check</span> Returned invoices go back to Accountant 1</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-[#242c42] rounded-lg border border-gray-200 dark:border-[#2e3650]">
              <h4 className="text-xs font-bold text-gray-900 dark:text-[#e1e3f0] uppercase tracking-wider mb-2">Actions</h4>
              <ul className="space-y-1.5 text-sm text-gray-600 dark:text-[#8d95b0]">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-indigo-500 dark:text-indigo-400">check_circle</span> Approve — advance to next stage</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-amber-500 dark:text-amber-400">undo</span> Return — send back for corrections</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-rose-500 dark:text-rose-400">cancel</span> Reject — terminal state, no further action</li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
