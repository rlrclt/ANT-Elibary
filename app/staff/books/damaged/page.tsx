import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getDamagedRecordsAction,
  getDamagedStatsAction,
  getDamagedMembersAction,
} from "./actions";
import { DamagedBooksClient } from "./components/damaged-books-client";

export const metadata = {
  title: "หนังสือชำรุด",
};

export default async function DamagedBooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/member");
  }

  const [{ data: records, error }, { data: stats }, { data: members }] =
    await Promise.all([
      getDamagedRecordsAction(),
      getDamagedStatsAction(),
      getDamagedMembersAction(),
    ]);

  return (
    <DamagedBooksClient
      initialRecords={records || []}
      initialStats={
        stats ?? { unresolved: 0, totalFine: 0, paid: 0, replaced: 0 }
      }
      initialMembers={members || []}
      error={error}
    />
  );
}
