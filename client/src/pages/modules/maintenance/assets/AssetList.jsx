import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api } from '../../../../api/client.js';
import { usePermission } from '../../../../auth/PermissionContext.jsx';

export default function AssetList() {
  const { canPerformAction } = usePermission();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.get('/maintenance/assets');
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to load assets');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Assets</h1>
          <p className="text-sm mt-1">Register and manage maintainable assets</p>
        </div>
        <div className="flex gap-2">
          <Link to="/maintenance" className="btn btn-secondary">Return to Menu</Link>
          <Link to="/maintenance/assets/new" className="btn-success">+ New Asset</Link>
        </div>
      </div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className="table">
          <thead><tr><th>Asset No</th><th>Name</th><th>Location</th><th>Status</th><th /></tr></thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5" className="text-center py-8 text-slate-500">Loading...</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-8 text-slate-500">No assets found</td>
              </tr>
            )}
            {!loading && items.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.asset_no}</td>
                <td>{a.asset_name}</td>
                <td>{a.location}</td>
                <td>{a.status}</td>
                <td>
                  {canPerformAction('maintenance:assets','view') && (
                    <Link
                      to={`/maintenance/assets/${a.id}?mode=view`}
                      className="text-brand hover:text-brand-600 text-sm font-medium"
                    >
                      View
                    </Link>
                  )}
                  {canPerformAction('maintenance:assets','edit') && (
                    <Link
                      to={`/maintenance/assets/${a.id}?mode=edit`}
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
      </div></div>
    </div>
  );
}







