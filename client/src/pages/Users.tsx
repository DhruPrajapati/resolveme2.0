import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserDialog } from "./UserDialog";
import { UsersTable } from "@/components/UsersTable";
import type { User } from "@/types/user";

export default function Users() {
  const [dialog, setDialog] = useState<"create" | User | null>(null);

  const editingUser = dialog !== null && dialog !== "create" ? dialog : undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => setDialog("create")}>Add user</Button>
      </div>

      <UserDialog
        key={editingUser?.id ?? "create"}
        open={dialog !== null}
        onOpenChange={(v) => { if (!v) setDialog(null); }}
        user={editingUser}
      />
      <UsersTable onEdit={setDialog} />
    </div>
  );
}
