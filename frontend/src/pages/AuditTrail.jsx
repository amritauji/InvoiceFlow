import { useState, useEffect } from 'react';
import api from '../services/api';

const actionColors = {
  'invoice.submitted': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'invoice.approved': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'invoice.rejected': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'invoice.returned': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'invoice.stage_advanced': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'invoice.resubmitted': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/audit', { params: { limit, offset: page * limit } })
      .then(({ data }) => { setLogs(data.data); setTotal(data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-4 lg:p-6 space-y-6 dark:bg-[#0b1326] min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Audit Trail</h1>
        <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">Immutable log of all system actions.</p>
      </div>

      <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2e3650]">
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Actor</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Resource</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider hidden md:table-cell">Details</th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider hidden lg:table-cell">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#2e3650]">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-[#8d95b0]">No audit logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-[#242c42] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${actionColors[log.action] || 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-900 dark:text-[#e1e3f0]">
                      <div>{log.actor_email || '-'}</div>
                      <div className="text-[10px] text-gray-400 dark:text-[#8d95b0]">{log.actor_role || ''}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8d95b0]">
                      {log.resource_type} {log.resource_id ? `#${log.resource_id.slice(0, 8)}` : ''}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-[#8d95b0] hidden md:table-cell max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-[#8d95b0] hidden lg:table-cell">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / limit) > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-[#2e3650]">
            <p className="text-xs text-gray-400 dark:text-[#8d95b0]">Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button className="p-1.5 rounded-lg text-gray-600 dark:text-[#e1e3f0] hover:bg-gray-100 dark:hover:bg-[#242c42] disabled:opacity-40" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
