// Replaces the spike Worker: nothing is served from it any more.
export default {
  fetch: () => new Response("Gone.", { status: 410, headers: { "Cache-Control": "no-store" } }),
};
