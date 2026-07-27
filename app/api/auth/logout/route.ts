import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * API Route: /api/auth/logout
 * Handles both GET and POST requests for logging out a user.
 * Since standard HTML forms submission (e.g. from the sidebar) navigates the browser,
 * both methods redirect the user to the login page instead of returning JSON.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  return NextResponse.redirect(`${origin}/login`, { status: 302 });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Redirect to the login page dynamically using the request's origin
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  return NextResponse.redirect(`${origin}/login`, { status: 302 });
}
