import os
import time
import json
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
CLIENT_ID = os.getenv("SPOTIPY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SPOTIPY_REDIRECT_URI")
SCOPE = "user-read-playback-state user-read-currently-playing user-read-recently-played user-top-read"

def get_spotify_client():
    if not CLIENT_ID or not CLIENT_SECRET or not REDIRECT_URI:
        print("Error: Missing Spotify credentials. Please set SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET, and SPOTIPY_REDIRECT_URI in .env file.")
        return None

    try:
        auth_manager = SpotifyOAuth(
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            redirect_uri=REDIRECT_URI,
            scope=SCOPE,
            open_browser=False
        )
        return spotipy.Spotify(auth_manager=auth_manager)
    except Exception as e:
        print(f"Authentication Error: {e}")
        return None

def update_realtime_data(sp, data):
    try:
        # Current Playback
        current = sp.current_playback()
        if current and current.get('item'):
            data["current_playback"] = current
        else:
            data["current_playback"] = None # Clear if nothing playing

        # Recently Played
        recent = sp.current_user_recently_played(limit=50)
        data["recently_played"] = recent['items']
        return True
    except Exception as e:
        print(f"Error fetching realtime data: {e}")
        return False

def update_stats_data(sp, data):
    try:
        print("Updating Top Artists and Tracks (Heavy Fetch)...")
        terms = ['short_term', 'medium_term', 'long_term']
        for term in terms:
            top_artists = sp.current_user_top_artists(limit=20, time_range=term)
            data["top_artists"][term] = top_artists['items']

            top_tracks = sp.current_user_top_tracks(limit=20, time_range=term)
            data["top_tracks"][term] = top_tracks['items']
        return True
    except Exception as e:
        print(f"Error fetching stats data: {e}")
        return False

def main():
    print("Starting Spotify Data Fetcher...")
    print("Schedule: Realtime data every 10s, Stats every 12 hours.")
    
    sp = get_spotify_client()
    if not sp:
        return

    # Initialize data structure
    full_data = {
        "timestamp": "",
        "current_playback": None,
        "recently_played": [],
        "top_artists": {},
        "top_tracks": {}
    }

    last_stats_update = 0
    STATS_INTERVAL = 43200  # 12 hours in seconds

    while True:
        current_time = time.time()
        full_data["timestamp"] = datetime.now().isoformat()

        # Always update realtime data
        update_realtime_data(sp, full_data)

        # Update stats if interval passed
        if current_time - last_stats_update > STATS_INTERVAL:
            if update_stats_data(sp, full_data):
                last_stats_update = current_time

        # Save to file
        try:
            # Ensure data directory exists
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(script_dir)
            data_dir = os.path.join(project_root, 'data')
            os.makedirs(data_dir, exist_ok=True)
            
            data_file_path = os.path.join(data_dir, 'data.json')
            
            with open(data_file_path, 'w', encoding='utf-8') as f:
                json.dump(full_data, f, ensure_ascii=False, indent=2)
            print(f"Data updated at {datetime.now().strftime('%H:%M:%S')}")
        except Exception as e:
            print(f"Error saving data: {e}")
        
        time.sleep(10)

if __name__ == "__main__":
    main()
