import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import logging
import sys

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def select_device():
    """Allow user to select device (CPU or GPU) when running the script"""
    print("Select device for sentiment analysis:")
    print("1. CPU")
    print("2. GPU (if available)")
    
    # Check if CUDA is available
    cuda_available = torch.cuda.is_available()
    if not cuda_available:
        print("\nNote: CUDA is not available on this system. GPU option will fallback to CPU.")
    
    while True:
        try:
            choice = input("Enter your choice (1 or 2): ").strip()
            if choice == "1":
                return -1, "CPU"
            elif choice == "2":
                if cuda_available:
                    return 0, torch.cuda.get_device_name(0)
                else:
                    print("CUDA not available, falling back to CPU...")
                    return -1, "CPU (fallback)"
            else:
                print("Invalid choice. Please enter 1 or 2.")
        except KeyboardInterrupt:
            print("\nExiting...")
            sys.exit(0)
        except Exception as e:
            print(f"Error: {e}. Please try again.")

# Select device based on user input or environment variable
device = -1  # Default to CPU
device_name = "CPU"

# Check if device is specified via environment variable
import os
device_env = os.environ.get('SENTIMENT_DEVICE', '').lower()
if device_env == 'gpu' and torch.cuda.is_available():
    device = 0
    device_name = torch.cuda.get_device_name(0)
    logger.info(f"Using GPU device from environment variable: {device_name}")
elif device_env == 'cpu':
    device = -1
    device_name = "CPU"
    logger.info("Using CPU device from environment variable")
else:
    # Interactive device selection when running script directly
    if __name__ == '__main__':
        device, device_name = select_device()
    else:
        # Default behavior for API usage
        device = 0 if torch.cuda.is_available() else -1
        device_name = torch.cuda.get_device_name(0) if device == 0 else "CPU"

logger.info(f"Using device: {device_name}")
if device == 0 and torch.cuda.is_available():
    logger.info(f"CUDA version: {torch.version.cuda}")
    logger.info(f"CUDA device count: {torch.cuda.device_count()}")

# Initialize the sentiment analysis pipeline with IndoBERT
# Using Indonesian sentiment analysis model
pretrained = "mdhugol/indonesia-bert-sentiment-classification"
logger.info("Loading model...")
model = AutoModelForSequenceClassification.from_pretrained(pretrained)
tokenizer = AutoTokenizer.from_pretrained(pretrained)

# Move model to GPU if available and selected
if device == 0 and torch.cuda.is_available():
    logger.info("Moving model to GPU...")
    model = model.to("cuda")

logger.info("Creating sentiment analysis pipeline...")
sentiment_pipeline = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer, device=device)
logger.info("Pipeline created successfully!")

# Label mapping for IndoBERT sentiment analysis (original)
original_label_mapping = {
    'LABEL_0': 'positive',
    'LABEL_1': 'neutral',
    'LABEL_2': 'negative'
}

# Binary classification mapping (combining neutral with negative as "negative")
binary_label_mapping = {
    'positive': 'positive',
    'neutral': 'negative',
    'negative': 'negative'
}

# Binary numeric mapping (1 for positive, 0 for negative)
binary_numeric_mapping = {
    'positive': 1,
    'negative': 0
}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    device_info = {
        "device": device_name,
        "cuda_available": torch.cuda.is_available()
    }
    if torch.cuda.is_available():
        device_info["cuda_version"] = torch.version.cuda
        device_info["device_count"] = torch.cuda.device_count()
        device_info["device_name"] = torch.cuda.get_device_name(0)
        device_info["memory_allocated"] = f"{torch.cuda.memory_allocated(0) / 1024**2:.2f} MB"
        device_info["memory_reserved"] = f"{torch.cuda.memory_reserved(0) / 1024**2:.2f} MB"
    
    return jsonify({
        "status": "healthy", 
        "message": "Binary sentiment analysis API is running with IndoBERT",
        "device_info": device_info,
        "classification_type": "binary"
    }), 200

@app.route('/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyze sentiment of text with binary classification"""
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
        mapped_label = original_label_mapping.get(original_label, 'neutral')
        
        # Convert to binary classification
        binary_label = binary_label_mapping.get(mapped_label, 'negative')
        
        # Get numeric value for binary classification
        numeric_label = binary_numeric_mapping.get(binary_label, 0)
        
        # Return results
        return jsonify({
            "label": binary_label,
            "numeric_label": numeric_label,
            "confidence": score,
            "original_label": original_label,
            "original_mapped_label": mapped_label,
            "scores": {
                binary_label: score
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment: {str(e)}")
        return jsonify({"error": f"Error analyzing sentiment: {str(e)}"}), 500

@app.route('/analyze-batch', methods=['POST'])
def analyze_sentiment_batch():
    """Analyze sentiment for a batch of texts with binary classification"""
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
                mapped_label = original_label_mapping.get(original_label, 'neutral')
                
                # Convert to binary classification
                binary_label = binary_label_mapping.get(mapped_label, 'negative')
                
                # Get numeric value for binary classification
                numeric_label = binary_numeric_mapping.get(binary_label, 0)
                
                results.append({
                    "index": i,
                    "label": binary_label,
                    "numeric_label": numeric_label,
                    "confidence": score,
                    "original_label": original_label,
                    "original_mapped_label": mapped_label,
                    "scores": {
                        binary_label: score
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
    app.run(host='0.0.0.0', port=5001, debug=True)