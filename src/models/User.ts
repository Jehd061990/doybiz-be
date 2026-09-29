import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';
export const VALID_ROLES: UserRole[] = ['OWNER', 'MANAGER', 'CASHIER'];
export const VALID_MODULES = ['POS', 'SALES', 'APPOINTMENTS', 'CUSTOMERS', 'REPORTS', 'STAFF', 'BILLING'] as const;
export type ModulePermissionName = typeof VALID_MODULES[number];
export type PermissionPreset = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface IUser extends Document {
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  branchAccess: string[] | 'ALL';
  modulePermissions: ModulePermissionName[];
  permissionPreset?: PermissionPreset;
  billingEffectiveAt?: Date;
  billingActivationPending?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const defaultModulePermissionsForRole = (role: UserRole, preset?: PermissionPreset) => {
  const normalizedPreset = (preset || role || 'OWNER').toUpperCase() as PermissionPreset;
  if (role === 'OWNER') return [...VALID_MODULES];
  if (normalizedPreset === 'MANAGER') return ['POS', 'SALES', 'APPOINTMENTS', 'CUSTOMERS', 'REPORTS', 'STAFF'];
  if (normalizedPreset === 'CASHIER') return ['POS', 'SALES', 'APPOINTMENTS', 'CUSTOMERS'];
  return [];
};

const normalizeModulePermissions = (value: unknown): ModulePermissionName[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const next: ModulePermissionName[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const candidate = item.trim().toUpperCase();
    if (!candidate) continue;
    if (!seen.has(candidate)) {
      seen.add(candidate);
      next.push(candidate as ModulePermissionName);
    }
  }
  return next;
};

const UserSchema: Schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['OWNER', 'MANAGER', 'CASHIER'], required: true },
  branchAccess: { type: Schema.Types.Mixed, required: true },
  modulePermissions: { type: [String], enum: VALID_MODULES, default: undefined },
  permissionPreset: { type: String, enum: ['OWNER', 'MANAGER', 'CASHIER'] },
  billingEffectiveAt: { type: Date },
  billingActivationPending: { type: Boolean, default: false },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
}, { timestamps: true });

UserSchema.pre('validate', function (next) {
  const permissions = (this as any).modulePermissions;
  if (permissions === undefined || permissions === null) {
    (this as any).modulePermissions = defaultModulePermissionsForRole((this as any).role, (this as any).permissionPreset);
  } else {
    (this as any).modulePermissions = normalizeModulePermissions(permissions);
  }
  (this as any).permissionPreset = (this as any).role === 'OWNER' ? 'OWNER' : ((this as any).permissionPreset || (this as any).role || 'CASHIER');
  next();
});

// Ensure unique email within an organization
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export default mongoose.model<IUser>('User', UserSchema);
