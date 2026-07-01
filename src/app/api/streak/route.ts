import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAndAwardStreak } from "@/lib/streak";

/* GET /api/streak?wallet=<address>&x_username=<handle>
   Looks up by wallet first; falls back to x_username for walletless records. */
export async function GET(req: NextRequest) {
  const url        = new URL(req.url);
  const wallet     = url.searchParams.get("wallet")?.toLowerCase() ?? "";
  const x_username = url.searchParams.get("x_username")?.toLowerCase() ?? "";

  if (!wallet && !x_username) {
    return Response.json({ error: "Missing wallet or x_username." }, { status: 400 });
  }

  // Primary lookup: wallet (covers wallet-linked records)
  if (wallet) {
    const { data, error } = await supabaseAdmin
      .from("daily_streaks")
      .select("*")
      .eq("wallet", wallet)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (data)  return Response.json({ data });
  }

  // Fallback: x_username (covers walletless backfilled records)
  if (x_username) {
    const { data, error } = await supabaseAdmin
      .from("daily_streaks")
      .select("*")
      .eq("x_username", x_username)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  }

  return Response.json({ data: null });
}

/* POST /api/streak — trigger checkAndAwardStreak for a user and return updated streak.
   Called by the client when todayCount >= 30 but streak not yet credited for today. */
export async function POST(req: NextRequest) {
  const { x_username } = await req.json();
  if (!x_username) return Response.json({ error: "Missing x_username." }, { status: 400 });

  await checkAndAwardStreak(x_username.toLowerCase());

  const { data } = await supabaseAdmin
    .from("daily_streaks")
    .select("*")
    .eq("x_username", x_username.toLowerCase())
    .maybeSingle();

  return Response.json({ data });
}
