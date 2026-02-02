import React from 'react';
import { Link } from 'react-router-dom';

export default function AttendanceList() {
  const items = [
    { id: 1, emp: 'EMP-001', name: 'John Doe', date: '2025-01-02', status: 'PRESENT' },
    { id: 2, emp: 'EMP-002', name: 'Jane Smith', date: '2025-01-02', status: 'PRESENT' },
  ];

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Attendance System</h1>
            <p className="text-sm mt-1">Track employee attendance</p>
          </div>
          <div className="flex gap-2">
            <Link to="/human-resources" className="btn btn-secondary">Return to Menu</Link>
            <Link to="/human-resources/attendance/new" className="btn-success">+ New Entry</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Emp No</th>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.emp}</td>
                    <td>{r.name}</td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>{r.status}</td>
                    <td>
                      <Link to={`/human-resources/attendance/${r.id}?mode=view`} className="text-brand hover:text-brand-600 text-sm font-medium">View</Link>
                      <Link to={`/human-resources/attendance/${r.id}?mode=edit`} className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2">Edit</Link>
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







