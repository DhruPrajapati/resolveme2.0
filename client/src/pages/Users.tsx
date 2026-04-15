import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { UsersTable } from "@/components/UsersTable";

export default function Users() {
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => setOpen(true)}>Add user</Button>
      </div>

      <CreateUserDialog open={open} onOpenChange={setOpen} />
      <UsersTable />
    </div>
  );
}
