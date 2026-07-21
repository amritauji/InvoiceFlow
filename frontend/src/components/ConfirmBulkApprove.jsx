import { useState } from 'react';

export default function ConfirmBulkApprove({ count, onConfirm, onCancel }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(comment);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white dark:bg-[#1e2538] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-gray-200 dark:border-[#2e3650] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px] text-emerald-600 dark:text-emerald-400">check_circle</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e1e3f0]">Bulk Approve</h2>
            <p className="text-sm text-gray-500 dark:text-[#8d95b0]">This action cannot be undone.</p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-[#242c42] rounded-xl p-4 transition-colors">
          <p className="text-sm text-gray-700 dark:text-[#e1e3f0]">
            You are about to approve <span className="font-semibold text-gray-900 dark:text-[#e1e3f0]">{count} invoice{count !== 1 ? 's' : ''}</span>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5">
            Comment (optional)
          </label>
          <textarea
            className="w-full border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm p-3 h-20 resize-none text-gray-900 dark:text-[#e1e3f0] placeholder:text-gray-400 dark:placeholder:text-[#8d95b0] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors bg-white dark:bg-[#242c42]"
            placeholder="Add a comment for all selected invoices..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-[#e1e3f0] bg-white dark:bg-[#242c42] border border-gray-200 dark:border-[#2e3650] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e2538] transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            )}
            Approve {count} Invoice{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
