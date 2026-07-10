#!/usr/bin/env python
"""
SQLite → PostgreSQL data migration helper.

Usage (run from backend/):
    1. Export data from SQLite:
       python migrate_data.py export

    2. Point DATABASE_URL to your Supabase Postgres in .env

    3. Run Django migrations against Postgres:
       python manage.py migrate

    4. Import data into Postgres:
       python migrate_data.py import

The script uses Django's dumpdata / loaddata with --natural-foreign and
--natural-primary to avoid PK conflicts on ContentType and Permission tables.
"""

import os
import sys
import subprocess
import argparse

# Ensure Django settings are available
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DUMP_FILE = os.path.join(BACKEND_DIR, 'data_export.json')

# Tables to EXCLUDE — Django recreates these during `migrate` and importing
# them causes PK collisions across different database backends.
EXCLUDED_MODELS = [
    'contenttypes.contenttype',
    'auth.permission',
    'sessions.session',
    'admin.logentry',
]


def export_data():
    """Dump all data from the CURRENT database (SQLite) to a JSON fixture."""
    print("=" * 60)
    print("  EXPORTING data from current database -> data_export.json")
    print("=" * 60)

    cmd = [
        sys.executable, 'manage.py', 'dumpdata',
        '--settings=core.settings_sqlite',
        '--all',
        '--natural-foreign',
        '--natural-primary',
        '--indent', '2',
        '-o', DUMP_FILE,
    ]
    for model in EXCLUDED_MODELS:
        cmd += ['--exclude', model]

    print(f"\n  Running: {' '.join(cmd)}\n")
    result = subprocess.run(cmd, cwd=BACKEND_DIR)

    if result.returncode == 0:
        size_mb = os.path.getsize(DUMP_FILE) / (1024 * 1024)
        print(f"\n  [OK] Export complete -> {DUMP_FILE}  ({size_mb:.2f} MB)")
    else:
        print(f"\n  [FAIL] Export failed (exit code {result.returncode})")
        sys.exit(result.returncode)


def import_data():
    """Load the JSON fixture into the CURRENT database (Postgres)."""
    if not os.path.exists(DUMP_FILE):
        print(f"  [FAIL] Dump file not found: {DUMP_FILE}")
        print("    Run 'python migrate_data.py export' first (while still on SQLite).")
        sys.exit(1)

    print("=" * 60)
    print("  IMPORTING data from data_export.json -> current database")
    print("=" * 60)

    # Step 1: Ensure migrations are applied
    print("\n  -> Running migrate ...")
    migrate_result = subprocess.run(
        [sys.executable, 'manage.py', 'migrate', '--run-syncdb'],
        cwd=BACKEND_DIR,
    )
    if migrate_result.returncode != 0:
        print("  [FAIL] migrate failed - fix errors above before importing data.")
        sys.exit(migrate_result.returncode)

    # Step 1b: Clear any partially imported data from earlier failed runs.
    print("\n  -> Flushing existing data ...")
    flush_result = subprocess.run(
        [sys.executable, 'manage.py', 'flush', '--noinput'],
        cwd=BACKEND_DIR,
    )
    if flush_result.returncode != 0:
        print("  [FAIL] flush failed - fix errors above before importing data.")
        sys.exit(flush_result.returncode)

    # Step 2: Load the fixture
    print(f"\n  -> Loading {DUMP_FILE} ...")
    cmd = [
        sys.executable, 'manage.py', 'loaddata', DUMP_FILE,
    ]
    print(f"  Running: {' '.join(cmd)}\n")
    result = subprocess.run(cmd, cwd=BACKEND_DIR)

    if result.returncode == 0:
        print("\n  [OK] Import complete. Verify your data in the Supabase dashboard.")
    else:
        print(f"\n  [FAIL] Import failed (exit code {result.returncode})")
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(
        description='Migrate data between SQLite and PostgreSQL',
    )
    parser.add_argument(
        'action',
        choices=['export', 'import'],
        help="'export' = dump from current DB;  'import' = load into current DB",
    )
    args = parser.parse_args()

    if args.action == 'export':
        export_data()
    else:
        import_data()


if __name__ == '__main__':
    main()
