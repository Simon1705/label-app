import requests
import time

def test_sentiment_api():
    # Test single text analysis
    print("Testing single text analysis...")
    start_time = time.time()
    
    response = requests.post('http://localhost:5000/analyze', json={
        'text': 'Indonesia adalah negara yang indah dan memiliki banyak budaya yang beragam.'
    })
    
    end_time = time.time()
    print(f"Response time: {end_time - start_time:.2f} seconds")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Test batch analysis
    print("\nTesting batch analysis...")
    start_time = time.time()
    
    response = requests.post('http://localhost:5000/analyze-batch', json={
        'texts': [
            'Indonesia adalah negara yang indah.',
            'Saya tidak suka dengan pelayanan di tempat ini.',
            'Makanan di restoran ini enak sekali!',
            'Cuaca hari ini biasa saja.'
        ]
    })
    
    end_time = time.time()
    print(f"Response time: {end_time - start_time:.2f} seconds")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    test_sentiment_api()