"use client";
import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Calendar, Tag } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { NovaTaskButton } from "@/components/kanban/nova-task";

interface Column { id: string; name: string; color: string; position: number; }
interface Task { id: string; title: string; description: string | null; column_id: string | null; priority: string; due_date: string | null; position: number; tags: string[]; }

export function KanbanBoard({ boardId, initialColumns, initialTasks }: { boardId: string; initialColumns: Column[]; initialTasks: Task[] }) {
  const [columns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const priorityColor: Record<string, string> = { low: "text-muted-foreground", normal: "text-cyan", high: "text-yellow-400", urgent: "text-red-400" };

  function handleDragStart(e: DragStartEvent) {
    const t = tasks.find((x) => x.id === e.active.id);
    if (t) setActive(t);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === a.id);
    if (!activeTask) return;
    const overTask = tasks.find((t) => t.id === over.id);
    const targetColumnId = overTask?.column_id || (over.id as string);

    let newTasks = tasks;
    if (activeTask.column_id !== targetColumnId) {
      newTasks = tasks.map((t) => t.id === activeTask.id ? { ...t, column_id: targetColumnId } : t);
    } else if (overTask && activeTask.id !== overTask.id) {
      const cur = tasks.filter((t) => t.column_id === activeTask.column_id);
      const oldIdx = cur.findIndex((t) => t.id === activeTask.id);
      const newIdx = cur.findIndex((t) => t.id === overTask.id);
      const reordered = arrayMove(cur, oldIdx, newIdx).map((t, i) => ({ ...t, position: i }));
      newTasks = tasks.map((t) => reordered.find((r) => r.id === t.id) || t);
    }
    setTasks(newTasks);

    await fetch(`/api/tasks/${activeTask.id}/move`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: targetColumnId, position: newTasks.findIndex((t) => t.id === activeTask.id) }),
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.column_id === col.id);
          return (
            <div key={col.id} className="w-80 flex-shrink-0 bg-card/60 border border-border rounded-xl">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                  <div className="font-bold text-sm">{col.name}</div>
                  <Badge variant="secondary" className="text-[10px]">{colTasks.length}</Badge>
                </div>
                <NovaTaskButton boardId={boardId} columnId={col.id} />
              </div>
              <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {colTasks.map((t) => <SortableTask key={t.id} task={t} priorityColor={priorityColor} />)}
                </div>
              </SortableContext>
            </div>
          );
        })}
        <div className="w-80 flex-shrink-0">
          <Button variant="outline" className="w-full h-12"><Plus className="h-4 w-4" /> Nova coluna</Button>
        </div>
      </div>
      <DragOverlay>
        {active && <div className="bg-card border-2 border-cyan rounded-lg p-3 shadow-2xl rotate-2 w-72"><div className="font-semibold text-sm">{active.title}</div></div>}
      </DragOverlay>
    </DndContext>
  );
}

function SortableTask({ task, priorityColor }: { task: Task; priorityColor: Record<string, string> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <Card ref={setNodeRef} style={style} className={cn("cursor-grab active:cursor-grabbing hover:border-cyan/30")} {...attributes} {...listeners}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <GripVertical className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="font-semibold text-sm leading-tight">{task.title}</div>
        </div>
        {task.description && <div className="text-xs text-muted-foreground line-clamp-2">{task.description}</div>}
        <div className="flex items-center gap-2 text-[11px]">
          <span className={cn("font-bold", priorityColor[task.priority] || priorityColor.normal)}>
            {task.priority === "urgent" ? "●●●" : task.priority === "high" ? "●●" : "●"}
          </span>
          {task.due_date && (<span className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" /> {formatDate(task.due_date)}</span>)}
          {task.tags?.length > 0 && (<span className="flex items-center gap-1 text-muted-foreground"><Tag className="h-3 w-3" /> {task.tags.join(", ")}</span>)}
        </div>
      </CardContent>
    </Card>
  );
}
