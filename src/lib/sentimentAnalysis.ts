import { LabelOption } from '@/types';

// Function to analyze sentiment using our Python API with Hugging Face transformers
export async function analyzeSentiment(text: string): Promise<LabelOption> {
  try {
    // Call our Python API endpoint
    const response = await fetch('http://localhost:5000/analyze', {
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

// Function to analyze sentiment using our Python API with binary classification
export async function analyzeSentimentBinary(text: string): Promise<LabelOption> {
  try {
    // Call our Python API endpoint for binary classification
    const response = await fetch('http://localhost:5001/analyze', {
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
    console.error('Error analyzing sentiment (binary):', error);
    // Fallback to our previous keyword-based approach if API fails, but convert to binary
    const fallbackLabel = analyzeSentimentFallback(text);
    // Convert to binary (positive or negative only)
    return fallbackLabel === 'positive' ? 'positive' : 'negative';
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