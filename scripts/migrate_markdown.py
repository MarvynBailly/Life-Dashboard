#!/usr/bin/env python3
"""
Migration script to import existing markdown todo and notes files into SQLite.

This script scans the YYYY/MM/DD directory structure and imports:
- todo.md / todos.md files -> todos table
- notes.md files -> notes table

It preserves:
- Task hierarchy (indent levels)
- Task status (incomplete, completed, moved)
- Migration links (From/Moved to tags)
- Original dates from directory structure
"""
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import List, Tuple, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database.models import Base, Todo, Note
from backend.database.crud import engine, SessionLocal


# Regex patterns for parsing todos
TODO_PATTERN = re.compile(r'^(\s*)-\s*\[([x>| ])\]\s*(.*)$')
FROM_TAG_PATTERN = re.compile(r'\(From \[(\d{4}-\d{2}-\d{2})\]\([^)]+\)\)')
MOVED_TAG_PATTERN = re.compile(r'\(Moved to \[(\d{4}-\d{2}-\d{2})\]\([^)]+\)\)')


def parse_date_from_path(path: Path) -> Optional[date]:
    """Extract date from YYYY/MM/DD directory structure."""
    parts = path.parts
    try:
        # Find year, month, day in path
        for i, part in enumerate(parts):
            if len(part) == 4 and part.isdigit():
                year = int(part)
                if i + 2 < len(parts):
                    month = int(parts[i + 1])
                    day = int(parts[i + 2])
                    return date(year, month, day)
    except (ValueError, IndexError):
        pass
    return None


def parse_todo_line(line: str) -> Optional[Tuple[int, str, str]]:
    """
    Parse a todo line and extract indent, status, and text.

    Returns:
        Tuple of (indent_level, status, text) or None if not a todo line
    """
    match = TODO_PATTERN.match(line)
    if not match:
        return None

    spaces, status_char, text = match.groups()
    indent_level = len(spaces) // 2

    # Map status character to status string
    if status_char == 'x':
        status = 'completed'
    elif status_char == '>':
        status = 'moved'
    else:
        status = 'incomplete'

    return indent_level, status, text.strip()


def extract_migration_dates(text: str) -> Tuple[Optional[date], Optional[date]]:
    """Extract 'From' and 'Moved to' dates from todo text."""
    from_date = None
    moved_to_date = None

    from_match = FROM_TAG_PATTERN.search(text)
    if from_match:
        try:
            from_date = datetime.strptime(from_match.group(1), '%Y-%m-%d').date()
        except ValueError:
            pass

    moved_match = MOVED_TAG_PATTERN.search(text)
    if moved_match:
        try:
            moved_to_date = datetime.strptime(moved_match.group(1), '%Y-%m-%d').date()
        except ValueError:
            pass

    return from_date, moved_to_date


def clean_todo_text(text: str) -> str:
    """Remove migration tags from todo text for clean storage."""
    text = FROM_TAG_PATTERN.sub('', text)
    text = MOVED_TAG_PATTERN.sub('', text)
    return text.strip()


def parse_todo_file(filepath: Path, original_date: date) -> List[dict]:
    """
    Parse a todo.md file and return list of todo items.
    """
    todos = []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"  Error reading {filepath}: {e}")
        return todos

    for line_num, line in enumerate(lines, 1):
        parsed = parse_todo_line(line)
        if parsed:
            indent_level, status, text = parsed
            from_date, moved_to_date = extract_migration_dates(text)
            clean_text = clean_todo_text(text)

            if clean_text:  # Only add if there's actual text
                todos.append({
                    'text': clean_text,
                    'status': status,
                    'indent_level': indent_level,
                    'original_date': original_date,
                    'from_date': from_date,
                    'moved_to_date': moved_to_date,
                    'line_num': line_num
                })

    return todos


def parse_notes_file(filepath: Path, note_date: date) -> List[dict]:
    """
    Parse a notes.md file and return list of note sections.
    """
    notes = []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  Error reading {filepath}: {e}")
        return notes

    # Split by ## headers to get individual notes
    sections = re.split(r'^## ', content, flags=re.MULTILINE)

    for section in sections[1:]:  # Skip first section (usually just "# Notes")
        lines = section.strip().split('\n')
        if lines:
            title = lines[0].strip()
            content = '\n'.join(lines[1:]).strip()

            if title or content:
                notes.append({
                    'title': title if title else None,
                    'content': content if content else title,  # Use title as content if no body
                    'note_date': note_date
                })

    # If no sections found, treat entire file as one note
    if not notes and content.strip():
        # Remove the "# Notes" header if present
        content = re.sub(r'^#\s*Notes?\s*\n', '', content, flags=re.IGNORECASE)
        if content.strip():
            notes.append({
                'title': None,
                'content': content.strip(),
                'note_date': note_date
            })

    return notes


def find_data_directories(root_path: Path) -> List[Path]:
    """Find all YYYY/MM/DD directories containing data files."""
    data_dirs = []

    for year_dir in root_path.iterdir():
        if year_dir.is_dir() and year_dir.name.isdigit() and len(year_dir.name) == 4:
            for month_dir in year_dir.iterdir():
                if month_dir.is_dir() and month_dir.name.isdigit():
                    for day_dir in month_dir.iterdir():
                        if day_dir.is_dir() and day_dir.name.isdigit():
                            # Check if directory has todo.md, todos.md, or notes.md
                            has_data = any([
                                (day_dir / 'todo.md').exists(),
                                (day_dir / 'todos.md').exists(),
                                (day_dir / 'notes.md').exists()
                            ])
                            if has_data:
                                data_dirs.append(day_dir)

    return sorted(data_dirs)


def migrate_data(root_path: Path, dry_run: bool = False):
    """
    Main migration function.

    Args:
        root_path: Root directory containing YYYY/MM/DD structure
        dry_run: If True, only print what would be done without actually migrating
    """
    print(f"{'DRY RUN - ' if dry_run else ''}Starting migration from {root_path}")
    print("=" * 60)

    # Find all data directories
    data_dirs = find_data_directories(root_path)
    print(f"Found {len(data_dirs)} directories with data files\n")

    if not data_dirs:
        print("No data directories found. Exiting.")
        return

    # Initialize database
    if not dry_run:
        Base.metadata.create_all(bind=engine)

    total_todos = 0
    total_notes = 0

    db = SessionLocal()
    try:
        for day_dir in data_dirs:
            dir_date = parse_date_from_path(day_dir)
            if not dir_date:
                print(f"  Skipping {day_dir} - could not parse date")
                continue

            print(f"Processing {dir_date.isoformat()}...")

            # Process todo files
            todo_file = day_dir / 'todo.md'
            if not todo_file.exists():
                todo_file = day_dir / 'todos.md'  # Legacy format

            if todo_file.exists():
                todos = parse_todo_file(todo_file, dir_date)
                print(f"  Found {len(todos)} todos")

                if not dry_run:
                    for todo_data in todos:
                        todo = Todo(
                            text=todo_data['text'],
                            status=todo_data['status'],
                            indent_level=todo_data['indent_level'],
                            original_date=todo_data['original_date'],
                            tags=[]
                        )
                        db.add(todo)

                total_todos += len(todos)

            # Process notes files
            notes_file = day_dir / 'notes.md'
            if notes_file.exists():
                notes = parse_notes_file(notes_file, dir_date)
                print(f"  Found {len(notes)} notes")

                if not dry_run:
                    for note_data in notes:
                        note = Note(
                            title=note_data['title'],
                            content=note_data['content'],
                            note_date=note_data['note_date'],
                            tags=[]
                        )
                        db.add(note)

                total_notes += len(notes)

        if not dry_run:
            db.commit()
            print("\n" + "=" * 60)
            print("Migration completed successfully!")
        else:
            print("\n" + "=" * 60)
            print("Dry run completed - no data was written")

        print(f"Total todos: {total_todos}")
        print(f"Total notes: {total_notes}")

    except Exception as e:
        db.rollback()
        print(f"\nError during migration: {e}")
        raise
    finally:
        db.close()


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Migrate markdown todo and notes files to SQLite database'
    )
    parser.add_argument(
        '--root',
        type=str,
        default='z:/',
        help='Root directory containing YYYY/MM/DD structure (default: z:/)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print what would be migrated without actually doing it'
    )

    args = parser.parse_args()
    root_path = Path(args.root)

    if not root_path.exists():
        print(f"Error: Root path {root_path} does not exist")
        sys.exit(1)

    migrate_data(root_path, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
