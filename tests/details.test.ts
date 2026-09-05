import { describe, expect, test } from "bun:test";
import {
  type DismissibleDetails,
  dismissDetailsFromOutsideTarget,
} from "../app/lib/details";

function createDetails(open: boolean, containsTarget: boolean) {
  return {
    contains: () => containsTarget,
    open,
  } as DismissibleDetails;
}

describe("dismissible details", () => {
  test("closes an open control when the pointer target is outside", () => {
    const details = createDetails(true, false);

    expect(dismissDetailsFromOutsideTarget(details, {} as Node)).toBe(true);
    expect(details.open).toBe(false);
  });

  test("keeps the control open when the pointer target is inside", () => {
    const details = createDetails(true, true);

    expect(dismissDetailsFromOutsideTarget(details, {} as Node)).toBe(false);
    expect(details.open).toBe(true);
  });

  test("ignores closed or unavailable controls and targets", () => {
    const details = createDetails(false, false);

    expect(dismissDetailsFromOutsideTarget(details, {} as Node)).toBe(false);
    expect(dismissDetailsFromOutsideTarget(null, {} as Node)).toBe(false);
    expect(dismissDetailsFromOutsideTarget(details, null)).toBe(false);
  });
});
