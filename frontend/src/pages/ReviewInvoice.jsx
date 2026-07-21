import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import usePolling from '../hooks/usePolling';

const statusColors = {
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  returned: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const statusLabels = {
  submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved',
  rejected: 'Rejected', returned: 'Returned',
};

const actionLabels = {
  approve: 'Approved', reject: 'Rejected', return: 'Returned', comment: 'Commented',
};

const workflowStages = [
  { order: 1, name: 'Accountant 1 Verification', role: 'accountant_1', icon: 'fact_check' },
  { order: 2, name: 'Accountant 2 Verification', role: 'accountant_2', icon: 'approval' },
  { order: 3, name: 'Manager Approval', role: 'manager', icon: 'workspace_premium' },
  { order: 4, name: 'CEO Final Approval', role: 'ceo', icon: 'verified' },
];

export default function ReviewInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [history, setHistory] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState(null);

  const [signedUrls, setSignedUrls] = useState({});
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [urlLoading, setUrlLoading] = useState(true);

  const fetchInvoice = useCallback(async () => {
    try {
      const [invRes, histRes] = await Promise.all([
        api.get(`/invoices/${id}`),
        api.get(`/invoices/${id}/history`),
      ]);
      const inv = invRes.data.data;
      setInvoice(inv);
      setHistory(histRes.data.data);

      if (inv.files?.length > 0) {
        setUrlLoading(true);
        const urls = {};
        const results = await Promise.allSettled(
          inv.files.map((f) => api.get(`/invoices/files/${f.id}/download`))
        );
        inv.files.forEach((f, i) => {
          if (results[i].status === 'fulfilled') {
            urls[f.id] = results[i].value.data.data.signed_url;
          }
        });
        setSignedUrls(urls);
        setUrlLoading(false);
      }
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  usePolling(() => {
    if (!acting) {
      api.get(`/invoices/${id}`).then(({ data }) => setInvoice(data.data)).catch(() => {});
      api.get(`/invoices/${id}/history`).then(({ data }) => setHistory(data.data)).catch(() => {});
    }
  }, 15000);

  const handleAction = async (action) => {
    if (acting) return;
    setActing(true);
    try {
      const body = comment ? { comment } : {};
      const { data } = await api.post(`/invoices/${id}/${action}`, body);
      await fetchInvoice();
      setComment('');

      const result = data.data;
      if (action === 'return') {
        setToast({ type: 'success', message: 'Invoice returned to submitter for corrections.' });
      } else if (action === 'reject') {
        setToast({ type: 'success', message: 'Invoice has been rejected.' });
      } else if (result.next_approver) {
        setToast({
          type: 'success',
          message: `Invoice approved. Routed to ${result.next_approver.role_display} — ${result.next_approver.stage}`,
        });
      } else if (result.is_final_approval) {
        setToast({ type: 'success', message: 'Final approval granted. Invoice is now fully approved!' });
      }
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.error?.message || err.response?.data?.detail || `Failed to ${action}`,
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center dark:bg-[#0b1326]">
        <div className="flex items-center gap-3 text-gray-400 dark:text-[#8d95b0]">
          <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading invoice...</span>
        </div>
      </div>
    );
  }
  if (!invoice) return null;

  const stageIndex =
    invoice.status === 'under_review'
      ? history.filter((h) => h.action === 'approve').length
      : -1;

  const files = invoice.files || [];
  const currentFile = files[activeFileIdx] || null;
  const currentUrl = currentFile ? signedUrls[currentFile.id] : null;
  const isTerminal = invoice.status === 'approved' || invoice.status === 'rejected' || invoice.status === 'returned';

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-4 p-4 lg:p-6 min-h-0 relative dark:bg-[#0b1326]">
      {/* Toast notification */}
      {toast && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 max-w-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' :
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-300' :
          'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
          </span>
          {toast.message}
        </div>
      )}
      {/* LEFT PANEL — Document Preview */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-0 min-w-0 dark:bg-[#1e2538] dark:border-[#2e3650]">
        {/* Toolbar */}
        <div className="h-11 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between px-4 shrink-0 dark:bg-[#1e2538] dark:border-[#2e3650]">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors shrink-0 dark:text-[#8d95b0] dark:hover:text-[#e1e3f0] dark:hover:bg-[#2e3650]">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <span className="material-symbols-outlined text-[16px] text-gray-400 shrink-0 dark:text-[#8d95b0]">description</span>
            <span className="text-sm font-medium text-gray-700 truncate dark:text-[#e1e3f0]">{invoice.invoice_number}</span>
          </div>
          {files.length > 0 && (
            <a
              href={currentUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${currentUrl ? 'text-gray-400 hover:bg-gray-200 dark:text-[#8d95b0] dark:hover:bg-[#2e3650]' : 'text-gray-300 pointer-events-none dark:text-gray-600'}`}
              title="Open in new tab"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          )}
        </div>

        {/* File tabs (if multiple files) */}
        {files.length > 1 && (
          <div className="flex border-b border-gray-100 bg-white shrink-0 overflow-x-auto dark:bg-[#1e2538] dark:border-[#2e3650]">
            {files.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setActiveFileIdx(i)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeFileIdx === i
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-[#8d95b0] dark:hover:text-[#e1e3f0] dark:hover:bg-[#2e3650]'
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

        {/* Document viewer */}
        <div className="flex-1 bg-gray-100 overflow-hidden relative min-h-0 dark:bg-[#2d3449]">
          {urlLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-gray-400 dark:text-[#8d95b0]">
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                <span className="text-sm">Loading document...</span>
              </div>
            </div>
          ) : currentUrl ? (
            currentFile?.mime_type === 'application/pdf' ? (
              <iframe
                src={currentUrl}
                className="w-full h-full border-0"
                title={currentFile.file_name}
              />
            ) : (
              <div className="w-full h-full overflow-auto flex items-start justify-center p-4">
                <img
                  src={currentUrl}
                  alt={currentFile?.file_name}
                  className="max-w-full h-auto object-contain rounded shadow-sm"
                />
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

      {/* RIGHT PANEL — Details, Actions, Workflow */}
      <div className="w-full lg:w-[380px] flex flex-col gap-4 overflow-y-auto shrink-0">
        {/* Invoice Summary */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 dark:bg-[#1e2538] dark:border-[#2e3650]">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate dark:text-[#e1e3f0]">{invoice.vendor_name}</h2>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-[#8d95b0]">{invoice.invoice_number}</p>
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md shrink-0 ${statusColors[invoice.status] || ''}`}>
              {statusLabels[invoice.status] || invoice.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider dark:text-[#8d95b0]">Amount</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5 dark:text-[#e1e3f0]">
                INR {Number(invoice.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider dark:text-[#8d95b0]">Version</p>
              <p className="text-sm text-gray-600 mt-0.5 dark:text-[#8d95b0]">v{invoice.version}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider dark:text-[#8d95b0]">Submitted By</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5 dark:text-[#e1e3f0]">{invoice.submitter_name}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider dark:text-[#8d95b0]">Date</p>
              <p className="text-sm text-gray-700 mt-0.5 dark:text-[#8d95b0]">
                {invoice.submitted_at ? new Date(invoice.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              </p>
            </div>
          </div>

          {invoice.remarks && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#2e3650]">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 dark:text-[#8d95b0]">Remarks</p>
              <p className="text-sm text-gray-600 leading-relaxed dark:text-[#8d95b0]">{invoice.remarks}</p>
            </div>
          )}
        </div>

        {/* Action Panel */}
        {!isTerminal && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 dark:bg-[#1e2538] dark:border-[#2e3650]">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 dark:text-[#e1e3f0]">Your Decision</h3>
            <textarea
              className="w-full border border-gray-200 rounded-lg text-sm p-3 h-20 resize-none text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none mb-3 transition-colors dark:bg-[#242c42] dark:border-[#2e3650] dark:text-[#e1e3f0] dark:placeholder:text-[#8d95b0]"
              placeholder="Add a comment (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <button
                disabled={acting}
                onClick={() => handleAction('approve')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60 dark:bg-emerald-700 dark:hover:bg-emerald-800"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Approve
              </button>
              <div className="flex gap-2">
                <button
                  disabled={acting}
                  onClick={() => handleAction('return')}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-700"
                >
                  <span className="material-symbols-outlined text-[18px]">undo</span>
                  Return
                </button>
                <button
                  disabled={acting}
                  onClick={() => handleAction('reject')}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60 dark:bg-rose-700 dark:hover:bg-rose-800"
                >
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {isTerminal && invoice.status === 'approved' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm p-4 flex items-center gap-3 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300">
            <span className="material-symbols-outlined text-[24px] text-emerald-600 dark:text-emerald-400">check_circle</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Invoice Approved</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">This invoice has been fully approved and is final.</p>
            </div>
            <button
              onClick={() => navigate(`/invoices/${invoice.invoice_number || invoice.id}/print`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors dark:bg-[#1e2538] dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-[#2e3650]"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Print
            </button>
          </div>
        )}

        {isTerminal && invoice.status === 'rejected' && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl shadow-sm p-4 flex items-center gap-3 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
            <span className="material-symbols-outlined text-[24px] text-rose-600 dark:text-rose-400">block</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">Invoice Rejected</p>
              <p className="text-xs text-rose-600 dark:text-rose-400">This invoice has been rejected and cannot be processed further.</p>
            </div>
          </div>
        )}

        {isTerminal && invoice.status === 'returned' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl shadow-sm p-4 flex items-center gap-3 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300">
            <span className="material-symbols-outlined text-[24px] text-orange-600 dark:text-orange-400">undo</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Invoice Returned</p>
              <p className="text-xs text-orange-600 dark:text-orange-400">This invoice has been returned to the submitter for corrections.</p>
            </div>
          </div>
        )}

        {/* Workflow Timeline */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 dark:bg-[#1e2538] dark:border-[#2e3650]">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4 dark:text-[#e1e3f0]">Workflow Progress</h3>
          <div className="relative pl-6 border-l-2 border-gray-100 space-y-5 dark:border-[#2e3650]">
            {workflowStages.map((stage, i) => {
              const isCompleted = stageIndex > i || invoice.status === 'approved';
              const isActive = stageIndex === i || (invoice.status === 'submitted' && i === 0);
              const isNext = !isCompleted && !isActive && i === stageIndex + 1;
              return (
                <div key={i} className="relative">
                  <div
                    className={`absolute -left-[25px] w-3 h-3 rounded-full ring-[3px] ${
                      isCompleted
                        ? 'bg-indigo-600 dark:ring-[#1e2538]'
                        : isActive
                        ? 'bg-white border-2 border-indigo-600 ring-white dark:bg-transparent dark:border-indigo-400 dark:ring-[#1e2538]'
                        : isNext
                        ? 'bg-white border-2 border-amber-400 ring-white dark:bg-transparent dark:border-amber-400 dark:ring-[#1e2538]'
                        : 'bg-gray-200 dark:bg-gray-700 dark:ring-[#1e2538]'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[14px] ${
                      isCompleted ? 'text-indigo-600' : isActive ? 'text-indigo-500' : isNext ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'
                    }`}>
                      {stage.icon}
                    </span>
                    <p className={`text-sm font-medium ${isActive ? 'text-indigo-600' : isCompleted ? 'text-gray-900' : isNext ? 'text-amber-600' : 'text-gray-400 dark:text-[#8d95b0]'}`}>
                      {isActive ? <span className="dark:text-[#e1e3f0]">{stage.name}</span> : isCompleted ? <span className="dark:text-[#e1e3f0]">{stage.name}</span> : stage.name}
                    </p>
                    {isNext && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full dark:bg-amber-900/30 dark:text-amber-400">NEXT</span>
                    )}
                    {isCompleted && (
                      <span className="material-symbols-outlined text-[14px] text-emerald-500">check</span>
                    )}
                  </div>
                  <p className={`text-xs ml-[22px] ${isActive || isCompleted || isNext ? 'text-gray-500 dark:text-[#e1e3f0]' : 'text-gray-300 dark:text-[#8d95b0]'}`}>
                    {stage.role.replace(/_/g, ' ')}
                  </p>
                </div>
              );
            })}
          </div>
          {!isTerminal && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 dark:border-[#2e3650]">
              <span className="material-symbols-outlined text-[14px] text-amber-500">arrow_forward</span>
              <p className="text-xs text-gray-500 dark:text-[#8d95b0]">Next: <span className="font-semibold text-amber-600 dark:text-amber-400">
                {(() => {
                  const nextIdx = invoice.status === 'submitted' ? 1 : stageIndex + 1;
                  if (nextIdx >= workflowStages.length) return 'Final — Approval Complete';
                  return workflowStages[nextIdx]?.role.replace(/_/g, ' ') || 'Final';
                })()}
              </span></p>
            </div>
          )}
        </div>

        {/* Action History + Comments */}
        {history.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 dark:bg-[#1e2538] dark:border-[#2e3650]">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4 dark:text-[#e1e3f0]">
              Activity ({history.length})
            </h3>
            <div className="space-y-4">
              {history.map((h) => {
                const actionColor =
                  h.action === 'approve'
                    ? 'bg-emerald-500'
                    : h.action === 'reject'
                    ? 'bg-rose-500'
                    : h.action === 'return'
                    ? 'bg-amber-500'
                    : 'bg-gray-400';
                return (
                  <div key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${actionColor}`} />
                      <div className="w-px flex-1 bg-gray-100 mt-1 dark:bg-[#2e3650]" />
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0]">{h.actor_name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          h.action === 'approve' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          h.action === 'reject' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                          h.action === 'return' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
                        }`}>
                          {actionLabels[h.action] || h.action}
                        </span>
                      </div>
                      {h.comment && (
                        <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-lg px-3 py-2 dark:text-[#8d95b0] dark:bg-[#242c42]">{h.comment}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1 dark:text-[#8d95b0]">
                        {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
