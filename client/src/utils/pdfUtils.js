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

export async function renderHtmlToA4Pdf(html, filename = "document.pdf") {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.background = "white";
  container.style.width = "794px"; // ~A4 width at 96dpi
  container.style.padding = "32px";
  container.innerHTML = html;
  document.body.appendChild(container);

  await waitForImagesIn(container);
  const { default: html2canvas } = await import("html2canvas");
  const { default: JsPDF } = await import("jspdf");

  const canvas = await html2canvas(container, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new JsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let rendered = 0;
  while (rendered < imgHeight) {
    pdf.addImage(imgData, "PNG", 0, -rendered, imgWidth, imgHeight);
    rendered += pageHeight;
    if (rendered < imgHeight) pdf.addPage();
  }
  document.body.removeChild(container);
  pdf.save(filename);
}

export async function fetchReportHeaderHtml(api) {
  // Uses the general-template preview as the report header
  const res = await api.post(`/documents/general-template/preview`, {
    format: "html",
  });
  return String(res.data || "");
}

export function joinHeaderAndBody(headerHtml, bodyHtml) {
  // Naive join: place header above body
  return `${headerHtml || ""}\n${bodyHtml || ""}`;
}

