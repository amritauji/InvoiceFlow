import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getErrorMessage } from '../utils/error';

const STATUS_COLORS = {
  submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  under_review: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  verified: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function SubmitStatement() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statementName, setStatementName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [step, setStep] = useState('upload');
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }
    setFile(selectedFile);
    setError('');
    setPreview(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleParse = async () => {
    if (!file) { setError('Please upload a statement PDF.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/statements/parse-preview', formData);
      setPreview(data.data);
      setStep('preview');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to parse statement. Please check the file format.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (statementName) formData.append('statement_name', statementName);
      if (remarks) formData.append('remarks', remarks);
      await api.post('/statements', formData);
      navigate('/statements');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit statement.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  const totalAmount = preview?.transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

  return (
    <div className="p-4 lg:p-6 dark:bg-[#0b1326] dark:text-[#e1e3f0]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Submit Statement</h1>
          <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">Upload a bank statement PDF to extract and verify transactions.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>{error}
          </div>
        )}

        {step === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0] mb-3 pb-2 border-b border-gray-100 dark:border-[#2e3650]">Statement PDF *</h2>
              <div
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all dark:bg-[#242c42] ${isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 dark:border-[#2e3650] hover:border-gray-300 dark:hover:border-[#3a4560] hover:bg-gray-50 dark:hover:bg-[#2a324a]'}`}
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !file && document.getElementById('stmtFileInput').click()}
              >
                <input accept=".pdf" className="hidden" id="stmtFileInput" type="file" onChange={(e) => e.target.files.length > 0 && validateAndSetFile(e.target.files[0])} />
                {!file ? (
                  <>
                    <span className="material-symbols-outlined text-[40px] text-gray-300 dark:text-[#8d95b0] mb-3">cloud_upload</span>
                    <p className="text-sm font-medium text-gray-700 dark:text-[#e1e3f0] mb-1">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-400 dark:text-[#8d95b0]">PDF bank statement up to 10MB</p>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[28px] text-rose-500">picture_as_pdf</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0] truncate max-w-[250px]">{file.name}</p>
                        <p className="text-xs text-gray-400 dark:text-[#8d95b0]">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5" htmlFor="stmtName">Statement Name *</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm text-gray-900 dark:text-[#e1e3f0] dark:bg-[#242c42] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors" id="stmtName" placeholder="e.g. HDFC Card Aug 2026" value={statementName} onChange={(e) => setStatementName(e.target.value)} />
              </div>
              <div className="mt-4">
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5" htmlFor="remarks">Remarks</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm text-gray-900 dark:text-[#e1e3f0] dark:bg-[#242c42] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors resize-none" id="remarks" placeholder="Optional notes about this statement..." rows="2" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-[#2e3650] flex justify-end gap-3">
                <button className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm font-medium text-gray-700 dark:text-[#e1e3f0] hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors" type="button" onClick={() => navigate(-1)}>Cancel</button>
                <button className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60" type="button" disabled={isSubmitting || !file || !statementName} onClick={handleParse}>
                  {isSubmitting ? (<><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Parsing...</>) : (<><span className="material-symbols-outlined text-[16px]">find_in_page</span>Parse Statement</>)}
                </button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-5 sticky top-20">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-indigo-600 text-[20px]">info</span>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0]">Guidelines</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    { title: 'Supported Formats', desc: 'Upload HDFC, ICICI, or other bank credit card statements in PDF format.' },
                    { title: 'Auto-Extraction', desc: 'Transactions are extracted automatically from the statement regions.' },
                    { title: 'Review Before Submit', desc: 'Verify extracted transactions on the preview screen before final submission.' },
                  ].map((tip, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5"><span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{i + 1}</span></div>
                      <div><p className="text-[13px] font-medium text-gray-900 dark:text-[#e1e3f0]">{tip.title}</p><p className="text-xs text-gray-500 dark:text-[#8d95b0] mt-0.5 leading-relaxed">{tip.desc}</p></div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-[#2e3650]">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e1e3f0]">Extraction Preview</h2>
                  <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">{preview.meta?.card_holder_name || 'Statement'} &mdash; Card ****{preview.meta?.card_last_four || '****'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Transactions</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-[#e1e3f0]">{preview.transactions.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 dark:text-[#8d95b0] uppercase tracking-wider">Total</p>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#242c42] border-b border-gray-100 dark:border-[#2e3650]">
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider w-8">#</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Transaction Description</th>
                    <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#2e3650]">
                  {preview.transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors">
                      <td className="px-6 py-3 text-gray-400 dark:text-[#8d95b0]">{i + 1}</td>
                      <td className="px-6 py-3 font-mono text-gray-900 dark:text-[#e1e3f0]">{t.date}</td>
                      <td className="px-6 py-3 text-gray-700 dark:text-[#c3c8e0]">{t.description}</td>
                      <td className="px-6 py-3 text-right font-mono font-medium text-gray-900 dark:text-[#e1e3f0]">₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-[#242c42] border-t border-gray-200 dark:border-[#2e3650]">
                    <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-[#e1e3f0]">Total</td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-[#2e3650] flex justify-end gap-3">
              <button className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm font-medium text-gray-700 dark:text-[#e1e3f0] hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors" onClick={() => { setStep('upload'); setPreview(null); }}>Back</button>
              <button className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60" disabled={isSubmitting} onClick={handleSubmit}>
                {isSubmitting ? (<><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Submitting...</>) : (<><span className="material-symbols-outlined text-[16px]">send</span>Submit Statement</>)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubmitStatement;
