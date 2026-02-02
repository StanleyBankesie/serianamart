import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";

export default function ItemGroupsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setCategoriesLoading(true);
    setCategoriesError("");

    api
      .get("/inventory/item-groups")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load item groups");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    api
      .get("/inventory/item-categories")
      .then((res) => {
        if (!mounted) return;
        setCategories(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setCategoriesError(
          e?.response?.data?.message || "Failed to load item categories"
        );
      })
      .finally(() => {
        if (!mounted) return;
        setCategoriesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items.filter((g) => {
      return (
        String(g.group_code || "")
          .toLowerCase()
          .includes(q) ||
        String(g.group_name || "")
          .toLowerCase()
          .includes(q) ||
        String(g.parent_group_name || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, searchTerm]);

  const filteredCategories = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return categories.filter((c) => {
      return (
        String(c.category_code || "")
          .toLowerCase()
          .includes(q) ||
        String(c.category_name || "")
          .toLowerCase()
          .includes(q) ||
        String(c.parent_category_name || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [categories, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white"><div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Item Groups &amp; Sub Groups
              </h1>
              <p className="text-sm mt-1">
                Organize items by categories
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/item-groups/new" className="btn-success">
                + New Group
              </Link>
            </div>
          </div>
        </div>

        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by code, name, or parent..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Parent</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No item groups found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {g.group_code}
                    </td>
                    <td>{g.group_name}</td>
                    <td>{g.parent_group_name || "-"}</td>
                    <td>{g.is_active ? "Yes" : "No"}</td>
                    <td>
                      <Link
                        to={`/inventory/item-groups/${g.id}?mode=view`}
                        className="text-brand hover:text-brand-700 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        to={`/inventory/item-groups/${g.id}?mode=edit`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h2 className="text-xl font-bold dark:text-brand-300">
                Item Categories
              </h2>
              <p className="text-sm mt-1">Organize items by category</p>
            </div>
          </div>
        </div>

        <div className="card-body">
          {categoriesError ? (
            <div className="text-sm text-red-600 mb-4">{categoriesError}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Parent</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {categoriesLoading ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!categoriesLoading && !filteredCategories.length ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No item categories found
                    </td>
                  </tr>
                ) : null}

                {filteredCategories.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {c.category_code}
                    </td>
                    <td>{c.category_name}</td>
                    <td>{c.parent_category_name || "-"}</td>
                    <td>{c.is_active ? "Yes" : "No"}</td>
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







