import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function KPISetup() {
  const [items, setItems] = React.useState([]);
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    description: "",
    target_value: "",
  });

  const load = async () => {
    try {
      const res = await api.get("/hr/performance/kpis");
      setItems(res?.data?.items || []);
    } catch {}
  };
  React.useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/hr/performance/kpis", { ...form });
      toast.success("KPI saved");
      setForm({ code: "", name: "", description: "", target_value: "" });
      load();
    } catch {
      toast.error("Failed to save KPI");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/human-resources" className="btn-secondary text-sm">
          Back to Menu
        </Link>
        <h2 className="text-lg font-semibold">KPI Setup</h2>
      </div>
      <form
        onSubmit={submit}
        className="bg-white dark:bg-slate-800 p-4 rounded mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Code</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Description</label>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Target Value</label>
            <input
              className="input"
              value={form.target_value}
              onChange={(e) =>
                setForm((s) => ({ ...s, target_value: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-slate-800 rounded">
        <table className="min-w-full">
          <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
            <tr className="text-left">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Target</th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.id} className="border-t">
                <td className="px-3 py-2">{k.code}</td>
                <td className="px-3 py-2">{k.name}</td>
                <td className="px-3 py-2">{k.target_value ?? "-"}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm" colSpan={3}>
                  No KPIs
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
