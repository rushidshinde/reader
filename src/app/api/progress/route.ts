import { NextRequest, NextResponse } from 'next/server';
import { getBookById, saveReadingProgress } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId');
    if (!bookId) {
      return NextResponse.json({ error: 'Missing bookId' }, { status: 400 });
    }
    const book = await getBookById(bookId);
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json({
      book_id: book.id,
      current_page: book.current_page || 1,
      progress_percentage: book.progress_percentage || 0,
      scroll_position: book.scroll_position || 0,
      last_opened_at: book.last_opened_at
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body: any = await req.json();
    const { bookId, currentPage, progressPercentage, scrollPosition, pageCount } = body;

    if (!bookId || typeof currentPage !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const calcProgress = progressPercentage ?? (pageCount ? Math.min(100, Math.round((currentPage / pageCount) * 100 * 10) / 10) : 0);

    await saveReadingProgress(bookId, currentPage, calcProgress, scrollPosition || 0, pageCount);
    return NextResponse.json({ success: true, bookId, currentPage, progressPercentage: calcProgress });
  } catch (error: any) {
    console.error('Error saving progress:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
