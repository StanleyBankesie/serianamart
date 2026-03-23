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
      if (activeTab === "departments") endpoint = "/admin/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "locations") endpoint = "/hr/setup/locations";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods") endpoint = "/hr/payroll/periods";
      else if (activeTab === "employment-types") endpoint = "/hr/setup/employment-types";
      else if (activeTab === "employee-categories") endpoint = "/hr/setup/employee-categories";
      else if (activeTab === "allowance-types") endpoint = "/hr/setup/allowance-types";
      else if (activeTab === "parameters") endpoint = "/hr/setup/parameters";
      
      const res = await api.get(endpoint);
      if (activeTab === "parameters") {
        setItems([]);
        const params = res?.data?.items || [];
        const formObj = {};
        params.forEach(p => formObj[p.param_key] = p.param_value);
        setForm(formObj);
      } else {
        setItems(res?.data?.items || []);
      }
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
      if (activeTab === "departments") endpoint = "/admin/departments";
      else if (activeTab === "positions") endpoint = "/hr/positions";
      else if (activeTab === "locations") endpoint = "/hr/setup/locations";
      else if (activeTab === "leave-types") endpoint = "/hr/leave/types";
      else if (activeTab === "payroll-periods") endpoint = "/hr/payroll/periods";
      else if (activeTab === "employment-types") endpoint = "/hr/setup/employment-types";
      else if (activeTab === "employee-categories") endpoint = "/hr/setup/employee-categories";
      else if (activeTab === "allowance-types") endpoint = "/hr/setup/allowance-types";
      if (activeTab === "departments") {
        if (isEditing && form.id) {
          await api.put(`${endpoint}/${form.id}`, form);
        } else {
          await api.post(endpoint, form);
        }
      } else if (activeTab === "parameters") {
        endpoint = "/hr/setup/parameters";
        await api.post(endpoint, { parameters: form });
        toast.success("Parameters saved");
        loadData();
        return;
      } else {
        await api.post(endpoint, form);
      }

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
          {[
            "locations",
            "departments", 
            "positions", 
            "leave-types", 
            "payroll-periods", 
            "employment-types", 
            "employee-categories", 
            "allowance-types", 
            "parameters"
          ].map(tab => (
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
              <h3 className="font-medium mb-4">
                {activeTab === "parameters" ? "Update Settings" : (isEditing ? "Edit" : "Add New") + " " + activeTab.replace("-", " ")}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === "departments" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Code</label>
                      <input className="input" value={form.code || ""} onChange={e => setForm({...form, code: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Name</label>
                      <input className="input" value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} required />
                    </div>
                  </>
                )}
                {activeTab === "locations" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Location Name</label>
                      <input className="input" value={form.location_name || ""} onChange={e => setForm({...form, location_name: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Address</label>
                      <textarea className="input" value={form.address || ""} onChange={e => setForm({...form, address: e.target.value})} rows="2" />
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
                    <div>
                      <label className="block text-sm mb-1">Reports To (Position)</label>
                      <select className="input" value={form.reports_to_pos_id || ""} onChange={e => setForm({...form, reports_to_pos_id: e.target.value})}>
                        <option value="">-- None --</option>
                        {items.filter(p => !form.id || p.id !== form.id).map(p => (
                          <option key={p.id} value={p.id}>{p.pos_name}</option>
                        ))}
                      </select>
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
                {activeTab === "employment-types" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Type Name</label>
                      <input className="input" placeholder="e.g. Full-Time, Contract" value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} required />
                    </div>
                  </>
                )}
                {activeTab === "employee-categories" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Category Name</label>
                      <input className="input" placeholder="e.g. Management, Staff" value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} required />
                    </div>
                  </>
                )}
                {activeTab === "allowance-types" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Allowance Name</label>
                      <input className="input" placeholder="e.g. Transport, Housing" value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} required />
                    </div>
                  </>
                )}
                {activeTab === "parameters" && (
                  <>
                    <div>
                      <label className="block text-sm mb-1 font-semibold">Regular Working Hours (Daily)</label>
                      <input 
                        className="input" 
                        type="number" 
                        step="0.5" 
                        value={form.REGULAR_WORKING_HOURS || "8"} 
                        onChange={e => setForm({...form, REGULAR_WORKING_HOURS: e.target.value})} 
                        required 
                      />
                      <p className="text-xs text-slate-500 mt-1">Used for OT calculations in timesheets.</p>
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
            {activeTab !== "parameters" && (
              <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                    <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Details</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-2">
                          {activeTab === "locations" && (
                            <div>
                              <div className="font-medium">{item.location_name}</div>
                              <div className="text-xs text-slate-500">{item.address}</div>
                            </div>
                          )}
                          {activeTab === "departments" && (
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-slate-500">{item.code}</div>
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
                          {(activeTab === "employment-types" || activeTab === "employee-categories" || activeTab === "allowance-types") && (
                            <div>
                              <div className="font-medium">{item.name}</div>
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
            )}
            {activeTab === "parameters" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded border border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-300">
                <h4 className="font-semibold mb-2">About Parameters</h4>
                <p className="text-sm">These settings control module-wide calculations. For example, "Regular Working Hours" defines the threshold above which hours are considered Overtime (OT) in the Timesheet module.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Guard>
  );
}
