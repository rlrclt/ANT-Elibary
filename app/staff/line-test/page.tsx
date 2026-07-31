import type { Metadata } from "next";
import { LineTestClient } from "./components/line-test-client";

export const metadata: Metadata = {
  title: "ทดสอบแจ้งเตือน LINE",
};

export default function LineTestPage() {
  return <LineTestClient />;
}