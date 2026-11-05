"use client";

import { PointerSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors, type CollisionDetection, type SensorDescriptor, type SensorOptions } from "@dnd-kit/core";
import type { TaskDestination } from "../domain/weekBoard";

const DRAG_ACTIVATION_DISTANCE_PX = 6;
const TOUCH_DRAG_DELAY_MS = 250;
const TOUCH_DRAG_TOLERANCE_PX = 6;
const DAY_DROP_PREFIX = "day:";
export const INBOX_DROP_ID = "inbox";

export function dayDropId(date: string): string {
  return `${DAY_DROP_PREFIX}${date}`;
}

/** The column under the pointer wins; wide cards would otherwise overlap a neighbouring day. */
export const detectDropTarget: CollisionDetection = (detectionInput) => {
  const pointerCollisions = pointerWithin(detectionInput);
  return pointerCollisions.length ? pointerCollisions : rectIntersection(detectionInput);
};

/** Mouse drags after a few pixels (clicks still work); touch drags after a short press (scrolling still works). */
export function useBoardSensors(): SensorDescriptor<SensorOptions>[] {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DRAG_DELAY_MS, tolerance: TOUCH_DRAG_TOLERANCE_PX } })
  );
  return sensors;
}

export function readDropDestination(dropId: string | number | undefined): TaskDestination | null {
  if (dropId === INBOX_DROP_ID) return { kind: "inbox" };
  if (typeof dropId === "string" && dropId.startsWith(DAY_DROP_PREFIX)) return { kind: "day", date: dropId.slice(DAY_DROP_PREFIX.length) };
  return null;
}
