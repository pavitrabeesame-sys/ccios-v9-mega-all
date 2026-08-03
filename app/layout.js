import "./globals.css";

export const metadata = {
  title: "CCIOS V9",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}