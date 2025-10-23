import torch
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification

def test_cuda():
    print("CUDA Available:", torch.cuda.is_available())
    print("CUDA Device Count:", torch.cuda.device_count())
    
    if torch.cuda.is_available():
        print("CUDA Current Device:", torch.cuda.current_device())
        print("CUDA Device Name:", torch.cuda.get_device_name(0))
        
        # Test loading model on GPU
        print("Loading model...")
        pretrained = "mdhugol/indonesia-bert-sentiment-classification"
        model = AutoModelForSequenceClassification.from_pretrained(pretrained)
        tokenizer = AutoTokenizer.from_pretrained(pretrained)
        
        print("Moving model to GPU...")
        model = model.to("cuda")
        
        print("Creating pipeline with GPU...")
        sentiment_pipeline = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer, device=0)
        
        # Test inference
        print("Testing inference...")
        result = sentiment_pipeline("Indonesia adalah negara yang indah")
        print("Result:", result)
        print("Success! Model is using GPU.")
    else:
        print("CUDA is not available. Model will use CPU.")

if __name__ == "__main__":
    test_cuda()