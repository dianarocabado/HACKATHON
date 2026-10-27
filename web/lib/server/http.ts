// Shared helpers for API route handlers.

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Run a handler; ApiError becomes its status code, anything else a logged 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return Response.json({ error: err.message }, { status: err.status });
    console.error("api: unhandled error", err);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}

/** Parse a JSON request body; an empty body is `{}`. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through
  }
  throw new ApiError(400, "body must be a JSON object");
}
