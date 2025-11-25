// Import Transformers.js
import { pipeline, env } from './node_modules/@xenova/transformers/dist/transformers.min.js';

// Configure Transformers.js to use local models
env.allowLocalModels = false;
env.useBrowserCache = true;

// Session state
let currentSessionWords = [];
const SESSION_SIZE = 10;
let currentIndex = 0;
let isFlipped = false;

// Speech recognition state
let recognizer = null;
let isListening = false;
let isModelLoading = false;
let mediaRecorder = null;
let audioChunks = [];
let ignoreProcessing = false; // Flag to ignore audio processing during card flip

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
const micBtn = document.getElementById('mic-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const successOverlay = document.getElementById('success-overlay');
const transcriptionStatus = document.getElementById('transcription-status');
const statusText = document.getElementById('status-text');
const transcribedTextEl = document.getElementById('transcribed-text');

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

    // Set ignore flag during card update to prevent false matches
    ignoreProcessing = true;

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

    // Clear ignore flag after a short delay
    setTimeout(() => {
        ignoreProcessing = false;
    }, 300);
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

// Initialize Whisper model
async function initializeModel() {
    if (recognizer || isModelLoading) return;

    isModelLoading = true;
    loadingOverlay.classList.add('active');

    try {
        console.log('Loading Whisper model...');
        recognizer = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
        console.log('Whisper model loaded successfully!');
    } catch (error) {
        console.error('Error loading Whisper model:', error);
        alert('Failed to load speech recognition model. Please refresh and try again.');
    } finally {
        isModelLoading = false;
        loadingOverlay.classList.remove('active');
    }
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[len1][len2];
}

// Normalize text for comparison
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric
}

// Check if pronunciation matches
function checkPronunciation(transcribedText, expectedWord) {
    const normalized1 = normalizeText(transcribedText);
    const normalized2 = normalizeText(expectedWord);

    // Direct match
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
        return true;
    }

    // Fuzzy match - allow up to 2 character differences for short words, more for longer
    const maxDistance = Math.max(2, Math.floor(normalized2.length * 0.3));
    const distance = levenshteinDistance(normalized1, normalized2);

    console.log(`Comparing: "${normalized1}" vs "${normalized2}", distance: ${distance}, max: ${maxDistance}`);

    return distance <= maxDistance;
}

// Show success animation and advance
async function showSuccess() {
    // Set ignore flag to prevent processing during success animation
    ignoreProcessing = true;

    successOverlay.classList.add('active');

    // Play success sound (using speech synthesis)
    speakFrench(currentSessionWords[currentIndex].fr);

    // Wait for animation (reduced from 1500ms)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Hide overlay
    successOverlay.classList.remove('active');

    // Flip card
    if (!isFlipped) {
        card.classList.add('is-flipped');
        isFlipped = true;
    }

    // Wait a bit then advance (reduced from 1000ms)
    await new Promise(resolve => setTimeout(resolve, 400));

    // Go to next card
    currentIndex = (currentIndex + 1) % currentSessionWords.length;
    updateCard();

    // Note: ignoreProcessing flag will be cleared by updateCard()
}

// Start listening
async function startListening() {
    if (!recognizer) {
        await initializeModel();
        if (!recognizer) return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            // Process audio
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processAudio(audioBlob);

            // Restart listening if still active
            if (isListening) {
                audioChunks = [];
                mediaRecorder.start();
                setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, 3000); // Record for 3 seconds
            }
        };

        // Start recording
        mediaRecorder.start();

        // Stop after 3 seconds
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, 3000);

        isListening = true;
        micBtn.classList.add('listening');
        updateTranscriptionStatus('listening');

        // Show transcription status when speech recognition is on
        transcriptionStatus.style.visibility = 'visible';

    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please grant permission and try again.');
    }
}

// Stop listening
function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
    updateTranscriptionStatus('ready');

    // Hide transcription status when speech recognition is off
    transcriptionStatus.style.visibility = 'hidden';
    transcriptionStatus.classList.remove('active');

    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }

    if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

// Update transcription status UI
function updateTranscriptionStatus(state, text = '') {
    transcriptionStatus.className = 'transcription-status';

    if (state === 'ready') {
        transcriptionStatus.classList.remove('active');
        statusText.textContent = 'Ready';
        transcribedTextEl.textContent = '';
    } else if (state === 'listening') {
        transcriptionStatus.classList.add('active', 'listening');
        statusText.textContent = 'Listening...';
        transcribedTextEl.textContent = '';
    } else if (state === 'transcribing') {
        transcriptionStatus.classList.add('active', 'transcribing');
        statusText.textContent = 'Transcribing...';
        transcribedTextEl.textContent = '';
    } else if (state === 'transcribed') {
        transcriptionStatus.classList.add('active', 'listening');
        statusText.textContent = 'Heard:';
        transcribedTextEl.textContent = text;
    }
}

// Process audio with Whisper
async function processAudio(audioBlob) {
    // Skip processing if we're ignoring (during flip)
    if (ignoreProcessing) {
        console.log('Ignoring audio processing during card flip');
        return;
    }

    try {
        updateTranscriptionStatus('transcribing');

        // Convert blob to audio buffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get audio data
        const audioData = audioBuffer.getChannelData(0);

        console.log('Transcribing audio...');

        // Transcribe with Whisper
        const result = await recognizer(audioData, {
            language: 'french',
            task: 'transcribe',
        });

        const transcribedText = result.text.trim();
        console.log('Transcribed:', transcribedText);

        // Show what was transcribed
        updateTranscriptionStatus('transcribed', transcribedText);

        // Clear transcription after 3 seconds
        setTimeout(() => {
            if (isListening) {
                updateTranscriptionStatus('listening');
            }
        }, 3000);

        // Check if it matches the current word
        const expectedWord = currentSessionWords[currentIndex].fr;

        if (checkPronunciation(transcribedText, expectedWord)) {
            console.log('Match found!');
            await showSuccess();
        } else {
            console.log('No match. Expected:', expectedWord);
        }

    } catch (error) {
        console.error('Error processing audio:', error);
        if (isListening) {
            updateTranscriptionStatus('listening');
        }
    }
}

// Event Listeners
card.addEventListener('click', () => {
    // Set ignore flag to skip audio processing during flip
    ignoreProcessing = true;

    card.classList.toggle('is-flipped');
    isFlipped = !isFlipped;

    if (isFlipped) {
        // Small delay to match the flip animation halfway
        setTimeout(() => {
            speakFrench(currentSessionWords[currentIndex].fr);
        }, 200);

        // Clear ignore flag after flip and speech complete
        setTimeout(() => {
            ignoreProcessing = false;
        }, 1500);
    } else {
        // Clear ignore flag after flip back
        setTimeout(() => {
            ignoreProcessing = false;
        }, 600);
    }
});

prevBtn.addEventListener('click', async (e) => {
    e.stopPropagation();

    // If card is flipped, flip it back first to prevent cheating
    if (isFlipped) {
        card.classList.remove('is-flipped');
        isFlipped = false;
        // Wait for flip animation to complete
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    currentIndex = (currentIndex - 1 + currentSessionWords.length) % currentSessionWords.length;
    updateCard();
});

nextBtn.addEventListener('click', async (e) => {
    e.stopPropagation();

    // If card is flipped, flip it back first to prevent cheating
    if (isFlipped) {
        card.classList.remove('is-flipped');
        isFlipped = false;
        // Wait for flip animation to complete
        await new Promise(resolve => setTimeout(resolve, 400));
    }

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

// Microphone button
micBtn.addEventListener('click', async (e) => {
    e.stopPropagation();

    if (isListening) {
        stopListening();
    } else {
        await startListening();
    }
});

// Initial load
// updateCard() called in startNewSession()

// Pre-load voices (sometimes needed for Chrome)
window.speechSynthesis.onvoiceschanged = () => {
    // Voices loaded
};
