import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  editUserSchema,
  type CreateUserFields,
  type EditUserFields,
} from "@resolveme/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User } from "@/types/user";

type Fields = CreateUserFields | EditUserFields;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
}

export function UserDialog({ open, onOpenChange, user }: Props) {
  const isEdit = user !== undefined;
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(isEdit ? editUserSchema : createUserSchema) as Resolver<Fields>,
    defaultValues: isEdit
      ? { name: user.name, email: user.email, password: "" }
      : { name: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: Fields) =>
      isEdit
        ? api.patch<User>(`/api/users/${user.id}`, data).then((r) => r.data)
        : api.post<User>("/api/users", data).then((r) => r.data),
    onSuccess: (result) => {
      if (isEdit) {
        queryClient.setQueryData<User[]>(["users"], (prev = []) =>
          prev.map((u) => (u.id === result.id ? result : u))
        );
      } else {
        queryClient.setQueryData<User[]>(["users"], (prev = []) => [...prev, result]);
      }
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = async (data: Fields) => {
    try {
      await mutation.mutateAsync(data);
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      const body = (err as AxiosError<{ error?: string | Record<string, string[]> }>).response?.data;
      if (status === 409) {
        setError("email", { message: "A user with that email already exists." });
      } else if (body?.error && typeof body.error === "object") {
        for (const [field, messages] of Object.entries(body.error)) {
          if (field === "name" || field === "email" || field === "password") {
            setError(field as keyof Fields, { message: (messages as string[])[0] });
          }
        }
      } else {
        setError("root", {
          message: typeof body?.error === "string"
            ? body.error
            : isEdit ? "Failed to update user." : "Failed to create user.",
        });
      }
    }
  };

  const prefix = isEdit ? "edit-" : "";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "New user"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}name`}>Name</Label>
            <Input
              id={`${prefix}name`}
              placeholder="Jane Smith"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}email`}>Email</Label>
            <Input
              id={`${prefix}email`}
              type="email"
              placeholder="jane@example.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}password`}>
              Password{" "}
              {isEdit && (
                <span className="text-muted-foreground text-xs font-normal">
                  (leave blank to keep unchanged)
                </span>
              )}
            </Label>
            <Input
              id={`${prefix}password`}
              type="password"
              placeholder="min. 8 characters"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-destructive text-sm">{errors.root.message}</p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isEdit
              ? isSubmitting ? "Saving…" : "Save changes"
              : isSubmitting ? "Creating…" : "Create user"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
