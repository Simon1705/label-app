import { NextApiRequest, NextApiResponse } from 'next';
import { MAINTENANCE_MODE } from '@/lib/maintenanceConfig';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    isMaintenanceMode: MAINTENANCE_MODE,
    message: MAINTENANCE_MODE 
      ? 'Application is currently under maintenance' 
      : 'Application is running normally'
  });
}