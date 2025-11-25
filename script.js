// Use wordsData from words.js
// Session state
let currentSessionWords = [];
const SESSION_SIZE = 10;

// DOM Elements
const card = document.getElementById('flashcard');
const wordFront = document.getElementById('word-front');
const wordBack = document.getElementById('word-back');
const categoryFront = document.getElementById('category-front');
const categoryBack = document.getElementById('category-back');
const progressFront = document.getElementById('progress-front');
const progressBack = document.getElementById('progress-back');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const newSessionBtn = document.getElementById('new-session-btn');

// Shuffle function (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function startNewSession() {
    // Create a copy of the full data to shuffle
    let allWords = [...wordsData];
    shuffleArray(allWords);

    // Select the first 10 words
    currentSessionWords = allWords.slice(0, SESSION_SIZE);
    currentIndex = 0;
    isFlipped = false;

    updateCard();
}

// Initialize first session
startNewSession();

// Initialize
function updateCard() {
    const currentWord = currentSessionWords[currentIndex];

    // Update content
    wordFront.textContent = currentWord.en;
    wordBack.textContent = currentWord.fr;
    categoryFront.textContent = currentWord.type;
    categoryBack.textContent = currentWord.type;

    // Update progress
    const progressText = `${currentIndex + 1} / ${currentSessionWords.length}`;
    progressFront.textContent = progressText;
    progressBack.textContent = progressText;

    // Reset flip state if needed
    if (isFlipped) {
        card.classList.remove('is-flipped');
        isFlipped = false;
    }
}

// Speak function
function speakFrench(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.9; // Slightly slower for clarity

        // Optional: Try to select a French voice if available
        const voices = window.speechSynthesis.getVoices();
        const frenchVoice = voices.find(voice => voice.lang.includes('fr'));
        if (frenchVoice) {
            utterance.voice = frenchVoice;
        }

        window.speechSynthesis.speak(utterance);
    } else {
        console.warn("Web Speech API not supported");
    }
}

// Event Listeners
card.addEventListener('click', () => {
    card.classList.toggle('is-flipped');
    isFlipped = !isFlipped;

    if (isFlipped) {
        // Small delay to match the flip animation halfway
        setTimeout(() => {
            speakFrench(currentSessionWords[currentIndex].fr);
        }, 300);
    }
});

prevBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card flip if button is on top (though it's outside)
    currentIndex = (currentIndex - 1 + currentSessionWords.length) % currentSessionWords.length;
    updateCard();
});

nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % currentSessionWords.length;
    updateCard();
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % currentSessionWords.length;
        updateCard();
    } else if (e.key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + currentSessionWords.length) % currentSessionWords.length;
        updateCard();
    } else if (e.key === ' ' || e.key === 'Enter') {
        card.click();
    }
});

newSessionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startNewSession();
});

// Initial load
// updateCard() called in startNewSession()

// Pre-load voices (sometimes needed for Chrome)
window.speechSynthesis.onvoiceschanged = () => {
    // Voices loaded
};
