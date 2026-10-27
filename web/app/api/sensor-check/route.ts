import type { Category } from "@contracts/types";
import { checkSensor } from "@/lib/server/sensors";

const CATEGORIES = new Set<Category>(["heat", "air", "noise", "water", "biodiversity", "waste", "mobility", "other"]);

// GET /api/sensor-check?lat=&lng=[&category=heat|air] -> SensorCheck (category defaults to heat)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const category = params.get("category") ?? "heat";
  if (!params.get("lat") || !params.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat and lng are required numbers" }, { status: 400 });
  }
  if (!CATEGORIES.has(category as Category)) {
    return Response.json({ error: `unknown category: ${category}` }, { status: 400 });
  }
  return Response.json(await checkSensor({ lat, lng, category: category as Category }));
}
