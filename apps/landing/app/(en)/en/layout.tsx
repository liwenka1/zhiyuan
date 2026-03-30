import { RootLayoutShell } from "@/components/root-layout-shell";

export default function EnglishLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootLayoutShell lang="en">{children}</RootLayoutShell>;
}