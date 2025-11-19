// Use wordsData from words.js
let words = [...wordsData];
let currentIndex = 0;
let isFlipped = false;

// Shuffle function (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Shuffle words on load
shuffleArray(words);

// DOM Elements
const card = document.getElementById('flashcard');
const wordFront = document.getElementById('word-front');
const wordBack = document.getElementById('word-back');
const categoryFront = document.getElementById('category-front');
const categoryBack = document.getElementById('category-back');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// Initialize
function updateCard() {
    const currentWord = words[currentIndex];

    // Update content
    wordFront.textContent = currentWord.en;
    wordBack.textContent = currentWord.fr;
    categoryFront.textContent = currentWord.type;
    categoryBack.textContent = currentWord.type;

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
            speakFrench(words[currentIndex].fr);
        }, 300);
    }
});

prevBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card flip if button is on top (though it's outside)
    currentIndex = (currentIndex - 1 + words.length) % words.length;
    updateCard();
});

nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % words.length;
    updateCard();
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % words.length;
        updateCard();
    } else if (e.key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + words.length) % words.length;
        updateCard();
    } else if (e.key === ' ' || e.key === 'Enter') {
        card.click();
    }
});

// Initial load
updateCard();

// Pre-load voices (sometimes needed for Chrome)
window.speechSynthesis.onvoiceschanged = () => {
    // Voices loaded
};
