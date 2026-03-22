import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../hooks/usePermissions.jsx";

export default function HRSetup() {
  const [activeTab, setActiveTab] = useState("departments");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "departments") endpoint = "/hr/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods") endpoint = "/hr/payroll/periods";
      
      const res = await api.get(endpoint);
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setForm({});
    setIsEditing(false);
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let endpoint = "";
      if (activeTab === "departments") endpoint = "/hr/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods") endpoint = "/hr/payroll/periods";

      await api.post(endpoint, form);
      toast.success("Saved successfully");
      setForm({});
      setIsEditing(false);
      loadData();
    } catch (err) {
      toast.error("Failed to save");
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setIsEditing(true);
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/human-resources" className="btn-secondary text-sm">
            Back to Menu
          </Link>
          <h2 className="text-lg font-semibold">HR Setup & Parameters</h2>
        </div>

        <div className="flex border-b mb-6 overflow-x-auto">
          {["departments", "positions", "leave-types", "payroll-periods"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap ${
                activeTab === tab 
                  ? "border-b-2 border-brand text-brand" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
              <h3 className="font-medium mb-4">{isEditing ? "Edit" : "Add New"} {activeTab.replace("-", " ")}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === "departments" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Code</label>
                      <input className="input" value={form.dept_code || ""} onChange={e => setForm({...form, dept_code: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Name</label>
                      <input className="input" value={form.dept_name || ""} onChange={e => setForm({...form, dept_name: e.target.value})} required />
                    </div>
                  </>
                )}
                {activeTab === "positions" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Code</label>
                      <input className="input" value={form.pos_code || ""} onChange={e => setForm({...form, pos_code: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Name</label>
                      <input className="input" value={form.pos_name || ""} onChange={e => setForm({...form, pos_name: e.target.value})} required />
                    </div>
                  </>
                )}
                {activeTab === "leave-types" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Type Name</label>
                      <input className="input" value={form.type_name || ""} onChange={e => setForm({...form, type_name: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Days Per Year</label>
                      <input className="input" type="number" value={form.days_per_year || ""} onChange={e => setForm({...form, days_per_year: e.target.value})} required />
                    </div>
                  </>
                )}
                {activeTab === "payroll-periods" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Period Name</label>
                      <input className="input" placeholder="e.g. March 2026" value={form.period_name || ""} onChange={e => setForm({...form, period_name: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Start Date</label>
                      <input className="input" type="date" value={form.start_date || ""} onChange={e => setForm({...form, start_date: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">End Date</label>
                      <input className="input" type="date" value={form.end_date || ""} onChange={e => setForm({...form, end_date: e.target.value})} required />
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1">Save</button>
                  {isEditing && <button type="button" onClick={() => {setForm({}); setIsEditing(false);}} className="btn-secondary">Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700 text-left">
                    <th className="px-4 py-2">Details</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2">
                        {activeTab === "departments" && (
                          <div>
                            <div className="font-medium">{item.dept_name}</div>
                            <div className="text-xs text-slate-500">{item.dept_code}</div>
                          </div>
                        )}
                        {activeTab === "positions" && (
                          <div>
                            <div className="font-medium">{item.pos_name}</div>
                            <div className="text-xs text-slate-500">{item.pos_code}</div>
                          </div>
                        )}
                        {activeTab === "leave-types" && (
                          <div>
                            <div className="font-medium">{item.type_name}</div>
                            <div className="text-xs text-slate-500">{item.days_per_year} days/year</div>
                          </div>
                        )}
                        {activeTab === "payroll-periods" && (
                          <div>
                            <div className="font-medium">{item.period_name}</div>
                            <div className="text-xs text-slate-500">{item.start_date} to {item.end_date}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleEdit(item)} className="text-brand text-sm hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && !loading && (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">No records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
}
