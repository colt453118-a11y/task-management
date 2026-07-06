import { getAuth } from '@/lib/auth';

let _handler: { POST: (req: Request) => Promise<Response>; GET: (req: Request) => Promise<Response> } | null = null;

async function getHandler() {
  if (!_handler) {
    const { toNextJsHandler } = await import('better-auth/next-js');
    _handler = toNextJsHandler(getAuth());
  }
  return _handler;
}

export async function POST(request: Request) {
  const h = await getHandler();
  return h.POST(request);
}

export async function GET(request: Request) {
  const h = await getHandler();
  return h.GET(request);
}
