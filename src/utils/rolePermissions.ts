import { IUser, UserRole, VALID_MODULES } from '../models/User';

export type ModuleName = typeof VALID_MODULES[number];
export const ROLE_PRESETS: Record<'CASHIER' | 'MANAGER', ModuleName[]> = {
  CASHIER: ['POS', 'SALES', 'APPOINTMENTS', 'CUSTOMERS'],
  MANAGER: ['POS', 'SALES', 'APPOINTMENTS', 'SERVICES', 'CUSTOMERS', 'REPORTS', 'STAFF'],
};
export const normalizeModulePermissions = (value: unknown): ModuleName[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>(); const normalized: ModuleName[] = [];
  for (const entry of value) { if (typeof entry !== 'string') continue; const candidate = entry.trim().toUpperCase(); if (!VALID_MODULES.includes(candidate as ModuleName)) continue; if (!seen.has(candidate)) { seen.add(candidate); normalized.push(candidate as ModuleName); } }
  return normalized;
};
export const getDefaultModulesForRole = (role: UserRole | string, preset?: string) => {
  if (role === 'OWNER') return [...VALID_MODULES];
  const key = (preset || role || 'CASHIER').toUpperCase();
  if (key === 'MANAGER') return [...ROLE_PRESETS.MANAGER];
  if (key === 'CASHIER') return [...ROLE_PRESETS.CASHIER];
  return [];
};
export const applyRolePreset = (role: UserRole | string, preset?: string) => getDefaultModulesForRole(role, preset);
export const hasModuleAccess = (user: IUser | null | undefined, moduleName: string) => {
  if (!user) return false;
  const module = moduleName.trim().toUpperCase();
  if (!VALID_MODULES.includes(module as ModuleName)) return false;
  if (user.role === 'OWNER') return true;
  const stored = (user as any).modulePermissions;
  const permissions = Array.isArray(stored) ? normalizeModulePermissions(stored) : getDefaultModulesForRole(user.role, user.permissionPreset);
  return permissions.includes(module as ModuleName);
};
