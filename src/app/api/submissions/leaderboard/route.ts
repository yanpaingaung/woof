import { supabaseAdmin } from "@/lib/supabase-admin";

/* GET /api/submissions/leaderboard
   Returns top contributors from reply submissions + content submissions + adjustments. */
export async function GET() {
  try {
    const [repliesRes, contentRes, adjRes] = await Promise.all([
      supabaseAdmin.from("submissions").select("x_username, points").eq("status", "approved"),
      supabaseAdmin.from("content_submissions").select("x_handle, points").eq("status", "approved"),
      supabaseAdmin.from("adjustments").select("x_handle, pts"),
    ]);

    const byUser: Record<string, number> = {};

    (repliesRes.data ?? []).forEach((s: { x_username: string; points: number }) => {
      byUser[s.x_username] = (byUser[s.x_username] ?? 0) + s.points;
    });

    (contentRes.data ?? []).forEach((s: { x_handle: string; points: number }) => {
      byUser[s.x_handle] = (byUser[s.x_handle] ?? 0) + s.points;
    });

    (adjRes.data ?? []).forEach((a: { x_handle: string; pts: number }) => {
      byUser[a.x_handle] = (byUser[a.x_handle] ?? 0) + a.pts;
    });

    const contributors = Object.entries(byUser)
      .filter(([, pts]) => pts > 0)
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    return Response.json({ data: contributors });
  } catch (err) {
    console.error("GET /api/submissions/leaderboard:", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
