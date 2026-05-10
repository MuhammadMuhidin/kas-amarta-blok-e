import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const dynamic = "force-dynamic"

export async function GET() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data, error } = await supabase.rpc("tracelog_backup_summary")

  return Response.json({ data, error })
}