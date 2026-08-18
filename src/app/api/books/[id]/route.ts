import { NextRequest, NextResponse } from 'next/server';
import { getBookById } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const book = await getBookById(id);
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json({ book });
  } catch (error: any) {
    console.error('Error fetching book:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch book' }, { status: 500 });
  }
}
