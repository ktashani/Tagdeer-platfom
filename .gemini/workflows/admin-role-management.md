---
description: Add admin role management to the Users tab so super_admins can promote/demote users
---

# Task: Admin Role Management in Users Tab

## Context

The admin Settings → Admins tab (line 506–508 of `src/app/(portals)/admin/settings/page.jsx`) says:
> "Use the main Users tab to modify someone's role to Super Admin, Admin, Assistant Admin, or Support Agent."

But the Users tab (`src/app/(portals)/admin/users/page.jsx`) has **NO role management**. It only has status control (Active/Restricted/Banned), points adjustment, and purge. This task adds role assignment.

## Critical Rules — DO NOT BREAK

1. **Do NOT modify** the existing user list, filtering, status control, points adjustment, purge, or merchant business cascade logic
2. **Do NOT change** the `profiles` table schema — the `role` column already exists with TEXT type
3. **Do NOT remove** any existing functionality from the Users page
4. The valid roles are defined in `platform_config` table under key `admin_roles`: `['super_admin', 'admin', 'assistant_admin', 'support_agent']`. Regular users have role `'user'` and merchants have `'merchant'`.

## Step 1: Create the RPC Migration

Create file: `supabase/migrations/20260306130000_admin_update_user_role.sql`

```sql
-- RPC: Allow super_admins to change a user's role
CREATE OR REPLACE FUNCTION admin_update_user_role(p_user_id UUID, p_new_role TEXT)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Get caller's role
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    
    -- Only super_admin can change roles
    IF v_caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only Super Admins can modify roles');
    END IF;

    -- Prevent self-demotion
    IF p_user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own role');
    END IF;

    -- Validate role value
    IF p_new_role NOT IN ('user', 'merchant', 'admin', 'super_admin', 'assistant_admin', 'support_agent') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid role: ' || p_new_role);
    END IF;

    -- Update the role
    UPDATE public.profiles SET role = p_new_role WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Role updated to ' || p_new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Step 2: Add Role Management UI to Users Page

File: `src/app/(portals)/admin/users/page.jsx`

### 2a. Add state for role change

Near the existing state declarations (around line 28), add:

```javascript
const [isChangingRole, setIsChangingRole] = useState(false)
```

### 2b. Get current user's role

The current logged-in admin's role needs to be checked. In the component, use the `useTagdeer` hook to get the current user:

```javascript
const { supabase, showToast, user } = useTagdeer()
```

Then determine if current user is super_admin:

```javascript
const currentUserProfile = users.find(u => u.id === user?.id)
const isSuperAdmin = currentUserProfile?.role === 'super_admin'
```

### 2c. Add the role change handler function

Add this after the `handleUpdateUserInfo` function (around line 255):

```javascript
const handleRoleChange = async (newRole) => {
    if (!supabase || !selectedUser) return;
    if (!confirm(`Are you sure you want to change ${selectedUser.name}'s role to "${newRole}"?`)) return;
    
    setIsChangingRole(true);
    const { data, error } = await supabase.rpc('admin_update_user_role', {
        p_user_id: selectedUser.id,
        p_new_role: newRole
    });

    if (error || !data?.success) {
        showToast(error?.message || data?.error || "Failed to update role", "error");
    } else {
        showToast(`Role updated to ${newRole}`);
        const updated = { ...selectedUser, role: newRole };
        setSelectedUser(updated);
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
    }
    setIsChangingRole(false);
}
```

### 2d. Add Role Management UI section

In the user detail sidebar (scrollable content area), add a new section **between** "Account Status Control" (ends around line 644) and "Merchant Businesses Section" (starts around line 647). Insert this JSX:

```jsx
{/* Role Management - Super Admin Only */}
{isSuperAdmin && selectedUser.id !== user?.id && (
    <div className="mb-8">
        <h3 className="font-semibold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" /> Role Management
        </h3>
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <label className="block text-xs font-medium text-slate-400 mb-2">Assign Role</label>
            <select
                value={selectedUser.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={isChangingRole}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
            >
                <option value="user">Consumer (User)</option>
                <option value="merchant">Merchant</option>
                <option value="support_agent">Support Agent</option>
                <option value="assistant_admin">Assistant Admin</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
            </select>
            <p className="text-xs text-slate-500 mt-2">
                ⚠️ Promoting to admin-level roles grants access to the Admin Portal.
            </p>
        </div>
    </div>
)}
```

## Step 3: Verify

1. Run `npm run dev`
2. Login to admin portal as a super_admin user
3. Navigate to Users tab
4. Select any user → verify Role Management section appears
5. Change a user's role → verify it updates in the UI and database
6. Verify existing functionality (status control, points, purge) still works
7. Login as a non-super_admin admin → verify Role Management section is HIDDEN
