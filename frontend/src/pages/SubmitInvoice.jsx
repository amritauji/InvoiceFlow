import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function SubmitInvoice() {
  const navigate = useNavigate();
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/departments')
      .then(({ data }) => setDepartments(data.data || []))
      .catch(() => {});
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile.size > 10 * 1024 * 1024) { alert('File is too large. Maximum size is 10MB.'); return; }
    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please attach an invoice document.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('vendor_name', vendorName);
      formData.append('amount', amount);
      if (remarks) formData.append('remarks', remarks);
      if (departmentId) formData.append('department_id', departmentId);
      formData.append('file', file);
      await api.post('/invoices', formData);
      alert('Invoice submitted successfully!');
      navigate('/invoices');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="p-4 lg:p-6 dark:bg-[#0b1326] dark:text-[#e1e3f0]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e1e3f0]">Submit Invoice</h1>
          <p className="text-sm text-gray-500 dark:text-[#8d95b0] mt-1">Enter vendor details and attach the invoice document.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>{error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0] mb-3 pb-2 border-b border-gray-100 dark:border-[#2e3650]">Vendor Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5" htmlFor="vendorName">Vendor Name *</label>
                    <input className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm text-gray-900 dark:text-[#e1e3f0] dark:bg-[#242c42] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#8d95b0]" id="vendorName" placeholder="e.g. Acme Corp" required type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5" htmlFor="amount">Total Amount (INR) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#8d95b0] text-sm">INR</span>
                      <input className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm text-gray-900 dark:text-[#e1e3f0] dark:bg-[#242c42] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#8d95b0]" id="amount" min="0" placeholder="0.00" required step="0.01" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5" htmlFor="department">Department</label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm text-gray-900 dark:text-[#e1e3f0] dark:bg-[#242c42] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors bg-white"
                      id="department"
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                    >
                      <option value="">Select department (optional)</option>
                      {departments.filter(d => d.is_active).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0] mb-3 pb-2 border-b border-gray-100 dark:border-[#2e3650]">Additional Information</h2>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-[#8d95b0] uppercase tracking-wider mb-1.5" htmlFor="remarks">Remarks</label>
                  <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm text-gray-900 dark:text-[#e1e3f0] dark:bg-[#242c42] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#8d95b0] resize-none" id="remarks" placeholder="Provide any context for this invoice..." rows="3" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0] mb-3 pb-2 border-b border-gray-100 dark:border-[#2e3650]">Invoice Document *</h2>
                <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all dark:bg-[#242c42] ${isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 dark:border-[#2e3650] hover:border-gray-300 dark:hover:border-[#3a4560] hover:bg-gray-50 dark:hover:bg-[#2a324a]'}`} onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => !file && document.getElementById('fileInput').click()}>
                  <input accept=".pdf,image/png,image/jpeg" className="hidden" id="fileInput" type="file" onChange={(e) => e.target.files.length > 0 && validateAndSetFile(e.target.files[0])} />
                  {!file ? (
                    <>
                      <span className="material-symbols-outlined text-[40px] text-gray-300 dark:text-[#8d95b0] mb-3">cloud_upload</span>
                      <p className="text-sm font-medium text-gray-700 dark:text-[#e1e3f0] mb-1">Drag & drop or click to upload</p>
                      <p className="text-xs text-gray-400 dark:text-[#8d95b0]">PDF, JPG, PNG up to 10MB</p>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[28px] text-rose-500">picture_as_pdf</span>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-[#e1e3f0] truncate max-w-[200px]">{file.name}</p>
                          <p className="text-xs text-gray-400 dark:text-[#8d95b0]">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button className="p-1.5 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-[#2e3650] flex justify-end gap-3">
                <button className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-[#2e3650] text-sm font-medium text-gray-700 dark:text-[#e1e3f0] hover:bg-gray-50 dark:hover:bg-[#242c42] transition-colors" type="button" onClick={() => navigate(-1)}>Cancel</button>
                <button className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (<><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Submitting...</>) : (<><span className="material-symbols-outlined text-[16px]">send</span>Submit Invoice</>)}
                </button>
              </div>
            </form>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#1e2538] rounded-xl border border-gray-200 dark:border-[#2e3650] shadow-sm p-5 sticky top-20">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-indigo-600 text-[20px]">info</span>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#e1e3f0]">Guidelines</h3>
              </div>
              <ul className="space-y-4">
                {[{ title: 'Preferred Format', desc: 'Upload PDF for best results. High-res JPEG is also accepted.' }, { title: 'Verify Vendor Name', desc: 'Ensure the vendor name matches the invoice header exactly.' }, { title: 'Clear Scan', desc: 'All totals and line items must be clearly visible and legible.' }].map((tip, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5"><span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{i + 1}</span></div>
                    <div><p className="text-[13px] font-medium text-gray-900 dark:text-[#e1e3f0]">{tip.title}</p><p className="text-xs text-gray-500 dark:text-[#8d95b0] mt-0.5 leading-relaxed">{tip.desc}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubmitInvoice;
