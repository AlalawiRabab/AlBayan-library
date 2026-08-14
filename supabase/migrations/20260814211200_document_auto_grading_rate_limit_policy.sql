-- The Edge Function is the only caller. This explicit policy documents that
-- intent for database audits; service_role also retains its normal RLS bypass.
CREATE POLICY "Service role manages auto grading rate limits"
ON public.auto_grading_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
