import fs from 'fs';
import path from 'path';

export interface GeneratedBook {
  id: string;
  title: string;
  author?: string;
  fileName: string;
  filePath: string;
  url: string;
}

export function cleanTitleFromFilename(fileName: string): { title: string; author?: string } {
  let name = fileName.replace(/\.pdf$/i, '');
  
  // Clean common scraper tags
  name = name.replace(/\(z-lib\.org\)/gi, '').trim();

  let author: string | undefined = undefined;

  // Handle [Author Name] pattern in square brackets
  const bracketMatch = name.match(/\[(.*?)\]/);
  if (bracketMatch) {
    author = bracketMatch[1].trim();
    name = name.replace(bracketMatch[0], '').trim();
  }

  // Fallback to (Author, Name) pattern if present e.g. (Tripathi, Amish)
  if (!author) {
    const authorMatch = name.match(/\(([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)?)\)/);
    if (authorMatch) {
      const rawAuthor = authorMatch[1];
      if (rawAuthor.includes(',')) {
        const parts = rawAuthor.split(',').map(s => s.trim());
        author = `${parts[1]} ${parts[0]}`;
      } else {
        author = rawAuthor;
      }
      name = name.replace(authorMatch[0], '').trim();
    }
  }

  const title = name.replace(/\s+/g, ' ').trim();
  return { title, author };
}

export function generateSlug(fileName: string): string {
  let name = fileName.replace(/\.pdf$/i, '');
  name = name.replace(/\(z-lib\.org\)/gi, '');
  name = name.toLowerCase();
  let slug = name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'book';
}

function discoverBooks() {
  const rootDir = process.cwd();
  const possibleDirs = [
    path.join(rootDir, 'public', 'books'),
    path.join(rootDir, 'public', 'book')
  ];

  const books: GeneratedBook[] = [];
  const usedSlugs = new Set<string>();

  for (const dirPath of possibleDirs) {
    if (fs.existsSync(dirPath)) {
      const dirName = path.basename(dirPath); // 'books' or 'book'
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (file.toLowerCase().endsWith('.pdf')) {
          let slug = generateSlug(file);
          if (usedSlugs.has(slug)) {
            let counter = 2;
            while (usedSlugs.has(`${slug}-${counter}`)) {
              counter++;
            }
            slug = `${slug}-${counter}`;
          }
          usedSlugs.add(slug);

          const { title, author } = cleanTitleFromFilename(file);
          const relativePath = `/public/${dirName}/${file}`;
          const url = `/${dirName}/${encodeURIComponent(file)}`;

          books.push({
            id: slug,
            title,
            author,
            fileName: file,
            filePath: relativePath,
            url
          });
        }
      }
    }
  }

  const outputPath = path.join(rootDir, 'src', 'lib', 'generated-books.json');
  const libDir = path.dirname(outputPath);
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(books, null, 2), 'utf-8');
  console.log(`Successfully generated ${books.length} book entries in ${outputPath}`);
}

if (require.main === module || process.argv[1]?.includes('generate-books')) {
  discoverBooks();
}
