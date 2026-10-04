import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent chat",
};

export default function ChatLayout({ children }: LayoutProps<"/chat">) {
  return children;
}
