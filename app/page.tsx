'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion'
import Cookies from 'js-cookie';

export default function Home() {
  const [currentGuess, setCurrentGuess] = useState("");
  const [currentLine, setCurrentLine] = useState(0); 

  const [modalTitle, setModalTitle] = useState("You guessed the word succesfully!");
  const [wordWasTitle, setWordWasTitle] = useState("The correct word was ");

  const [showModal, setShowModal] = useState(false); 
  const [stopKeyboard, setStopKeyboard] = useState(false); 

  const [wrongLocLetters, setWrongLocLetters] = useState<string[]>([]);
  const [incorrectLetters, setIncorrectLetters] = useState<string[]>([]);
  const [correctLetters, setCorrectLetters] = useState<string[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [isLoaded, setIsLoaded] = useState(false);

  const [currentWordIndex, setCurrentWordIndex] = useState("");

  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '⌫'],
    [ 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⏎'],
  ];

  const onKeyAction = (key: string) => {
    if (fetchingData || showModal || stopKeyboard) {
      if (stopKeyboard){
        setShowModal(true);
        }
      return;
    }

    if (key === "ENTER" || key === "⏎") {
      if (currentGuess.length === 5) handleEnterSubmit();
      return;
    }

    if (key === "⌫" || key === "BACKSPACE") {
      if (currentGuess.length === 0) return;
      const newGuesses = [...guesses];
      newGuesses[currentLine][currentGuess.length - 1] = '';
      setGuesses(newGuesses);
      setCurrentGuess(prev => prev.slice(0, -1));
      return;
    }

    if (/^[A-Z]$/.test(key.toUpperCase()) && currentGuess.length < 5) {
      const letter = key.toUpperCase();
      const nextGuess = currentGuess + letter;
      setCurrentGuess(nextGuess);
      const newGuesses = [...guesses];
      newGuesses[currentLine][nextGuess.length - 1] = letter;
      setGuesses(newGuesses);
    }
  };

  const handleEnterSubmit = async () => {
    setFetchingData(true);
    try {
      const is_valid = await checkWordOnBackend(currentGuess);
      
      if (is_valid) {
        setCurrentGuess("");
        setCurrentLine((prev) => prev + 1);
      }
    } finally {
      setFetchingData(false); 
    }
  }

  const [guesses, setGuesses] = useState([
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ]);

  const [guessesPlace, setGuessesPlace] = useState([
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ]);

  useEffect(() => {
  if (!isLoaded || !currentWordIndex) return;

    const dataToSave = {
      guesses,
      guessesPlace,
      currentLine,
      stopKeyboard,
      wrongLocLetters,
      incorrectLetters,
      correctLetters,
      currentGuess,
      currentWordIndex 
    };
    
    Cookies.set('save_data_eng', JSON.stringify(dataToSave), { expires: 1 });
  }, [guesses, guessesPlace, currentLine, stopKeyboard, isLoaded, currentWordIndex]);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        const response = await fetch(`${apiUrl}/get_timer`);
        const data = await response.json();
        const serverWordIndex = data.word;
        setTimeLeft(data.seconds);

        const saved = Cookies.get('save_data_eng');
        if (saved) {
          const parsed = JSON.parse(decodeURIComponent(saved));
          // Compare immediately
          if (parsed.currentWordIndex && serverWordIndex !== parsed.currentWordIndex) {
            Cookies.remove('save_data_eng');
            setCurrentWordIndex(serverWordIndex);
          } else {
            // Load all saved states
            setGuesses(parsed.guesses);
            setGuessesPlace(parsed.guessesPlace);
            setCurrentLine(parsed.currentLine);
            setStopKeyboard(parsed.stopKeyboard);
            setWrongLocLetters(parsed.wrongLocLetters || []);
            setIncorrectLetters(parsed.incorrectLetters || []);
            setCorrectLetters(parsed.correctLetters || []);
            setCurrentGuess(parsed.currentGuess || "");
            setCurrentWordIndex(serverWordIndex);
          }
        } else {
          setCurrentWordIndex(serverWordIndex);
        }
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    initializeGame();
  }, [apiUrl]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };


  const [timeLeft, setTimeLeft] = useState(-1);

  const [fetchingData, setFetchingData] = useState(false);

  const checkForNewWord = async () => {
    try {
      const response = await fetch(`${apiUrl}/get_timer`);
      const data = await response.json();
      
      // If the server says the word index has changed:
      if (data.word.toString() !== currentWordIndex.toString()) {
        console.log("Timer hit zero and word changed! Resetting...");
        Cookies.remove('save_data_eng');
        window.location.reload(); // Hard reload to reset all states
      } else {
        // If the timer hit 0 but the server hasn't flipped the word yet,
        // sync the timer again and wait.
        setTimeLeft(data.seconds);
      }
    } catch (e) {
      console.error("Failed to sync new word:", e);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          // When the timer hits 0, don't just stay at 0. 
          // Trigger a re-fetch to get the NEW word index from the server.
          checkForNewWord(); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentWordIndex]); // Re-run if index changes

  useEffect(() => {
    if (!isLoaded) return;

    const syncWithServer = async () => {
      try {
        const response = await fetch(`${apiUrl}/get_timer`);
        const data = await response.json();
        
        // Update timer immediately
        setTimeLeft(data.seconds);

        // Check if word changed while user was away
        if (data.word !== currentWordIndex) {
          Cookies.remove('save_data_eng');
          window.location.reload();
        }
      } catch (e) {
        console.error("Sync error:", e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithServer();
      }
    };

    // Internal countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          syncWithServer(); // If timer hits 0 while looking at it, double check server
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoaded, currentWordIndex, apiUrl]);

  useEffect(() => {
    if (timeLeft === 0) {
      Cookies.remove('save_data_eng');

      const reloadTimeout = setTimeout(() => {
        window.location.reload();
      }, 1000);

      return () => clearTimeout(reloadTimeout);
    }
  }, [timeLeft]);



  const checkWordOnBackend = async (guess: string) => {
    try {
      const response = await fetch(`${apiUrl}/check_eng?word=${guess}`);
      
      const data = await response.json(); 

      if (data.isValid) {
        const sequence = data.correctSequence;
        const newIncorrects = [...incorrectLetters];
        const newCorrects = [...correctLetters];
        const newWrongLoc = [...wrongLocLetters];
        sequence.split('').forEach((status: string, index: number) => {
          const letter = guess[index].toUpperCase();
          if (status === 'F' && !newIncorrects.includes(letter)) {
            newIncorrects.push(letter);
          }
          else if (status === 'C' && !newCorrects.includes(letter)) {
            newCorrects.push(letter);
          }
          else if (status === 'P' && !newWrongLoc.includes(letter)) {
            newWrongLoc.push(letter);
          }
        });
        setIncorrectLetters(newIncorrects);
        setCorrectLetters(newCorrects);
        setWrongLocLetters(newWrongLoc)
        const updatedMatrix = [...guessesPlace];

        updatedMatrix[currentLine] = sequence.split('');
        setGuessesPlace(updatedMatrix);

        const is_correct = data.isCorrect;
        if (is_correct){
          setShowModal(true);
          setModalTitle("You guessed the word succesfully");
          setWordWasTitle("Wait for the next word soon");
          setStopKeyboard(true);
        }
      }
      
      return data.isValid; 
    } catch (error) {
      console.error("Connection failed:", error);
      return false;
    }
  };

  useEffect(() => {
    const handleGameOver = async () => {
      if (stopKeyboard) return;

      if (currentLine > 4) {
        setModalTitle("Better luck next time!");
        setShowModal(true);
        setStopKeyboard(true);

        try {
          const response = await fetch(`${apiUrl}/correct_eng`);
          const data = await response.json();

          const correct = data.correct;
          setWordWasTitle(`The correct word was ${correct}`);

        } catch (error) {
          console.error("Error fetching the word:", error);
          setWordWasTitle("Error while fetching word");
        }
      }
    };

    handleGameOver();
  }, [ currentLine ])

  const HEBREW_TO_ENGLISH: Record<string, string> = {
    'ש': 'A', 'נ': 'B', 'ב': 'C', 'ג': 'D', 'ק': 'E',
    'כ': 'F', 'ע': 'G', 'י': 'H', 'ן': 'I', 'ח': 'J',
    'ל': 'K', 'ך': 'L', 'צ': 'M', 'מ': 'N', 'ם': 'O',
    'פ': 'P', '/': 'Q', 'ר': 'R', 'ד': 'S', 'א': 'T',
    'ו': 'U', 'ה': 'V', "'" : 'W', 'ס': 'X', 'ט': 'Y', 'ז': 'Z'
  };

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const { code, key } = event;
      if (fetchingData || showModal || stopKeyboard) {
        if (stopKeyboard){
          setShowModal(true);
          }
        return;
      }
      
      if (key === "Enter") {
        if (currentGuess.length === 5) {
          handleEnterSubmit()
        }
        return;
      }
      if (key === 'Backspace') {
        if (fetchingData) return;
        const newGuesses = [...guesses];
        newGuesses[currentLine][currentGuess.length - 1] = '';
        setCurrentGuess((prev) => prev.slice(0, -1));
        return;
      }

      let char = '';

      // 1. Check if it's already an English letter
      if (/^[a-zA-Z]$/.test(key)) {
        char = key.toUpperCase();
      } 
      // 2. Otherwise, check if it's a Hebrew letter we can map to English
      else if (HEBREW_TO_ENGLISH[key]) {
        char = HEBREW_TO_ENGLISH[key];
      }

      if (char && currentGuess.length < 5) {
        if (fetchingData) return;
        
        const nextGuess = currentGuess + char;
        setCurrentGuess(nextGuess);

        const newGuesses = [...guesses];
        newGuesses[currentLine][nextGuess.length - 1] = char; 
        setGuesses(newGuesses);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, guesses, fetchingData]);

  return (
  <div className="flex flex-col min-h-screen bg-black font-sans text-white items-center p-4">
    <Link 
      href="/hebrew" 
      className="absolute top-6 right-6 z-50 flex items-center justify-center 
                w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 
                hover:bg-zinc-700 hover:scale-110 active:scale-95 transition-all
                shadow-[0_0_15px_rgba(255,255,255,0.1)] group"
    >
      <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 group-hover:text-white">
        עברית
      </span>
    </Link>
    <div className="w-full max-w-md bg-[#250000] rounded-2xl py-3 px-6 min-h-20 text-center border border-red-900/30 shadow-lg mb-8">
      <h3 className="text-[10px] uppercase tracking-widest text-zinc-400">Next Refresh In</h3>
      <p className="text-2xl font-mono font-bold">{timeLeft === -1 ? "" :formatTime(timeLeft)}</p>
    </div>

    <main className="grow flex flex-col items-center justify-center w-full max-w-2xl bg-zinc-900/50 rounded-[40px] p-6 md:p-12 shadow-2xl border border-white/5">
      <h3 className="text-xl md:text-2xl font-bold mb-6 text-zinc-300">Enter Your Guess</h3>
      
      <div className="flex flex-col gap-2 md:gap-4">
        {guesses.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2 md:gap-4">
            {row.map((letter, letterIndex) => {
              const colorCode = guessesPlace[rowIndex][letterIndex];
              return (
                <div 
                  key={letterIndex} 
                  className={`flex justify-center items-center rounded-lg 
                    w-12 h-16 md:w-16 md:h-20 text-4xl md:text-6xl font-extrabold
                    transition-all duration-500
                    ${colorCode === 'C' ? 'bg-green-500' : 
                      colorCode === 'P' ? 'bg-yellow-500' : 
                      colorCode === 'F' ? 'bg-zinc-600' : 'bg-zinc-800'}
                    shadow-[0_4px_0_0_rgba(0,0,0,0.3)]
                  `}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </main>

    {!stopKeyboard && (
    <div className="w-full max-w-2xl mt-8 mb-4 flex flex-col gap-2 px-2">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5 touch-manipulation">
          {row.map((key) => {
            const wrontLoc = wrongLocLetters.includes(key.toUpperCase());
            const isIncorrect = incorrectLetters.includes(key.toUpperCase());
            const isCorrect = correctLetters.includes(key.toUpperCase());

            return (
              <button
                key={key}
                onClick={() => onKeyAction(key)}
                className={`
                  ${key === 'ENTER' || key === '⌫' ? 'px-3 text-[10px] min-w-4' : 'flex-1 text-sm md:text-lg'}
                  h-14 rounded-lg font-bold uppercase transition-all 
                  active:scale-90 active:opacity-70
                  
                  ${isCorrect 
                    ? 'bg-green-600 text-white shadow-md' 
                    : wrontLoc 
                    ? 'bg-amber-500 text-white shadow-md' 
                    : isIncorrect 
                    ? 'bg-zinc-800 text-zinc-500 opacity-50' 
                    : 'bg-zinc-700 text-white shadow-md'}
                `}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
    )}
    <p className="text-center text-[10px] text-zinc-500 mt-4 uppercase tracking-widest">
      © Made by Noam Greenberg (Nomspot)
    </p>
    <AnimatePresence>
      {showModal && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-12"
          onClick={() => setShowModal(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "linear" }}
        >
          <motion.div className="flex bg-amber-100 rounded-4xl min-w-40 min-h-40 flex-col justify-center items-center p-12"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            <h3 className="text-xl font-black mb-6 text-zinc-400 text-center uppercase tracking-tight leading-tight">
              {modalTitle}
            </h3>
            <div className="flex flex-col gap-2 md:gap-4">
              {guesses.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-2 md:gap-4">
                  {row.map((letter, letterIndex) => {
                    const colorCode = guessesPlace[rowIndex][letterIndex];
                    return (
                      <div 
                        key={letterIndex} 
                        className={`flex justify-center items-center rounded-lg text-white
                          w-12 h-16 md:w-16 md:h-20 text-4xl md:text-6xl font-extrabold
                          transition-all duration-500
                          ${colorCode === 'C' ? 'bg-green-500' : 
                            colorCode === 'P' ? 'bg-yellow-500' : 
                            colorCode === 'F' ? 'bg-zinc-600' : 'bg-zinc-800'}
                          shadow-[0_4px_0_0_rgba(0,0,0,0.3)]
                        `}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <h3 className="text-xl font-black mt-12 text-emerald-600 text-center uppercase tracking-tight leading-tight">
              {wordWasTitle}
            </h3>
            <button className="w-full mt-8 py-4 bg-green-600 text-white font-black rounded-xl text-xl active:scale-95 transition-transform" onClick={() => setShowModal(false)}>
              CLOSE
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {!isLoaded &&
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-12"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "circIn" }}>
        </motion.div>
      }
    </AnimatePresence>
  </div>
);
}
