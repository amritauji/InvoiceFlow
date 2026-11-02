import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getErrorMessage } from '../utils/error';

function MyStatements() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAccountant1 = user?.role === 'accountant_1';
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 });

  const fetchStatements = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/statements', { params: { page: p, limit: 15 } });
      setStatements(data.data);
      setMeta(data.meta);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load statements.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatements(page); }, [page]);

  const fmtDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 lg:p-6 dark:bg-[#0b1326] dark:text-[#e1e3f0]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Statements</h1>
            <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">
              {isAccountant1 ? 'Upload and manage bank statements.' : 'View statements and submit invoices for unverified transactions.'}
            </p>
          </div>
          {isAccountant1 && (
            <button className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm" onClick={() => navigate('/statements/new')}>
              <span className="material-symbols-outlined text-[16px]">upload_file</span>Submit Statement
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>{error}
            <button className="ml-auto p-1" onClick={() => setError('')}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>
        )}

        <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-gray-400 dark:text-[#8d95b0]">
                <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                <span className="text-sm">Loading statements...</span>
              </div>
            </div>
          ) : statements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="material-symbols-outlined text-[48px] text-gray-300 dark:text-[#3a4260]">receipt_long</span>
              <p className="mt-3 text-sm text-gray-500 dark:text-[#8d95b0]">No statements yet.</p>
              {isAccountant1 && (
                <button className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 flex items-center gap-2" onClick={() => navigate('/statements/new')}>
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>Upload First Statement
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#242c42] border-b border-gray-100 dark:border-[#2e3650]">
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Statement #</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Card</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Period</th>
                      <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Total Txns</th>
                      <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">
                        {isAccountant1 ? 'Pending' : 'Unverified'}
                      </th>
                      {!isAccountant1 && (
                        <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Invoiced</th>
                      )}
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2e3650]">
                    {statements.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors cursor-pointer" onClick={() => navigate(`/statements/${s.id}`)}>
                        <td className="px-6 py-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">{s.statement_number}</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-[#e1e3f0] font-medium">{s.statement_name || '—'}</td>
                        <td className="px-6 py-4 text-gray-700 dark:text-[#c3c8e0]">****{s.card_last_four || '****'}</td>
                        <td className="px-6 py-4 text-gray-700 dark:text-[#c3c8e0]">{s.billing_period || '—'}</td>
                        <td className="px-6 py-4 text-center font-mono font-medium text-gray-900 dark:text-[#e1e3f0]">{s.total_transactions}</td>
                        <td className="px-6 py-4 text-center">
                          {s.unverified_count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{s.unverified_count}</span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-[#8d95b0]">—</span>
                          )}
                        </td>
                        {!isAccountant1 && (
                          <td className="px-6 py-4 text-center">
                            {s.invoiced_count > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{s.invoiced_count}</span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-[#8d95b0]">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4 text-gray-500 dark:text-[#8d95b0] text-xs">{fmtDate(s.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta.total_pages > 1 && (
                <div className="px-6 py-3 border-t border-gray-100 dark:border-[#2e3650] flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-[#8d95b0]">
                    Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, meta.total)} of {meta.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2e3650] text-xs font-medium text-gray-700 dark:text-[#e1e3f0] hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span className="text-xs text-gray-500 dark:text-[#8d95b0]">Page {page} of {meta.total_pages}</span>
                    <button className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2e3650] text-xs font-medium text-gray-700 dark:text-[#e1e3f0] hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors disabled:opacity-40" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyStatements;
