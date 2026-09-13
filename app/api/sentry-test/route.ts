// TEMPORARY: throws on purpose so Sentry's reporting can be checked on the
// live app. Only fires with the token below, so nobody can spam errors with
// it. Remove after the test.
export const dynamic = "force-dynamic";

const TOKEN = "bcdb71709a96f16a48180a238f6507778de2";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("token") !== TOKEN) {
    return new Response("Not found", { status: 404 });
  }
  throw new Error("Sentry test: deliberate error from /api/sentry-test (safe to ignore)");
}
