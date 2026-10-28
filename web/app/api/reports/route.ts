import { cookies } from "next/headers";
import { getAuth } from "@/lib/server/auth";
import { handle, readBody } from "@/lib/server/http";
import { recordActivity } from "@/lib/server/profile";
import { createReport, listReports, parseNewReport } from "@/lib/server/reports";
import { currentUser, isSecure } from "@/lib/server/session";

// GET /api/reports?since=<ISO> -> Report[]
export function GET(request: Request) {
  return handle(async () => Response.json(await listReports(new URL(request.url).searchParams.get("since"))));
}

// POST /api/reports { transcript, lat?, lng?, placeName? } -> Report
// Signed in: also logged to the profile. The report itself never names the person.
export async function POST(request: Request) {
  const jar = await cookies();
  return handle(async () => {
    const report = await createReport(parseNewReport(await readBody(request)));
    await recordActivity(await currentUser(jar, getAuth(), isSecure(request)), "report", report.id);
    return Response.json(report, { status: 201 });
  });
}
