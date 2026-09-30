import 'server-only';
export function log(event: string, fields: { code?: string; requestId?: string; durationMs?: number } = {}) {
  console.log(JSON.stringify({ event, ...fields, time: new Date().toISOString() }));
}
