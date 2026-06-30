import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* PATCH /api/admin/submissions/[id] — approve or decline a submission */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const status: string      = body.status ?? "";
    const reviewed_by: string = (body.reviewed_by ?? "admin").trim();

    if (!["approved", "declined"].includes(status)) {
      return Response.json({ error: "Invalid status." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("submissions")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("admin submission update error:", error);
      return Response.json({ error: "Database error." }, { status: 500 });
    }

    return Response.json({ data });
  } catch (err) {
    console.error("PATCH /api/admin/submissions/[id]:", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
