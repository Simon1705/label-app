import requests
import json

# Test the health endpoint
def test_health():
    response = requests.get('http://localhost:5000/health')
    print("Health check response:")
    print(response.status_code)
    print(json.dumps(response.json(), indent=2))
    print()

# Test single text analysis
def test_single_analysis():
    text = "This is a wonderful product! I love it so much."
    response = requests.post('http://localhost:5000/analyze', 
                            json={'text': text})
    print("Single analysis response:")
    print(response.status_code)
    print(json.dumps(response.json(), indent=2))
    print()

# Test batch analysis
def test_batch_analysis():
    texts = [
        "This is a wonderful product! I love it so much.",
        "This is terrible. I hate it.",
        "It's okay, nothing special but not bad either."
    ]
    response = requests.post('http://localhost:5000/analyze-batch', 
                            json={'texts': texts})
    print("Batch analysis response:")
    print(response.status_code)
    print(json.dumps(response.json(), indent=2))
    print()

if __name__ == '__main__':
    print("Testing Sentiment Analysis API")
    print("=" * 40)
    test_health()
    test_single_analysis()
    test_batch_analysis()