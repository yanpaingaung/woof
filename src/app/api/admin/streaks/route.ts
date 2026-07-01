import { supabaseAdmin } from "@/lib/supabase-admin";

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }
function tomorrowUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* GET /api/admin/streaks — all streak records + full reward history.
   Auto-backfills daily_streaks rows for users who have hit 30 approved
   submissions today but have no existing record. */
export async function GET() {
  const today    = todayUTC();
  const tomorrow = tomorrowUTC();

  // Fetch everything in parallel
  const [streaksRes, rewardsRes, repliesRes, contentRes] = await Promise.all([
    supabaseAdmin
      .from("daily_streaks")
      .select("*")
      .order("current_streak", { ascending: false }),
    supabaseAdmin
      .from("streak_rewards")
      .select("*")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("submissions")
      .select("x_username")
      .eq("status", "approved")
      .gte("submitted_at", today)
      .lt("submitted_at", tomorrow),
    supabaseAdmin
      .from("content_submissions")
      .select("x_handle")
      .eq("status", "approved")
      .gte("submitted_at", today)
      .lt("submitted_at", tomorrow),
  ]);

  if (streaksRes.error) return Response.json({ error: streaksRes.error.message }, { status: 500 });
  if (rewardsRes.error) return Response.json({ error: rewardsRes.error.message }, { status: 500 });

  // Build per-username approved count for today (replies + content combined)
  const todayCounts: Record<string, number> = {};
  for (const row of repliesRes.data ?? []) {
    todayCounts[row.x_username] = (todayCounts[row.x_username] ?? 0) + 1;
  }
  for (const row of contentRes.data ?? []) {
    todayCounts[row.x_handle] = (todayCounts[row.x_handle] ?? 0) + 1;
  }

  // Backfill: insert daily_streaks rows for qualifying users who have no record yet
  const existingUsernames = new Set((streaksRes.data ?? []).map(r => r.x_username));
  const missing = Object.entries(todayCounts)
    .filter(([username, count]) => count >= 30 && !existingUsernames.has(username))
    .map(([username]) => ({
      wallet: null,
      x_username: username,
      current_streak: 1,
      last_active_date: today,
      total_7day_rewards: 0,
    }));

  let freshRecords: typeof streaksRes.data = streaksRes.data ?? [];

  if (missing.length > 0) {
    const { data: inserted } = await supabaseAdmin
      .from("daily_streaks")
      .insert(missing)
      .select();
    if (inserted) {
      freshRecords = [...freshRecords, ...inserted];
      // Re-sort by current_streak desc
      freshRecords.sort((a, b) => b.current_streak - a.current_streak);
    }
  }

  // Attach today_approved count to every record
  const streaks = freshRecords.map(r => ({
    ...r,
    today_approved: todayCounts[r.x_username] ?? 0,
  }));

  return Response.json({ streaks, rewards: rewardsRes.data ?? [] });
}
