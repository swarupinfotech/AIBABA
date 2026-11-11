export const ROLES = ["USER", "SUPPORT", "CONTENT_EDITOR", "OPERATIONS_ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

const LEVEL: Record<Role, number> = {
  USER: 0,
  SUPPORT: 1,
  CONTENT_EDITOR: 2,
  OPERATIONS_ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function hasRole(role: string, minimum: Role): boolean {
  return isRole(role) && LEVEL[role] >= LEVEL[minimum];
}

export function canAccessAdmin(role: string): boolean {
  return hasRole(role, "SUPPORT");
}
