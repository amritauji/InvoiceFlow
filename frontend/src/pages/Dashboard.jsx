import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import usePolling from '../hooks/usePolling';
import { useAuth } from '../context/AuthContext';

const stageBadgeColors = {
  submitted: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  under_review: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  approved: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  rejected: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
  returned: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
  draft: 'bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
};

const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
  draft: 'Draft',
};

const deletableStatuses = ['submitted', 'returned', 'rejected'];

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDelete = user?.role === 'accountant_1';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchStats = useCallback((silent = false) => {
    const fetcher = () => api.get('/dashboard/stats').then(({ data }) => setStats(data.data));
    if (silent) { fetcher().catch(() => {}); return; }
    setLoading(true);
    fetcher().catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  usePolling(() => fetchStats(true), 15000);

  const handleDelete = async (e, inv) => {
    e.stopPropagation();
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This action cannot be undone.`)) return;
    setDeletingId(inv.id);
    try {
      await api.delete(`/invoices/${inv.id}`);
      setToast({ type: 'success', message: `Invoice ${inv.invoice_number} deleted.` });
      fetchStats(true);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to delete invoice.',
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeletingId(null);
    }
  };

  const s = stats?.summary || {};
  const kpis = [
    { label: 'Total Invoices', value: s.total_invoices || 0, icon: 'receipt_long', badge: 'All Time', badgeColor: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
    { label: 'Pending', value: s.pending || 0, icon: 'hourglass_empty', badge: 'Active', badgeColor: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', accent: 'border-l-4 border-orange-400' },
    { label: 'Approved', value: s.approved || 0, icon: 'check_circle', badge: 'Done', badgeColor: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    { label: 'Rejected', value: s.rejected || 0, icon: 'cancel', badge: 'Closed', badgeColor: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 max-w-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' :
          'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">Overview of invoice processing metrics and pending tasks.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`bg-white dark:bg-[#1e2538] rounded-xl p-5 border border-gray-200 dark:border-[#2e3650] shadow-sm transition-colors ${kpi.accent || ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${kpi.badgeColor}`}>{kpi.badge}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#8d95b0] font-medium mb-1">{kpi.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">{loading ? '...' : kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {stats?.amount_by_status && (
        <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-5 transition-colors">
          <h2 className="text-base font-semibold text-gray-900 dark:text-[#e1e3f0] mb-3">Amount by Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(stats.amount_by_status).map(([status, amount]) => (
              <div key={status} className="bg-gray-50 dark:bg-[#242c42] rounded-lg p-3 transition-colors">
                <p className="text-xs text-gray-500 dark:text-[#8d95b0] font-medium">{statusLabels[status] || status}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-[#e1e3f0] mt-1">INR {Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#2e3650] flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-[#e1e3f0]">Recent Invoices</h2>
          <button onClick={() => navigate('/invoices')} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors">
            View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2e3650]">
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Vendor</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider hidden lg:table-cell">Submitter</th>
                {canDelete && <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#2e3650]">
              {loading ? (
                <tr><td colSpan={canDelete ? 6 : 5} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">Loading...</td></tr>
              ) : stats?.recent_invoices?.length === 0 ? (
                <tr><td colSpan={canDelete ? 6 : 5} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">No invoices yet</td></tr>
              ) : (
                stats?.recent_invoices?.map((inv) => (
                  <tr key={inv.invoice_number} className="hover:bg-gray-50/50 dark:hover:bg-[#242c42] transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${inv.invoice_number}`)}>
                    <td className="px-5 py-3.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0]">{inv.vendor_name}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0] text-right">INR {Number(inv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${stageBadgeColors[inv.status] || ''}`}>
                        {statusLabels[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8d95b0] hidden lg:table-cell">{inv.submitter_name}</td>
                    {canDelete && (
                      <td className="px-5 py-3.5 text-right">
                        {deletableStatuses.includes(inv.status) && (
                          <button
                            disabled={deletingId === inv.id}
                            onClick={(e) => handleDelete(e, inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50"
                          >
                            {deletingId === inv.id ? (
                              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            )}
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
