import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import usePolling from '../hooks/usePolling';
import { formatCurrency } from '../utils/currency';

const statusColors = {
  submitted: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  under_review: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  rejected: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  returned: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  draft: 'bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400',
};

const statusLabels = {
  submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved',
  rejected: 'Rejected', returned: 'Returned', draft: 'Draft',
};

export default function MySubmissions() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const fetchData = useCallback((silent = false) => {
    const params = { limit, offset: page * limit };
    if (statusFilter) params.status = statusFilter;
    const fetcher = () => api.get('/invoices', { params })
      .then(({ data }) => { setInvoices(data.data); setTotal(data.meta.total); });
    if (silent) { fetcher().catch(() => {}); return; }
    setLoading(true);
    fetcher().catch(() => {}).finally(() => setLoading(false));
  }, [page, limit, statusFilter]);

  useEffect(() => { fetchData(); }, [page, statusFilter, limit, fetchData]);

  usePolling(() => fetchData(true), 15000);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">My Submissions</h1>
          <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">Track all invoices you have submitted.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="h-9 px-3 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm bg-white dark:bg-[#242c42] text-gray-700 dark:text-[#e1e3f0] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors">
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
          </select>
          <button onClick={() => navigate('/invoices/new')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">add</span> New Invoice
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden transition-colors">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2e3650]">
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Vendor</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider hidden lg:table-cell">Submitted</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#2e3650]">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">No invoices found</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-[#242c42] transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="px-5 py-3.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0]">{inv.vendor_name}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0] text-right">{formatCurrency(inv.amount, inv.currency)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${statusColors[inv.status] || ''}`}>
                        {statusLabels[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8d95b0] hidden lg:table-cell">
                      {inv.submitted_at ? new Date(inv.submitted_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button className="p-1 rounded-md text-gray-400 dark:text-[#8d95b0] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-gray-100 dark:divide-[#2e3650]">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">No invoices found</div>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="flex items-center gap-2 px-5 py-4 cursor-pointer active:bg-gray-50 dark:active:bg-[#242c42] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 truncate">{inv.invoice_number}</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 ${statusColors[inv.status] || ''}`}>
                      {statusLabels[inv.status] || inv.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0] truncate mt-1">{inv.vendor_name}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-[#e1e3f0]">{formatCurrency(inv.amount, inv.currency)}</p>
                    {inv.submitted_at && <p className="text-xs text-gray-500 dark:text-[#8d95b0] truncate">{new Date(inv.submitted_at).toLocaleDateString()}</p>}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-gray-400 dark:text-[#8d95b0] shrink-0">chevron_right</span>
              </div>
            ))
          )}
        </div>
        {Math.ceil(total / limit) > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-[#2e3650] transition-colors">
            <p className="text-xs text-gray-400 dark:text-[#8d95b0]">Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40 transition-colors cursor-pointer" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button className="p-1.5 rounded-lg text-gray-600 dark:text-[#e1e3f0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40 transition-colors cursor-pointer" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
