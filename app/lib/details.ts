export type DismissibleDetails = Pick<HTMLDetailsElement, "contains" | "open">;

export function dismissDetailsFromOutsideTarget(
  details: DismissibleDetails | null,
  target: Node | null,
) {
  if (!details?.open || !target || details.contains(target)) {
    return false;
  }

  details.open = false;
  return true;
}
