import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("rewards")
    .select("key, label, pts, description")
    .order("key");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, pts } = body;
    if (!key || typeof pts !== "number") {
      return Response.json({ error: "Missing key or pts" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("rewards")
      .update({ pts: Math.round(pts), updated_at: new Date().toISOString() })
      .eq("key", key)
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
