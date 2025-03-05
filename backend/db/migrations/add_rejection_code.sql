-- Add rejection_code column to audit_results table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'audit_results' AND column_name = 'rejection_code'
    ) THEN
        ALTER TABLE audit_results ADD COLUMN rejection_code TEXT;
    END IF;
END $$; 