/** Comprova si el rol de Better Auth inclou `admin` (pot ser una llista separada per comes). */
export function isAdminRole(role: string | null | undefined) {
  return (role ?? "user")
    .split(",")
    .map((r) => r.trim())
    .includes("admin")
}
