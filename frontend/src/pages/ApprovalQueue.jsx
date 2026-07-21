import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import usePolling from '../hooks/usePolling';
import { useAuth } from '../context/AuthContext';
import ConfirmBulkApprove from '../components/ConfirmBulkApprove';
import InvoicePreviewModal from '../components/InvoicePreviewModal';

export default function ApprovalQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canBulkApprove = ['ceo', 'manager'].includes(user?.role);

  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 10;
  const prevPageRef = useRef(page);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchData = useCallback((silent = false) => {
    const fetcher = () => api.get('/invoices/queue/pending', { params: { limit, offset: page * limit } })
      .then(({ data }) => { setInvoices(data.data); setTotal(data.meta.total); });
    if (silent) { fetcher().catch(() => {}); return; }
    setLoading(true);
    fetcher().catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => {
    if (prevPageRef.current !== page) {
      setSelectedIds(new Set());
      prevPageRef.current = page;
    }
    fetchData();
  }, [page, limit, fetchData]);

  usePolling(() => fetchData(true), 15000);

  const totalPages = Math.ceil(total / limit);

  const allVisibleSelected = invoices.length > 0 && invoices.every((inv) => selectedIds.has(inv.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkApprove = async (comment) => {
    try {
      const { data } = await api.post('/invoices/bulk-approve', {
        invoice_ids: Array.from(selectedIds),
        comment: comment || undefined,
      });
      const result = data.data;
      setShowConfirmModal(false);
      setSelectedIds(new Set());

      if (result.failed === 0) {
        setToast({ type: 'success', message: `${result.approved} invoice${result.approved !== 1 ? 's' : ''} approved successfully.` });
      } else {
        setToast({
          type: 'partial',
          message: `${result.approved} approved, ${result.failed} failed.`,
        });
      }
      setTimeout(() => setToast(null), 5000);
      fetchData(true);
    } catch (err) {
      setShowConfirmModal(false);
      setToast({
        type: 'error',
        message: err.response?.data?.error?.message || err.response?.data?.detail || 'Bulk approval failed.',
      });
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 max-w-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' :
          toast.type === 'partial' ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300' :
          'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : toast.type === 'partial' ? 'warning' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Approval Queue</h1>
          <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">Review and approve pending invoices.</p>
        </div>
        {total > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-semibold">
            <span className="material-symbols-outlined text-[14px]">pending_actions</span>
            {total} pending
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2e3650]">
                {canBulkApprove && (
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-[#8d95b0] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Vendor / Staff</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Remark</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider hidden md:table-cell">Department</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#2e3650]">
              {loading ? (
                <tr><td colSpan={canBulkApprove ? 8 : 7} className="px-5 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-[#8d95b0]">
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span className="text-sm">Loading queue...</span>
                  </div>
                </td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={canBulkApprove ? 8 : 7} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center text-gray-300 dark:text-[#8d95b0]">
                    <span className="material-symbols-outlined text-[48px]">inbox</span>
                    <p className="text-sm text-gray-400 dark:text-[#8d95b0] mt-3 font-medium">No pending invoices</p>
                    <p className="text-xs text-gray-400 dark:text-[#8d95b0] mt-1">Invoices pending your review will appear here.</p>
                  </div>
                </td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`transition-colors group ${
                      selectedIds.has(inv.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-gray-50/50 dark:hover:bg-[#242c42]'
                    } ${canBulkApprove ? '' : 'cursor-pointer'}`}
                    onClick={() => { if (!canBulkApprove) navigate(`/invoices/${inv.id}`); }}
                  >
                    {canBulkApprove && (
                      <td className="px-5 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 dark:border-[#8d95b0] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-sm font-medium">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewInvoiceId(inv.id); }}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors"
                      >
                        {inv.invoice_number}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0]">{inv.vendor_name}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-[#e1e3f0] text-right font-mono">
                      INR {Number(inv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8d95b0] max-w-[180px] truncate" title={inv.remarks || ''}>
                      {inv.remarks || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8d95b0] hidden md:table-cell">
                      {inv.department_name || '-'}
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

        {canBulkApprove && selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-100 dark:border-indigo-800 transition-colors">
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              <span className="material-symbols-outlined text-[16px] inline align-middle mr-1.5">checklist</span>
              {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Approve Selected
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-[#2e3650] transition-colors">
            <p className="text-xs text-gray-400 dark:text-[#8d95b0]">Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === i ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42]'}`}>{i + 1}</button>
              ))}
              <button className="p-1.5 rounded-lg text-gray-600 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showConfirmModal && (
        <ConfirmBulkApprove
          count={selectedIds.size}
          onConfirm={handleBulkApprove}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
      {previewInvoiceId && (
        <InvoicePreviewModal
          invoiceId={previewInvoiceId}
          onClose={() => setPreviewInvoiceId(null)}
        />
      )}
    </div>
  );
}
