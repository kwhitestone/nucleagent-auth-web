export function hasPermission(granted: readonly string[], required: string): boolean {
  const requiredSegments = required.trim().split(":");
  if (requiredSegments.length !== 3) return false;
  return granted.some((permission) => {
    const segments = permission.trim().split(":");
    return segments.length === requiredSegments.length &&
      segments.every((segment, index) => segment === "*" || segment === requiredSegments[index]);
  });
}
