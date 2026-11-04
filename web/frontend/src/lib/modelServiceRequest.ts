/** A network failure is distinct from an HTTP auth, assignment or database error. */
export async function requestModelService(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (failure) {
    if (init.signal?.aborted || (failure instanceof Error && failure.name === 'AbortError')) throw failure;
    throw Error('Unable to reach the Python prediction service. Check Service connection, confirm the Render service is running, and verify HTTPS and allowed website origins (CORS). Supabase sign-in and Admin patient assignments use a separate connection.');
  }
}
