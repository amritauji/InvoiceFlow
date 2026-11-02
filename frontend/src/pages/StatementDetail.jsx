import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getErrorMessage } from '../utils/error';

function StatementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAccountant1 = user?.role === 'accountant_1';
  const [statement, setStatement] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifyingAll, setVerifyingAll] = useState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [invoiceFiles, setInvoiceFiles] = useState([]);
  const [narration, setNarration] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [invoiceSuccess, setInvoiceSuccess] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/statements/${id}`);
        if (!cancelled) {
          setStatement(data.data);
          setTransactions(data.data.transactions);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load statement.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleToggle = async (txnId) => {
    setTransactions((prev) => prev.map((t) => t.id === txnId ? { ...t, is_verified: !t.is_verified } : t));
    try {
      await api.patch(`/statements/${txnId}/toggle-verify`);
    } catch (err) {
      setTransactions((prev) => prev.map((t) => t.id === txnId ? { ...t, is_verified: !t.is_verified } : t));
      setError(getErrorMessage(err, 'Failed to toggle verification.'));
    }
  };

  const handleVerifyAll = async () => {
    setVerifyingAll(true);
    try {
      await api.patch(`/statements/${id}/verify-all`);
      setTransactions((prev) => prev.map((t) => ({ ...t, is_verified: true })));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to verify all.'));
    } finally {
      setVerifyingAll(false);
    }
  };

  const openInvoiceModal = (txn) => {
    setSelectedTxn(txn);
    setInvoiceFiles([]);
    setNarration('');
    setInvoiceSuccess(null);
    setShowInvoiceModal(true);
  };

  const addFiles = (newFiles) => {
    const arr = [];
    for (let i = 0; i < newFiles.length; i++) arr.push(newFiles[i]);
    setInvoiceFiles((prev) => [...prev, ...arr]);
  };

  const removeFile = (idx) => {
    setInvoiceFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitInvoice = async () => {
    if (invoiceFiles.length === 0) { setError('Please select at least one invoice file.'); return; }
    setSubmittingInvoice(true);
    setError('');
    try {
      let lastResult = null;
      for (const file of invoiceFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (narration) formData.append('narration', narration);
        const { data } = await api.post(`/statements/${selectedTxn.id}/submit-invoice`, formData);
        lastResult = data.data;
      }
      setInvoiceSuccess(lastResult);
      // Refresh transactions to get updated invoice counts
      const { data: refreshed } = await api.get(`/statements/${id}`);
      setTransactions(refreshed.data.transactions);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit invoice.'));
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const verifiedCount = transactions.filter((t) => t.is_verified).length;
  const invoicedCount = transactions.filter((t) => t.has_invoice).length;
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const verifiedAmount = transactions.filter((t) => t.is_verified).reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-3 text-gray-400 dark:text-[#8d95b0]">
          <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading statement...</span>
        </div>
      </div>
    );
  }

  if (error && !statement) {
    return (
      <div className="p-6 text-center">
        <span className="material-symbols-outlined text-[48px] text-gray-300 dark:text-[#3a4260]">error</span>
        <p className="mt-3 text-sm text-gray-500 dark:text-[#8d95b0]">{error}</p>
        <button className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700" onClick={() => navigate('/statements')}>Back to Statements</button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 dark:bg-[#0b1326] dark:text-[#e1e3f0]">
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>{error}
            <button className="ml-auto p-1" onClick={() => setError('')}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>
        )}

        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <button className="flex items-center gap-1 text-sm text-gray-500 dark:text-[#8d95b0] hover:text-gray-700 dark:hover:text-[#e1e3f0] mb-2 transition-colors" onClick={() => navigate('/statements')}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back to Statements
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">{statement?.statement_name || statement?.statement_number}</h1>
            <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">
              {statement?.card_holder_name && `${statement.card_holder_name} \u2014 `}
              Card ****{statement?.card_last_four || '****'}
              {statement?.billing_period && ` \u2014 ${statement.billing_period}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isAccountant1 ? (
              <>
                <div className="text-right">
                  <p className="text-[11px] text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Verified</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{verifiedCount}/{transactions.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Amount</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{'\u20B9'}{verifiedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60" disabled={verifyingAll || verifiedCount === transactions.length} onClick={handleVerifyAll}>
                  {verifyingAll ? (<><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Verifying...</>) : (<><span className="material-symbols-outlined text-[16px]">task_alt</span>Verify All</>)}
                </button>
              </>
            ) : (
              <>
                <div className="text-right">
                  <p className="text-[11px] text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Unverified</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{transactions.filter((t) => !t.is_verified).length}/{transactions.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Invoiced</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{invoicedCount}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#242c42] border-b border-gray-100 dark:border-[#2e3650]">
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider w-14">#</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider w-32">Date</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Transaction Description</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider w-40">Amount ({'\u20B9'})</th>
                  {isAccountant1 ? (
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider w-20">Check</th>
                  ) : (
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider w-32">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#2e3650]">
                {transactions.map((t, i) => (
                  <tr key={t.id} className={`transition-colors ${t.is_verified ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : t.has_invoice ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-[#242c42]'}`}>
                    <td className="px-4 py-3 text-center text-gray-400 dark:text-[#8d95b0]">{i + 1}</td>
                    <td className="px-6 py-3 font-mono text-gray-900 dark:text-[#e1e3f0] whitespace-nowrap">{t.transaction_date}</td>
                    <td className="px-6 py-3 text-gray-700 dark:text-[#c3c8e0]">{t.description}</td>
                    <td className="px-6 py-3 text-right font-mono font-medium text-gray-900 dark:text-[#e1e3f0]">{'\u20B9'}{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-center">
                      {isAccountant1 ? (
                        <button onClick={() => handleToggle(t.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all mx-auto ${t.is_verified ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60' : 'bg-gray-100 dark:bg-[#2e3650] text-gray-400 dark:text-[#8d95b0] hover:bg-gray-200 dark:hover:bg-[#3a4560]'}`} title={t.is_verified ? 'Click to unverify' : 'Click to verify'}>
                          <span className="material-symbols-outlined text-[20px]">{t.is_verified ? 'check_box' : 'check_box_outline_blank'}</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {t.invoice_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>{t.invoice_count}
                            </span>
                          )}
                          <button onClick={() => openInvoiceModal(t)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[12px] font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm">
                            <span className="material-symbols-outlined text-[14px]">upload_file</span>Upload
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-[#242c42] border-t border-gray-200 dark:border-[#2e3650]">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-[#e1e3f0]">Total ({transactions.length} transactions)</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{'\u20B9'}{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {showInvoiceModal && selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submittingInvoice && setShowInvoiceModal(false)} />
          <div className="relative bg-white dark:bg-[#1e2538] rounded-2xl border border-gray-200 dark:border-[#2e3650] shadow-2xl w-full max-w-lg overflow-hidden">
            {invoiceSuccess ? (
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[28px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-[#e1e3f0]">Invoice Submitted</h3>
                <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">
                  {invoiceSuccess.invoice_number} {'\u2014'} {'\u20B9'}{invoiceSuccess.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400 dark:text-[#8d95b0] mt-2">Accountant 1 has been notified for verification.</p>
                <button className="mt-5 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors" onClick={() => setShowInvoiceModal(false)}>Done</button>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2e3650] flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-[#e1e3f0]">Submit Invoice</h3>
                  <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-[#e1e3f0] hover:bg-gray-100 dark:hover:bg-[#242c42] transition-colors" onClick={() => setShowInvoiceModal(false)} disabled={submittingInvoice}>
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-gray-50 dark:bg-[#242c42] rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-[#8d95b0]">Date</span>
                      <span className="font-mono font-medium text-gray-900 dark:text-[#e1e3f0]">{selectedTxn.transaction_date}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-[#8d95b0]">Description</span>
                      <span className="font-medium text-gray-900 dark:text-[#e1e3f0] text-right max-w-[260px] truncate">{selectedTxn.description}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-[#8d95b0]">Amount</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{'\u20B9'}{selectedTxn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {selectedTxn.invoice_count > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-[#8d95b0]">Already Submitted</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{selectedTxn.invoice_count} invoice(s)</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5">Invoice Document(s) *</label>
                    <div className="border-2 border-dashed border-gray-200 dark:border-[#2e3650] rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors" onClick={() => fileInputRef.current?.click()}>
                      <input ref={fileInputRef} accept=".pdf,.jpg,.jpeg,.png" className="hidden" type="file" multiple onChange={(e) => { const files = e.target.files; if (files && files.length > 0) addFiles(files); e.target.value = ''; }} />
                      {invoiceFiles.length > 0 ? (
                        <div className="space-y-1.5">
                          {invoiceFiles.map((f, idx) => (
                            <div key={idx} className="flex items-center justify-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-indigo-500">description</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0] truncate max-w-[220px]">{f.name}</span>
                              <button className="p-0.5 rounded text-gray-400 hover:text-rose-500" onClick={(e) => { e.stopPropagation(); removeFile(idx); }}>
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            </div>
                          ))}
                          <p className="text-[11px] text-gray-400 dark:text-[#8d95b0] mt-1">Click to add more files</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-[#8d95b0]">Click to select invoice files (PDF, JPG, PNG) — select multiple at once</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5">Narration</label>
                    <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm text-gray-900 dark:text-[#e1e3f0] dark:bg-[#242c42] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors resize-none" placeholder="Optional narration for this invoice..." rows="3" value={narration} onChange={(e) => setNarration(e.target.value)} />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2e3650] flex justify-end gap-3">
                  <button className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm font-medium text-gray-700 dark:text-[#e1e3f0] hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors" onClick={() => setShowInvoiceModal(false)} disabled={submittingInvoice}>Cancel</button>
                  <button className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60" disabled={submittingInvoice || invoiceFiles.length === 0} onClick={handleSubmitInvoice}>
                    {submittingInvoice ? (<><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Submitting...</>) : (<><span className="material-symbols-outlined text-[16px]">send</span>Submit {invoiceFiles.length > 0 ? `${invoiceFiles.length} ` : ''}Invoice{invoiceFiles.length !== 1 ? 's' : ''}</>)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StatementDetail;
