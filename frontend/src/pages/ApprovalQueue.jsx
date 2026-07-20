import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import usePolling from '../hooks/usePolling';

const statusColors = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  returned: 'bg-orange-100 text-orange-700',
};

const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
};

export default function ApprovalQueue() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const fetchData = useCallback((silent = false) => {
    const fetcher = () => api.get('/invoices/queue/pending', { params: { limit, offset: page * limit } })
      .then(({ data }) => { setInvoices(data.data); setTotal(data.meta.total); });
    if (silent) { fetcher().catch(() => {}); return; }
    setLoading(true);
    fetcher().catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => { fetchData(); }, [page, limit]);

  usePolling(() => fetchData(true), 15000);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve pending invoices.</p>
        </div>
        {total > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold">
            <span className="material-symbols-outlined text-[14px]">pending_actions</span>
            {total} pending
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Submitted By</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Submitted</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span className="text-sm">Loading queue...</span>
                  </div>
                </td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center text-gray-300">
                    <span className="material-symbols-outlined text-[48px]">inbox</span>
                    <p className="text-sm text-gray-400 mt-3 font-medium">No pending invoices</p>
                    <p className="text-xs text-gray-400 mt-1">Invoices pending your review will appear here.</p>
                  </div>
                </td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-indigo-600 group-hover:text-indigo-700">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{inv.vendor_name}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right font-mono">
                      INR {Number(inv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${statusColors[inv.status] || ''}`}>
                        {statusLabels[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 hidden lg:table-cell">{inv.submitter_name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-400 hidden xl:table-cell">
                      {inv.submitted_at ? new Date(inv.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${inv.id}`); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">fact_check</span> Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === i ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
              ))}
              <button className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
