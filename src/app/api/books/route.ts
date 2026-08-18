import { NextResponse } from 'next/server';
import { getAllBooks } from '@/lib/db';

export async function GET() {
  try {
    const books = await getAllBooks();
    return NextResponse.json({ books });
  } catch (error: any) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch books' }, { status: 500 });
  }
}
