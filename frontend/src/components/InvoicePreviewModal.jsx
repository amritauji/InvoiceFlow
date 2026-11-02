import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import PdfViewer from './PdfViewer';
import useMediaQuery from '../hooks/useMediaQuery';

const statusColors = {
  submitted: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  under_review: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  rejected: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  returned: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
};

const statusLabels = {
  submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved',
  rejected: 'Rejected', returned: 'Returned',
};

export default function InvoicePreviewModal({ invoiceId, onClose }) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [invoice, setInvoice] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [urlLoading, setUrlLoading] = useState(true);

  // Keep the latest onClose in a ref so parent re-renders (e.g. the 15s queue
  // poll) never retrigger the fetch/Escape effects below.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;

    const fetchInvoice = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/invoices/${invoiceId}`);
        if (cancelled) return;
        const inv = data.data;
        setInvoice(inv);

        if (inv.files?.length > 0) {
          setUrlLoading(true);
          const urls = {};
          const results = await Promise.allSettled(
            inv.files.map((f) => api.get(`/invoices/files/${f.id}/download`))
          );
          if (cancelled) return;
          inv.files.forEach((f, i) => {
            if (results[i].status === 'fulfilled') {
              urls[f.id] = results[i].value.data.data.signed_url;
            }
          });
          setSignedUrls(urls);
          setUrlLoading(false);
        }
      } catch {
        if (!cancelled) onCloseRef.current();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchInvoice();
    return () => { cancelled = true; };
  }, [invoiceId]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const files = invoice?.files || [];
  const currentFile = files[activeFileIdx] || null;
  const currentUrl = currentFile ? signedUrls[currentFile.id] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white dark:bg-[#1e2538] rounded-none sm:rounded-2xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-[#2e3650] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-gray-100 dark:border-[#2e3650] bg-gray-50/80 dark:bg-[#242c42]/80 flex items-center justify-between px-5 shrink-0 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-gray-400 dark:text-[#8d95b0]">description</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0] truncate">
              {loading ? 'Loading...' : invoice?.invoice_number}
            </span>
            {invoice && (
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md shrink-0 ${statusColors[invoice.status] || ''}`}>
                {statusLabels[invoice.status] || invoice.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { onClose(); navigate(`/invoices/${invoiceId}`); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              <span className="hidden sm:inline">Full Review</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 dark:text-[#8d95b0] hover:text-gray-600 dark:hover:text-[#e1e3f0] hover:bg-gray-200 dark:hover:bg-[#1e2538] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Left: Document viewer */}
          <div className="h-[40vh] sm:h-auto flex-1 flex flex-col min-w-0 border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-[#2e3650]">
            {files.length > 1 && (
              <div className="flex border-b border-gray-100 dark:border-[#2e3650] bg-white dark:bg-[#1e2538] shrink-0 overflow-x-auto transition-colors">
                {files.map((f, i) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFileIdx(i)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeFileIdx === i
                        ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20'
                        : 'border-transparent text-gray-500 dark:text-[#8d95b0] hover:text-gray-700 dark:hover:text-[#e1e3f0] hover:bg-gray-50 dark:hover:bg-[#242c42]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {f.mime_type === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                    </span>
                    {f.file_name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 bg-gray-100 dark:bg-[#0f1423] overflow-hidden relative transition-colors">
              {loading || urlLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-gray-400 dark:text-[#8d95b0]">
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span className="text-sm">Loading document...</span>
                  </div>
                </div>
              ) : currentUrl ? (
                currentFile?.mime_type === 'application/pdf' ? (
                  isMobile ? (
                    <PdfViewer url={currentUrl} fileName={currentFile.file_name} />
                  ) : (
                    <iframe src={currentUrl} className="w-full h-full border-0" title={currentFile.file_name} />
                  )
                ) : (
                  <div className="w-full h-full overflow-auto flex items-start justify-center p-4">
                    <img src={currentUrl} alt={currentFile?.file_name} className="max-w-full h-auto object-contain rounded shadow-sm" />
                  </div>
                )
              ) : files.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 dark:text-[#8d95b0]">
                  <span className="material-symbols-outlined text-[56px]">upload_file</span>
                  <p className="text-sm mt-3 text-gray-400 dark:text-[#8d95b0]">No document attached</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-[#8d95b0]">
                  <span className="material-symbols-outlined text-[40px]">error_outline</span>
                  <p className="text-sm mt-2">Could not load document</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Invoice details */}
          <div className="flex-1 min-h-0 sm:flex-none sm:w-80 overflow-y-auto p-5 space-y-5 bg-white dark:bg-[#1e2538] transition-colors">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 dark:text-[#8d95b0]">
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              </div>
            ) : invoice && (
              <>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-[#e1e3f0]">{invoice.vendor_name}</h3>
                  <p className="text-xs text-gray-400 dark:text-[#8d95b0] mt-0.5">{invoice.invoice_number}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Amount</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-[#e1e3f0] mt-0.5">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Submitted By</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0] mt-0.5">{invoice.submitter_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Date</p>
                    <p className="text-sm text-gray-700 dark:text-[#8d95b0] mt-0.5">
                      {invoice.submitted_at ? new Date(invoice.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                  {invoice.department_name && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Department</p>
                      <p className="text-sm text-gray-700 dark:text-[#8d95b0] mt-0.5">{invoice.department_name}</p>
                    </div>
                  )}
                </div>

                {invoice.remarks && (
                  <div className="pt-3 border-t border-gray-100 dark:border-[#2e3650]">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider mb-1">Remarks</p>
                    <p className="text-sm text-gray-600 dark:text-[#8d95b0] leading-relaxed">{invoice.remarks}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
