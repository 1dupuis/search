class GeminiSearch {
  constructor() {
    // Gemini API Configuration
    this.GEMINI_API_KEY = 'AIzaSyAtIJNuqJsnifU3Ez3CNEtjUrhQWbB1N7o';
    this.GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent';

    // DOM Elements
    this.elements = {
      searchInput: document.getElementById('searchInput'),
      searchButton: document.getElementById('searchButton'),
      clearSearchBtn: document.getElementById('clearSearchBtn'),
      searchResults: document.getElementById('searchResults'),
      aiResponse: document.getElementById('aiResponseContent'),
      aiResponseContainer: document.getElementById('aiResponse'),
      searchHistory: document.getElementById('searchHistory'),
      themeToggle: document.getElementById('themeToggle'),
      voiceSearchBtn: document.getElementById('voiceSearchBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      settingsModal: document.getElementById('settingsModal'),
      advancedSearchOptions: document.getElementById('advancedSearchOptions'),
      copyAIResponseBtn: document.getElementById('copyAIResponseBtn'),
      shareAIResponseBtn: document.getElementById('shareAIResponseBtn'),
      toggleHistoryBtn: document.getElementById('toggleHistoryBtn'),
      historySection: document.getElementById('historySection'),

      // "Did you mean?"
      didYouMean: document.getElementById('didYouMean'),

      // Suggestions dropdown
      suggestionList: document.getElementById('suggestionList'),

      // Advanced filters
      searchLanguage: document.getElementById('searchLanguage'),
      searchTimeframe: document.getElementById('searchTimeframe'),
      domainFilterInput: document.getElementById('domainFilterInput'),
      
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
      },
      // For demonstration: simple local "dictionary" for misspell checks
      dictionary: ['html', 'javascript', 'gemini', 'search', 'apple', 'banana', 'weather']
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
  
  // Handle URL query parameter for direct ?q= searches
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

    // Real-time suggestions
    this.elements.searchInput.addEventListener('input', this.handleInputSuggestions.bind(this));

    // Theme & settings
    this.elements.themeToggle.addEventListener('click', this.toggleTheme.bind(this));
    this.elements.settingsBtn.addEventListener('click', this.openSettingsModal.bind(this));
    
    // Settings modal interactions
    this.elements.saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this));
    this.elements.cancelSettingsBtn.addEventListener('click', this.closeSettingsModal.bind(this));

    // AI Response actions
    this.elements.copyAIResponseBtn.addEventListener('click', this.copyAIResponse.bind(this));
    this.elements.shareAIResponseBtn.addEventListener('click', this.shareAIResponse.bind(this));

    // Show/hide recent searches
    this.elements.toggleHistoryBtn.addEventListener('click', () => {
      this.elements.historySection.classList.toggle('hidden');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  // Real-time suggestions handler
  async handleInputSuggestions(e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
      this.elements.suggestionList.classList.add('hidden');
      return;
    }
    const suggestions = this.fetchLocalSuggestions(query);
    this.renderSuggestions(suggestions);
  }

  // Simple local suggestion logic (replace with a real API if desired)
  fetchLocalSuggestions(query) {
    // Filter from dictionary
    return this.state.dictionary
      .filter(word => word.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
  }

  renderSuggestions(suggestions) {
    if (!suggestions.length) {
      this.elements.suggestionList.classList.add('hidden');
      return;
    }
    this.elements.suggestionList.innerHTML = suggestions.map(item => `
      <li class="px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
        ${item}
      </li>
    `).join('');
    this.elements.suggestionList.classList.remove('hidden');

    // Add click handlers for each suggestion
    Array.from(this.elements.suggestionList.querySelectorAll('li')).forEach(li => {
      li.addEventListener('click', () => {
        this.elements.searchInput.value = li.textContent;
        this.elements.suggestionList.classList.add('hidden');
        this.performSearch();
      });
    });
  }

  // Check if query is misspelled based on a simple dictionary
  isMisspelled(query) {
    // Split into words and check each
    const words = query.split(' ');
    // Return the first word that doesn't match our dictionary
    for (let word of words) {
      if (!this.state.dictionary.includes(word.toLowerCase())) {
        return word;
      }
    }
    return null;
  }

  getSuggestionForMisspelling(word) {
    // Dummy approach: pick first dictionary entry that starts with the same letter
    const candidate = this.state.dictionary.find(item => item.startsWith(word[0]));
    return candidate || null;
  }

  showDidYouMeanSuggestion(correction) {
    this.elements.didYouMean.innerHTML = `
      Did you mean:
      <button class="underline text-brand-blue ml-1"
        onclick="document.getElementById('searchInput').value='${correction}'; 
        geminiSearch.performSearch();"
      >
        ${correction}
      </button>?
    `;
  }

  clearDidYouMean() {
    this.elements.didYouMean.innerHTML = '';
  }

  // Fetch from Gemini
  async fetchGeminiResults(query) {
    try {
      // Incorporate domain filter if provided
      const domainFilter = this.elements.domainFilterInput.value.trim();
      const searchLang = this.elements.searchLanguage.value;
      const timeframe = this.elements.searchTimeframe.value;
      
      // Build a partial "filter" string to pass into the prompt
      let additionalFilterPrompt = '';
      if (domainFilter) {
        additionalFilterPrompt += ` Restrict search to domain: ${domainFilter}.`;
      }
      if (searchLang) {
        additionalFilterPrompt += ` Show results primarily in ${searchLang}.`;
      }
      if (timeframe) {
        additionalFilterPrompt += ` Timeframe: ${timeframe}.`;
      }

      // Adjust AI response length
      const aiResponseLength = this.state.settings.aiResponseLength;
      const lengthRequest = aiResponseLength === 'long' ? 'Longer explanation' :
                            aiResponseLength === 'short' ? 'Concise answer' :
                            'Medium-length answer';

      // Enhanced prompt to enforce JSON-only response
      const prompt = `Act as an advanced search engine and AI assistant. 
For the query "${query}", provide:
1. 6 comprehensive web result snippets with title, link, and description (100 characters or less each)
2. A ${lengthRequest} analyzing the topic
3. Insights, context, and potential follow-up questions
${additionalFilterPrompt}
Respond ONLY with a valid JSON object in the following format, and do NOT include any additional text:
{
  "webResults": [{"title": "", "link": "", "snippet": ""}], 
  "aiResponse": "",
  "followUpQuestions": []
}`;

      const response = await fetch(`${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });
  
      if (!response.ok) {
        throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
      }
  
      const responseData = await response.json();
      
      // More robust parsing with extraction between ```json and ```
      const responseText = responseData.candidates[0].content.parts[0].text;
      console.log('Raw response text:', responseText);

      // Use regex to extract JSON between ```json and ```
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonString = jsonMatch[1].trim();
        try {
          const parsedResults = JSON.parse(jsonString);
          if (!parsedResults.webResults || !parsedResults.aiResponse) {
            throw new Error('Invalid response format');
          }
          return parsedResults;
        } catch (parseError) {
          console.error('Failed to parse Gemini JSON response:', parseError);
          console.error('Extracted JSON string:', jsonString);
          return {
            webResults: [],
            aiResponse: "I apologize, but I couldn't generate a proper response. Please try your search again.",
            followUpQuestions: []
          };
        }
      } else {
        console.error('JSON block not found in Gemini response.');
        return {
          webResults: [],
          aiResponse: "I apologize, but I couldn't generate a proper response. Please try your search again.",
          followUpQuestions: []
        };
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
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

    // Clear "Did you mean?"
    this.clearDidYouMean();

    // Check for misspelling
    const misspelledWord = this.isMisspelled(query);
    if (misspelledWord) {
      const correction = this.getSuggestionForMisspelling(misspelledWord);
      if (correction) {
        this.showDidYouMeanSuggestion(correction);
      }
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
        this.displayWebResults(cachedResults.webResults, query);
        this.displayAIResponse(cachedResults.aiResponse);
        this.addFollowUpQuestions(cachedResults.followUpQuestions);
        this.clearLoading();
        return;
      }

      // Fetch results from Gemini
      const aiResults = await this.fetchGeminiResults(query);
      
      // Cache the results
      this.cacheResults(query, aiResults);
      
      this.displayWebResults(aiResults.webResults, query);
      this.displayAIResponse(aiResults.aiResponse);
      this.addFollowUpQuestions(aiResults.followUpQuestions);

    } catch (error) {
      this.displayError(error);
    } finally {
      this.clearLoading();
    }
  }
  
  cacheResults(query, results) {
    localStorage.setItem(`searchResults-${query}`, JSON.stringify(results));
  }
  
  getCachedResults(query) {
    const cached = localStorage.getItem(`searchResults-${query}`);
    return cached ? JSON.parse(cached) : null;
  }

  // Highlight snippet text
  highlightSnippet(snippet, query) {
    if (!query) return snippet;
    const regex = new RegExp(`(${query})`, 'gi');
    return snippet.replace(regex, '<span class="highlight">$1</span>');
  }

  displayWebResults(results, query) {
    this.elements.searchResults.innerHTML = '';
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
        'hover:shadow-lg',
        'hover-3d'
      );
      resultElement.innerHTML = `
        <h3 class="text-brand-blue font-bold mb-2 text-lg">
          <a href="${result.link}" target="_blank" class="hover:underline">
            <i class="fas fa-link mr-2"></i>${result.title}
          </a>
        </h3>
        <p class="text-light-text dark:text-dark-text">
          ${this.highlightSnippet(result.snippet, query)}
        </p>
      `;
      this.elements.searchResults.appendChild(resultElement);
    });
  }

  displayAIResponse(response) {
    // Clear previous content
    this.elements.aiResponse.innerHTML = '';

    const header = document.createElement('h2');
    header.classList.add('text-2xl', 'font-bold', 'text-brand-blue', 'flex', 'items-center');
    header.innerHTML = `
      <i class="fas fa-brain mr-3"></i>
      AI Insights
      <span class="ml-2 text-sm text-gray-500 ai-pulse">Analyzing...</span>
    `;
    this.elements.aiResponse.appendChild(header);

    const responseText = document.createElement('p');
    responseText.classList.add('leading-relaxed', 'text-light-text', 'dark:text-dark-text');
    responseText.textContent = response;
    this.elements.aiResponse.appendChild(responseText);

    // Follow-up questions appended in addFollowUpQuestions
  }

  addFollowUpQuestions(questions = []) {
    const followUpContainer = document.createElement('div');
    followUpContainer.classList.add('mt-6', 'border-t', 'pt-4', 'border-gray-200', 'dark:border-gray-700');
    
    const followUpTitle = document.createElement('h3');
    followUpTitle.classList.add('text-lg', 'font-semibold', 'text-brand-green', 'mb-3');
    followUpTitle.textContent = 'Explore More';
    followUpContainer.appendChild(followUpTitle);

    const questionsList = document.createElement('div');
    questionsList.classList.add('flex', 'flex-wrap', 'gap-2');

    const defaultQuestions = [
      'Tell me more about this',
      'What are the key takeaways?',
      'Provide historical context',
      'Explain the implications'
    ];
    const combinedQuestions = [ ...questions, ...defaultQuestions ];
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

  showLoading() {
    this.elements.searchResults.innerHTML = `
      <div class="col-span-full text-center">
        <i class="fas fa-spinner fa-spin text-4xl text-brand-blue"></i>
        <p class="mt-4 text-light-text dark:text-dark-text">
          Searching the web and generating insights...
        </p>
      </div>
    `;
    this.elements.aiResponse.innerHTML = `
      <div class="text-center">
        <i class="fas fa-brain fa-pulse text-4xl text-brand-blue"></i>
        <p class="mt-4 text-light-text dark:text-dark-text">
          Analyzing information intelligently...
        </p>
      </div>
    `;
  }
  
  clearLoading() {
    // Remove any loading spinners if still present
    const loadingSpinner = document.querySelector('.fa-spinner');
    if (loadingSpinner && loadingSpinner.parentElement) {
      loadingSpinner.parentElement.remove();
    }
    const aiPulse = document.querySelector('.fa-brain.fa-pulse');
    if (aiPulse && aiPulse.parentElement) {
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
    this.clearDidYouMean();
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
    // Prevent duplicates
    if (!this.state.searchHistory.includes(query)) {
      this.state.searchHistory.unshift(query);
      // Limit to 10
      this.state.searchHistory = this.state.searchHistory.slice(0, 10);
      this.saveSearchHistory();
    }
    this.renderSearchHistory();
  }

  renderSearchHistory() {
    this.elements.searchHistory.innerHTML = this.state.searchHistory
      .map(query => `
        <li 
          class="cursor-pointer hover:bg-light-secondary dark:hover:bg-dark-secondary p-2 rounded text-sm"
          onclick="document.getElementById('searchInput').value='${query}'; geminiSearch.performSearch();"
        >
          ${query}
        </li>
      `)
      .join('');
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

    // Optional: toggle body gradient for light mode
    if (newTheme === 'light') {
      document.body.classList.add('light-mode-bg');
    } else {
      document.body.classList.remove('light-mode-bg');
    }
  }

  updateThemeIcon() {
    this.elements.themeToggle.innerHTML = 
      this.state.currentTheme === 'dark' 
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
      localStorage.setItem('appTheme', 'dark');
      this.state.currentTheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('appTheme', 'light');
      this.state.currentTheme = 'light';
    }

    // Save to local storage
    localStorage.setItem('appSettings', JSON.stringify(this.state.settings));

    this.closeSettingsModal();
    this.updateThemeIcon();
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
let geminiSearch;
document.addEventListener('DOMContentLoaded', () => {
  geminiSearch = new GeminiSearch();
});
