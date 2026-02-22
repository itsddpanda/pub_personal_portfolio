import requests
import json

def test_mfapi():
    amfi_code = "112090" # SBI Small Cap Fund
    url = f"https://api.mfapi.in/mf/{amfi_code}"
    
    print(f"Fetching data from: {url}")
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        meta = data.get('meta', {})
        nav_data = data.get('data', [])
        
        print(f"Scheme Name: {meta.get('scheme_name')}")
        print(f"Total historical records: {len(nav_data)}")
        
        if nav_data:
            print(f"Latest: {nav_data[0]}")
            print(f"Oldest: {nav_data[-1]}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_mfapi()
