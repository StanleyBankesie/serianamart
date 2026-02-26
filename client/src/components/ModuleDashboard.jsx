import React from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../auth/PermissionContext.jsx";

const ModuleDashboard = ({
  title,
  description,
  stats = [],
  quickActions = [],
  sections = [],
  features = [],
}) => {
  const navigate = useNavigate();
  const { canAccessPath, canAccessFeatureKey } = usePermission();

  const handleNavigate = (path, e) => {
    if (e) e.stopPropagation();
    if (path) navigate(path);
  };

  const statGradients = [
    "from-green-500 to-green-600",
    "from-blue-500 to-blue-600",
    "from-purple-500 to-purple-600",
    "from-orange-500 to-orange-600",
    "from-pink-500 to-pink-600",
    "from-teal-500 to-teal-600",
    "from-red-500 to-red-600",
    "from-amber-500 to-amber-600",
  ];

  const randomStatGradients = React.useMemo(() => {
    const shuffled = [...statGradients];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selections = [];
    for (let i = 0; i < stats.length; i++) {
      selections.push(shuffled[i % shuffled.length]);
    }
    return selections;
  }, [stats.length]);

  function isFeatureEnabled(path) {
    return canAccessPath(path);
  }

  const canShowItem = (item) => {
    if (!item) return false;
    if (item.hidden) return false;
    const path = String(item.path || "");
    if (!path) return false;

    const parts = path.split("/").filter(Boolean);
    const mk = String(item.module_key || parts[0] || "");
    const fk = String(item.feature_key || parts[1] || "");

    if (mk && fk) {
      if (canAccessFeatureKey(mk, fk)) return true;
      if (!item.feature_key && parts.length > 2) {
        const fk2 = String(parts[2] || "");
        if (fk2 && canAccessFeatureKey(mk, fk2)) return true;
      }
      return canAccessPath(path);
    }
    return canAccessPath(path);
  };

  const allSections = React.useMemo(() => {
    const base = Array.isArray(sections) ? sections : [];
    const feats = Array.isArray(features) ? features : [];
    if (!feats.length) return base;
    const existing = new Set();
    for (const section of base) {
      const sectionItems =
        (section && (section.items || section.features)) || [];
      for (const item of sectionItems) {
        if (item && item.path) existing.add(String(item.path));
      }
    }
    const extras = [];
    for (const f of feats) {
      const path = String(f.path || "");
      if (!path || existing.has(path)) continue;
      extras.push({
        title: f.label || f.name || "Page",
        name: f.label || f.name,
        path,
        icon: f.icon || "📄",
      });
    }
    if (!extras.length) return base;
    return [
      ...base,
      {
        title: "Other Pages",
        items: extras,
      },
    ];
  }, [sections, features]);

  return (
    <div className="p-6 space-y-8 animate-fade-in fullbleed-sm">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-900 dark:text-white tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg max-w-3xl">
          {description}
        </p>
      </div>

      {/* Key Statistics */}
      {stats.filter((s) => canShowItem(s)).length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-brand-800 dark:text-brand-200 mb-4 flex items-center gap-2">
            <span>📈</span> Business Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats
              .filter((stat) => canShowItem(stat))
              .map((stat, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-xl shadow-erp-sm hover:shadow-erp-md transition-all duration-200 cursor-pointer group bg-gradient-to-r ${stat.color || randomStatGradients[index]} text-white`}
                  onClick={() => handleNavigate(stat.path)}
                >
                  <div className="flex justify-end mb-2">
                    {stat.change && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/20 text-white">
                        {stat.change}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-white/80 font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {quickActions.filter((a) => !a?.path || canShowItem(a)).length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-brand-800 dark:text-brand-200 mb-4 flex items-center gap-2">
            <span>⚡</span> Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {quickActions
              .filter((action) => !action?.path || canShowItem(action))
              .map((action, index) => (
                <button
                  key={index}
                  className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md hover:bg-brand-50 dark:hover:bg-slate-700 transition-all duration-200 group text-center h-full border border-slate-100 dark:border-slate-700"
                  onClick={() => handleNavigate(action.path)}
                >
                  <span className="text-2xl mb-2 group-hover:-translate-y-1 transition-transform duration-200 block">
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                    {action.label}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-10">
        {allSections.map((section, sectionIndex) => {
          const sectionTitle = section.title || section.category;
          const sectionItems = section.items || section.features || [];

          return (
            <div key={sectionIndex}>
              <div className="flex items-center gap-3 mb-5 border-b border-slate-200 dark:border-slate-700 pb-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                  {sectionTitle}
                </h2>
                {section.badge && (
                  <span className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {section.badge}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {sectionItems
                  .filter((item) => canShowItem(item))
                  .map((item, itemIndex) => {
                    const itemTitle = item.title || item.name;

                    return (
                      <div
                        key={itemIndex}
                        className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 border border-transparent transition-all duration-200 cursor-pointer group relative overflow-hidden"
                        onClick={() => handleNavigate(item.path)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-slate-700 flex items-center justify-center text-xl group-hover:bg-brand-100 dark:group-hover:bg-slate-600 transition-colors">
                            {item.icon || "📄"}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors mb-1">
                              {itemTitle}
                            </h3>
                            {item.description && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModuleDashboard;
