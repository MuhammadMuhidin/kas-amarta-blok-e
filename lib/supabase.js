import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          cache: "no-store", // Ini memastikan fetch ke API Supabase tidak di-cache
        });
      },
    },
  }
)
