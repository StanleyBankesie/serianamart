const fs = require('fs');
const file = 'client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationForm.jsx';
let code = fs.readFileSync(file, 'utf8');

const anchorHandleSubmit = `  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!selectedExecutionId) {
        throw new Error("Select completed external service order");
      }
      if (!(accept1 && accept2 && accept3 && accept4 && accept5)) {
        throw new Error("Check all acceptance items");
      }
      if (!satisfaction) {
        throw new Error("Select satisfaction rating");
      }
      const payload = {
        sc_no:
          formData.sc_no ||
          \`SC-\${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}\`,
        sc_date: formData.sc_date,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        status: "APPROVED",`;

const repHandleSubmit = `  const handleSubmit = async (e, forceStatus = "APPROVED") => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!selectedExecutionId) {
        throw new Error("Select completed external service order");
      }
      if (forceStatus === "APPROVED") {
        if (!(accept1 && accept2 && accept3 && accept4 && accept5)) {
          throw new Error("Check all acceptance items");
        }
        if (!satisfaction) {
          throw new Error("Select satisfaction rating");
        }
      }
      const payload = {
        sc_no:
          formData.sc_no ||
          \`SC-\${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}\`,
        sc_date: formData.sc_date,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        status: forceStatus,`;

code = code.replace(anchorHandleSubmit, repHandleSubmit);

const anchorButtons = `          <div className="flex justify-end gap-2">
            <Link
              to="/service-management/service-confirmation"
              className="btn-secondary px-4 py-2"
            >
              Back
            </Link>
            {formData.status !== 'APPROVED' && (
              <button
                type="button"
                className="btn-success px-4 py-2"
                onClick={handleSubmit}
                disabled={saving || !readyToConfirm}
              >
                {saving ? "Confirming..." : "Confirm"}
              </button>
            )}
          </div>`;

const repButtons = `          <div className="flex justify-end gap-2">
            <Link
              to="/service-management/service-confirmation"
              className="btn-secondary px-4 py-2"
            >
              Back
            </Link>
            {formData.status !== 'APPROVED' && (
              <>
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  onClick={(e) => handleSubmit(e, "DRAFT")}
                  disabled={saving}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="btn-success px-4 py-2"
                  onClick={(e) => handleSubmit(e, "APPROVED")}
                  disabled={saving || !readyToConfirm}
                >
                  {saving ? "Confirming..." : "Confirm"}
                </button>
              </>
            )}
          </div>`;

code = code.replace(anchorButtons, repButtons);

fs.writeFileSync(file, code);
console.log("Updated buttons and handleSubmit");
