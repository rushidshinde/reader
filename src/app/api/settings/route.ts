import { NextRequest, NextResponse } from 'next/server';
import { getReaderSettings, saveReaderSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = await getReaderSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: any = await req.json();
    const settings = await saveReaderSettings(body);
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
