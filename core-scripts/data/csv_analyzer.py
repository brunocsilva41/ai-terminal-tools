import csv
import sys
import json
from collections import Counter

def analyze_csv(filepath, limit=5):
    """Lê um CSV de forma eficiente em memória e retorna estatísticas cruciais para a IA."""
    try:
        with open(filepath, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            
            if not headers:
                return {"error": "No headers found or empty file"}
                
            row_count = 0
            sample_rows = []
            
            # Conta nulos e tipos
            for row in reader:
                if row_count < limit:
                    sample_rows.append(row)
                row_count += 1
                
        result = {
            "status": "success",
            "file": filepath,
            "total_rows": row_count,
            "columns": headers,
            "sample_data": sample_rows
        }
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('{"error": "Please provide a CSV file path"}')
        sys.exit(1)
        
    analyze_csv(sys.argv[1])
