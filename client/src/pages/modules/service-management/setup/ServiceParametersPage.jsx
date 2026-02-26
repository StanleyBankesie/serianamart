import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client";

export default function ServiceParametersPage() {
  const [locations, setLocations] = useState([]);
  const [types, setTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newLoc, setNewLoc] = useState("");
  const [newType, setNewType] = useState("");
  const [newCat, setNewCat] = useState("");
  const [supervisors, setSupervisors] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        const [locResp, typeResp, catResp, supResp] = await Promise.all([
          api.get("/purchase/service-setup/work-locations"),
          api.get("/purchase/service-setup/service-types"),
          api.get("/purchase/service-setup/categories"),
          api.get("/purchase/service-setup/supervisors"),
        ]);
        if (mounted) {
          setLocations(
            Array.isArray(locResp.data?.items) ? locResp.data.items : [],
          );
          setTypes(
            Array.isArray(typeResp.data?.items) ? typeResp.data.items : [],
          );
          setCategories(
            Array.isArray(catResp.data?.items) ? catResp.data.items : [],
          );
          setSupervisors(
            Array.isArray(supResp.data?.items) ? supResp.data.items : [],
          );
        }
      } catch {
        if (mounted) {
          setLocations([]);
          setTypes([]);
          setCategories([]);
          setSupervisors([]);
        }
      }
    }
    fetchAll();
    return () => {
      mounted = false;
    };
  }, []);

  const addLocation = async (e) => {
    e.preventDefault();
    const v = String(newLoc || "").trim();
    if (!v) return;
    try {
      const resp = await api.post("/purchase/service-setup/work-locations", {
        name: v,
      });
      const added = resp?.data?.item;
      setLocations((prev) => (added ? [added, ...prev] : prev));
      setNewLoc("");
    } catch {
      // ignore
    }
  };

  const addType = async (e) => {
    e.preventDefault();
    const v = String(newType || "").trim();
    if (!v) return;
    try {
      const resp = await api.post("/purchase/service-setup/service-types", {
        name: v,
      });
      const added = resp?.data?.item;
      setTypes((prev) => (added ? [added, ...prev] : prev));
      setNewType("");
    } catch {
      // ignore
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    const v = String(newCat || "").trim();
    if (!v) return;
    try {
      const resp = await api.post("/purchase/service-setup/categories", {
        name: v,
      });
      const added = resp?.data?.item;
      setCategories((prev) => (added ? [added, ...prev] : prev));
      setNewCat("");
    } catch {
      // ignore
    }
  };

  const removeRow = async (kind, id) => {
    try {
      await api.delete(`/purchase/service-setup/${kind}/${id}`);
      if (kind === "work-locations") {
        setLocations((prev) => prev.filter((x) => Number(x.id) !== Number(id)));
      } else if (kind === "service-types") {
        setTypes((prev) => prev.filter((x) => Number(x.id) !== Number(id)));
      } else if (kind === "categories") {
        setCategories((prev) =>
          prev.filter((x) => Number(x.id) !== Number(id)),
        );
      } else if (kind === "supervisors") {
        setSupervisors((prev) =>
          prev.filter((x) => Number(x.id) !== Number(id)),
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadUsers() {
      try {
        const resp = await api.get("/purchase/service-setup/users");
        const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
        if (mounted) setAllUsers(items);
      } catch {
        if (mounted) setAllUsers([]);
      }
    }
    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const addSupervisor = async () => {
    try {
      const resp = await api.post("/purchase/service-setup/supervisors", {
        user_id: Number(selectedUserId || 0),
      });
      const added = resp?.data?.item;
      setSupervisors((prev) => (added ? [added, ...prev] : prev));
      setSelectedUserId("");
    } catch {}
  };

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Service Setup</div>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <div className="card-header">Work Locations</div>
              <div className="card-body space-y-3">
                <form onSubmit={addLocation} className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={newLoc}
                    onChange={(e) => setNewLoc(e.target.value)}
                    placeholder="e.g., HQ Facility"
                  />
                  <button className="btn-primary">Add</button>
                </form>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => removeRow("work-locations", r.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">Service Types</div>
              <div className="card-body space-y-3">
                <form onSubmit={addType} className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    placeholder="e.g., Installation"
                  />
                  <button className="btn-primary">Add</button>
                </form>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => removeRow("service-types", r.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">Service Categories</div>
              <div className="card-body space-y-3">
                <form onSubmit={addCategory} className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="e.g., Maintenance"
                  />
                  <button className="btn-primary">Add</button>
                </form>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => removeRow("categories", r.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">Supervisors</div>
              <div className="card-body space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addSupervisor();
                  }}
                  className="flex gap-2"
                >
                  <select
                    className="input flex-1"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">-- Select User --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                  <button disabled={!selectedUserId} className="btn-primary">
                    Add
                  </button>
                </form>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supervisors.map((r) => (
                        <tr key={r.id}>
                          <td>{r.username}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => removeRow("supervisors", r.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
