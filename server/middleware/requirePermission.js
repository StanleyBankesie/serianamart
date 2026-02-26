import { checkModuleAccess, checkModuleAction } from "./access.js";
import { httpError } from "../utils/httpError.js";

function mapPermissionKeyToModuleAndAction(key) {
  const raw = String(key || "").toUpperCase();
  const prefix = raw.split(".")[0];
  const moduleMap = {
    ADMIN: "administration",
    SALES: "sales",
    INVENTORY: "inventory",
    PURCHASE: "purchase",
    FIN: "finance",
    HR: "human-resources",
    POS: "pos",
    BI: "business-intelligence",
    MAINT: "maintenance",
    PROD: "production",
    PROJ: "project-management",
  };
  const moduleKey = moduleMap[prefix] || "";
  let action = "view";
  if (raw.includes("CREATE")) action = "create";
  else if (raw.includes("DELETE")) action = "delete";
  else if (raw.includes("EDIT") || raw.includes("MANAGE")) action = "edit";
  else action = "view";
  return { moduleKey, action };
}

export function requireModule(moduleKey) {
  return function composedModule(req, res, next) {
    const mk = String(moduleKey || "");
    if (!mk) return next();
    const m = checkModuleAccess(mk);
    m(req, res, next);
  };
}

export function requirePermission(permissionKey) {
  return function composedMiddleware(req, res, next) {
    const url = String(req.baseUrl || req.originalUrl || "");
    if (
      req.method === "GET" &&
      (url.includes("/api/sales") ||
        url.includes("/api/purchase") ||
        url.includes("/api/finance"))
    ) {
      return next();
    }
    const { moduleKey, action } =
      mapPermissionKeyToModuleAndAction(permissionKey);
    if (!moduleKey) return next();
    const m1 = checkModuleAccess(moduleKey);
    const m2 = checkModuleAction(moduleKey, action);
    m1(req, res, (err) => {
      if (err) return next(err);
      m2(req, res, next);
    });
  };
}

export function requireAnyPermission(permissionKeys) {
  const keys = Array.isArray(permissionKeys)
    ? permissionKeys.filter(Boolean)
    : [permissionKeys].filter(Boolean);
  return async function composedAnyMiddleware(req, res, next) {
    const url = String(req.baseUrl || req.originalUrl || "");
    if (
      req.method === "GET" &&
      (url.includes("/api/sales") ||
        url.includes("/api/purchase") ||
        url.includes("/api/finance"))
    ) {
      return next();
    }
    if (!keys.length) return next();
    try {
      for (const k of keys) {
        const { moduleKey } = mapPermissionKeyToModuleAndAction(k);
        if (!moduleKey) continue;
        let allowed = false;
        const m1 = checkModuleAccess(moduleKey);
        await new Promise((resolve) => {
          m1(req, res, (err) => {
            if (!err) {
              allowed = true;
            }
            resolve(null);
          });
        });
        if (allowed) {
          return next();
        }
      }
      return next(httpError(403, "FORBIDDEN", "Module access denied"));
    } catch (err) {
      return next(err);
    }
  };
}
