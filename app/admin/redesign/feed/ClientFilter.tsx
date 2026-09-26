"use client";

import { useRouter } from "next/navigation";
import Picker from "../Picker";

// Which client the Feed shows: all of them, or one. Kept in the address
// (?client=) so a page of one client's feed can be reloaded or shared.
export default function ClientFilter({ value, clients, hrefFor }: { value: string; clients: { id: number; name: string }[]; /** "" for everyone. */ hrefFor: Record<string, string> }) {
  const router = useRouter();
  return (
    <Picker
      value={value}
      label="Client"
      className="rfd-client"
      options={[{ value: "", label: "All clients" }, ...clients.map((c) => ({ value: String(c.id), label: c.name }))]}
      onChange={(v) => router.push(hrefFor[v] ?? hrefFor[""], { scroll: false })}
    />
  );
}
