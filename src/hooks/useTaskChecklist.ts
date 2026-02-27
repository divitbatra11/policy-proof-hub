import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TaskChecklistItem } from "@/types/tasks";

const CHECKLIST_QUERY_KEY = "task-checklist";

export function useTaskChecklist(taskId: string | undefined) {
  return useQuery({
    queryKey: [CHECKLIST_QUERY_KEY, taskId],
    enabled: !!taskId,
    queryFn: async () => {
      if (!taskId) return [] as TaskChecklistItem[];

      const { data, error } = await supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TaskChecklistItem[];
    },
  });
}

export function useAddTaskChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, text }: { taskId: string; text: string }) => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Checklist item cannot be empty");

      // Compute next sort order
      const { data: last, error: lastErr } = await supabase
        .from("task_checklist_items")
        .select("sort_order")
        .eq("task_id", taskId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastErr) throw lastErr;

      const nextSort = ((last?.sort_order as number | null) ?? 0) + 1;

      const { data, error } = await supabase
        .from("task_checklist_items")
        .insert({ task_id: taskId, item_text: trimmed, sort_order: nextSort })
        .select()
        .single();

      if (error) throw error;
      return data as TaskChecklistItem;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_QUERY_KEY, vars.taskId] });
      toast.success("Checklist item added");
    },
    onError: (error) => {
      toast.error("Failed to add checklist item: " + error.message);
    },
  });
}

export function useToggleTaskChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      itemId,
      isCompleted,
    }: {
      taskId: string;
      itemId: string;
      isCompleted: boolean;
    }) => {
      const { data, error } = await supabase
        .from("task_checklist_items")
        .update({ is_completed: isCompleted })
        .eq("id", itemId)
        .select()
        .single();

      if (error) throw error;
      return data as TaskChecklistItem;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_QUERY_KEY, vars.taskId] });
    },
    onError: (error) => {
      toast.error("Failed to update checklist item: " + error.message);
    },
  });
}

export function useDeleteTaskChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, itemId }: { taskId: string; itemId: string }) => {
      const { error } = await supabase
        .from("task_checklist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      return true;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_QUERY_KEY, vars.taskId] });
      toast.success("Checklist item removed");
    },
    onError: (error) => {
      toast.error("Failed to remove checklist item: " + error.message);
    },
  });
}