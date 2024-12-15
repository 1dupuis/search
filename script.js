class GeminiSearch {
    constructor() {
        // Gemini API Configuration
        this.GEMINI_API_KEY = 'AIzaSyCd0okpIKnQ7rSe0fw-EuEuKKZwJdqNlKM';
        this.GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

        // DOM Elements
        this.elements = {
            searchInput: document.getElementById('searchInput'),
            searchButton: document.getElementById('searchButton'),
            clearSearchBtn: document.getElementById('clearSearchBtn'),
            searchResults: document.getElementById('searchResults'),
            aiResponse: document.getElementById('aiResponseContent'),
            searchHistory: document.getElementById('searchHistory'),
            themeToggle: document.getElementById('themeToggle'),
            voiceSearchBtn: document.getElementById('voiceSearchBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            advancedSearchOptions: document.getElementById('advancedSearchOptions'),
            copyAIResponseBtn: document.getElementById('copyAIResponseBtn'),
            shareAIResponseBtn: document.getElementById('shareAIResponseBtn'),
            
            // Settings Modal Elements
            darkModeToggle: document.getElementById('darkModeToggle'),
            safeSearchToggle: document.getElementById('safeSearchToggle'),
            aiResponseLengthSelect: document.getElementById('aiResponseLengthSelect'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            cancelSettingsBtn: document.getElementById('cancelSettingsBtn')
        };

        // Application State
        this.state = {
            searchHistory: [],
            currentTheme: 'dark',
            settings: {
                darkMode: true,
                safeSearch: true,
                aiResponseLength: 'medium'
            }
        };

        this.initializeApp();
    }

    initializeApp() {
        this.loadSettings();
        this.loadSearchHistory();
        this.attachEventListeners();
        this.setupVoiceSearch();
        this.initTheme();
        this.handleUrlQuery();
    }
    
    // New method to handle URL query parameter
    handleUrlQuery() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            this.elements.searchInput.value = decodeURIComponent(query);
            this.performSearch();
        }
    }

    attachEventListeners() {
        // Search interactions
        this.elements.searchButton.addEventListener('click', this.performSearch.bind(this));
        this.elements.searchInput.addEventListener('keypress', this.handleSearchKeyPress.bind(this));
        this.elements.clearSearchBtn.addEventListener('click', this.clearSearch.bind(this));

        // Theme and settings
        this.elements.themeToggle.addEventListener('click', this.toggleTheme.bind(this));
        this.elements.settingsBtn.addEventListener('click', this.openSettingsModal.bind(this));
        
        // Settings modal interactions
        this.elements.saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this));
        this.elements.cancelSettingsBtn.addEventListener('click', this.closeSettingsModal.bind(this));

        // AI Response actions
        this.elements.copyAIResponseBtn.addEventListener('click', this.copyAIResponse.bind(this));
        this.elements.shareAIResponseBtn.addEventListener('click', this.shareAIResponse.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    async fetchGeminiResults(query) {
        try {
            const response = await fetch(`${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Act as an advanced search engine and AI assistant. 
                            For the query "${query}", provide:
                            1. 6 comprehensive web result snippets with title, link, and description (100 characters or less each)
                            2. A short & simple, nuanced AI-generated response analyzing the topic
                            3. Insights, context, and potential follow-up questions
                            Respond ONLY with a valid JSON object in the following format: 
                            {
                                "webResults": [{"title": "", "link": "", "snippet": ""}], 
                                "aiResponse": "",
                                "followUpQuestions": []
                            }`
                        }]
                    }]
                })
            });
    
            if (!response.ok) {
                throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
            }
    
            const responseData = await response.json();
            
            // More robust parsing with multiple fallback mechanisms
            const responseText = responseData.candidates[0].content.parts[0].text;
            
            // Remove any code block markers and extra whitespace
            const cleanedText = responseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .replace(/[\n\r]/g, '')
                .trim();
    
            // Try parsing the JSON, with error handling
            try {
                const parsedResults = JSON.parse(cleanedText);
                
                // Validate the parsed results
                if (!parsedResults.webResults || !parsedResults.aiResponse) {
                    throw new Error('Invalid response format');
                }
                
                return parsedResults;
            } catch (parseError) {
                console.error('Failed to parse Gemini response:', parseError);
                console.error('Raw response text:', responseText);
                
                // Fallback mechanism with default results
                return {
                    webResults: [],
                    aiResponse: "I apologize, but I couldn't generate a proper response. Please try your search again.",
                    followUpQuestions: []
                };
            }
        } catch (error) {
            console.error('Gemini API Error:', error);
            
            // More informative error handling
            return {
                webResults: [],
                aiResponse: `Search failed: ${error.message}. Please check your internet connection and try again.`,
                followUpQuestions: ['Try a different search', 'Check internet connection']
            };
        }
    }
    
    async performSearch() {
        const query = this.elements.searchInput.value.trim();
        if (!query) {
            this.displayError(new Error('Please enter a search query'));
            return;
        }
    
        // Update URL without page reload
        history.pushState(null, '', `?q=${encodeURIComponent(query)}`);
    
        this.clearResults();
        this.showLoading();
        this.updateSearchHistory(query);
    
        try {
            // Check for cached results first
            const cachedResults = this.getCachedResults(query);
            if (cachedResults) {
                this.displayWebResults(cachedResults.webResults);
                this.displayAIResponse(cachedResults.aiResponse);
                this.addFollowUpQuestions(cachedResults.followUpQuestions);
                this.clearLoading();
                return;
            }
    
            // Fetch results from Gemini
            const aiResults = await this.fetchGeminiResults(query);
            
            // Cache the results
            this.cacheResults(query, aiResults);
            
            this.displayWebResults(aiResults.webResults);
            this.displayAIResponse(aiResults.aiResponse);
            this.addFollowUpQuestions(aiResults.followUpQuestions);
    
        } catch (error) {
            this.displayError(error);
        } finally {
            this.clearLoading();
        }
    }
    
    // Method to cache results for a given query
    cacheResults(query, results) {
        localStorage.setItem(`searchResults-${query}`, JSON.stringify(results));
    }
    
    // Method to retrieve cached results if available
    getCachedResults(query) {
        const cached = localStorage.getItem(`searchResults-${query}`);
        return cached ? JSON.parse(cached) : null;
    }

    displayWebResults(results) {
        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.classList.add(
                'bg-light-secondary', 
                'dark:bg-dark-secondary', 
                'p-4', 
                'rounded-lg', 
                'hover:scale-105', 
                'transition-transform',
                'shadow-md',
                'hover:shadow-lg'
            );
            resultElement.innerHTML = `
                <h3 class="text-brand-blue font-bold mb-2 text-lg">
                    <a href="${result.link}" target="_blank" class="hover:underline">
                        <i class="fas fa-link mr-2"></i>${result.title}
                    </a>
                </h3>
                <p class="text-light-text dark:text-dark-text">${result.snippet}</p>
            `;
            this.elements.searchResults.appendChild(resultElement);
        });
    }

    displayAIResponse(response) {
        // Clear previous content
        this.elements.aiResponse.innerHTML = '';

        // Create main response
        const responseElement = document.createElement('div');
        responseElement.classList.add('ai-response', 'space-y-4');
        
        // AI Insights Header
        const header = document.createElement('h2');
        header.classList.add('text-2xl', 'font-bold', 'text-brand-blue', 'flex', 'items-center');
        header.innerHTML = `
            <i class="fas fa-brain mr-3"></i>
            AI Insights
            <span class="ml-2 text-sm text-gray-500 ai-pulse">Analyzing...</span>
        `;
        this.elements.aiResponse.appendChild(header);

        // Main response text
        const responseText = document.createElement('p');
        responseText.classList.add('leading-relaxed', 'text-light-text', 'dark:text-dark-text');
        responseText.textContent = response;
        this.elements.aiResponse.appendChild(responseText);

        // Follow-up questions (if available)
        this.addFollowUpQuestions();
    }

    // Enhanced Follow-up Questions
    addFollowUpQuestions(questions = []) {
        const followUpContainer = document.createElement('div');
        followUpContainer.classList.add('mt-6', 'border-t', 'pt-4', 'border-gray-200', 'dark:border-gray-700');
        
        const followUpTitle = document.createElement('h3');
        followUpTitle.classList.add('text-lg', 'font-semibold', 'text-brand-green', 'mb-3');
        followUpTitle.textContent = 'Explore More';
        followUpContainer.appendChild(followUpTitle);

        const questionsList = document.createElement('div');
        questionsList.classList.add('flex', 'flex-wrap', 'gap-2');

        // Combine provided questions with default ones
        const combinedQuestions = [
            ...questions,
            ...[
                'Tell me more about this',
                'What are the key takeaways?',
                'Provide historical context',
                'Explain the implications'
            ]
        ];

        // Limit to unique questions
        const uniqueQuestions = [...new Set(combinedQuestions)].slice(0, 6);

        uniqueQuestions.forEach(question => {
            const questionBtn = document.createElement('button');
            questionBtn.classList.add(
                'px-3', 
                'py-1', 
                'bg-light-secondary', 
                'dark:bg-dark-secondary', 
                'rounded-full', 
                'text-sm', 
                'hover:bg-brand-blue', 
                'hover:text-white', 
                'transition-colors'
            );
            questionBtn.textContent = question;
            questionBtn.addEventListener('click', () => {
                this.elements.searchInput.value = question;
                this.performSearch();
            });
            questionsList.appendChild(questionBtn);
        });

        followUpContainer.appendChild(questionsList);
        this.elements.aiResponse.appendChild(followUpContainer);
    }

    // Show loading spinner when search starts
    showLoading() {
        // Loading state for search results
        this.elements.searchResults.innerHTML = `
            <div class="col-span-full text-center">
                <i class="fas fa-spinner fa-spin text-4xl text-brand-blue"></i>
                <p class="mt-4 text-light-text dark:text-dark-text">Searching the web and generating insights...</p>
            </div>
        `;
    
        // Loading state for AI response
        this.elements.aiResponse.innerHTML = `
            <div class="text-center">
                <i class="fas fa-brain fa-pulse text-4xl text-brand-blue"></i>
                <p class="mt-4 text-light-text dark:text-dark-text">Analyzing information intelligently...</p>
            </div>
        `;
    }
    
    // New function to clear loading state
    clearLoading() {
        const loadingSpinner = document.querySelector('.fa-spinner');
        const aiPulse = document.querySelector('.fa-brain');
        if (loadingSpinner) {
            loadingSpinner.parentElement.remove();
        }
        if (aiPulse) {
            aiPulse.parentElement.remove();
        }
    }

    clearResults() {
        this.elements.searchResults.innerHTML = '';
        this.elements.aiResponse.innerHTML = '';
    }

    clearSearch() {
        this.elements.searchInput.value = '';
        this.clearResults();
    }

    displayError(error) {
        this.elements.searchResults.innerHTML = `
            <div class="col-span-full bg-red-900 p-4 rounded-lg text-white">
                <i class="fas fa-exclamation-triangle mr-2 text-red-400"></i>
                <span>Search failed: ${error.message}. Please try again.</span>
            </div>
        `;
    }

    updateSearchHistory(query) {
        // Prevent duplicate entries
        if (!this.state.searchHistory.includes(query)) {
            this.state.searchHistory.unshift(query);
            // Limit search history to 10 items
            this.state.searchHistory = this.state.searchHistory.slice(0, 10);
            this.saveSearchHistory();
        }
        this.renderSearchHistory();
    }

    renderSearchHistory() {
        this.elements.searchHistory.innerHTML = this.state.searchHistory
            .map(query => `
                <li class="cursor-pointer hover:bg-light-secondary dark:hover:bg-dark-secondary p-2 rounded text-sm" 
                    onclick="document.getElementById('searchInput').value='${query}'">${query}</li>
            `).join('');
    }

    saveSearchHistory() {
        localStorage.setItem('searchHistory', JSON.stringify(this.state.searchHistory));
    }

    loadSearchHistory() {
        const history = localStorage.getItem('searchHistory');
        this.state.searchHistory = history ? JSON.parse(history) : [];
        this.renderSearchHistory();
    }

    // Theme Management
    initTheme() {
        const savedTheme = localStorage.getItem('appTheme') || 'dark';
        this.state.currentTheme = savedTheme;
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        this.updateThemeIcon();
    }

    toggleTheme() {
        const newTheme = this.state.currentTheme === 'dark' ? 'light' : 'dark';
        this.state.currentTheme = newTheme;
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('appTheme', newTheme);
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        this.elements.themeToggle.innerHTML = this.state.currentTheme === 'dark' 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
    }

    // Voice Search
    setupVoiceSearch() {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            this.elements.voiceSearchBtn.addEventListener('click', () => {
                recognition.start();
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.elements.searchInput.value = transcript;
                this.performSearch();
            };
        } else {
            this.elements.voiceSearchBtn.style.display = 'none';
        }
    }

    // Keyboard Shortcuts
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + K: Focus on search input
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            this.elements.searchInput.focus();
        }
    }

    handleSearchKeyPress(event) {
        if (event.key === 'Enter') {
            this.performSearch();
        }
    }

    // Settings Management
    openSettingsModal() {
        this.elements.settingsModal.classList.remove('hidden');
        this.elements.settingsModal.classList.add('flex');
        
        // Populate current settings
        this.elements.darkModeToggle.checked = this.state.settings.darkMode;
        this.elements.safeSearchToggle.checked = this.state.settings.safeSearch;
        this.elements.aiResponseLengthSelect.value = this.state.settings.aiResponseLength;
    }

    closeSettingsModal() {
        this.elements.settingsModal.classList.remove('flex');
        this.elements.settingsModal.classList.add('hidden');
    }

    saveSettings() {
        this.state.settings = {
            darkMode: this.elements.darkModeToggle.checked,
            safeSearch: this.elements.safeSearchToggle.checked,
            aiResponseLength: this.elements.aiResponseLengthSelect.value
        };

        // Apply theme if changed
        if (this.state.settings.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Save to local storage
        localStorage.setItem('appSettings', JSON.stringify(this.state.settings));

        this.closeSettingsModal();
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            this.state.settings = JSON.parse(savedSettings);
        }
    }

    // Utility Methods
    copyAIResponse() {
        const aiResponseText = this.elements.aiResponse.textContent;
        navigator.clipboard.writeText(aiResponseText).then(() => {
            alert('AI response copied to clipboard!');
        });
    }

    shareAIResponse() {
        if (navigator.share) {
            navigator.share({
                title: 'Gemini Search AI Insights',
                text: this.elements.aiResponse.textContent
            });
        } else {
            alert('Sharing not supported on this device.');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GeminiSearch();
});
