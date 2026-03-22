import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function OfferForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [positions, setPositions] = useState([]);
  const [form, setForm] = useState({
    offer_no: "",
    offer_date: new Date().toISOString().split("T")[0],
    requisition_id: "",
    candidate_id: "",
    position_id: "",
    gross_salary: 0,
    allowances: 0,
    deductions: 0,
    net_salary: 0,
    status: "DRAFT",
    remarks: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [reqRes, candRes, posRes] = await Promise.all([
          api.get("/hr/requisitions"),
          api.get("/hr/candidates"),
          api.get("/hr/positions"),
        ]);
        setRequisitions(reqRes?.data?.items || []);
        setCandidates(candRes?.data?.items || []);
        setPositions(posRes?.data?.items || []);
      } catch {}
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!isEdit) {
      // Auto-generate offer no
      setForm(s => ({ ...s, offer_no: "OFF-" + Date.now().toString().slice(-6) }));
      return;
    }
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await api.get(`/hr/offers/${id}`);
        const item = res?.data?.item || {};
        setForm({
          ...item,
          offer_date: item.offer_date ? item.offer_date.slice(0, 10) : "",
        });
      } catch {
        toast.error("Failed to fetch offer details");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [id, isEdit]);

  const calculateNet = () => {
    const gross = Number(form.gross_salary || 0);
    const allow = Number(form.allowances || 0);
    const ded = Number(form.deductions || 0);
    setForm(s => ({ ...s, net_salary: gross + allow - ded }));
  };

  useEffect(() => {
    calculateNet();
  }, [form.gross_salary, form.allowances, form.deductions]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/hr/offers", form);
      toast.success("Offer saved successfully");
      navigate("/human-resources/offers");
    } catch {
      toast.error("Failed to save offer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/human-resources/offers" className="btn-secondary text-sm">
          Back
        </Link>
        <h2 className="text-lg font-semibold">{isEdit ? "Edit Offer" : "New Offer"}</h2>
      </div>

      <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Offer No *</label>
            <input className="input font-mono" value={form.offer_no} readOnly />
          </div>
          <div>
            <label className="label">Offer Date *</label>
            <input type="date" className="input" value={form.offer_date} onChange={e => setForm({...form, offer_date: e.target.value})} required />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="label">Job Requisition *</label>
            <select className="input" value={form.requisition_id} onChange={e => setForm({...form, requisition_id: e.target.value})} required>
              <option value="">Select Requisition</option>
              {requisitions.map(r => <option key={r.id} value={r.id}>{r.req_no} - {r.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Candidate *</label>
            <select className="input" value={form.candidate_id} onChange={e => setForm({...form, candidate_id: e.target.value})} required>
              <option value="">Select Candidate</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Position</label>
            <select className="input" value={form.position_id} onChange={e => setForm({...form, position_id: e.target.value})}>
              <option value="">Select Position</option>
              {positions.map(p => <option key={p.id} value={p.id}>{p.pos_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Gross Salary *</label>
            <input type="number" className="input" value={form.gross_salary} onChange={e => setForm({...form, gross_salary: e.target.value})} required />
          </div>
          <div>
            <label className="label">Allowances</label>
            <input type="number" className="input" value={form.allowances} onChange={e => setForm({...form, allowances: e.target.value})} />
          </div>
          <div>
            <label className="label">Deductions</label>
            <input type="number" className="input" value={form.deductions} onChange={e => setForm({...form, deductions: e.target.value})} />
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded">
            <label className="text-xs font-medium uppercase text-slate-500 mb-1 block">Net Salary</label>
            <div className="text-xl font-bold text-brand">{Number(form.net_salary).toLocaleString()}</div>
          </div>
          <div className="md:col-span-2">
            <label className="label">Remarks</label>
            <textarea className="input" rows={2} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 border-t pt-4">
          <button type="button" className="btn-secondary" onClick={() => navigate("/human-resources/offers")}>Cancel</button>
          <button type="submit" className="btn-primary px-8" disabled={loading}>Save Offer</button>
        </div>
      </form>
    </div>
  );
}
