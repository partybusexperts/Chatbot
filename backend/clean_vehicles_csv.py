
import csv

input_path = '../data/vehicles.csv'
output_path = '../data/vehicles_cleaned.csv'

with open(input_path, newline='', encoding='utf-8') as infile:
    reader = csv.reader(infile)
    rows = list(reader)
    
    
header = rows[0]
num_cols = len(header)

cleaned = [header]
for i, row in enumerate(rows[1:], 2):
    # Pad or trim the row to match the header length
    if len(row) < num_cols:
        row = row + ['0'] * (num_cols - len(row))
    elif len(row) > num_cols:
        row = row[:num_cols]
    cleaned.append(row)

with open(output_path, 'w', newline='', encoding='utf-8') as outfile:
    writer = csv.writer(outfile)
    writer.writerows(cleaned)

print(f"Cleaned CSV written to {output_path}. {len(cleaned)-1} rows retained.") 