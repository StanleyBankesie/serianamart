import { httpError } from '../utils/httpError.js';

export function requirePermission(permissionKey) {
  return function permissionMiddleware(req, res, next) {
    const perms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (perms.includes('*') || perms.includes(permissionKey)) return next();
    return next(httpError(403, 'FORBIDDEN', 'Insufficient permissions'));
  };
}

export function requireAnyPermission(permissionKeys) {
  const keys = Array.isArray(permissionKeys) ? permissionKeys.filter(Boolean) : [permissionKeys];
  return function permissionAnyMiddleware(req, res, next) {
    const perms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (perms.includes('*')) return next();
    for (const k of keys) {
      if (perms.includes(k)) return next();
    }
    return next(httpError(403, 'FORBIDDEN', 'Insufficient permissions'));
  };
}
