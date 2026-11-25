import { it, expect } from "vitest";
import { label, statuses } from "./api";
it("labels valid selectable states", () => {
  expect(statuses.map(label)).toEqual([
    "Todo",
    "In progress",
    "Review",
    "Done",
  ]);
});
