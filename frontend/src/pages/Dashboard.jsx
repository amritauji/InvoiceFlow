import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const stageBadgeColors = {
  submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
  returned: 'bg-orange-50 text-orange-700 border border-orange-200',
  draft: 'bg-gray-50 text-gray-700 border border-gray-200',
};

const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
  draft: 'Draft',
};

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then(({ data }) => setStats(data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const s = stats?.summary || {};
  const kpis = [
    { label: 'Total Invoices', value: s.total_invoices || 0, icon: 'receipt_long', badge: 'All Time', badgeColor: 'bg-indigo-50 text-indigo-600', iconBg: 'bg-indigo-50 text-indigo-600' },
    { label: 'Pending', value: s.pending || 0, icon: 'hourglass_empty', badge: 'Active', badgeColor: 'bg-amber-50 text-amber-600', iconBg: 'bg-amber-50 text-amber-600', accent: 'border-l-4 border-orange-400' },
    { label: 'Approved', value: s.approved || 0, icon: 'check_circle', badge: 'Done', badgeColor: 'bg-emerald-50 text-emerald-600', iconBg: 'bg-emerald-50 text-emerald-600' },
    { label: 'Rejected', value: s.rejected || 0, icon: 'cancel', badge: 'Closed', badgeColor: 'bg-rose-50 text-rose-600', iconBg: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of invoice processing metrics and pending tasks.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`bg-white rounded-xl p-5 border border-gray-200 shadow-sm ${kpi.accent || ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${kpi.badgeColor}`}>{kpi.badge}</span>
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1">{kpi.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{loading ? '...' : kpi.value}</span>
            </div>
          </div>
        ))}
      </div>

      {stats?.amount_by_status && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Amount by Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(stats.amount_by_status).map(([status, amount]) => (
              <div key={status} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">{statusLabels[status] || status}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">INR {Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Invoices</h2>
          <button onClick={() => navigate('/invoices')} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
            View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Submitter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">Loading...</td></tr>
              ) : stats?.recent_invoices?.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">No invoices yet</td></tr>
              ) : (
                stats?.recent_invoices?.map((inv) => (
                  <tr key={inv.invoice_number} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${inv.invoice_number}`)}>
                    <td className="px-5 py-3.5 text-sm font-medium text-indigo-600">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{inv.vendor_name}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right">INR {Number(inv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${stageBadgeColors[inv.status] || ''}`}>
                        {statusLabels[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 hidden lg:table-cell">{inv.submitter_name}</td>
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
