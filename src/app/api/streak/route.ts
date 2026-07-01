import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* GET /api/streak?wallet=<address> — current streak for a wallet */
export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) {
    return Response.json({ error: "Missing wallet." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("daily_streaks")
    .select("*")
    .eq("wallet", wallet)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data });
}
