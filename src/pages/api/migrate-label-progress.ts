import type { NextApiRequest, NextApiResponse } from 'next';
import { migrateLabelProgress } from '@/lib/runMigration';
import { supabase } from '@/lib/supabase';

type ResponseData = {
  success: boolean;
  message: string;
  error?: any;
}

/**
 * API endpoint to run the label progress migration
 * This adds start_date and completed_date columns to the label_progress table
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed',
    });
  }

  // Extract admin auth token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid token',
    });
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid token',
        error: authError
      });
    }
    
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
      
    if (userError || !userData || !userData.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required',
        error: userError
      });
    }
    
    // Run the migration
    const result = await migrateLabelProgress();
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Migration completed successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Migration failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error processing migration:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred',
      error
    });
  }
} 