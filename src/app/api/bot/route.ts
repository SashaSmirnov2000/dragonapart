import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ message: "Test OK! I am alive" });
}

export async function POST(req: Request) {
  return NextResponse.json({ ok: true });
}