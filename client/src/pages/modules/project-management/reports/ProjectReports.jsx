import React from "react";
import { 
  BarChart3, 
  PieChart, 
  FileText, 
  TrendingUp, 
  ArrowLeft,
  ChevronRight,
  Activity,
  DollarSign,
  Briefcase,
  Users,
  Target,
  Zap,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";

const ReportCard = ({ title, description, icon, path, color }) => (
  <Link 
    to={path}
    className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-300 flex items-start gap-4"
  >
    <div className={`p-3 rounded-xl ${color} shadow-sm group-hover:scale-105 transition-transform`}>
      {icon}
    </div>
    <div className="flex-1 space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors text-sm">{title}</h3>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  </Link>
);

export default function ProjectReports() {
  const reports = [
    {
      title: "Portfolio Status Report",
      description: "Overview of all projects across Planning, In-Progress, and Completion stages.",
      icon: <Briefcase size={20} className="text-indigo-600" />,
      path: "/project-management/reports/portfolio",
      color: "bg-indigo-50 dark:bg-indigo-900/30"
    },
    {
      title: "Budget Utilization Analysis",
      description: "Comparative study of project budgets versus actual recorded expenses and labor costs.",
      icon: <DollarSign size={20} className="text-emerald-600" />,
      path: "/project-management/reports/budget",
      color: "bg-emerald-50 dark:bg-emerald-900/30"
    },
    {
      title: "Resource Allocation Matrix",
      description: "Analyze team member workload, logged hours, and task distribution across projects.",
      icon: <Users size={20} className="text-blue-600" />,
      path: "/project-management/reports/resources",
      color: "bg-blue-50 dark:bg-blue-900/30"
    },
    {
      title: "Project Risk & Overdue Tasks",
      description: "Identify projects at risk due to missed milestones or overdue high-priority tasks.",
      icon: <Zap size={20} className="text-rose-600" />,
      path: "/project-management/reports/risks",
      color: "bg-rose-50 dark:bg-rose-900/30"
    }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Project Intelligence</h1>
            <p className="text-slate-500 text-sm">Strategic metrics for portfolio optimization</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-900/30 rounded-xl border border-brand-100 dark:border-brand-900/50">
           <Activity size={18} className="text-brand-600" />
           <span className="text-[10px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-widest">Health Index: 92%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report, idx) => (
          <ReportCard key={idx} {...report} />
        ))}
      </div>

      <div className="bg-slate-900 dark:bg-slate-800/50 rounded-2xl p-8 text-white shadow-sm border border-slate-800 dark:border-slate-700 relative overflow-hidden group">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl w-fit">
            <Target size={24} className="text-indigo-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Portfolio Performance Engine</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Identify potential delivery bottlenecks before they impact your timeline. 
              Our engine analyzes historical velocity to provide accurate completion forecasts.
            </p>
          </div>
          <div className="flex gap-4">
             <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Avg. Velocity</p>
                <p className="text-lg font-bold">1.2d / task</p>
             </div>
             <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Budget Adherence</p>
                <p className="text-lg font-bold">94.8%</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
