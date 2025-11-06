import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { runAllMigrations } from '@/lib/runAllMigrations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if user is admin
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: userData, error: adminError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminError || !userData?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Run all migrations
    const result = await runAllMigrations();
    
    if (result.success) {
      return res.status(200).json({ message: 'All migrations completed successfully' });
    } else {
      return res.status(500).json({ error: 'Migrations failed', details: result.error });
    }
  } catch (error) {
    console.error('Migration API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}