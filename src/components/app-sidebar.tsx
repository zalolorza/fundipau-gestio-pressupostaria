"use client";

import {
  BriefcaseBusinessIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  LogOutIcon,
  TruckIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";

const navBase = [
  {
    title: "Gestió",
    items: [
      { title: "Projectes", url: "/projectes", icon: BriefcaseBusinessIcon },
      { title: "Clients", url: "/clients", icon: UsersIcon },
    ],
  },
  {
    title: "Costos",
    items: [
      { title: "Factures de proveïdors", url: "/factures", icon: FileTextIcon },
      { title: "Proveïdors", url: "/proveidors", icon: TruckIcon },
      { title: "Nòmines", url: "/nomines", icon: WalletIcon },
    ],
  },
];

const navAdmin = {
  title: "Administració",
  items: [{ title: "Usuàries", url: "/usuaris", icon: UserRoundIcon }],
};

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; isAdmin?: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url);
  const navMain = user.isAdmin ? [...navBase, navAdmin] : navBase;

  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="h-auto py-2">
              <Link href="/" className="flex items-center gap-4">
                <Image
                  src="/logo.svg"
                  alt="Fundipau"
                  width={56}
                  height={45}
                  priority
                />
                <Separator orientation="vertical" className="bg-primary/50" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="text-xs font-mediu max-w-[10em] text-primary py-1">
                    Gestió pressupostària de projectes
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {navMain.map((group) => (
              <SidebarMenuItem key={group.title}>
                <SidebarMenuButton className="pointer-events-none text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.title}
                </SidebarMenuButton>
                <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                  {group.items.map((item) => (
                    <SidebarMenuSubItem key={item.url}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive(item.url)}
                      >
                        <Link href={item.url}>
                          <item.icon />
                          {item.title}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  isActive={pathname.startsWith("/compte")}
                  title="El meu compte"
                >
                  <Avatar className="rounded-lg after:rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {user.name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenuItem asChild>
                  <Link href="/compte">
                    <UserRoundIcon />
                    El meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={async () => {
                    await signOut();
                    router.push("/login");
                    router.refresh();
                  }}
                >
                  <LogOutIcon />
                  Tanca la sessió
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
