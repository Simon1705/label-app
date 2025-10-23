import { createClient } from '@supabase/supabase-js';

// Create Supabase client with env variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Always require Supabase credentials
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Always create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get admin client with service role key (only used on server)
export const getServiceSupabase = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseServiceKey) {
    throw new Error('Missing Supabase service role key');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};