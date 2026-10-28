import { AppShell } from "./ui/AppShell";

export function PageShell({
  children,
  contentClassName
}: Readonly<{
  children: React.ReactNode;
  contentClassName?: string;
}>) {
  return <AppShell contentClassName={contentClassName}>{children}</AppShell>;
}
