/**
 * @fileoverview ServiceParametersPage component.
 * Provides functionality for ServiceParametersPage.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";

const TABS = [
  { key: "work-locations", label: "Work Locations", endpoint: "/purchase/service-setup/work-locations", fieldLabel: "Location Name", placeholder: "e.g., HQ Facility" },
  { key: "service-types", label: "Service Types", endpoint: "/purchase/service-setup/service-types", fieldLabel: "Type Name", placeholder: "e.g., Installation" },
  { key: "categories", label: "Service Categories", endpoint: "/purchase/service-setup/categories", fieldLabel: "Category Name", placeholder: "e.g., Maintenance" },
  { key: "time-slots", label: "Time Slots", endpoint: "/purchase/service-setup/time-slots", fieldLabel: "Time Range", placeholder: "e.g., 12:00pm - 2:00pm" },
  { key: "timelines", label: "Timelines", endpoint: "/purchase/service-setup/timelines", fieldLabel: "Timeline", placeholder: "e.g., 1 - 7 Days" },
  { key: "supervisors", label: "Supervisors", endpoint: "/purchase/service-setup/supervisors", fieldLabel: "Supervisor", placeholder: null },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceParametersPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get("tab") || "work-locations";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [allUsers, setAllUsers] = useState([]);

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];
  const isSupervisorTab = activeTab === "supervisors";

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(currentTab.endpoint);
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setInputValue("");
  }, [activeTab]);

  useEffect(() => {
    if (!isSupervisorTab) return;
    let mounted = true;
    async function loadUsers() {
      try {
        const resp = await api.get("/purchase/service-setup/users");
        if (mounted) setAllUsers(Array.isArray(resp?.data?.items) ? resp.data.items : []);
      } catch {
        if (mounted) setAllUsers([]);
      }
    }
    loadUsers();
    return () => { mounted = false; };
  }, [isSupervisorTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isSupervisorTab) {
        if (!inputValue) return;
        await api.post(currentTab.endpoint, { user_id: Number(inputValue) });
        setInputValue("");
      } else {
        const v = String(inputValue || "").trim();
        if (!v) return;
        await api.post(currentTab.endpoint, { name: v });
        setInputValue("");
      }
      toast.success("Saved successfully");
      loadData();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleRemove = async (id) => {
    try {
      await api.delete(`${currentTab.endpoint}/${id}`);
      setItems((prev) => prev.filter((x) => Number(x.id) !== Number(id)));
      toast.success("Removed");
    } catch {
      toast.error("Failed to remove");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/service-management" className="btn-secondary text-sm">
          Back to Menu
        </Link>
        <h2 className="text-lg font-semibold">Service Setup & Parameters</h2>
      </div>

      <div className="flex border-b mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap ${
              activeTab === tab.key
                ? "border-b-2 border-brand text-brand"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
            <h3 className="font-medium mb-4">
              {"Add New " + currentTab.label.replace(/-/g, " ")}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isSupervisorTab ? (
                <div>
                  <label className="block text-sm mb-1">{currentTab.fieldLabel}</label>
                  <input
                    className="input"
                    type={currentTab.inputType || "text"}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={currentTab.placeholder}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-1">User</label>
                  <select
                    className="input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    required
                  >
                    <option value="">-- Select User --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Details
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {item.name || item.username || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
