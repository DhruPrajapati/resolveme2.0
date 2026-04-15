import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserDialog } from "./UserDialog";
import { UsersTable } from "@/components/UsersTable";
import type { User } from "@/types/user";

export default function Users() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => setCreateOpen(true)}>Add user</Button>
      </div>

      <UserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserDialog
        key={editingUser?.id}
        open={editingUser !== null}
        onOpenChange={(v) => { if (!v) setEditingUser(null); }}
        user={editingUser ?? undefined}
      />
      <UsersTable onEdit={setEditingUser} />
    </div>
  );
}
