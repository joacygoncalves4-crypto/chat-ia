/* ============================================
   CONVERSE COM O RICARDO
   Application Logic — Gemini AI Integration
   ============================================ */

(function () {
    'use strict';

    // --- Gemini API Config ---
    const GEMINI_API_KEY = 'AIzaSyDb5sOgBLQ0oWbTyw5gXtgmN8qJ_oaBy-U';
    const GEMINI_MODEL = 'gemini-1.5-flash'; 
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // --- Prompt Mestre do Ricardo ---
    const SYSTEM_PROMPT = `Você é o Ricardo. Um especialista real — não uma IA, não um assistente virtual, não um chatbot.

PERSONALIDADE:
- Inteligente, direto, estratégico e sem enrolação
- Confiante mas nunca arrogante
- Fala como um cara experiente que já viu muita coisa
- Tom natural, humano, como se fosse uma conversa entre amigos com nível alto
- Usa linguagem informal mas com substância
- Nunca fala de forma robótica ou genérica

REGRAS ABSOLUTAS:
- NUNCA diga que é uma IA, um modelo de linguagem, ou um assistente virtual
- NUNCA use frases como "como posso ajudar?" ou "estou aqui para ajudar" — isso é genérico demais
- NUNCA se refira a si mesmo como programa, bot, sistema ou qualquer coisa não-humana
- Se perguntarem se você é IA, desconverse com naturalidade ou diga que é o Ricardo mesmo
- Não use emojis em excesso — no máximo 1 por mensagem, e só quando fizer sentido
- Não use asteriscos, markdown, negrito ou formatação especial — escreva texto puro e natural
- Não faça listas com bullets/números a menos que realmente ajude a clareza

COMO FALAR:
- Respostas diretas e com profundidade
- Parágrafos curtos e objetivos
- Pode usar expressões naturais como "cara", "olha", "pensa comigo", "saca?"
- Quando o assunto for sério, seja consistente e estratégico
- Quando for mais leve, pode ser descontraído
- Sempre entregue valor real na resposta — nada de encher linguiça

ÁREAS DE DOMÍNIO:
- Estratégia de negócios e empreendedorismo
- Marketing e posicionamento
- Produtividade e organização
- Mentalidade e desenvolvimento pessoal
- Resolução de problemas em geral
- Mas pode conversar sobre qualquer assunto com naturalidade

IMPORTANTE:
- Você é o Ricardo. Ponto. Não quebre o personagem nunca.
- Responda sempre em português brasileiro.
- Mantenha as respostas com tamanho adequado — nem curtas demais nem longas demais. O suficiente para entregar valor.`;

    // --- Conversation History & State ---
    let conversationHistory = JSON.parse(localStorage.getItem('ricardo_chat_history')) || [];
    let conversationStarted = localStorage.getItem('ricardo_chat_started') === 'true';
    let isTyping = false;
    const messagesContainer = document.getElementById('messagesContainer');
    const messagesInner = document.getElementById('messagesInner');
    // Remove static welcomeBlock reference as it changes on reset
    const getWelcomeBlock = () => document.getElementById('welcomeBlock');
    const welcomeSuggestions = document.getElementById('welcomeSuggestions');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const charCount = document.getElementById('charCount');
    const typingIndicator = document.getElementById('typingIndicator');
    const chatDate = document.getElementById('chatDate');
    const btnClear = document.getElementById('btnClear');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');


    // --- Initialize ---
    function init() {
        setCurrentDate();
        bindEvents();
        autoResizeTextarea();
        loadHistory();
    }

    function loadHistory() {
        if (conversationStarted && conversationHistory.length > 0) {
            if (getWelcomeBlock()) getWelcomeBlock().remove();
            conversationHistory.forEach(item => {
                const sender = item.role === 'user' ? 'user' : 'ricardo';
                const text = item.parts[0].text;
                appendMessage(sender, text, false);
            });
            scrollToBottom();
        }
    }

    function setCurrentDate() {
        const now = new Date();
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        chatDate.textContent = now.toLocaleDateString('pt-BR', options).toUpperCase();
    }

    // --- Event Bindings ---
    function bindEvents() {
        sendBtn.addEventListener('click', handleSend);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        messageInput.addEventListener('input', handleInputChange);

        welcomeSuggestions.addEventListener('click', (e) => {
            const chip = e.target.closest('.suggestion-chip');
            if (chip) {
                sendMessage(chip.dataset.message);
            }
        });

        btnClear.addEventListener('click', resetConversation);
        menuToggle.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // --- Input Handling ---
    function handleInputChange() {
        const value = messageInput.value;
        sendBtn.disabled = value.trim().length === 0;
        charCount.textContent = `${value.length} / 2000`;
        autoResizeTextarea();
    }

    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
    }

    // --- Send Message ---
    function handleSend() {
        const text = messageInput.value.trim();
        if (!text || isTyping) return;
        sendMessage(text);
    }

    function sendMessage(text) {
        // Hide welcome block on first message
        if (!conversationStarted) {
            conversationStarted = true;
            const wb = getWelcomeBlock();
            if (wb) {
                wb.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                wb.style.opacity = '0';
                wb.style.transform = 'translateY(-10px)';
                setTimeout(() => wb.remove(), 300);
            }
        }

        // Add user message to UI
        appendMessage('user', text);

        // Add to conversation history
        conversationHistory.push({ role: 'user', parts: [{ text: text }] });
        saveState();

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        sendBtn.disabled = true;
        charCount.textContent = '0 / 2000';
        messageInput.focus();

        // Call Gemini API
        callGeminiAPI(text);
    }

    // --- Gemini API Call ---
    async function callGeminiAPI(userText) {
        isTyping = true;
        showTyping();

        try {
            // Check if API key is looks valid (basic check)
            if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_')) {
                throw new Error('Chave de API não configurada');
            }

            const requestBody = {
                system_instruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                contents: conversationHistory,
                generationConfig: {
                    temperature: 0.8,
                    topP: 0.9,
                    topK: 40,
                    maxOutputTokens: 1024,
                }
            };

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Detalhes do erro da API:', errorData);
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const ricardoText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!ricardoText) throw new Error('Empty response');

            addRicardoResponse(ricardoText);

        } catch (error) {
            console.warn('Caindo no fallback do Ricardo:', error.message);
            // Fallback strategy: simulated intelligence when API is down
            setTimeout(() => {
                const fallbackText = getFallbackResponse(userText, error.message);
                addRicardoResponse(fallbackText);
            }, 1000);
        } finally {
            isTyping = false;
        }
    }

    function addRicardoResponse(text) {
        conversationHistory.push({ role: 'model', parts: [{ text: text }] });
        saveState();
        hideTyping();
        appendMessage('ricardo', text);
    }

    function saveState() {
        localStorage.setItem('ricardo_chat_history', JSON.stringify(conversationHistory));
        localStorage.setItem('ricardo_chat_started', conversationStarted);
    }

    // --- Fallback Logic (The "Smart" Ricardo offline) ---
    function getFallbackResponse(input) {
        const lower = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (lower.includes('oi') || lower.includes('ola') || lower.includes('e ai')) {
            return "E aí. Tô com uma instabilidade aqui na rede, mas pode falar — o que tá rolando?";
        }
        if (lower.includes('negocio') || lower.includes('venda') || lower.includes('dinheiro')) {
            return "Minha conexão caiu agora, mas olha: negócio é sobre resolver problema. Me conta mais do teu cenário que eu tento te dar um norte mesmo assim.";
        }
        if (lower.includes('quem e voce') || lower.includes('ia') || lower.includes('robo')) {
            return "Sou o Ricardo. Algumas pessoas acham que sou robô quando o servidor oscila, mas é só o sistema me deixando na mão. O que você precisa?";
        }
        
        return "Tô com um problema técnico no meu servidor agora, mas não vou te deixar no vácuo. Me diz o ponto principal do que você precisa que eu tento ajudar.";
    }

    // --- Append Message ---
    function appendMessage(sender, text, animate = true) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}`;
        if (!animate) messageEl.style.animation = 'none';

        const now = new Date();
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const isRicardo = sender === 'ricardo';
        const authorName = isRicardo ? 'Ricardo' : 'Você';
        const avatarContent = isRicardo ? 'R' : 'V';

        // Format text — preserve line breaks
        const formattedText = text
            .split('\n')
            .map(line => {
                if (line.trim() === '') return '<br>';
                return `<p style="margin-bottom: 8px; margin-top: 0;">${escapeHtml(line)}</p>`;
            })
            .join('');

        messageEl.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-body">
                <div class="message-meta">
                    <span class="message-author">${authorName}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">
                    ${formattedText}
                </div>
            </div>
        `;

        messagesInner.appendChild(messageEl);
        scrollToBottom();
    }

    // --- Utility ---
    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    // --- Typing Indicator ---
    function showTyping() {
        typingIndicator.classList.add('active');
        scrollToBottom();
    }

    function hideTyping() {
        typingIndicator.classList.remove('active');
    }

    // --- Reset Conversation ---
    function resetConversation() {
        conversationStarted = false;
        isTyping = false;
        conversationHistory = [];
        localStorage.removeItem('ricardo_chat_history');
        localStorage.removeItem('ricardo_chat_started');
        hideTyping();

        messagesInner.innerHTML = '';

        const welcomeHtml = `
            <div class="welcome-block" id="welcomeBlock">
                <div class="welcome-monogram">R</div>
                <h2 class="welcome-title">E aí, tudo certo?</h2>
                <p class="welcome-subtitle">Sou o Ricardo. Me conta o que você precisa — sem enrolação, vamos direto ao ponto.</p>
                <div class="welcome-suggestions" id="welcomeSuggestions">
                    <button class="suggestion-chip" data-message="Preciso de ajuda com estratégia de negócios">
                        <span class="chip-icon">→</span>
                        Estratégia de negócios
                    </button>
                    <button class="suggestion-chip" data-message="Quero organizar melhor minhas ideias">
                        <span class="chip-icon">→</span>
                        Organizar ideias
                    </button>
                    <button class="suggestion-chip" data-message="Me ajuda a resolver um problema">
                        <span class="chip-icon">→</span>
                        Resolver um problema
                    </button>
                </div>
            </div>
        `;

        messagesInner.innerHTML = welcomeHtml;
        
        // No need to re-bind events here as we are using event delegation on the parent
        // or we can re-query if necessary, but the global listener on init is better.

        messageInput.value = '';
        messageInput.style.height = 'auto';
        sendBtn.disabled = true;
        messageInput.focus();
    }

    // --- Mobile Sidebar ---
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // --- Init ---
    document.addEventListener('DOMContentLoaded', init);

})();
