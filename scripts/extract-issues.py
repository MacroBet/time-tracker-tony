"""Read an Autodesk issue workbook; emit a validated import staging file."""
import argparse
import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument('workbook')
parser.add_argument('output')
args = parser.parse_args()
workbook = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
rows = workbook['Issues'].iter_rows(values_only=True)
headers = next(rows)
required = {'ID', 'Title', 'Status', 'Type', 'Assigned to', 'Assignee type', 'Created on', 'Updated on', 'Due date', 'Company name'}
if not required.issubset(headers) or len(set(headers)) != len(headers):
    raise ValueError('Missing or duplicate report columns')

def text(value):
    return value.isoformat(sep=' ') if isinstance(value, datetime.datetime) else (str(value) if value is not None else None)

def timestamp(value):
    result = datetime.datetime.fromisoformat(value)
    if result.tzinfo is None:
        result = result.replace(tzinfo=ZoneInfo('Europe/Amsterdam'))
    return result.astimezone(datetime.timezone.utc).isoformat()

issues = []
for row_number, values in enumerate(rows, 2):
    if not any(v is not None for v in values):
        continue
    fields = dict(zip(headers, map(text, values)))
    issues.append({'row': row_number, 'fields': fields, 'createdAt': timestamp(fields['Created on']), 'updatedAt': timestamp(fields['Updated on']), 'dueDate': fields['Due date'][:10] if fields['Due date'] else None})
Path(args.output).parent.mkdir(parents=True, exist_ok=True)
Path(args.output).write_text(json.dumps({'file': Path(args.workbook).name, 'issues': issues}, ensure_ascii=False))
print(f'Extracted {len(issues)} issue rows; original workbook unchanged.')
