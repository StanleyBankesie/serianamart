import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "../../../auth/PermissionContext.jsx";

export default function IssueToRequirementList() {
  const { canPerformAction } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/issue-to-requirement")
      .then((res) => {
        if (!mounted) return;
        setDocs(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load issues");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      ISSUED: "badge-warning",
      POSTED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return docs.filter((d) => {
      const no = String(d.issue_no || "").toLowerCase();
      const dept = String(d.department_name || "").toLowerCase();
      return no.includes(q) || dept.includes(q);
    });
  }, [docs, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Issue to Requirement Area
              </h1>
              <p className="text-sm mt-1">
                Issue materials to departments / requirement areas
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/inventory/issue-to-requirement/new"
                className="btn-success"
              >
                + New Issue
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {loading ? <div className="text-sm mb-4">Loading...</div> : null}
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by issue number or department..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Issue No</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Warehouse</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {d.issue_no}
                    </td>
                    <td>{d.issue_date}</td>
                    <td>{d.issue_type || "-"}</td>
                    <td>{d.warehouse_name || "-"}</td>
                    <td>{d.department_name || "-"}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      {canPerformAction("inventory:issue-to-requirement", "view") && (
                        <Link
                          to={`/inventory/issue-to-requirement/${d.id}?mode=view`}
                          className="text-brand hover:text-brand-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                      {canPerformAction("inventory:issue-to-requirement", "edit") && (
                        <Link
                          to={`/inventory/issue-to-requirement/${d.id}?mode=edit`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
