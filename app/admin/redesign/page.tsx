import { redirect } from "next/navigation";

// /admin/redesign opens on the Home tab, client and all carried along.
export default async function RedesignIndex({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] != null)).toString();
  redirect(`/admin/redesign/home${qs ? `?${qs}` : ""}`);
}
