import { supabaseAdmin } from "./supabase-admin";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function tomorrowUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Called on submit. Creates or links a daily_streaks record for wallet ↔ username.
 * If a walletless record already exists for this username (created by checkAndAwardStreak),
 * links the real wallet to it instead of creating a duplicate.
 * Does NOT advance the streak — only the approval path does that.
 */
export async function registerWallet(wallet: string, x_username: string): Promise<void> {
  // Check for an existing record by username (may have been created walletlessly)
  const { data: existing } = await supabaseAdmin
    .from("daily_streaks")
    .select("id, wallet")
    .eq("x_username", x_username)
    .maybeSingle();

  if (existing) {
    // Link real wallet to the record if it has none yet
    if (!existing.wallet) {
      await supabaseAdmin
        .from("daily_streaks")
        .update({ wallet })
        .eq("id", existing.id);
    }
    return;
  }

  // No record at all — create fresh with wallet linked
  await supabaseAdmin
    .from("daily_streaks")
    .upsert(
      { wallet, x_username, current_streak: 0, last_active_date: "1970-01-01", total_7day_rewards: 0 },
      { onConflict: "wallet", ignoreDuplicates: true },
    );
}

/**
 * Core streak advancement. Idempotent per calendar day.
 * Accepts a null wallet for users who haven't connected their wallet yet.
 * Uses the row ID for atomic updates so null-wallet rows are handled safely.
 * On day 7: awards 1000 points and resets to streak 1 (today counts as Day 1 of new cycle).
 */
export async function updateStreak(
  wallet: string | null,
  x_username: string,
): Promise<{ current_streak: number; rewarded: boolean }> {
  const today = todayUTC();
  const yesterday = yesterdayUTC();

  // Look up by wallet when available, by username+no-wallet when not
  const { data: existing } = await (
    wallet
      ? supabaseAdmin.from("daily_streaks").select("*").eq("wallet", wallet)
      : supabaseAdmin.from("daily_streaks").select("*").eq("x_username", x_username).is("wallet", null)
  ).maybeSingle();

  if (!existing) {
    // Insert brand-new record directly at streak 1
    await supabaseAdmin.from("daily_streaks").insert({
      wallet,
      x_username,
      current_streak: 1,
      last_active_date: today,
      total_7day_rewards: 0,
    });
    return { current_streak: 1, rewarded: false };
  }

  // Already counted today — idempotent
  if (existing.last_active_date >= today) {
    return { current_streak: existing.current_streak, rewarded: false };
  }

  const new_streak =
    existing.last_active_date === yesterday ? existing.current_streak + 1 : 1;
  const rewarded = new_streak >= 7;

  // Atomic guard by row ID: only update if today hasn't been claimed yet
  const { data: updated } = await supabaseAdmin
    .from("daily_streaks")
    .update({
      x_username,
      current_streak: rewarded ? 1 : new_streak,
      last_active_date: today,
      total_7day_rewards: rewarded
        ? existing.total_7day_rewards + 1
        : existing.total_7day_rewards,
      last_reward_date: rewarded ? today : existing.last_reward_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .lt("last_active_date", today)
    .select()
    .maybeSingle();

  // Another concurrent request already claimed today — skip reward
  if (!updated) {
    return { current_streak: existing.current_streak, rewarded: false };
  }

  if (rewarded) {
    await Promise.all([
      supabaseAdmin.from("adjustments").insert({
        x_handle: x_username,
        pts: 1000,
        reason: "7-Day Daily Streak Reward",
      }),
      supabaseAdmin.from("streak_rewards").insert({
        wallet: wallet ?? null,
        x_username,
        points: 1000,
        reward_type: "7-Day Daily Streak",
      }),
    ]);
  }

  return { current_streak: rewarded ? 1 : new_streak, rewarded };
}

/**
 * Called after admin APPROVES a submission.
 * Counts today's total approved submissions (replies + content) for x_username.
 * When the count reaches 30 for the first time that day, advances the streak by 1.
 * Works for users with or without a connected wallet.
 */
export async function checkAndAwardStreak(x_username: string): Promise<void> {
  const today = todayUTC();
  const tomorrow = tomorrowUTC();

  const [repliesRes, contentRes] = await Promise.all([
    supabaseAdmin
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("x_username", x_username)
      .eq("status", "approved")
      .gte("submitted_at", today)
      .lt("submitted_at", tomorrow),
    supabaseAdmin
      .from("content_submissions")
      .select("*", { count: "exact", head: true })
      .eq("x_handle", x_username)
      .eq("status", "approved")
      .gte("submitted_at", today)
      .lt("submitted_at", tomorrow),
  ]);

  const totalApproved = (repliesRes.count ?? 0) + (contentRes.count ?? 0);
  if (totalApproved < 30) return;

  // Look up by x_username — works whether or not a wallet is linked
  const { data: record } = await supabaseAdmin
    .from("daily_streaks")
    .select("wallet")
    .eq("x_username", x_username)
    .maybeSingle();

  // Pass wallet (null if unlinked or no record yet — updateStreak handles both)
  await updateStreak(record?.wallet ?? null, x_username);
}
