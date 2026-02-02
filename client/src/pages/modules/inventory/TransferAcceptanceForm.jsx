import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";

export default function TransferAcceptanceForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [transfer, setTransfer] = useState(null);
  const [details, setDetails] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/transfer-acceptance/${id}`)
      .then((res) => {
        if (!mounted) return;
        setTransfer(res.data?.item || null);
        const fetchedDetails = Array.isArray(res.data?.details)
          ? res.data.details
          : [];

        setDetails(
          fetchedDetails.map((d) => ({
            ...d,
            received_qty: Number(d.remaining_qty ?? d.qty ?? 0),
            variance: 0,
            rejected_now: 0,
            remarks: "",
          }))
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load transfer");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleReceivedQtyChange = (detailId, value) => {
    const received = parseFloat(value) || 0;
    setDetails((prev) =>
      prev.map((d) => {
        if (d.id === detailId) {
          const remaining = Number(d.remaining_qty ?? d.qty ?? 0);
          const rejected = Number(d.rejected_now || 0);
          const variance = received + rejected - remaining;
          return { ...d, received_qty: received, variance };
        }
        return d;
      })
    );
  };

  const handleRejectedQtyChange = (detailId, value) => {
    const rejected = parseFloat(value) || 0;
    setDetails((prev) =>
      prev.map((d) => {
        if (d.id === detailId) {
          const remaining = Number(d.remaining_qty ?? d.qty ?? 0);
          const received = Number(d.received_qty || 0);
          const variance = received + rejected - remaining;
          return { ...d, rejected_now: rejected, variance };
        }
        return d;
      })
    );
  };

  const handleRemarksChange = (detailId, value) => {
    setDetails((prev) =>
      prev.map((d) => (d.id === detailId ? { ...d, remarks: value } : d))
    );
  };

  const acceptTransfer = async () => {
    setSaving(true);
    setError("");

    try {
      // Send the accepted details with variance and remarks
      const payload = {
        details: details.map((d) => {
          const remaining = Math.max(0, Number(d.remaining_qty ?? 0));
          const accepted = Math.max(
            0,
            Math.min(Number(d.received_qty) || 0, remaining)
          );
          const rejectedWanted = Math.max(0, Number(d.rejected_now) || 0);
          const rejected = Math.max(
            0,
            Math.min(rejectedWanted, Math.max(0, remaining - accepted))
          );
          return {
            id: d.id,
            item_id: d.item_id,
            qty: Number(d.qty) || 0,
            received_qty: accepted,
            accepted_qty: accepted,
            rejected_qty: rejected,
            acceptance_remarks: d.remarks,
          };
        }),
      };

      await api.put(`/inventory/transfer-acceptance/${id}`, payload);
      navigate("/inventory/transfer-acceptance");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to accept transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Transfer Acceptance
              </h1>
              <p className="text-sm mt-1">
                Review items and accept inbound transfer
              </p>
            </div>
            <Link to="/inventory/transfer-acceptance" className="btn-success">
              Back to List
            </Link>
          </div>
        </div>

        <div className="card-body space-y-6">
          {loading ? <div className="text-sm">Loading...</div> : null}
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          {transfer ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Transfer No</div>
                <div className="font-semibold">{transfer.transfer_no}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Date</div>
                <div className="font-semibold">
                  {transfer.transfer_date
                    ? String(transfer.transfer_date).slice(0, 10)
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">From Warehouse</div>
                <div className="font-semibold">
                  {transfer.from_warehouse_name ||
                    transfer.from_warehouse_id ||
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">To Warehouse</div>
                <div className="font-semibold">
                  {transfer.to_warehouse_name ||
                    transfer.to_warehouse_id ||
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div>
                  <span
                    className={`badge ${
                      transfer.status === "IN_TRANSIT"
                        ? "badge-warning"
                        : "badge-info"
                    }`}
                  >
                    {transfer.status}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold text-slate-100 dark:text-slate-100">
                Items Verification
              </h2>
            </div>
            <div className="card-body">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th className="w-24">Transferred</th>
                      <th className="w-24">Remaining</th>
                      <th className="w-28">Receive Now</th>
                      <th className="w-28">Reject Now</th>
                      <th className="w-24">Variance</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!details.length ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="text-center py-6 text-slate-500 dark:text-slate-400"
                        >
                          No items
                        </td>
                      </tr>
                    ) : null}
                    {details.map((d) => (
                      <tr key={d.id}>
                        <td className="font-medium text-brand-700 dark:text-brand-300">
                          {d.item_code}
                        </td>
                        <td>{d.item_name}</td>
                        <td>{d.qty}</td>
                        <td>{Number(d.remaining_qty ?? 0)}</td>
                        <td>
                          <input
                            type="number"
                            className="input h-8"
                            value={d.received_qty}
                            onChange={(e) =>
                              handleReceivedQtyChange(d.id, e.target.value)
                            }
                            min="0"
                            step="0.001"
                            max={Math.max(
                              0,
                              Number(d.remaining_qty ?? 0) -
                                Number(d.rejected_now || 0)
                            )}
                            disabled={transfer?.status === "RECEIVED"}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input h-8"
                            value={d.rejected_now}
                            onChange={(e) =>
                              handleRejectedQtyChange(d.id, e.target.value)
                            }
                            min="0"
                            step="0.001"
                            max={Math.max(
                              0,
                              Number(d.remaining_qty ?? 0) -
                                Number(d.received_qty || 0)
                            )}
                            disabled={transfer?.status === "RECEIVED"}
                          />
                        </td>
                        <td>
                          <span
                            className={`font-semibold ${
                              d.variance < 0
                                ? "text-red-600"
                                : d.variance > 0
                                ? "text-blue-600"
                                : "text-green-600"
                            }`}
                          >
                            {d.variance > 0 ? "+" : ""}
                            {d.variance}
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input h-8"
                            value={d.remarks}
                            onChange={(e) =>
                              handleRemarksChange(d.id, e.target.value)
                            }
                            placeholder="Variance reason..."
                            disabled={transfer?.status === "RECEIVED"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Link to="/inventory/transfer-acceptance" className="btn-success">
              Close
            </Link>
            <button
              type="button"
              className="btn-success"
              onClick={acceptTransfer}
              disabled={saving || !transfer || transfer.status === "RECEIVED"}
            >
              {saving ? "Accepting..." : "Accept Transfer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
