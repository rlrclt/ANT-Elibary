import type { Metadata } from "next";
import { BannersClient } from "./components/banners-client";

export const metadata: Metadata = {
  title: "จัดการ Banner",
};

export default function BannersPage() {
  return <BannersClient />;
}