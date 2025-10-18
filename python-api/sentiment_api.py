# This file is kept for local development
# For Vercel deployment, we use the serverless function in src/pages/api/sentiment/analyze.py

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the sentiment analysis pipeline with IndoBERT
# Using Indonesian sentiment analysis model
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

# Reverse mapping for easier access
reverse_label_mapping = {v: k for k, v in label_mapping.items()}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "Sentiment analysis API is running with IndoBERT"}), 200

@app.route('/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyze sentiment of text"""
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Check if text is provided
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        
        # Check if text is empty
        if not text.strip():
            return jsonify({"error": "Empty text provided"}), 400
        
        # Perform sentiment analysis
        logger.info(f"Analyzing sentiment for text: {text[:50]}...")
        results = sentiment_pipeline(text)
        
        # Extract the label and score
        original_label = results[0]['label']
        score = results[0]['score']
        
        # Map to our standard labels
        mapped_label = label_mapping.get(original_label, 'neutral')  # default to neutral if not found
        
        # Return results
        return jsonify({
            "label": mapped_label,
            "confidence": score,
            "original_label": original_label,
            "scores": {
                mapped_label: score
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment: {str(e)}")
        return jsonify({"error": f"Error analyzing sentiment: {str(e)}"}), 500

@app.route('/analyze-batch', methods=['POST'])
def analyze_sentiment_batch():
    """Analyze sentiment for a batch of texts"""
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Check if texts are provided
        if not data or 'texts' not in data:
            return jsonify({"error": "No texts provided"}), 400
        
        texts = data['texts']
        
        # Check if texts is a list
        if not isinstance(texts, list):
            return jsonify({"error": "Texts must be a list"}), 400
        
        # Check if texts list is empty
        if len(texts) == 0:
            return jsonify({"error": "Empty texts list provided"}), 400
        
        # Perform sentiment analysis for each text
        results = []
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                results.append({
                    "index": i,
                    "error": "Text must be a string"
                })
                continue
                
            if not text.strip():
                results.append({
                    "index": i,
                    "error": "Empty text provided"
                })
                continue
            
            try:
                logger.info(f"Analyzing sentiment for text {i+1}/{len(texts)}: {text[:50]}...")
                analysis = sentiment_pipeline(text)
                
                # Extract the label and score
                original_label = analysis[0]['label']
                score = analysis[0]['score']
                
                # Map to our standard labels
                mapped_label = label_mapping.get(original_label, 'neutral')  # default to neutral if not found
                
                results.append({
                    "index": i,
                    "label": mapped_label,
                    "confidence": score,
                    "original_label": original_label,
                    "scores": {
                        mapped_label: score
                    }
                })
            except Exception as e:
                logger.error(f"Error analyzing sentiment for text {i}: {str(e)}")
                results.append({
                    "index": i,
                    "error": f"Error analyzing sentiment: {str(e)}"
                })
        
        # Return results
        return jsonify({"results": results}), 200
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment batch: {str(e)}")
        return jsonify({"error": f"Error analyzing sentiment batch: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)