import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieJar = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieJar.getAll();
        },
        setAll(cookiesList) {
          try {
            for (const item of cookiesList) {
              cookieJar.set(item.name, item.value, item.options);
            }
          } catch {
            // Safe to ignore when called from a read-only Server Component
          }
        },
      },
    }
  );
}