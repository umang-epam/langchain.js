import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stream chat",
};

export default function StreamChatLayout({
  children,
}: LayoutProps<"/stream-chat">) {
  return children;
}
