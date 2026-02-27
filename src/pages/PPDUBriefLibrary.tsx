import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookMarked, Search, Calendar, User, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface LibraryEntry {
  id: string;
  title: string;
  content: string | null;
  saved_by: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const PPDUBriefLibrary = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (data) setUserRole(data.role);
    }
  };

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("ppdu_brief_library")
        .select("*, profiles:saved_by(full_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries((data as unknown as LibraryEntry[]) ?? []);
    } catch (err) {
      console.error("Error fetching PPDU brief library:", err);
      toast.error("Failed to load library");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("ppdu_brief_library")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast.success("Entry deleted");
      setEntries((prev) => prev.filter((e) => e.id !== deleteId));
    } catch (err) {
      console.error("Error deleting library entry:", err);
      toast.error("Failed to delete entry");
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = entries.filter((e) =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getWeekOfLine = (content: string | null) => {
    if (!content) return null;

    const normalized = content
      .replace(/<(br\s*\/?|\/p|\/div|\/h[1-6]|\/li)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ");

    const decoder = document.createElement("textarea");
    decoder.innerHTML = normalized;
    const decoded = decoder.value;

    const lines = decoded
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.toLowerCase().startsWith("week of")) {
        return line;
      }

      const inlineMatch = line.match(/\b(week of[^\n]*)/i);
      if (inlineMatch?.[1]) {
        return inlineMatch[1].trim();
      }
    }

    return null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookMarked className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">PPDU Brief Library</h1>
              <p className="text-muted-foreground">Saved snapshots of PPDU briefs</p>
            </div>
          </div>
          <Button onClick={() => navigate("/dashboard/ppdu-brief")}>
            Go to PPDU Brief Editor
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search saved briefs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading library...</div>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookMarked className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchTerm
                  ? "No briefs match your search"
                  : "No saved briefs yet. Use the \"Save to Library\" button in the PPDU Brief editor."}
              </p>
              {!searchTerm && (
                <Button
                  className="mt-4"
                  onClick={() => navigate("/dashboard/ppdu-brief")}
                >
                  Open PPDU Brief Editor
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((entry) => {
              const weekOfLine = getWeekOfLine(entry.content);

              return (
              <Card
                key={entry.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1"
                      onClick={() =>
                        navigate(`/dashboard/ppdu-brief-library/${entry.id}`)
                      }
                    >
                      <CardTitle className="text-xl hover:text-primary transition-colors">
                        {entry.title}
                      </CardTitle>
                      {weekOfLine && (
                        <CardDescription className="mt-1 font-medium text-foreground/80">
                          {weekOfLine}
                        </CardDescription>
                      )}
                    </div>
                    {(userRole === "admin" || currentUserId === entry.saved_by) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(entry.id);
                        }}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{entry.profiles?.full_name ?? "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Saved {format(new Date(entry.created_at), "PPP")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )})}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete library entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this saved brief from the library. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default PPDUBriefLibrary;
