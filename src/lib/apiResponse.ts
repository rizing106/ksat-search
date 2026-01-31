export const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type ResponseInitWithHeaders = Omit<ResponseInit, "headers"> & {
  headers?: HeadersInit;
};

export function json(data: unknown, init: ResponseInitWithHeaders = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("Cache-Control", noStoreHeaders["Cache-Control"]);

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function error(status: number, message: string, code = "INTERNAL_ERROR") {
  return json({ error: message, code }, { status });
}
