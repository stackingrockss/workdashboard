"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const editUserSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "REP", "VIEWER"]).optional(),
  managerId: z.string().nullable().optional(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "REP" | "VIEWER";
  managerId: string | null;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  allUsers: User[];
  onUserUpdated: () => void;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  allUsers,
  onUserUpdated,
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      role: user.role,
      managerId: user.managerId,
    },
  });

  const selectedRole = watch("role");
  const selectedManagerId = watch("managerId");

  // Reset form when user changes
  useEffect(() => {
    reset({
      role: user.role,
      managerId: user.managerId,
    });
  }, [user, reset]);

  // Filter potential managers (exclude self and direct reports)
  const potentialManagers = allUsers.filter(
    (u) => u.id !== user.id && ["ADMIN", "MANAGER"].includes(u.role)
  );

  async function onSubmit(data: EditUserFormData) {
    try {
      setLoading(true);

      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(data.role !== user.role && { role: data.role }),
          ...(data.managerId !== user.managerId && { managerId: data.managerId }),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }

      toast.success("User updated successfully!");
      onUserUpdated();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update user"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update role and manager assignment for {user.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{user.email}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue("role", value as UserRole)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REP">Rep - Can manage own opportunities</SelectItem>
                <SelectItem value="MANAGER">
                  Manager - Can manage team opportunities
                </SelectItem>
                <SelectItem value="ADMIN">
                  Admin - Full organization access
                </SelectItem>
                <SelectItem value="VIEWER">
                  Viewer - Read-only access
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Only admins can change user roles
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager">Manager</Label>
            <Select
              value={selectedManagerId || "none"}
              onValueChange={(value) =>
                setValue("managerId", value === "none" ? null : value)
              }
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Manager</SelectItem>
                {potentialManagers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name} ({manager.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Managers and admins can assign reporting relationships
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
