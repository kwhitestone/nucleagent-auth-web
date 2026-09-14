export interface MenuPolicyItem {
  id: number;
  parentId?: number | null;
  title: string;
  sort?: number;
}

export interface FlatMenuRow<T extends MenuPolicyItem> {
  item: T;
  depth: number;
  orphaned: boolean;
  cyclic: boolean;
}

export function normalizeNumericIds(values: readonly unknown[]): number[] {
  return [...new Set(values
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0))]
    .sort((left, right) => left - right);
}

export function toggleNumericSelection(
  current: readonly number[],
  id: number,
  checked: boolean,
): number[] {
  const next = checked ? [...current, id] : current.filter((value) => value !== id);
  return normalizeNumericIds(next);
}

export function parsePermissionExpression(expression: string): string[] {
  return [...new Set(expression.split("|").map((value) => value.trim()).filter(Boolean))];
}

export function formatPermissionExpression(permissions: readonly string[]): string {
  return parsePermissionExpression(permissions.join("|")).join("|");
}

function compareMenus<T extends MenuPolicyItem>(left: T, right: T): number {
  return (left.sort ?? 0) - (right.sort ?? 0) ||
    left.title.localeCompare(right.title) || left.id - right.id;
}

export function flattenMenuTree<T extends MenuPolicyItem>(menus: readonly T[]): FlatMenuRow<T>[] {
  const ordered = [...menus].sort(compareMenus);
  const byId = new Map(ordered.map((menu) => [menu.id, menu]));
  const children = new Map<number, T[]>();
  ordered.forEach((menu) => {
    const parentId = menu.parentId ?? 0;
    if (parentId <= 0 || !byId.has(parentId)) return;
    children.set(parentId, [...(children.get(parentId) ?? []), menu]);
  });

  const rows: FlatMenuRow<T>[] = [];
  const visited = new Set<number>();
  const append = (menu: T, depth: number, cyclic: boolean): void => {
    if (visited.has(menu.id)) return;
    visited.add(menu.id);
    const parentId = menu.parentId ?? 0;
    rows.push({
      item: menu,
      depth,
      orphaned: parentId > 0 && !byId.has(parentId),
      cyclic,
    });
    [...(children.get(menu.id) ?? [])]
      .sort(compareMenus)
      .forEach((child) => append(child, depth + 1, cyclic));
  };

  ordered
    .filter((menu) => (menu.parentId ?? 0) <= 0 || !byId.has(menu.parentId as number))
    .forEach((menu) => append(menu, 0, false));
  ordered.forEach((menu) => append(menu, 0, true));
  return rows;
}

export function collectDescendantMenuIds<T extends MenuPolicyItem>(
  menus: readonly T[],
  menuId: number,
): Set<number> {
  const descendants = new Set<number>();
  const queue = [menuId];
  while (queue.length > 0) {
    const parentId = queue.shift() as number;
    menus
      .filter((menu) => menu.parentId === parentId && menu.id !== menuId)
      .forEach((menu) => {
        if (descendants.has(menu.id)) return;
        descendants.add(menu.id);
        queue.push(menu.id);
      });
  }
  return descendants;
}
