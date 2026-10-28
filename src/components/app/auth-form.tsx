"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";
import { Logo } from "../brand/logo";

export function AuthForm({
  mode,
  allowSignup,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  mode: "login" | "signup";
  allowSignup?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setPending(true);
    const { error } =
      mode === "login"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: String(f.get("name")) });
    setPending(false);
    if (error) {
      toast.error(
        error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Correu o contrasenya incorrectes"
          : (error.message ?? "No s'ha pogut iniciar la sessió"),
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className={cn("flex flex-col gap-12", className)} {...props}>
      <div className="flex justify-center">
        <Logo className="w-34 h-auto" color="blanc" variant="icon" />
      </div>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="p-6 md:p-8 flex flex-col justify-center min-h-100"
            onSubmit={onSubmit}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex flex-col gap-2">
                  <h1 className="font-heading text-2xl font-bold">
                    {mode === "login" ? "Inicia la sessió" : "Crea un compte"}
                  </h1>
                  <p className="text-balance text-muted-foreground">
                    {mode === "login"
                      ? ""
                      : "Introdueix les teves dades per crear un compte"}
                  </p>
                </div>
              </div>
              {mode === "signup" && (
                <Field>
                  <FieldLabel htmlFor="name">Nom</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    required
                    autoComplete="name"
                    className="min-h-10"
                  />
                </Field>
              )}
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Contrasenya</FieldLabel>
                  {mode === "login" && (
                    <Link
                      href="/recuperar-contrasenya"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      No recordo la meva contrasenya
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    className="min-h-10 pe-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      showPassword
                        ? "Amaga la contrasenya"
                        : "Mostra la contrasenya"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground [&_svg]:size-5"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
              </Field>
              <Field>
                <Button
                  type="submit"
                  size="lg"
                  disabled={pending}
                  className="w-full"
                >
                  {pending
                    ? "Un moment…"
                    : mode === "login"
                      ? "Entra"
                      : "Crea el compte"}
                </Button>
              </Field>
              {mode === "login" && allowSignup && (
                <FieldDescription className="text-center">
                  No tens compte?{" "}
                  <Link
                    href="/registre"
                    className="underline-offset-4 hover:underline"
                  >
                    Registra&apos;t
                  </Link>
                </FieldDescription>
              )}
              {mode === "signup" && (
                <FieldDescription className="text-center">
                  Ja tens compte?{" "}
                  <Link
                    href="/login"
                    className="underline-offset-4 hover:underline"
                  >
                    Inicia la sessió
                  </Link>
                </FieldDescription>
              )}
            </FieldGroup>
          </form>
          <div className="relative hidden min-h-80 bg-primary md:block">
            <Image
              src="/quisom-fundipau.webp"
              alt="Acció de Fundipau: abolim les armes nuclears"
              fill
              priority
              sizes="(max-width: 768px) 0px, 50vw"
              className="object-cover object-[center_40%]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
