import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Role } from "@resolveme/core";
import api from "@/lib/api";
import type { User } from "@/types/user";

interface Props {
  onEdit: (user: User) => void;
}

export function UsersTable({ onEdit }: Props) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);

  const { data: users = [], isPending: isLoading, isError: loadError } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/api/users").then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) =>
        prev.filter((u) => u.id !== id)
      );
      setDeleteError(null);
      setConfirmUser(null);
    },
    onError: (err) => {
      const body = (err as AxiosError<{ error?: string }>).response?.data;
      setDeleteError(body?.error ?? "Failed to delete user.");
      setConfirmUser(null);
    },
  });

  if (loadError) {
    return <p className="text-destructive text-sm">Could not load users. Please try again.</p>;
  }

  return (
    <div className="space-y-3">
      {deleteError && (
        <p className="text-destructive text-sm">{deleteError}</p>
      )}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-6 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-6 py-3" />
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === session?.user.id;
                  const isAdmin = user.role === Role.admin;
                  const canDelete = !isSelf && !isAdmin;

                  return (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-3 font-medium">{user.name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.role === Role.admin
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${user.name}`}
                            onClick={() => onEdit(user)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${user.name}`}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmUser(user)}
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="inline-flex h-8 w-8" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AlertDialog open={confirmUser !== null} onOpenChange={(v) => { if (!v) setConfirmUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmUser?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the account for <strong>{confirmUser?.email}</strong>. The user will no longer be able to sign in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => confirmUser && deleteMutation.mutate(confirmUser.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
