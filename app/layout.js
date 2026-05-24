import PublicThemePicker from "@/components/public/PublicThemePicker";

export default function RootLayout({ children }) {
  return (
    <html>
      <body style={{ margin: 0 }}>
        <PublicThemePicker />
        {children}
      </body>
    </html>
  );
}
