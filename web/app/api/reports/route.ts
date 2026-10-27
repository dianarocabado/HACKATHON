import { handle, readBody } from "@/lib/server/http";
import { createReport, listReports, parseNewReport } from "@/lib/server/reports";

// GET /api/reports?since=<ISO> -> Report[]
export function GET(request: Request) {
  return handle(async () => Response.json(await listReports(new URL(request.url).searchParams.get("since"))));
}

// POST /api/reports { transcript, lat?, lng?, placeName? } -> Report
export function POST(request: Request) {
  return handle(async () => {
    const report = await createReport(parseNewReport(await readBody(request)));
    return Response.json(report, { status: 201 });
  });
}
