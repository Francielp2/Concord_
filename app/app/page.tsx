import type { Metadata } from "next";
import { LiveApp } from "@/components/live/LiveApp";
import { THEME_BOOT_SCRIPT } from "@/lib/client/themeBoot";

export const metadata: Metadata = {
  title: "Concord",
};

export default function AppPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      <LiveApp />
    </>
  );
}
