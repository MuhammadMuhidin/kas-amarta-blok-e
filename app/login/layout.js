import WhatsappDisabledLoginNotice from "@/components/login/WhatsappDisabledLoginNotice";

export default function LoginLayout({ children }) {
  return (
    <>
      <WhatsappDisabledLoginNotice />
      {children}
    </>
  );
}
