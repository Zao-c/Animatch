import { AppShell } from "./ui/AppShell";

export function PageShell({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
