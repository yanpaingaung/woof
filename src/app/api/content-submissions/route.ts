import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { registerWallet } from "@/lib/streak";

function extractTweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/i);
  return m ? m[1] : null;
}

function mapRow(s: Record<string, unknown>) {
  return {
    id:          s.id,
    xHandle:     s.x_handle,
    title:       s.title,
    contentUrl:  s.content_url,
    status:      s.status,
    points:      s.points,
    submittedAt: s.submitted_at,
    reviewedAt:  s.reviewed_at ?? null,
    reviewedBy:  s.reviewed_by ?? null,
  };
}

export async function GET(req: NextRequest) {
  const x_handle = new URL(req.url).searchParams.get("x_handle")?.toLowerCase();
  let query = supabaseAdmin.from("content_submissions").select("*").order("submitted_at", { ascending: false });
  if (x_handle) query = query.eq("x_handle", x_handle);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data: (data ?? []).map(mapRow) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const x_handle    = (body.x_handle   ?? "").trim().toLowerCase();
    const title       = (body.title       ?? "").trim();
    const content_url = (body.content_url ?? "").trim();
    const points      = typeof body.points === "number" && body.points > 0 ? Math.round(body.points) : 1000;

    if (!x_handle || !title || !content_url) {
      return Response.json({ error: "Missing fields." }, { status: 400 });
    }
    if (!/^https?:\/\/(www\.|mobile\.)?(twitter\.com|x\.com)\/.+\/status\/\d+/i.test(content_url)) {
      return Response.json({ error: "Only Twitter/X post links are accepted (must include /status/ID)." }, { status: 400 });
    }

    // Extract tweet ID
    const tweet_id = extractTweetId(content_url);
    if (!tweet_id) {
      return Response.json({ error: "Could not extract tweet ID from URL." }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("content_submissions")
      .select("id")
      .eq("tweet_id", tweet_id)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { error: "This Twitter/X post has already been submitted. Please submit a different post." },
        { status: 409 },
      );
    }

    // Insert — unique index is a safety net for concurrent submissions
    const { data, error } = await supabaseAdmin
      .from("content_submissions")
      .insert({ x_handle, title, content_url, tweet_id, status: "pending", points })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json(
          { error: "This Twitter/X post has already been submitted. Please submit a different post." },
          { status: 409 },
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Register wallet ↔ username mapping so the approval route can look up the wallet later
    const wallet = typeof body.wallet === "string" ? body.wallet.trim().toLowerCase() : "";
    if (wallet.startsWith("0x")) {
      try { await registerWallet(wallet, x_handle); } catch {}
    }

    return Response.json({ data: mapRow(data) }, { status: 201 });
  } catch {
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
