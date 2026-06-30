import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* ── helpers ─────────────────────────────────────────────────────── */

// Accepts: x.com, www.x.com, mobile.x.com, twitter.com, www.twitter.com
// Accepts: /username/status/ID  and  /i/status/ID
function isValidTweetUrl(url: string): boolean {
  return /^https?:\/\/(www\.|mobile\.)?(twitter\.com|x\.com)\/.+\/status\/\d+/i.test(url);
}

function extractTweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/i);
  return m ? m[1] : null;
}

// Returns null for /i/status/ URLs (no username in path)
function extractTweetHandle(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/(?!i\/)([^/]+)\/status\//i);
  return m ? m[1].toLowerCase() : null;
}

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
    reviewedAt:  s.reviewed_at  ?? null,
    reviewedBy:  s.reviewed_by  ?? null,
  };
}

/* ── POST /api/submissions ───────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const x_username: string = (body.x_username ?? "").trim().toLowerCase();
    const tweet_url:  string = (body.tweet_url  ?? "").trim();

    if (!x_username || !tweet_url) {
      return Response.json({ error: "Missing fields." }, { status: 400 });
    }

    // 1. Validate URL format
    if (!isValidTweetUrl(tweet_url)) {
      return Response.json({ error: "Invalid Twitter/X URL — must be a tweet link (x.com or twitter.com)." }, { status: 400 });
    }

    // 2. Extract tweet ID
    const tweet_id = extractTweetId(tweet_url);
    if (!tweet_id) {
      return Response.json({ error: "Could not extract tweet ID from URL." }, { status: 400 });
    }

    // 3. If URL contains a username (not /i/status/), it must match the connected account
    const urlHandle = extractTweetHandle(tweet_url);
    if (urlHandle !== null && urlHandle !== x_username) {
      return Response.json(
        { error: `Username mismatch — URL is @${urlHandle} but you are connected as @${x_username}.` },
        { status: 400 },
      );
    }

    // 3. Check for duplicate tweet_id
    const { data: existing } = await supabaseAdmin
      .from("submissions")
      .select("id")
      .eq("tweet_id", tweet_id)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { error: "This Twitter/X reply has already been submitted." },
        { status: 409 },
      );
    }

    // 4. Insert — UNIQUE constraint is a safety net for races
    const points = typeof body.points === "number" && body.points > 0 ? Math.round(body.points) : 10;
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .insert({ x_username, tweet_url, tweet_id, status: "pending", points })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json(
          { error: "This Twitter/X reply has already been submitted." },
          { status: 409 },
        );
      }
      console.error("submissions insert error:", error);
      return Response.json({ error: "Database error." }, { status: 500 });
    }

    return Response.json({ data: mapRow(data) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/submissions:", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}

/* ── GET /api/submissions?x_username=<handle> ───────────────────── */
export async function GET(req: NextRequest) {
  try {
    const x_username = new URL(req.url).searchParams.get("x_username")?.toLowerCase();
    if (!x_username) {
      return Response.json({ error: "Missing x_username." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("x_username", x_username)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("submissions select error:", error);
      return Response.json({ error: "Database error." }, { status: 500 });
    }

    return Response.json({ data: (data ?? []).map(mapRow) });
  } catch (err) {
    console.error("GET /api/submissions:", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
