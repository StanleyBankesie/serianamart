import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePermission } from "../auth/PermissionContext.jsx";

const ModuleDashboard = ({
  title,
  description,
  stats = [],
  quickActions = [],
  sections = [],
  features = [],
  headerActions = [],
  showAll = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessPath, canAccessFeatureKey, canViewDashboardElement } =
    usePermission();

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
    if (showAll) return true;
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

    if (showAll) return true;
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

  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");

  React.useEffect(() => {
    const search = new URLSearchParams(location.search || "");
    const hash = String(location.hash || "").replace(/^#/, "");
    const focus = search.get("focus") || hash;
    if (!focus) return;
    const tryScroll = (el) => {
      if (!el || typeof el.scrollIntoView !== "function") return false;
      setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {}
      }, 50);
      return true;
    };
    if (focus.toLowerCase() === "reports") {
      const all = Array.from(document.querySelectorAll("[data-section-title]"));
      const target =
        all.find((e) =>
          String(e.getAttribute("data-section-title") || "")
            .toLowerCase()
            .includes("report"),
        ) || null;
      if (tryScroll(target)) return;
    }
    const id = `section-${slug(focus)}`;
    const el = document.getElementById(id);
    tryScroll(el);
  }, [location.hash, location.search]);

  const overlayType = React.useMemo(() => {
    const search = new URLSearchParams(location.search || "");
    return String(search.get("overlay") || "").toLowerCase() || null;
  }, [location.search]);

  const overlayItems = React.useMemo(() => {
    if (overlayType !== "reports") return [];
    const items = [];
    const addItem = (it) => {
      if (!it || !canShowItem(it)) return;
      items.push({
        title: it.title || it.name || it.label,
        path: it.path,
        icon: it.icon || "📄",
      });
    };
    for (const s of allSections) {
      const title = String(s.title || s.category || "").toLowerCase();
      if (title.includes("report")) {
        const sItems = s.items || s.features || [];
        sItems.forEach((it) => addItem(it));
      }
      if (title.includes("dashboard")) {
        const sItems = s.items || s.features || [];
        sItems.forEach((it) => addItem(it));
      }
    }
    if (Array.isArray(headerActions)) {
      headerActions.forEach((a) =>
        addItem({
          title: a.label || "Dashboard",
          path: a.path,
          icon: a.icon || "📊",
        }),
      );
    }
    const seen = new Set();
    return items.filter((it) => {
      const k = `${it.title}|${it.path}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [overlayType, allSections, headerActions]);

  const closeOverlay = React.useCallback(() => {
    const search = new URLSearchParams(location.search || "");
    search.delete("overlay");
    navigate(
      {
        pathname: location.pathname,
        search: search.toString(),
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.pathname, location.search, location.hash, navigate]);

  return (
    <div className="p-6 space-y-8 animate-fade-in fullbleed-sm">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-900 dark:text-white tracking-tight mb-2">
            {title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-3xl">
            {description}
          </p>
        </div>
        {Array.isArray(headerActions) && headerActions.length > 0 && (
          <div className="flex items-center gap-2">
            {headerActions.map((a, i) => (
              <button
                key={i}
                onClick={(e) => handleNavigate(a.path, e)}
                className="btn btn-primary"
                title={a.title || a.label}
              >
                {a.icon ? <span className="mr-2">{a.icon}</span> : null}
                {a.label || "Open"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Key Statistics */}
      {stats.filter((s) => {
        if (!canShowItem(s)) return false;
        const path = String(s.path || "");
        const parts = path.split("/").filter(Boolean);
        const mk = String(s.module_key || parts[0] || "");
        const key =
          String(s.rbac_key || "")
            .toLowerCase()
            .trim() ||
          String(s.label || s.name || s.title || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
        if (!mk || !key) return true;
        return canViewDashboardElement(mk, "card", key);
      }).length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-brand-800 dark:text-brand-200 mb-4 flex items-center gap-2">
            <span>📈</span> Business Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats
              .filter((stat) => {
                if (!canShowItem(stat)) return false;
                const path = String(stat.path || "");
                const parts = path.split("/").filter(Boolean);
                const mk = String(stat.module_key || parts[0] || "");
                const key =
                  String(stat.rbac_key || "")
                    .toLowerCase()
                    .trim() ||
                  String(stat.label || stat.name || stat.title || "")
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
                if (!mk || !key) return true;
                return canViewDashboardElement(mk, "card", key);
              })
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
            <div
              key={sectionIndex}
              id={`section-${slug(sectionTitle)}`}
              data-section-title={String(sectionTitle || "")}
            >
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
                    const itemActions = Array.isArray(item.actions)
                      ? item.actions.filter((action) => canShowItem(action))
                      : [];

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
                            {itemActions.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {itemActions.map((action, actionIndex) => {
                                  const actionType = String(
                                    action.type || "outline",
                                  ).toLowerCase();
                                  const actionClass =
                                    actionType === "primary"
                                      ? "bg-brand-600 text-white hover:bg-brand-700 border-brand-600"
                                      : "bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-slate-700 border-brand-200 dark:border-slate-600";

                                  return (
                                    <button
                                      key={`${action.path || action.label}-${actionIndex}`}
                                      type="button"
                                      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${actionClass}`}
                                      onClick={(e) =>
                                        handleNavigate(action.path, e)
                                      }
                                      title={action.title || action.label}
                                    >
                                      {action.label || "Open"}
                                    </button>
                                  );
                                })}
                              </div>
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
      {overlayType === "reports" && overlayItems.length > 0 ? (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute right-4 top-24 w-[min(260px,92vw)] max-h-[70vh] overflow-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl shadow-erp-xl border border-slate-200 dark:border-slate-700 pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Reports & Dashboards
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={closeOverlay}
              >
                Close
              </button>
            </div>
            <div className="p-2 divide-y divide-slate-200 dark:divide-slate-700">
              {overlayItems.map((it, i) => (
                <button
                  key={`${it.path}-${i}`}
                  onClick={() => handleNavigate(it.path)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-brand-50 dark:bg-slate-700 flex items-center justify-center text-lg">
                      {it.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {it.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {it.path}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-400">→</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
export default ModuleDashboard;
