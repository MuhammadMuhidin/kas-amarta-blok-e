import WhatsappDisabledLoginNotice from "@/components/login/WhatsappDisabledLoginNotice";
import { getCurrentAdminSession } from "@/lib/adminSession";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginLayout({ children }) {
  const session = await getCurrentAdminSession({
    cookies: cookies(),
    headers: headers(),
  });

  if (session) {
    redirect("/admin");
  }

  return (
    <>
      <WhatsappDisabledLoginNotice />
      {children}
    </>
  );
}
