import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getHistoryDataAction } from "./actions";
import { HistoryClient } from "./components/history-client";

export const metadata = {
  title: "ประวัติและรายงานการยืม-คืน",
};

export default async function HistoryPage() {
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

  const { data: historyRecords, error } = await getHistoryDataAction();

  return (
    <HistoryClient 
      initialRecords={historyRecords || []} 
      error={error} 
    />
  );
}
