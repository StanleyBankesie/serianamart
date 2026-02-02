import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  Eye,
  Edit,
  Check,
  FileText,
  Package,
  AlertCircle,
} from "lucide-react";
import { api } from "api/client";

export default function StockVerificationList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [verifications, setVerifications] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      api.get("/inventory/stock-adjustments"),
      api.get("/inventory/warehouses"),
    ])
      .then(([adjRes, whRes]) => {
        if (!mounted) return;
        // Filter for verification-related types if possible, or just show all adjustments
        // Assuming Stock Verification maps to Stock Adjustments for now
        setVerifications(
          Array.isArray(adjRes.data?.items) ? adjRes.data.items : []
        );
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load stock verifications"
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getWarehouseName = (id) => {
    const wh = warehouses.find((w) => w.id === id);
    return wh ? wh.name : "Unknown Warehouse"; // Adjust based on warehouse object structure
  };

  const statusOptions = [
    { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
    {
      value: "IN_PROGRESS",
      label: "In Progress",
      color: "bg-blue-100 text-blue-800",
    },
    {
      value: "COMPLETED",
      label: "Completed",
      color: "bg-green-100 text-green-800",
    },
    {
      value: "ADJUSTED",
      label: "Adjusted",
      color: "bg-purple-100 text-purple-800",
    },
  ];

  const getStatusBadge = (status) => {
    const statusConfig = statusOptions.find((s) => s.value === status);
    // Fallback for existing statuses
    if (!statusConfig) {
      if (status === "POSTED")
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Posted
          </span>
        );
      if (status === "CANCELLED")
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Cancelled
          </span>
        );
    }
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          statusConfig?.color || "bg-gray-100 text-gray-800"
        }`}
      >
        {statusConfig?.label || status}
      </span>
    );
  };

  const verificationTypes = [
    { value: "PHYSICAL_COUNT", label: "Physical Count" },
    { value: "CYCLE_COUNT", label: "Cycle Count" },
    { value: "SPOT_CHECK", label: "Spot Check" },
  ];

  const getTypeLabel = (type) => {
    return verificationTypes.find((t) => t.value === type)?.label || type;
  };

  const filteredVerifications = useMemo(() => {
    return verifications.filter((v) => {
      const matchesSearch =
        String(v.adjustment_no || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        // Assuming v.warehouse_id is available in adjustment list, if not this might fail
        // We'll skip warehouse search if data not present
        false;

      const matchesStatus =
        filterStatus === "ALL" || v.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [verifications, searchTerm, filterStatus]);

  // Calculate stats based on verifications
  const stats = {
    total: verifications.length,
    inProgress: verifications.filter(
      (v) => v.status === "IN_PROGRESS" || v.status === "DRAFT"
    ).length,
    completed: verifications.filter(
      (v) => v.status === "COMPLETED" || v.status === "POSTED"
    ).length,
    variance: 0, // Not available in current API
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Stock Verification
            </h1>
            <p className="text-gray-600">
              Manage and track warehouse stock verification activities
            </p>
          </div>
          <Link to="/inventory" className="btn btn-secondary">
            Return to Menu
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Verifications</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total}
                </p>
              </div>
              <FileText className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.inProgress}
                </p>
              </div>
              <Package className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.completed}
                </p>
              </div>
              <Check className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Variance</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${stats.variance.toFixed(2)}
                </p>
              </div>
              <AlertCircle className="w-10 h-10 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by verification number..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              <Link
                to="/inventory/stock-verification/new"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#0E3646" }}
              >
                <Plus className="w-5 h-5" />
                New Verification
              </Link>
            </div>
          </div>
        </div>

        {/* Verifications Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: "#0E3646" }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Verification #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Warehouse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : filteredVerifications.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No verifications found
                    </td>
                  </tr>
                ) : (
                  filteredVerifications.map((verification) => (
                    <tr key={verification.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {verification.adjustment_no}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {verification.adjustment_date}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getWarehouseName(verification.warehouse_id)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getTypeLabel(verification.adjustment_type)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(verification.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-600">
                          N/A
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link
                            to={`/inventory/stock-verification/${verification.id}?mode=view`}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                          <Link
                            to={`/inventory/stock-verification/${verification.id}?mode=edit`}
                            className="text-green-600 hover:text-green-900"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
