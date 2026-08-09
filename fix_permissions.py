import sys
import re

path = 'client/src/auth/PermissionContext.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """    canViewDashboardElement: (moduleKey, type, key) => {
      const mk = String(moduleKey || "");
      const t = String(type || "");
      const rawKey = String(key || "");
      const normKey = rawKey
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      if (!dashboardViewLoaded) return false;
      const comp = `${mk}|${t}|${normKey}`;

      if (mk === "home" && t === "card") {
        let hasHomeCardConfig = false;
        for (const k of dashboardViewMap.keys()) {
          if (k.startsWith("home|card|")) {
            hasHomeCardConfig = true;
            break;
          }
        }
        if (hasHomeCardConfig) {
          return dashboardViewMap.get(comp) === true;
        } else {
          const defaultCards = [
            "sales-total-revenue",
            "sales-pending-orders",
            "sales-active-customers",
            "purchase-total-value"
          ];
          return defaultCards.includes(normKey);
        }
      }

      // If this item has an explicit permission entry, respect it
      if (dashboardViewMap.has(comp)) {
        return dashboardViewMap.get(comp) === true;
      }
      // No explicit config for this item — fall back to module-level RBAC
      if (mk) {
        return canAccessPath(`/${mk}`);
      }
      return isSuper;
    },"""

replacement = """    canViewDashboardElement: (moduleKey, type, key) => {
      if (isSuper) return true; // Super admins see everything by default
      const mk = String(moduleKey || "");
      const t = String(type || "");
      const rawKey = String(key || "");
      const normKey = rawKey
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      if (!dashboardViewLoaded) return false;
      const comp = `${mk}|${t}|${normKey}`;

      if (dashboardViewMap.has(comp)) {
        return dashboardViewMap.get(comp) === true;
      }
      // Strictly enforce RBAC: if not explicitly granted and not super admin, hide it.
      return false;
    },"""

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed PermissionContext.jsx")
else:
    print("Target not found! Attempting regex match...")
    
    # regex match since spacing might differ
    pattern = re.compile(r'    canViewDashboardElement: \(moduleKey, type, key\) => \{.*?return isSuper;\n    \},', re.DOTALL)
    if pattern.search(content):
        content = pattern.sub(replacement, content)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed PermissionContext.jsx with regex")
    else:
        print("Regex match also failed!")
