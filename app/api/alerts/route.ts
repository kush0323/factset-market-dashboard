import { getAlerts } from '@/lib/factset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return Response.json({
    updatedAt: new Date().toISOString(),
    alerts: getAlerts(),
  });
}
