import { NextApiRequest, NextApiResponse } from 'next';
import { migrateDatasetActiveStatus } from '@/lib/migrateDatasetActiveStatus';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await migrateDatasetActiveStatus();
    
    if (result.success) {
      res.status(200).json({ message: 'Migration completed successfully' });
    } else {
      res.status(500).json({ error: 'Migration failed', details: result.error });
    }
  } catch (error) {
    console.error('Migration API error:', error);
    res.status(500).json({ error: 'Migration failed', details: error });
  }
}