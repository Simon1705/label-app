import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // In a real implementation, you would verify admin authentication here
    // For now, we'll just simulate the toggle
    
    // Read the current maintenance config file
    const configPath = path.join(process.cwd(), 'src', 'lib', 'maintenanceConfig.ts');
    const configFile = await fs.readFile(configPath, 'utf8');
    
    // Toggle the MAINTENANCE_MODE value
    const updatedConfig = configFile.replace(
      /export const MAINTENANCE_MODE = (true|false);/,
      (match, currentValue) => {
        const newValue = currentValue === 'true' ? 'false' : 'true';
        return `export const MAINTENANCE_MODE = ${newValue};`;
      }
    );
    
    // Write the updated config back to the file
    await fs.writeFile(configPath, updatedConfig, 'utf8');
    
    // Extract the new value to return in the response
    const newMode = updatedConfig.includes('export const MAINTENANCE_MODE = true;') ? true : false;
    
    // Add a small delay to ensure file write completes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    res.status(200).json({ 
      success: true, 
      isMaintenanceMode: newMode,
      message: `Maintenance mode ${newMode ? 'enabled' : 'disabled'} successfully` 
    });
  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to toggle maintenance mode',
      message: 'Please check server logs for details' 
    });
  }
}