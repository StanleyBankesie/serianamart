const fs = require('fs');

const formFile = 'client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationForm.jsx';
let formCode = fs.readFileSync(formFile, 'utf8');

// 1. Remove "Confirmation Summary" section
const summaryAnchor = `              <div className="space-y-4">
                <div className="card">
                  <div className="card-header bg-brand text-white rounded-t-lg">
                    <div className="font-semibold">Confirmation Summary</div>
                  </div>
                  <div className="card-body space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <div className="text-sm">Supplier</div>
                      <div className="text-sm font-semibold">
                        {supplierName || "-"}
                      </div>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <div className="text-sm">Appointment</div>
                      <div className="text-sm font-semibold">
                        {(formData.sc_date || "") +
                          (appointmentTime ? \` \${appointmentTime}\` : "")}
                      </div>
                    </div>
                    <div className="flex justify-between py-1">
                      <div className="text-sm">Location</div>
                      <div className="text-sm font-semibold">In Shop</div>
                    </div>
                    <div className="flex justify-between py-1 border-t pt-2">
                      <div className="text-sm">Total</div>
                      <div className="text-sm font-semibold">{\`GH₵ \${computedTotal.toFixed(2)}\`}</div>
                    </div>
                    <div className="mt-2">
                      <span
                        className={
                          "inline-block px-3 py-1 rounded-full text-xs font-semibold " +
                          (readyToConfirm
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700")
                        }
                      >
                        {readyToConfirm
                          ? "Ready to Confirm"
                          : "Pending Confirmation"}
                      </span>
                    </div>
                  </div>
                </div>`;
formCode = formCode.replace(summaryAnchor, '');

// 2. Time field default system time
formCode = formCode.replace(
  'const [appointmentTime, setAppointmentTime] = useState("");',
  'const [appointmentTime, setAppointmentTime] = useState(() => new Date().toTimeString().slice(0, 5));'
);

// 3. Date field display only date in view mode
formCode = formCode.replace(
  '<div className="font-semibold">{formData.sc_date || "-"}</div>',
  '<div className="font-semibold">{formData.sc_date ? String(formData.sc_date).slice(0, 10) : "-"}</div>'
);
formCode = formCode.replace(
  '<div className="font-semibold">\n                          {selectedExecution.order_date || "-"}\n                        </div>',
  '<div className="font-semibold">\n                          {selectedExecution.order_date ? String(selectedExecution.order_date).slice(0, 10) : "-"}\n                        </div>'
);

fs.writeFileSync(formFile, formCode);


const listFile = 'client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationsList.jsx';
let listCode = fs.readFileSync(listFile, 'utf8');

// 4. Remove pending external service orders in list
const pendingExternalAnchor = `                {filteredPendingOrders.length > 0 && (
                  <>
                    <tr>
                      <td colSpan="8" className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                        Pending External Service Orders (Ready for Confirmation)
                      </td>
                    </tr>
                    {filteredPendingOrders.map((o) => (
                      <tr key={\`order-\${o.id}\`} className="bg-blue-50/30 dark:bg-blue-900/10">
                        <td className="font-medium text-blue-700 dark:text-blue-300">
                          {o.order_no}
                        </td>
                        <td>{o.order_date ? String(o.order_date).slice(0, 10) : "-"}</td>
                        <td>{o.customer_name || "-"}</td>
                        <td>{Number(o.total_amount || 0).toFixed(2)}</td>
                        <td>
                          <span className="badge badge-info">
                            {o.status || "-"}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={\`/service-management/service-confirmation/new?order_id=\${o.id}\`}
                            className="text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            + Create Confirmation
                          </Link>
                        </td>
                        <td>{o.created_by_name || "-"}</td>
                        <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))}
                  </>
                )}`;
listCode = listCode.replace(pendingExternalAnchor, '');

fs.writeFileSync(listFile, listCode);

console.log("Done tweaks");
