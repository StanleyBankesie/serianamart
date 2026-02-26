# RBAC System Integration Guide

## 📋 FILES CREATED

### Frontend Pages
- `client/src/pages/admin/RoleSetup.jsx` - Role management and module assignment
- `client/src/pages/admin/UserPermissions.jsx` - Action-level permissions for roles

### Backend Components
- `server/controllers/rbac.controller.js` - RBAC API controllers
- `server/routes/admin.routes.js` - RBAC API routes
- `server/middleware/rbac.middleware.js` - Permission enforcement middleware

### Frontend Components
- `client/src/auth/PermissionContext.jsx` - Permission hooks and protected components
- `client/src/components/Sidebar.jsx` - RBAC-aware navigation
- `client/src/examples/SalesHomeExample.jsx` - Example protected module home

### Examples
- `server/routes/protected.example.js` - Example protected API routes

## 🔧 INTEGRATION STEPS

### 1. Add Admin Routes to Server
Add to your main server file (index.js or app.js):
```javascript
import adminRoutes from "./routes/admin.routes.js";
app.use("/api/admin", adminRoutes);
```

### 2. Add Permission Provider to App
Wrap your app with PermissionProvider:
```javascript
import { PermissionProvider } from "./auth/PermissionContext.jsx";

function App() {
  return (
    <PermissionProvider>
      <YourAppComponents />
    </PermissionProvider>
  );
}
```

### 3. Update Sidebar
Replace your existing sidebar with the RBAC-aware version:
```javascript
import Sidebar from "./components/Sidebar.jsx";
```

### 4. Protect Module Homes
Update your ModuleHome.jsx files to use protected components:
```javascript
import { ProtectedFeature, ProtectedButton } from "../auth/PermissionContext.jsx";

// Instead of rendering features directly, wrap them:
<ProtectedFeature
  moduleKey="sales"
  featureKey="sales:create-invoice"
  action="create"
>
  <YourFeatureComponent />
</ProtectedFeature>
```

### 5. Protect API Routes
Add RBAC middleware to your existing routes:
```javascript
import { checkFeatureAccess } from "../middleware/rbac.middleware.js";

router.post(
  "/sales/invoices",
  requireAuth,
  checkFeatureAccess("sales:create-invoice", "create"),
  yourController
);
```

## 🎯 USAGE EXAMPLES

### Creating a Role
1. Go to `/admin/roles`
2. Click "Create Role"
3. Enter role name and code
4. Click "Create Role"

### Assigning Modules to Role
1. Select a role from the list
2. Click "Configure"
3. Check modules to assign (master switch)
4. Check specific features and dashboards
5. Click "Save Assignments"

### Setting Action Permissions
1. Go to `/admin/user-permissions`
2. Select a role from dropdown
3. Set View/Create/Edit/Delete checkboxes for each feature
4. Click "Save Permissions"

### Protecting Frontend Components
```javascript
// Hide entire feature if no permission
<ProtectedFeature
  moduleKey="sales"
  featureKey="sales:create-invoice"
  action="create"
>
  <CreateInvoiceCard />
</ProtectedFeature>

// Hide just the button
<ProtectedButton
  moduleKey="sales"
  featureKey="sales:create-invoice"
  action="create"
  className="btn btn-primary"
>
  Create Invoice
</ProtectedButton>
```

### Protecting API Endpoints
```javascript
// Full protection with module and feature check
router.post(
  "/api/sales/invoices",
  requireAuth,
  checkFeatureAccess("sales:create-invoice", "create"),
  createInvoiceController
);
```

## 🔒 SECURITY BEHAVIOR

### Module Level
- If module not assigned → Not in sidebar, all APIs return 403

### Feature Level
- If feature not assigned → Feature hidden, APIs return 403

### Action Level
- If action not allowed → Button hidden, API returns 403

### Hierarchy Enforcement
- Unchecking module → Auto-unchecks all features
- Checking feature → Auto-checks parent module

## 🚀 DEPLOYMENT

1. **Database**: Ensure tables exist (adm_roles, adm_role_modules, adm_role_permissions, adm_users)
2. **Backend**: Add routes and middleware to server
3. **Frontend**: Add PermissionProvider and update components
4. **Testing**: Create test roles and verify permissions work

## 📊 EXPECTED OUTCOMES

- ✅ Roles can be created and managed
- ✅ Modules assigned as master switches
- ✅ Features selected individually per module
- ✅ Action permissions set per feature
- ✅ Sidebar respects module permissions
- ✅ Frontend components respect feature permissions
- ✅ API endpoints enforce action permissions
- ✅ Complete hierarchical RBAC system functional
