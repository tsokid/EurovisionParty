-- 058_rooms_delete_policy.sql
-- Migration 051 created SELECT/INSERT/UPDATE policies on rooms but omitted
-- DELETE.  With RLS enabled and no DELETE policy, admin room deletion silently
-- affects 0 rows.  Add a super-admin-only DELETE policy.

CREATE POLICY rooms_delete ON rooms
  FOR DELETE TO authenticated
  USING (is_super_admin());
