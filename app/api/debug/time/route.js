export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    unix: Math.floor(Date.now() / 1000),
    iso: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}