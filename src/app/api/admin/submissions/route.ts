import { supabaseAdmin } from "@/lib/supabase-admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(s: any) {
  return {
    id:          s.id,
    user:        s.x_username,
    xHandle:     s.x_username,
    link:        s.tweet_url,
    tweetId:     s.tweet_id,
    points:      s.points,
    status:      s.status,
    submittedAt: s.submitted_at,
    reviewedAt:  s.reviewed_at ?? null,
    reviewedBy:  s.reviewed_by ?? null,
  };
}

/* GET /api/admin/submissions — all submissions, newest first */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("admin submissions select error:", error);
      return Response.json({ error: "Database error." }, { status: 500 });
    }

    return Response.json({ data: (data ?? []).map(mapRow) });
  } catch (err) {
    console.error("GET /api/admin/submissions:", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
