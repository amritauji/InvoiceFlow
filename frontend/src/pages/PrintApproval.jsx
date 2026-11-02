import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getErrorMessage } from '../utils/error';

export default function PrintApproval() {
  const { id } = useParams();
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    const fetchPdf = async () => {
      try {
        // First get invoice number for filename
        const invRes = await api.get(`/invoices/${id}`);
        setInvoiceNumber(invRes.data.data.invoice_number);

        // Fetch the merged PDF blob
        const response = await api.get(`/invoices/${id}/print-pdf`, {
          responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load invoice PDF. Only approved invoices can be printed.'));
      } finally {
        setLoading(false);
      }
    };
    fetchPdf();

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [id]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${invoiceNumber || 'invoice'}_approved.pdf`;
      a.click();
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
          <span className="text-sm">Generating approval PDF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-gray-300">error_outline</span>
            <p className="text-sm text-gray-600 mt-4 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          iframe { width: 100% !important; height: 100vh !important; border: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{invoiceNumber}</p>
            <p className="text-[10px] text-gray-400">Approved Invoice — Print Preview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            Download
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">print</span>
            Print
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-gray-100" style={{ height: 'calc(100vh - 7.5rem)' }}>
        {pdfUrl && (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title={`${invoiceNumber} - Approved PDF`}
          />
        )}
      </div>
    </>
  );
}
