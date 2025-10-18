import json
import sys
import os

# Add the current directory and python-api directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'python-api'))

try:
    from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
except ImportError:
    # If transformers is not available, we'll use a simple fallback
    class MockPipeline:
        def __init__(self):
            pass
        
        def __call__(self, text):
            # Simple fallback implementation
            text_lower = text.lower()
            if any(word in text_lower for word in ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'perfect']):
                return [{'label': 'LABEL_0', 'score': 0.9}]
            elif any(word in text_lower for word in ['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst']):
                return [{'label': 'LABEL_2', 'score': 0.9}]
            else:
                return [{'label': 'LABEL_1', 'score': 0.9}]
    
    def pipeline(*args, **kwargs):
        return MockPipeline()
    
    class AutoTokenizer:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            return None
    
    class AutoModelForSequenceClassification:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            return None

# Initialize the sentiment analysis pipeline with IndoBERT
# Using Indonesian sentiment analysis model
try:
    pretrained = "mdhugol/indonesia-bert-sentiment-classification"
    model = AutoModelForSequenceClassification.from_pretrained(pretrained)
    tokenizer = AutoTokenizer.from_pretrained(pretrained)
    sentiment_pipeline = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer)
    
    # Label mapping for IndoBERT sentiment analysis
    label_mapping = {
        'LABEL_0': 'positive',
        'LABEL_1': 'neutral',
        'LABEL_2': 'negative'
    }
except Exception as e:
    # Fallback if model loading fails
    sentiment_pipeline = pipeline("sentiment-analysis")
    label_mapping = {
        'LABEL_0': 'positive',
        'LABEL_1': 'neutral',
        'LABEL_2': 'negative'
    }

def handler(request):
    """Vercel serverless function handler for sentiment analysis"""
    try:
        # Parse the request body
        if request.method == 'OPTIONS':
            # Handle CORS preflight request
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                'body': ''
            }
        
        if request.method != 'POST':
            return {
                'statusCode': 405,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'Method not allowed'})
            }
        
        # Get the request body
        try:
            body = json.loads(request.body) if request.body else {}
        except:
            body = {}
        
        # Check if text is provided
        if 'text' not in body:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'No text provided'})
            }
        
        text = body['text']
        
        # Check if text is empty
        if not text.strip():
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'Empty text provided'})
            }
        
        # Perform sentiment analysis
        results = sentiment_pipeline(text)
        
        # Extract the label and score
        original_label = results[0]['label']
        score = results[0]['score']
        
        # Map to our standard labels
        mapped_label = label_mapping.get(original_label, 'neutral')  # default to neutral if not found
        
        # Return results
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'label': mapped_label,
                'confidence': score,
                'original_label': original_label
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': f'Error analyzing sentiment: {str(e)}'})
        }