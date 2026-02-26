import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

export default function EmployeeList() {
  const navigate = useNavigate();
  const { canPerformAction } = usePermission();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/hr/employees");
      setEmployees(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching employees");
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (isActive) => {
    return isActive ? (
      <span className="badge badge-success">ACTIVE</span>
    ) : (
      <span className="badge badge-error">INACTIVE</span>
    );
  };

  const getEmploymentTypeBadge = (type) => {
    const typeClasses = {
      PERMANENT: "badge badge-success",
      CONTRACT: "badge badge-info",
      TEMPORARY: "badge badge-warning",
      INTERN:
        "badge bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    };
    return <span className={typeClasses[type] || "badge"}>{type}</span>;
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      String(emp.emp_no || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(emp.full_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      String(emp.email || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" ? emp.is_active : !emp.is_active);
    const matchesDepartment =
      departmentFilter === "ALL" || emp.department === departmentFilter;
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const departments = [
    "ALL",
    ...new Set(employees.map((emp) => emp.department).filter(Boolean)),
  ];

  if (loading) {
    return <div className="text-center py-8">Loading employees...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Employee Setup
              </h1>
              <p className="text-sm mt-1">
                Manage employee records and information
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/human-resources" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/human-resources/employees/new" className="btn-success">
                + New Employee
              </Link>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by employee number, name, or email..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "ALL" ? "All Departments" : dept}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading employees...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No employees found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Emp No</th>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Department</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="font-medium">{emp.emp_no}</td>
                      <td>{emp.full_name}</td>
                      <td>{emp.designation}</td>
                      <td>{emp.department}</td>
                      <td>
                        <div className="text-sm">
                          <div>{emp.email}</div>
                          <div className="text-slate-500">{emp.contact_no}</div>
                        </div>
                      </td>
                      <td>{getEmploymentTypeBadge(emp.employment_type)}</td>
                      <td>{getStatusBadge(emp.is_active)}</td>
                      <td>
                        <div className="flex gap-2">
                          {canPerformAction(
                            "human-resources:employees",
                            "view",
                          ) && (
                            <button
                              onClick={() =>
                                navigate(`/human-resources/employees/${emp.id}`)
                              }
                              className="text-brand hover:text-brand-600 font-medium text-sm"
                            >
                              View
                            </button>
                          )}
                          {canPerformAction(
                            "human-resources:employees",
                            "edit",
                          ) && (
                            <button
                              onClick={() =>
                                navigate(`/human-resources/employees/${emp.id}`)
                              }
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
