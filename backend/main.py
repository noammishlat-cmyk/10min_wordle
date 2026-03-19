from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import requests
from datetime import datetime
import math
import random


def load_hebrew_words():
    with open("./dictionaries/he_full.txt", encoding="utf-8") as f:
        # Take only the first column (the word itself)
        words = {line.split()[0] for line in f if line.strip()}
    return words

def load_english_words():
    with open("./dictionaries/en_full.txt", encoding="utf-8") as f:
        # Take only the first column (the word itself)
        words = {line.split()[0] for line in f if line.strip()}
    return words

WORDS_ENG = []
WORDS_HEB = []
ALL_WORDS_HEB = []
ALL_WORDS_ENG = []

app = FastAPI()

def load_words_eng():
    global WORDS_ENG
    global ALL_WORDS_ENG

    words = load_english_words()
    WORDS_ENG = [w.upper() for w in words if len(w) == 5]

    random.shuffle(WORDS_ENG)
    print(f"Loaded {len(WORDS_ENG)} words into the English list.")

def load_words_heb():
    global WORDS_HEB
    global ALL_WORDS_HEB

    words = load_hebrew_words()
    WORDS_HEB = [w.upper() for w in words if len(w) == 5]    

    random.shuffle(WORDS_HEB)
    print(f"Loaded {len(WORDS_HEB)} words into the Hebrew list.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://10min-wordle.vercel.app/", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def validate_word_exists_heb(word):
    try:
        if word in ALL_WORDS_HEB:
            print(f"Hebrew word '{word}' is valid!")
            return True
                
        print(f"Hebrew word '{word}' not found.")
        return False
    except Exception as e:
        print(f"API Error: {e}")
        return False
    
async def validate_word_exists_eng(word: str):
    try:
        if word in ALL_WORDS_ENG:
            print(f"English word '{word}' is valid!")
            return True
                
        print(f"English word '{word}' not found.")
        return False
    except Exception as e:
        print(f"API Error: {e}")
        return False

def get_word_of_the_day_eng():
    # 1. Get current seconds since 1970
    now_ts = datetime.now().timestamp()
    
    # 2. Divide by 600 (10 mins * 60 seconds)
    # math.floor ensures the number only changes every 10 mins
    ten_min_bucket = math.floor(now_ts / 600)
    
    # 3. Use that bucket to pick the word
    return WORDS_ENG[ten_min_bucket % len(WORDS_ENG)]

def get_word_of_the_day_heb():
    # 1. Get current seconds since 1970
    now_ts = datetime.now().timestamp()
    
    # 2. Divide by 600 (10 mins * 60 seconds)
    # math.floor ensures the number only changes every 10 mins
    ten_min_bucket = math.floor(now_ts / 600)
    
    # 3. Use that bucket to pick the word
    return WORDS_HEB[ten_min_bucket % len(WORDS_HEB)]

@app.get("/check_eng")
async def check_word_eng(word: str):
    correct_word = get_word_of_the_day_eng()

    print(f"Request word : {word}")
    print(f"Correct word : {correct_word}")

    is_valid = await validate_word_exists_eng(word)
    if is_valid == False:
        return {"isValid": False, "correctSequence": "FFFFFF"}

    correct_letters = ""
    for char in range(0,5):
        if word[char] == correct_word[char]:
            correct_letters += 'C'
        elif word[char] in correct_word:
            correct_letters += 'P'
        else:
            correct_letters += 'F'

    return {"isValid": True, "correctSequence": correct_letters, "isCorrect": correct_word == word}

@app.get("/correct_eng")
async def get_eng_word():
    correct_word = get_word_of_the_day_eng()
    return {"correct": correct_word}

@app.get("/check_heb")
async def check_word_heb(word: str):
    correct_word = get_word_of_the_day_heb()

    print(f"Request word : {word}")
    print(f"Correct word : {correct_word}")

    is_valid = await validate_word_exists_heb(word)
    if is_valid == False:
        return {"isValid": False, "correctSequence": "FFFFFF"}

    correct_letters = ""
    for char in range(0,5):
        if word[char] == correct_word[char]:
            correct_letters += 'C'
        elif word[char] in correct_word:
            correct_letters += 'P'
        else:
            correct_letters += 'F'

    return {"isValid": True, "correctSequence": correct_letters, "isCorrect": correct_word == word}

@app.get("/correct_heb")
async def get_heb_word():
    correct_word = get_word_of_the_day_heb()
    return {"correct": correct_word}

@app.get("/get_timer")
async def get_timer():
    now_ts = datetime.now().timestamp()
    
    # Calculate how many seconds have passed in the CURRENT 10-min block
    seconds_passed_in_bucket = now_ts % 600
    
    # Seconds remaining is the total bucket size (600) minus what passed
    seconds_remaining = 600 - seconds_passed_in_bucket

    word_index = int(now_ts // 600)
    
    return {"seconds": int(seconds_remaining), "word": word_index}

if __name__ == "__main__":
    load_words_eng()
    load_words_heb()
    ALL_WORDS_HEB = load_hebrew_words()
    ALL_WORDS_ENG = {w.upper() for w in load_english_words()}
    uvicorn.run(app, host="0.0.0.0", port=8000)