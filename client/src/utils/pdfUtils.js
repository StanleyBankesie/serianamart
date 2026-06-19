function isPageBlank(canvas) {
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const step = Math.max(1, Math.floor((canvas.width * canvas.height) / 2000));
  for (let i = 0; i < data.length; i += step * 4) {
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
  }
  return true;
}

export async function waitForImagesIn(el) {
  const imgs = Array.from(el?.querySelectorAll?.("img") || []);
  if (!imgs.length) return;
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

export async function renderHtmlToPdf(html, filename = "document.pdf") {
  const { toast } = await import("react-toastify");
  const html2canvas = (await import("html2canvas")).default;
  const { default: jsPDF } = await import("jspdf");
  const toastId = toast.loading("Generating PDF, please wait...");

  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "210mm";
    iframe.style.height = "10000px";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) throw new Error("Could not create render context");

    doc.open();
    doc.write(html);
    doc.close();

    await waitForImagesIn(doc.body);

    const bodyEl = doc.body;
    bodyEl.style.height = "auto";

    const canvas = await html2canvas(bodyEl, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const pageH = (pdfH * canvas.width) / pdfW;
    let srcY = 0;
    let pg = 0;
    while (srcY < canvas.height) {
      const h = Math.min(canvas.height - srcY, pageH);
      const pc = document.createElement("canvas");
      pc.width = canvas.width;
      pc.height = h;
      pc.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, h, 0, 0, canvas.width, h);
      if (!isPageBlank(pc)) {
        if (pg > 0) pdf.addPage();
        pdf.addImage(pc.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, (h * pdfW) / canvas.width);
        pg++;
      }
      srcY += h;
    }

    if (pg === 0) pdf.addPage();
    pdf.save(filename);
    document.body.removeChild(iframe);

    toast.update(toastId, {
      render: "PDF downloaded successfully!",
      type: "success",
      isLoading: false,
      autoClose: 2000,
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    toast.update(toastId, {
      render: err?.message || "Failed to generate PDF",
      type: "error",
      isLoading: false,
      autoClose: 4000,
    });
    throw err;
  }
}

export async function renderDocumentHtml(api, docType, id, featureName, fetchDataFn) {
  let payload_data = null;
  if (typeof fetchDataFn === "function") {
    try {
      payload_data = await fetchDataFn();
    } catch (e) {
      console.warn("Failed to fetch full data payload before rendering:", e);
    }
  }

  const payload = { format: "html" };
  if (featureName) payload.feature_name = featureName;
  if (payload_data) payload.payload_data = payload_data;

  const resp = await api.post(
    `/documents/${docType}/${id}/render`,
    payload,
    { headers: { "Content-Type": "application/json" } },
  );
  return typeof resp.data === "string" ? resp.data : String(resp.data || "");
}

export async function printDocument(api, docType, id, toast, featureName, fetchDataFn) {
  try {
    const html = await renderDocumentHtml(api, docType, id, featureName, fetchDataFn);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument || null;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    const patchCss = `<style>@media print{img{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
    doc.write(patchCss + html);
    doc.close();
    const win = iframe.contentWindow || window;
    const doPrint = () => {
      win.focus();
      try { win.print(); } catch {}
      setTimeout(() => { document.body.removeChild(iframe); }, 100);
    };
    setTimeout(doPrint, 200);
  } catch (err) {
    if (toast) {
      toast.error(err?.response?.data?.message || "Failed to print document");
    }
  }
}

export async function downloadDocumentPdf(api, docType, id, filename, toast, featureName, fetchDataFn) {
  try {
    const html = await renderDocumentHtml(api, docType, id, featureName, fetchDataFn);
    await renderHtmlToPdf(html, filename);
  } catch (err) {
    console.error("PDF Download Error:", err);
    if (toast) {
      toast.error(err?.response?.data?.message || `Failed to download ${filename}`);
    }
  }
}
