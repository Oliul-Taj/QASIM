"""
Data Verification Pipeline for Connectiva
Validates manually uploaded CSV/XLSX files against historical data and trustedsources
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime
from pathlib import Path

# ── Configuration ──
REQUIRED_COLUMNS_FUZZY = [
    'internet', 'broadband', 'connectivity', 'access',  # Internet access indicators
    '4g', 'lte', 'mobile broadband',  # 4G/mobile indicators
    'digital', 'literacy', 'ict',  # Digital readiness
    'tower', 'bts', 'infrastructure',  # Infrastructure
]

ACCEPTABLE_YEAR_RANGE = (1995, 2035)
HISTORICAL_GROWTH_BOUNDS = {
    'internet': (0.01, 0.15),  # 1-15% annual growth typical
    '4g': (0.05, 0.40),  # 5-40% annual growth during LTE rollout
    'digital': (0.02, 0.20),  # 2-20% annual growth
    'broadband': (0.01, 0.25),  # 1-25% annual growth
}


class DataVerifier:
    def __init__(self, historical_data_path="master_engine_data.csv"):
        """Initialize verifier with historical baseline data"""
        self.historical_data = None
        self.last_data_year = None
        self.load_historical_data(historical_data_path)
        self.verification_log = []
        
    def load_historical_data(self,path):
        """Load historical master data for comparison"""
        try:
            self.historical_data = pd.read_csv(path)
            if "dataYear" in self.historical_data.columns:
                self.last_data_year = int(self.historical_data["dataYear"].max())
            else:
                # Try to infer from index
                self.last_data_year = 2025
            print(f"[DataVerifier] Loaded historical data, last year: {self.last_data_year}")
        except Exception as e:
            print(f"[DataVerifier] Warning: Could not load historical data: {e}")
            self.last_data_year = 2025
            
    def fuzzy_match_column(self, col_name, target_keywords):
        """Fuzzy match column name against target keywords"""
        col_lower = col_name.lower().replace('_', ' ').replace('-', ' ')
        for keyword in target_keywords:
            if keyword.lower() in col_lower or col_lower in keyword.lower():
                return True
        return False
    
    def validate_year(self, file_df, filename):
        """Extract and validate year from file"""
        errors = []
        extracted_year = None
        
        # Try 1: Extract year from filename (e.g., "data_2026.csv")
        import re
        year_match = re.search(r'(\d{4})', filename)
        if year_match:
            extracted_year = int(year_match.group(1))
        
        # Try 2: Look for year column in data
        year_candidates = [c for c in file_df.columns if 'year' in c.lower()]
        if year_candidates and file_df[year_candidates[0]].notna().any():
            year_col = year_candidates[0]
            years = file_df[year_col].dropna().unique()
            if len(years) == 1:
                extracted_year = int(years[0])
            elif len(years) > 0:
                extracted_year = int(max(years))
        
        if extracted_year is None:
            errors.append(f"❌ Year extraction failed: Not found in filename or data columns")
            return None, errors
            
        if extracted_year < ACCEPTABLE_YEAR_RANGE[0] or extracted_year > ACCEPTABLE_YEAR_RANGE[1]:
            errors.append(f"❌ Year validation failed: {extracted_year} outside acceptable range {ACCEPTABLE_YEAR_RANGE}")
            return None, errors
            
        if extracted_year <= self.last_data_year:
            errors.append(f"❌ Year must be newer than last known year ({self.last_data_year}). Got {extracted_year}")
            return None, errors
            
        return extracted_year, errors
    
    def validate_columns(self, file_df):
        """Validate that file has at least 2 matching indicator columns"""
        errors = []
        matched_cols = []
        
        for col in file_df.columns:
            if self.fuzzy_match_column(col, REQUIRED_COLUMNS_FUZZY):
                matched_cols.append(col)
        
        # Require at least 2 matching columns
        if len(matched_cols) < 2:
            errors.append(f"❌ Column validation failed: Found only {len(matched_cols)} matching columns (require ≥2). Matched: {matched_cols}")
            return False, matched_cols, errors
        
        return True, matched_cols, errors
    
    def validate_growth_trends(self, file_df, matched_cols, extracted_year):
        """Validate growth rates against historical patterns"""
        errors = []
        
        if self.historical_data is None or "dataYear" not in self.historical_data.columns:
            return errors  # Skip if no historical data
        
        # Get previous year's data
        prev_year_data = self.historical_data[self.historical_data["dataYear"] == self.last_data_year]
        if prev_year_data.empty:
            return errors
        
        # Compare matched columns
        for col in matched_cols:
            if col not in prev_year_data.columns:
                continue
                
            try:
                prev_val = float(prev_year_data[col].iloc[0])
                new_val = float(file_df[col].iloc[0]) if col in file_df.columns and len(file_df) > 0 else None
                
                if new_val is None or prev_val == 0 or new_val < 0 or prev_val < 0:
                    continue
                
                # Calculate annual growth rate
                years_diff = extracted_year - self.last_data_year
                if years_diff <= 0:
                    continue
                    
                annual_growth = ((new_val / prev_val) ** (1 / years_diff) - 1)
                
                # Determine acceptable bounds based on metric type
                bounds = (0.01, 0.15)  # Default: 1-15% annual growth
                for key, val_bounds in HISTORICAL_GROWTH_BOUNDS.items():
                    if self.fuzzy_match_column(col, [key]):
                        bounds = val_bounds
                        break
                
                if annual_growth < bounds[0] or annual_growth > bounds[1]:
                    errors.append(
                        f"⚠️  Growth rate out of bounds for '{col}': {annual_growth*100:.1f}% annually "
                        f"(expected {bounds[0]*100:.1f}%-{bounds[1]*100:.1f}%)"
                    )
            except Exception as e:
                pass  # Silent skip on parse errors
        
        return errors
    
    def verify_upload(self, file_path, filename):
        """
        Main verification pipeline – returns status dict
        
        Returns:
            {
                "status": "verified" | "rejected" | "manual_review",
                "year": int,
                "matched_columns": [list],
                "errors": [list],
                "warnings": [list],
                "message": str
            }
        """
        result = {
            "status": "rejected",
            "year": None,
            "matched_columns": [],
            "errors": [],
            "warnings": [],
            "message": ""
        }
        
        # Load file
        try:
            if file_path.endswith('.xlsx'):
                file_df = pd.read_excel(file_path)
            else:  # CSV
                file_df = pd.read_csv(file_path)
                
            if file_df.empty:
                result["errors"].append("❌ File is empty")
                result["message"] = "File parsing failed: empty dataset"
                return result
        except Exception as e:
            result["errors"].append(f"❌ File parsing error: {str(e)}")
            result["message"] = "Could not parse file. Ensure it's valid CSV or XLSX."
            return result
        
        # Step 1: Year validation
        year, year_errors = self.validate_year(file_df, filename)
        result["errors"].extend(year_errors)
        if year is None:
            result["status"] = "rejected"
            result["message"] = "Year validation failed – filename must contain year or year column required"
            return result
        result["year"] = year
        
        # Step 2: Column validation (MUST PASS – blocks verification)
        cols_valid, matched_cols, col_errors = self.validate_columns(file_df)
        result["matched_columns"] = matched_cols
        result["errors"].extend(col_errors)
        if not cols_valid:
            result["status"] = "rejected"
            result["message"] = f"Column validation failed: Requires ≥2 matching indicator columns"
            return result
        
        # Step 3: Growth trends (MAY WARN – advisory only)
        trend_warnings = self.validate_growth_trends(file_df, matched_cols, year)
        result["warnings"].extend(trend_warnings)
        
        # Decision logic
        if len(result["errors"]) == 0 and len(result["warnings"]) <= 1:
            result["status"] = "verified"
            result["message"] = f"✓ File verified successfully: {year} data with {len(matched_cols)} indicators"
        elif len(result["errors"]) == 0 and len(result["warnings"]) > 1:
            result["status"] = "verified"  # Still verified, just with warnings
            result["message"] = f"✓ Verified with {len(result['warnings'])} advisories (trend variations noted)"
        else:
            result["status"] = "rejected"
            result["message"] = f"❌ Verification failed: {len(result['errors'])} error(s)"
        
        return result


# Export for use in app.py
verifier = DataVerifier("master_engine_data.csv")

