"use client";

import {
  BriefcaseBusinessIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  LogOutIcon,
  SettingsIcon,
  TruckIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
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
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";
import { Logo } from "./brand/logo";
import { Separator } from "./ui/separator";

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
  items: [
    { title: "Usuàries", url: "/usuaries", icon: UserRoundIcon },
    { title: "Ajustos", url: "/ajustos", icon: SettingsIcon },
  ],
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
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Inici">
              <Link href="/" className="flex items-center gap-2 p-2">
                <Logo
                  className="w-10! ml-1 block h-auto! my-2 max-w-[calc(100%-8px)]"
                  variant="icon"
                />
                <Separator orientation="vertical" className="bg-primary/70" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-xs font-medium text-primary">
                    Gestió pressupostària
                  </span>
                  <span className="truncate text-xs font-medium text-primary">
                    de projectes
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs font-medium tracking-wide uppercase">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  isActive={pathname.startsWith("/compte")}
                  tooltip="El meu compte"
                  className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
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
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                side="right"
                align="end"
                sideOffset={4}
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
