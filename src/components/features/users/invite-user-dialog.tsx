"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MANAGER", "REP", "VIEWER"]),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent: () => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onInviteSent,
}: InviteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      role: "REP",
    },
  });

  const selectedRole = watch("role");

  async function onSubmit(data: InviteFormData) {
    try {
      setLoading(true);

      const res = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send invitation");
      }

      const result = await res.json();

      toast.success("Invitation sent successfully!");
      setInvitationToken(result.invitation.token);
      onInviteSent();

      // Don't close dialog immediately so user can copy the token
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send invitation"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    reset();
    setInvitationToken(null);
    setCopied(false);
    onOpenChange(false);
  }

  function copyInviteLink() {
    if (!invitationToken) return;

    const inviteLink = `${window.location.origin}/invite/accept?token=${invitationToken}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invitation link copied to clipboard");

    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            {invitationToken
              ? "Invitation sent! Share this link with the new user."
              : "Send an invitation to add a new member to your organization."}
          </DialogDescription>
        </DialogHeader>

        {invitationToken ? (
          // Show invitation link after successful invite
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/invite/accept?token=${invitationToken}`}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={copyInviteLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                This link will expire in 7 days.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          // Show invitation form
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                {...register("email")}
                disabled={loading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setValue("role", value as any)}
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
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
