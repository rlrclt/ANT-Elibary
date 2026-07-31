import { createClient } from "@/utils/supabase/server";
import {
  getBooksAction,
  getStatCardsAction,
  getCategoriesAction,
} from "./actions";
import { BooksClient } from "./components/books-client";

export const metadata = {
  title: "จัดการหนังสือ",
};

export default async function StaffBooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [booksResult, statsResult, categoriesResult] = await Promise.all([
    getBooksAction(),
    getStatCardsAction(),
    getCategoriesAction(),
  ]);

  return (
    <BooksClient
      initialBooks={booksResult.data ?? []}
      initialStats={
        statsResult.data ?? {
          titles: 0,
          totalCopies: 0,
          availableCopies: 0,
          damagedLost: 0,
        }
      }
      categories={categoriesResult.data ?? []}
    />
  );
}