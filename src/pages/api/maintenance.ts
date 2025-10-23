import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // In a real application, this would check a database or config file
  // For now, we'll use an environment variable or default to false
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true' || false;
  
  res.status(200).json({ 
    isMaintenanceMode,
    message: isMaintenanceMode 
      ? 'Application is currently under maintenance' 
      : 'Application is running normally'
  });
}