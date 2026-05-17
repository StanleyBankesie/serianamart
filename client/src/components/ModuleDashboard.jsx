import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePermission } from "../auth/PermissionContext.jsx";
import { MODULES_REGISTRY } from "../data/modulesRegistry.js";

const ModuleDashboard = ({
  title,
  description,
  stats = [],
  quickActions = [],
  sections = [],
  features = [],
  headerActions = [],
  showAll = false,
  moduleKey,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessPath, canAccessFeatureKey, canViewDashboardElement } =
    usePermission();

  // Auto-inject a Dashboard button if the module has registered dashboards
  const resolvedHeaderActions = useMemo(() => {
    const actions = Array.isArray(headerActions) ? [...headerActions] : [];
    const mk = moduleKey || (location.pathname.split("/").filter(Boolean)[0] || "");
    const moduleInfo = MODULES_REGISTRY[mk];
    const hasDashboards = moduleInfo && moduleInfo.dashboards && moduleInfo.dashboards.length > 0;
    if (mk && hasDashboards && !actions.some((a) => String(a.path || "") === `/${mk}/dashboard`)) {
      actions.push({ label: "Dashboard", path: `/${mk}/dashboard`, icon: "📊" });
    }
    return actions;
  }, [headerActions, moduleKey, location.pathname]);
  const [searchTerm, setSearchTerm] = useState("");

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

  // Filter sections based on search term
  const normalizeForSearch = React.useCallback(
    (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
    [],
  );

  const filteredSections = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return allSections;

    const term = normalizeForSearch(searchTerm);
    const queryParts = term.split(/\s+/).filter(Boolean);

    const scoreItem = (item, sectionTitle = "") => {
      const rawTitle = String(item.title || item.name || item.label || "");
      const rawDescription = String(item.description || "");
      const rawPath = String(item.path || "");
      const pathWords = rawPath.replace(/[\/_-]+/g, " ");
      const titleInitials = rawTitle
        .split(/\s+/)
        .map((w) => w[0] || "")
        .join("")
        .toLowerCase();
      const searchable = normalizeForSearch(
        `${rawTitle} ${rawDescription} ${rawPath} ${pathWords} ${sectionTitle}`,
      );

      if (!queryParts.length) return 1;
      if (searchable.includes(term)) return 100;

      let score = 0;
      for (const part of queryParts) {
        if (searchable.includes(part)) {
          score += 10;
          continue;
        }
        if (titleInitials && titleInitials.includes(part)) {
          score += 6;
          continue;
        }
        return 0;
      }

      if (normalizeForSearch(rawTitle).startsWith(queryParts[0] || "")) score += 8;
      if (normalizeForSearch(rawPath).includes(queryParts[0] || "")) score += 4;
      return score;
    };

    return allSections.map((section) => {
      const sectionTitle = section.title || section.category || "";
      const sectionItems = section.items || section.features || [];

      const scoredItems = sectionItems
        .map((item) => ({ item, score: scoreItem(item, sectionTitle) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);

      return {
        ...section,
        items: scoredItems,
      };
    }).filter((section) => {
      const sectionTitle = section.title || section.category || "";
      return (
        section.items.length > 0 ||
        normalizeForSearch(sectionTitle).includes(term)
      );
    });
  }, [allSections, searchTerm, normalizeForSearch]);

  const isSearching = Boolean(String(searchTerm || "").trim());

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
    resolvedHeaderActions.forEach((a) =>
      addItem({
        title: a.label || "Dashboard",
        path: a.path,
        icon: a.icon || "📊",
      }),
    );
    const seen = new Set();
    return items.filter((it) => {
      const k = `${it.title}|${it.path}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [overlayType, allSections, resolvedHeaderActions]);

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
        {resolvedHeaderActions.length > 0 && (
          <div className="flex items-center gap-2">
            {resolvedHeaderActions.map((a, i) => (
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

      {/* Search Field */}
      <div className="mb-6">
        <div className="max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search feature name, code, or path..."
              className="input w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Key Statistics */}
      {!isSearching && stats.filter((s) => {
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
              .map((stat, index) => {
                const cardType = index % 4;
                if (cardType === 0) {
                  // Card 1: Amber Gold
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(178,110,23,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(178,110,23,0.5)] active:scale-[0.98] transition-all duration-300 ease-out cursor-pointer group bg-[#b26e17] text-white"
                      onClick={() => handleNavigate(stat.path)}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div 
                            className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]"
                            style={{ textShadow: "0 0 12px rgba(255, 255, 255, 0.45)" }}
                          >
                            {stat.value}
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                } else if (cardType === 1) {
                  // Card 2: Steel Blue
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(36,82,109,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(36,82,109,0.5)] active:scale-[0.98] transition-all duration-300 ease-out cursor-pointer group bg-[#24526d] text-white"
                      onClick={() => handleNavigate(stat.path)}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-md text-amber-200 border border-amber-400/20 shadow-sm leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div className="text-3xl font-extrabold text-white tracking-tight">
                            {stat.value}
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none flex items-center">
                            <span>{stat.label}</span>
                            <svg className="w-8 h-4 text-white/20 ml-2 group-hover:text-white/40 transition-colors" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M0 15 L10 12 L20 18 L30 8 L40 10 L50 2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                } else if (cardType === 2) {
                  // Card 3: Teal Green
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(24,117,92,0.3)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.4)] border border-white/10 hover:border-white/20 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(24,117,92,0.5)] active:scale-[0.98] transition-all duration-300 ease-out cursor-pointer group bg-[#18755c] text-white"
                      onClick={() => handleNavigate(stat.path)}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 border border-white/15 shadow-sm leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                            <span>{stat.value}</span>
                            <svg className="w-5 h-5 text-white/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                            </svg>
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                } else {
                  // Card 4: Carbon Dark Gray
                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-[24px] p-6 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.2)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)] border border-white/5 hover:border-white/15 hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all duration-300 ease-out cursor-pointer group bg-[#1d1f22] bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:8px_8px] text-white"
                      onClick={() => handleNavigate(stat.path)}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex justify-end min-h-[22px]">
                          {(stat.change || stat.trend) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/20 shadow-sm leading-none flex items-center gap-1">
                              {stat.change || stat.trend}
                            </span>
                          )}
                        </div>
                        <div className="mt-6">
                          <div className="text-3xl font-extrabold text-white tracking-tight">
                            {stat.value}
                          </div>
                          <div className="mt-2.5 text-[10px] font-bold text-white/80 uppercase tracking-widest leading-none">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                      <svg className="w-4.5 h-4.5 text-white/20 absolute right-5 bottom-5 group-hover:scale-110 group-hover:text-white/40 transition-all duration-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                    </div>
                  );
                }
              })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!isSearching &&
        quickActions.filter((a) => !a?.path || canShowItem(a)).length > 0 && (
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
                  className="flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 border border-slate-100 dark:border-slate-700/50 hover:border-brand-300 dark:hover:border-brand-700/60 hover:bg-gradient-to-br hover:from-white hover:to-brand-50/20 dark:hover:from-slate-800 dark:hover:to-slate-900/50 transition-all duration-300 group text-center h-full relative overflow-hidden"
                  onClick={() => handleNavigate(action.path)}
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-50/50 dark:bg-slate-700/50 flex items-center justify-center text-2xl mb-3 shadow-inner group-hover:scale-110 group-hover:rotate-3 group-hover:from-brand-100 group-hover:to-brand-200/50 dark:group-hover:from-slate-600 dark:group-hover:to-slate-700 transition-all duration-300">
                    {action.icon}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                    {action.label}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-10">
        {searchTerm && filteredSections.length === 0 && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <div className="text-4xl mb-2">🔍</div>
            <p>No menu items found matching "{searchTerm}"</p>
            <button
              onClick={() => setSearchTerm("")}
              className="mt-2 text-brand-600 hover:text-brand-700 underline"
            >
              Clear search
            </button>
          </div>
        )}
        {filteredSections.map((section, sectionIndex) => {
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
                        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:border-brand-300/80 dark:hover:border-brand-600/80 hover:-translate-y-1.5 hover:shadow-[0_15px_35px_rgba(14,54,70,0.06)] dark:hover:shadow-[0_15px_35px_rgba(0,0,0,0.25)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer group relative overflow-hidden"
                        onClick={() => handleNavigate(item.path)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:rotate-1 group-hover:from-brand-100 group-hover:to-brand-200/50 dark:group-hover:from-slate-600 dark:group-hover:to-slate-700 transition-all duration-300">
                            {item.icon || "📄"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors mb-1 truncate">
                              {itemTitle}
                            </h3>
                            {item.description && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
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
                                      ? "bg-brand text-white hover:bg-brand-700 border-brand shadow-sm hover:shadow"
                                      : "bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-brand-300 dark:hover:border-brand-600 shadow-sm";

                                  return (
                                    <button
                                      key={`${action.path || action.label}-${actionIndex}`}
                                      type="button"
                                      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${actionClass}`}
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
                        {/* Custom bottom line slide-in highlight on hover */}
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-brand-500/80 to-primary-500/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
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
