import { LabelOption } from '@/types';

// Function to determine the correct API endpoint based on environment
function getSentimentAPIEndpoint(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // In browser, check the hostname to determine environment
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.startsWith('192.168.') ||
                        window.location.hostname.startsWith('10.');
    
    if (isLocalhost) {
      return 'http://localhost:5000/analyze';
    } else {
      return '/api/sentiment/analyze';
    }
  }
  
  // Server-side fallback (shouldn't normally be used for this client-side function)
  // In development, use the local Python Flask API
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000/analyze';
  }
  // In production, use the Vercel serverless function
  return '/api/sentiment/analyze';
}

// Function to analyze sentiment using our Python API with Hugging Face transformers
export async function analyzeSentiment(text: string): Promise<LabelOption> {
  try {
    const endpoint = getSentimentAPIEndpoint();
    
    // Call our API endpoint
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();
    return result.label as LabelOption;
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    // Fallback to our previous keyword-based approach if API fails
    return analyzeSentimentFallback(text);
  }
}

// Fallback implementation using keyword matching
function analyzeSentimentFallback(text: string): LabelOption {
  // Convert to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Define keywords for each sentiment
  const positiveKeywords = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'perfect',
    'awesome', 'brilliant', 'outstanding', 'superb', 'incredible', 'exceptional', 'marvelous',
    'terrific', 'splendid', 'fabulous', 'stunning', 'phenomenal', 'remarkable', 'extraordinary',
    'magnificent', 'wonderous', 'spectacular', 'impressive', 'delightful', 'pleasant', 'satisfactory',
    'fine', 'nice', 'decent', 'favorable', 'positive', 'pleasing', 'gratifying', 'agreeable',
    'enjoyable', 'comfortable', 'reliable', 'efficient', 'effective', 'smooth', 'flawless'
  ];

  const negativeKeywords = [
    'bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'disappointing', 'poor',
    'mediocre', 'unsatisfactory', 'negative', 'unpleasant', 'disgusting', 'offensive', 'repulsive',
    'atrocious', 'dreadful', 'lousy', 'pathetic', 'abysmal', 'inferior', 'substandard', 'deficient',
    'faulty', 'imperfect', 'flawed', 'damaged', 'broken', 'useless', 'worthless', 'pointless',
    'futile', 'vain', 'unsuccessful', 'failed', 'disastrous', 'catastrophic', 'fatal', 'ruinous',
    'destructive', 'harmful', 'detrimental', 'injurious', 'unfavorable', 'adverse', 'unwelcome'
  ];

  // Count positive and negative keywords
  let positiveCount = 0;
  let negativeCount = 0;
  
  // Count positive keywords
  positiveKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = text.match(regex);
    positiveCount += matches ? matches.length : 0;
  });
  
  // Count negative keywords
  negativeKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = text.match(regex);
    negativeCount += matches ? matches.length : 0;
  });
  
  // Determine sentiment based on counts
  if (positiveCount > negativeCount) {
    return 'positive';
  } else if (negativeCount > positiveCount) {
    return 'negative';
  } else {
    // If counts are equal or both zero, return neutral
    return 'neutral';
  }
}