import { RootLayoutShell } from "@/components/root-layout-shell";

export default function ChineseLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootLayoutShell lang="zh-CN">{children}</RootLayoutShell>;
}