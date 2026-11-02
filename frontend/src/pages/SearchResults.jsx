import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';

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

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (!query) { setLoading(false); return; }
    setLoading(true);
    api.get('/invoices/search', { params: { q: query, limit, offset: page * limit } })
      .then(({ data }) => { setResults(data.data); setTotal(data.meta?.total ?? 0); })
      .catch(() => { setResults([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [query, page, limit]);

  useEffect(() => { setPage(0); }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Search Results</h1>
        <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">
          {loading ? 'Searching...' : `${total} result${total !== 1 ? 's' : ''} for "${query}"`}
        </p>
      </div>

      <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden transition-colors">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2e3650]">
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Vendor / Staff</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider hidden md:table-cell">Department</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider hidden lg:table-cell">Submitted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#2e3650]">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-[#8d95b0]">
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span className="text-sm">Searching invoices...</span>
                  </div>
                </td></tr>
              ) : results.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center text-gray-300 dark:text-[#8d95b0]">
                    <span className="material-symbols-outlined text-[48px]">search_off</span>
                    <p className="text-sm text-gray-400 dark:text-[#8d95b0] mt-3 font-medium">No results found</p>
                    <p className="text-xs text-gray-400 dark:text-[#8d95b0] mt-1">Try a different search term.</p>
                  </div>
                </td></tr>
              ) : (
                results.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-[#242c42] transition-colors cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0]">{inv.vendor_name}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0] text-right font-mono">
                      {formatCurrency(inv.amount, inv.currency)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${stageBadgeColors[inv.status] || ''}`}>
                        {statusLabels[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8d95b0] hidden md:table-cell">{inv.department_name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8d95b0] hidden lg:table-cell">{inv.submitter_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-100 dark:divide-[#2e3650]">
          {loading ? (
            <div className="px-5 py-12 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-[#8d95b0]">
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                <span className="text-sm">Searching invoices...</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="flex flex-col items-center text-gray-300 dark:text-[#8d95b0]">
                <span className="material-symbols-outlined text-[48px]">search_off</span>
                <p className="text-sm text-gray-400 dark:text-[#8d95b0] mt-3 font-medium">No results found</p>
              </div>
            </div>
          ) : (
            results.map((inv) => (
              <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="px-5 py-4 cursor-pointer active:bg-gray-50 dark:active:bg-[#242c42] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 truncate">{inv.invoice_number}</span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 ${stageBadgeColors[inv.status] || ''}`}>
                    {statusLabels[inv.status] || inv.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0] truncate mt-1">{inv.vendor_name}</p>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <p className="text-sm font-bold font-mono text-gray-900 dark:text-[#e1e3f0] shrink-0">{formatCurrency(inv.amount, inv.currency)}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8d95b0] truncate">
                    {[inv.department_name, inv.submitter_name].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-[#2e3650] transition-colors">
            <p className="text-xs text-gray-400 dark:text-[#8d95b0]">Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {(() => {
                const pageNos = [];
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const end = Math.min(totalPages, start + 5);
                if (start > 0) { pageNos.push(0); if (start > 1) pageNos.push('…'); }
                for (let i = start; i < end; i++) pageNos.push(i);
                if (end < totalPages) { if (end < totalPages - 1) pageNos.push('…'); pageNos.push(totalPages - 1); }
                return pageNos.map((p) => p === '…'
                  ? <span key={`e${p}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400 dark:text-[#8d95b0]">…</span>
                  : <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42]'}`}>{p + 1}</button>);
              })()}
              <button className="p-1.5 rounded-lg text-gray-600 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
