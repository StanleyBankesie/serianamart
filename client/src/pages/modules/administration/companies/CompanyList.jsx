import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

export default function CompanyList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/companies");
      setItems(res.data.items || []);
    } catch (err) {
      setError(err.message || "Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Company Setup
          </h1>
          <p className="text-sm mt-1">Manage companies</p>
        </div>
        <div className="flex gap-2">
          <Link to="/administration" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/administration/companies/new" className="btn-success">
            + New Company
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : error ? (
            <div className="text-red-500 py-4">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colspan="4"
                        className="text-center py-4 text-gray-500"
                      >
                        No companies found
                      </td>
                    </tr>
                  ) : (
                    items.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.code}</td>
                        <td>{c.name}</td>
                        <td>
                          {c.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-error">Inactive</span>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/administration/companies/${c.id}`}
                            className="text-brand hover:text-brand-600 text-sm font-medium"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
