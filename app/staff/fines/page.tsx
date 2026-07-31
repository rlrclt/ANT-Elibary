import type { Metadata } from "next";
import { FinesClient } from "./components/fines-client";

export const metadata: Metadata = {
  title: "ตั้งค่าค่าปรับ",
};

export default function FinesPage() {
  return <FinesClient />;
}