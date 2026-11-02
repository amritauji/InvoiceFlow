import { useCallback, useEffect, useRef, useState } from 'react';

let workerConfigured = false;

async function setupPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerConfigured) {
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
  return pdfjs;
}

export default function PdfViewer({ url, fileName }) {
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState('loading');

  const renderPdf = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    setStatus('loading');
    try {
      const pdfjs = await setupPdfjs();
      const pdf = await pdfjs.getDocument({ url }).promise;
      pdfRef.current = pdf;
      if (!mountedRef.current) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const width = container.clientWidth || 600;
      container.innerHTML = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        if (!mountedRef.current) return;
        const page = await pdf.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.setAttribute('aria-label', `${fileName || 'PDF'} — page ${i}`);

        const wrap = document.createElement('div');
        wrap.style.cssText =
          'margin:0 auto 16px;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.08);';
        wrap.appendChild(canvas);
        container.appendChild(wrap);

        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        }).promise;
      }

      if (mountedRef.current) setStatus('ready');
    } catch {
      if (mountedRef.current) setStatus('error');
    }
  }, [url, fileName]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kick off async render on mount
    renderPdf();
    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (pdfRef.current) renderPdf();
      }, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    };
  }, [renderPdf]);

  return (
    <div className="w-full h-full overflow-auto bg-gray-100 dark:bg-[#0f1423]">
      <div ref={containerRef} className="p-3 sm:p-4 flex flex-col items-center" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-gray-400 dark:text-[#8d95b0] bg-white/70 dark:bg-[#0f1423]/70 px-4 py-2 rounded-lg">
            <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            <span className="text-sm">Loading document...</span>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-[#0f1423]">
          <span className="material-symbols-outlined text-[40px] text-gray-400 dark:text-[#8d95b0]">error_outline</span>
          <p className="text-sm mt-2 text-gray-400 dark:text-[#8d95b0]">Could not load document inline.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg"
          >
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            Open PDF
          </a>
        </div>
      )}
    </div>
  );
}
