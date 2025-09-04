// app/utils/http.ts
export async function httpJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, init);
  const ct = res.headers?.get('content-type') || '';
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url} | CT=${ct} | BODY=${body.slice(0,500)}`);
  }
  if (!ct.includes('application/json')) {
    const body = await res.text();
    throw new Error(`Expected JSON, got CT=${ct}. BODY=${body.slice(0,500)}`);
  }
  return res.json();
}
