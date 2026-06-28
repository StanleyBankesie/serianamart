/**
 * @fileoverview ProductionSetup component.
 * Provides functionality for ProductionSetup.
 */

import React from "react";
import { 
  Settings2, 
  Cpu, 
  Clock, 
  FileText, 
  ArrowRight,
  ArrowLeft,
  Factory,
  ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProductionSetup() {
  const settings = [
    {
      title: "Manufacturing Processes",
      desc: "Define operations like Cutting, Assembly, Testing",
      icon: <Settings2 size={24} />,
      link: "/production/setup/processes"
    },
    {
      title: "Machines & Equipment",
      desc: "Register factory assets and maintenance status",
      icon: <Cpu size={24} />,
      link: "/production/setup/machines"
    },
    {
      title: "Shift Management",
      desc: "Configure work timings and breaks",
      icon: <Clock size={24} />,
      link: "/production/setup/shifts"
    },
    {
      title: "Routing Templates",
      desc: "Standardize process sequences for items",
      icon: <FileText size={24} />,
      link: "/production/routings"
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link to="/production" className="btn btn-secondary p-2">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Manufacturing Setup</h1>
          <p className="text-slate-500 text-sm">Configure your industrial environment and masters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settings.map((item, idx) => (
          <Link 
            key={idx}
            to={item.link}
            className="card p-6 group flex items-start gap-5 hover:border-brand-500 transition-all shadow-sm"
          >
            <div className="p-3 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              {item.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-brand-900 dark:text-brand-300 group-hover:text-brand-600 transition-colors">{item.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{item.desc}</p>
            </div>
            <ArrowRight size={20} className="text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all mt-1" />
          </Link>
        ))}
      </div>

      <div className="bg-brand-900 dark:bg-brand-950 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl shadow-brand-200 dark:shadow-none">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 text-center md:text-left">
          <div className="p-5 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10">
            <Factory size={56} className="text-brand-300" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">Industrial Control Center</h2>
            <p className="text-brand-200 text-sm max-w-xl leading-relaxed">
              Set up your production floor parameters here. These configurations drive the scheduling and execution modules. 
              Ensure accuracy to maintain high operational efficiency.
            </p>
          </div>
          <div className="flex-1 flex justify-end w-full">
            <button className="flex items-center gap-2 px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-brand-900/50">
              <ShieldCheck size={20} />
              Verify Environment
            </button>
          </div>
        </div>
        
        {/* Subtle decorative elements */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-brand-400/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
