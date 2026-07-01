import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAndAwardStreak } from "@/lib/streak";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const status      = body.status as string;
    const reviewed_by = (body.reviewed_by ?? "admin") as string;
    if (!["approved", "declined"].includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("content_submissions")
      .update({ status, reviewed_by, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // On approval, check if the 30-submission threshold is crossed and advance streak
    if (status === "approved" && data?.x_handle) {
      try { await checkAndAwardStreak(data.x_handle); } catch {}
    }

    return Response.json({ data });
  } catch {
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
