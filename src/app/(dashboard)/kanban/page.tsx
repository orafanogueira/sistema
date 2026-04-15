import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { NovoBoardButton } from "@/components/kanban/novo-board";
import { BoardSelector } from "@/components/kanban/board-selector";

export default async function KanbanPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const { board: boardId } = await searchParams;
  const supabase = await createClient();
  const { data: boards } = await supabase.from("boards").select("id,name,scope,team,cliente_id").order("created_at");
  const { data: clientes } = await supabase.from("clientes").select("id,nome").order("nome");

  const currentBoardId = boardId || boards?.[0]?.id || null;
  let columns: Array<{ id: string; name: string; color: string; position: number }> = [];
  let tasks: Array<{ id: string; title: string; description: string | null; column_id: string | null; priority: string; due_date: string | null; position: number; tags: string[] }> = [];

  if (currentBoardId) {
    const [{ data: cols }, { data: ts }] = await Promise.all([
      supabase.from("board_columns").select("*").eq("board_id", currentBoardId).order("position"),
      supabase.from("tasks").select("*").eq("board_id", currentBoardId).order("position"),
    ]);
    columns = cols || [];
    tasks = ts || [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Kanban</h1>
          <p className="text-muted-foreground">Acompanhe o fluxo de trabalho dos times.</p>
        </div>
        <div className="flex items-center gap-2">
          <BoardSelector boards={boards || []} currentBoardId={currentBoardId} />
          <NovoBoardButton clientes={clientes || []} />
        </div>
      </div>

      {!currentBoardId && (
        <div className="p-16 text-center bg-card border border-border rounded-xl">
          <div className="text-muted-foreground mb-4">Crie seu primeiro board para comecar.</div>
          <NovoBoardButton clientes={clientes || []} />
        </div>
      )}

      {currentBoardId && <KanbanBoard boardId={currentBoardId} initialColumns={columns} initialTasks={tasks} />}
    </div>
  );
}
