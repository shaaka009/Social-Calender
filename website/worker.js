/**
 * Serve the password-reset form for /reset-password/<uid>/<token> paths.
 * Static assets alone can't map those dynamic paths; this runs only when
 * assets.run_worker_first matches (see wrangler.toml).
 */
export default {
  async fetch(request, env) {
    const resetPage = new URL("/reset-password/", request.url);
    return env.ASSETS.fetch(new Request(resetPage, request));
  },
};
