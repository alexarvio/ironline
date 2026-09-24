"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Drag to reorder, the same everywhere in the coach's tabs: take a row by its
// grip and it lifts off and follows the pointer, while the rows around it
// slide apart to show where it will land. Drop, and onMove gets the new
// order; saving it is the caller's (a queued Apply, or an action straight
// away). The keyboard works too: focus the grip, Space, arrows, Space.
//
//   <SortableList ids={rows.map((r) => r.id)} onMove={(ids) => …}>
//     {rows.map((r) => (
//       <SortableItem key={r.id} id={r.id} className="rd-row">
//         {(grip) => <><span className="rd-grip" {...grip}>⋮⋮</span> …</>}
//       </SortableItem>
//     ))}
//   </SortableList>

type Id = number | string;

const ListLabel = createContext("item");

export function SortableList({ ids, onMove, label = "item", children }: { ids: Id[]; onMove: (ids: Id[]) => void; label?: string; children: ReactNode }) {
  const sensors = useSensors(
    // A few pixels of movement before it counts as a drag, so a click on the grip stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    onMove(arrayMove(ids, from, to));
  };
  return (
    <ListLabel.Provider value={label}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </DndContext>
    </ListLabel.Provider>
  );
}

/** What goes on the grip: spread it onto the element the coach takes hold of. */
export type GripProps = Record<string, unknown> & { ref: (el: HTMLElement | null) => void };

export function SortableItem({
  id,
  as: Tag = "div",
  className,
  style,
  anchor,
  children,
}: {
  id: Id;
  as?: "div" | "section" | "li";
  /** An id for the element, so a link (#anchor) can land on it. */
  anchor?: string;
  className?: string;
  style?: CSSProperties;
  children: (grip: GripProps, dragging: boolean) => ReactNode;
}) {
  const label = useContext(ListLabel);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const grip: GripProps = {
    ...attributes,
    ...listeners,
    ref: setActivatorNodeRef,
    "aria-label": `Drag to reorder this ${label}`,
    title: "Drag to reorder",
    style: { cursor: isDragging ? "grabbing" : "grab", touchAction: "none" },
  };
  return (
    <Tag
      ref={setNodeRef}
      id={anchor}
      className={`${className ?? ""}${isDragging ? " rd-sorting" : ""}`}
      style={{ ...style, transform: CSS.Translate.toString(transform), transition, position: "relative", zIndex: isDragging ? 20 : undefined }}
    >
      {children(grip, isDragging)}
    </Tag>
  );
}
