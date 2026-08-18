import { NextRequest, NextResponse } from 'next/server';
import { getBookmarks, addBookmark, deleteBookmark } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId');
    if (!bookId) {
      return NextResponse.json({ error: 'Missing bookId' }, { status: 400 });
    }
    const bookmarks = await getBookmarks(bookId);
    return NextResponse.json({ bookmarks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json();
    const { bookId, page, label } = body;
    if (!bookId || typeof page !== 'number') {
      return NextResponse.json({ error: 'Missing bookId or page' }, { status: 400 });
    }
    const bookmark = await addBookmark(bookId, page, label);
    return NextResponse.json({ bookmark });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing bookmark id' }, { status: 400 });
    }
    await deleteBookmark(id);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
