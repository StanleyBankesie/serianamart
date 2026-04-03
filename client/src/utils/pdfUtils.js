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
  const { api } = await import("../api/client.js");
  const { toast } = await import("react-toastify");
  const toastId = toast.loading("Generating PDF, please wait...");

  try {
    const res = await api.post(
      "/documents/raw-html-to-pdf",
      JSON.stringify({ html }),
      {
        responseType: "blob",
        headers: { "Content-Type": "application/json" },
        transformRequest: [(data) => data],  // skip default transform, already stringified
      },
    );

    // Verify we actually got a PDF back, not an error JSON
    const blob = res.data;
    if (!blob || blob.size === 0) {
      throw new Error("Empty PDF response from server");
    }

    // Check content type - if server returned JSON error, handle it
    if (blob.type && blob.type.includes("application/json")) {
      const text = await blob.text();
      const err = JSON.parse(text);
      throw new Error(err.message || "Server returned an error");
    }

    const url = window.URL.createObjectURL(
      new Blob([blob], { type: "application/pdf" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 200);

    toast.update(toastId, {
      render: "PDF downloaded successfully!",
      type: "success",
      isLoading: false,
      autoClose: 2000,
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    toast.update(toastId, {
      render: err?.response?.data?.message || err?.message || "Failed to generate PDF",
      type: "error",
      isLoading: false,
      autoClose: 4000,
    });
    throw err;
  }
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
