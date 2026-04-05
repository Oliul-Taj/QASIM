import pandas as pd
import glob
import os

# 1. SETUP PATHS
RAW_DATA_PATH = "C:/Users/tanim/Downloads/connectiva/ML/raw_data"
OUTPUT_FILE = "master_engine_data.csv"

def merge_bangladesh_data():
    # Find all CSV files in the raw_data folder
    all_files = glob.glob(os.path.join(RAW_DATA_PATH, "*.csv"))
    print(f"Found {len(all_files)} files. Starting extraction...")

    combined_list = []

    for file in all_files:
        try:
            # Extract topic name from filename
            topic = os.path.basename(file).replace('.csv', '')
            
            # Read current CSV
            df = pd.read_csv(file)
            
            # 2. FILTER: Only keep rows where the country is Bangladesh
            if 'entityIso' in df.columns:
                bgd_slice = df[df['entityIso'] == 'BGD'].copy()
            elif 'entityName' in df.columns:
                bgd_slice = df[df['entityName'] == 'Bangladesh'].copy()
            elif 'Country' in df.columns:
                bgd_slice = df[df['Country'] == 'Bangladesh'].copy()
            else:
                # If column names vary, look for BGD in the whole dataframe
                bgd_slice = df[df.apply(lambda row: row.astype(str).str.contains('BGD', case=False).any(), axis=1)].copy()

            if not bgd_slice.empty:
                # 3. STANDARDIZE COLUMNS: Extract dataYear and dataValue
                if 'Year' in bgd_slice.columns:
                    bgd_slice['dataYear'] = bgd_slice['Year']
                elif 'year' in bgd_slice.columns:
                    bgd_slice['dataYear'] = bgd_slice['year']
                elif 'dataYear' not in bgd_slice.columns:
                    # Try to find year-like columns
                    year_cols = [col for col in bgd_slice.columns if 'year' in col.lower()]
                    if year_cols:
                        bgd_slice['dataYear'] = bgd_slice[year_cols[0]]
                
                # Extract primary value column and convert to numeric
                value_cols = [col for col in bgd_slice.columns if 'value' in col.lower() or col in ['Value', 'Data', 'data']]
                if value_cols:
                    bgd_slice['dataValue'] = pd.to_numeric(bgd_slice[value_cols[0]], errors='coerce')
                else:
                    # Use last numeric column as fallback
                    numeric_cols = bgd_slice.select_dtypes(include=['number']).columns
                    if len(numeric_cols) > 0:
                        bgd_slice['dataValue'] = bgd_slice[numeric_cols[-1]]
                
                # Add Topic column
                bgd_slice['Topic'] = topic
                
                # Keep only necessary columns and drop NaN values
                if 'dataYear' in bgd_slice.columns and 'dataValue' in bgd_slice.columns:
                    bgd_slice = bgd_slice[['dataYear', 'dataValue', 'Topic']].dropna().copy()
                    combined_list.append(bgd_slice)
                    print(f"✓ Processed {topic}: {len(bgd_slice)} rows")
        
        except Exception as e:
            print(f"✗ Could not read {file}: {e}")

    # 4. STACK & MERGE: Combine all Bangladesh-specific rows
    if combined_list:
        master_df = pd.concat(combined_list, axis=0, ignore_index=True)
        
        # 5. PIVOT FOR ML TRAINING: Convert to wide format
        # dataYear as index, each Topic as a column
        pivot_df = master_df.pivot_table(
            index='dataYear',
            columns='Topic',
            values='dataValue',
            aggfunc='mean'  # In case of duplicates, take mean
        )
        
        # 6. HANDLE MISSING DATA: Linear interpolation + forward/backward fill
        pivot_df = pivot_df.interpolate(method='linear', limit_direction='both').bfill().ffill()
        
        # 7. OUTPUT: Save the final result
        pivot_df.to_csv(OUTPUT_FILE)
        print(f"\n✓ Success! Master Engine file saved as {OUTPUT_FILE}")
        print(f"Shape: {pivot_df.shape} (Years × Topics)")
        print(f"Topics included: {list(pivot_df.columns)}")
    else:
        print("✗ No Bangladesh data found in the files.")

if __name__ == "__main__":
    merge_bangladesh_data()