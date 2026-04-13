import { addAlert, getAlerts, parseFactSetEmail } from '@/lib/factset';
import { publish } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  let parsed: ReturnType<typeof parseFactSetEmail>;

  if (contentType.includes('application/json')) {
    const body = await request.json();
    parsed = parseFactSetEmail({
      subject: body.subject,
      raw: body.raw,
      from: body.from,
      date: body.date,
    });
  } else {
    const raw = await request.text();
    const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
    const fromMatch = raw.match(/^From:\s*(.+)$/im);
    const dateMatch = raw.match(/^Date:\s*(.+)$/im);
    parsed = parseFactSetEmail({
      subject: subjectMatch?.[1],
      raw,
      from: fromMatch?.[1],
      date: dateMatch?.[1],
    });
  }

  addAlert(parsed);
  const alerts = getAlerts();
  const updatedAt = new Date().toISOString();
  publish({ updatedAt, alert: parsed, alerts });

  return Response.json({ ok: true, alert: parsed, updatedAt });
}
