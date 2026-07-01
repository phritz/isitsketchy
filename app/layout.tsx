import type { Metadata } from "next";
import { MantineProvider, mantineHtmlProps } from "@mantine/core";
import "@mantine/core/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Is It Sketchy?",
  description: "Is It Sketchy?",
};

// The app is light-only for now. `mantineHtmlProps` statically sets
// data-mantine-color-scheme="light", so Mantine's <ColorSchemeScript> (an inline
// script that reads localStorage before hydration) is unnecessary. If a color
// scheme toggle is added later, re-add <ColorSchemeScript /> inside <head>.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <body>
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  );
}
