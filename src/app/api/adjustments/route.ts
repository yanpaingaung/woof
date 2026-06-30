import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function mapRow(a: Record<string, unknown>) {
  return {
    id:          a.id,
    user:        a.x_handle,
    pts:         String(a.pts),
    reason:      a.reason,
    submittedAt: a.submitted_at,
  };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("adjustments")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data: (data ?? []).map(mapRow) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const x_handle = (body.user ?? "").trim().toLowerCase().replace(/^@/, "");
    const pts      = parseInt(body.pts, 10);
    const reason   = (body.reason ?? "").trim();
    if (!x_handle || isNaN(pts)) {
      return Response.json({ error: "Missing fields." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("adjustments")
      .insert({ x_handle, pts, reason })
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data: mapRow(data) }, { status: 201 });
  } catch {
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
