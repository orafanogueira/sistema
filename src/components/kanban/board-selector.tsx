"use client";
import { useRouter } from "next/navigation";

export function BoardSelector({ boards, currentBoardId }: {
  boards: { id: string; name: string }[];
  currentBoardId: string | null;
}) {
  const router = useRouter();
  return (
    <select
      className="h-10 rounded-md border border-input bg-background/40 px-3 text-sm"
      value={currentBoardId || ""}
      onChange={(e) => router.push(e.target.value ? `/kanban?board=${e.target.value}` : "/kanban")}
    >
      <option value="">Selecione um board</option>
      {boards.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
    </select>
  );
}
