import { NextResponse } from 'next/server';
import { getAllBooks, getDbStatus } from '@/lib/db';

export async function GET() {
  try {
    const books = await getAllBooks();
    const status = await getDbStatus();
    return NextResponse.json({
      environment: status.environment,
      dbEngine: status.dbEngine,
      bookCount: books.length,
      books
    });
  } catch (error: any) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch books' }, { status: 500 });
  }
}
