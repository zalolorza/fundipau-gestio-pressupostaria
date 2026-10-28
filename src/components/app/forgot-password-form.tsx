"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    setPending(true);
    const { error } = await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/restablir-contrasenya`,
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "No s'ha pogut enviar el correu");
      return;
    }
    setSent(true);
    toast.success("Si el correu existeix, t’hem enviat un enllaç");
  }

  return (
    <div
      className={cn("flex flex-col gap-4 max-w-md mx-auto", className)}
      {...props}
    >
      <div className="flex justify-center">
        <Logo className="h-auto w-40" color="blanc" variant="icon" />
      </div>
      <Card className="overflow-hidden rounded-xl! p-0">
        <CardContent className="p-0">
          <form
            className="flex min-h-[320px] flex-col justify-center p-6 md:p-8"
            onSubmit={onSubmit}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="font-heading text-2xl font-bold">
                  No recordo la meva contrasenya
                </h1>
                <p className="text-balance text-muted-foreground">
                  {sent
                    ? "Si aquest correu és al sistema, hi trobaràs un enllaç per restablir la contrasenya. Revisa també la carpeta de correu brossa."
                    : "Introdueix el teu correu i t’enviarem un enllaç per restablir-la."}
                </p>
              </div>
              {!sent && (
                <>
                  <Field>
                    <FieldLabel htmlFor="email">Correu electrònic</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="nom@fundipau.org"
                      required
                      autoComplete="email"
                      className="min-h-10"
                    />
                  </Field>
                  <Field>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={pending}
                      className="w-full"
                    >
                      {pending ? "Un moment…" : "Envia l’enllaç"}
                    </Button>
                  </Field>
                </>
              )}
              <FieldDescription className="text-center">
                <Link
                  href="/login"
                  className="underline-offset-4 hover:underline"
                >
                  Torna a l’inici de sessió
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
