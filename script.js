/**
 * FRACK OFF v3.8.0 — Main Script
 * Бюро изящных отказов
 * powered by dev4rev
 * 
 * 🎠 Auto-slider: fade-only, 2s interval, no manual controls
 * 🖼️ Tainted canvas fix + fallback
 * 🔗 Рабочее декодирование + шаринг
 * 📦 LZ-String сжатие с авто-fallback
 * 📝 Поддержка абзацев
 * 🛡️ Защита от XSS
 */

// === Fallback для LZ-String ===
if (typeof LZString === 'undefined') {
    console.warn('⚠️ LZ-String не загружен, используем base64 fallback');
    window.LZString = {
        compressToEncodedURIComponent: (str) => {
            try {
                return btoa(encodeURIComponent(str))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            } catch (e) { return btoa(str); }
        },
        decompressFromEncodedURIComponent: (str) => {
            try {
                str = str.replace(/-/g, '+').replace(/_/g, '/');
                while (str.length % 4) str += '=';
                return decodeURIComponent(atob(str));
            } catch (e) { return atob(str); }
        }
    };
}

// === AutoSlider — минимальный, только fade, 2s интервал ===
class AutoSlider {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`❌ Slider container #${containerId} not found`);
            return null;
        }
        
        this.slides = Array.from(this.container.querySelectorAll('.card-slide'));
        this.total = this.slides.length;
        this.current = 0;
        this.timer = null;
        
        this.options = {
            interval: 2000,           // 2 секунды
            transitionDuration: 800,  // ms для fade
            ...options
        };
        
        this.init();
        return this;
    }
    
    init() {
        if (this.total === 0) {
            console.error('❌ No slides found');
            return;
        }
        
        console.log(`🎠 [AutoSlider] Init: ${this.total} slides, ${this.options.interval}ms interval`);
        
        // Setup initial state
        this.slides.forEach((slide, i) => {
            slide.style.transition = `opacity ${this.options.transitionDuration}ms ease-in-out`;
            if (i === 0) {
                slide.classList.add('active');
                slide.setAttribute('aria-hidden', 'false');
            } else {
                slide.setAttribute('aria-hidden', 'true');
            }
        });
        
        // Initialize particles for first slide
        this._initParticles(1);
        
        // Start auto-play
        this.start();
    }
    
    start() {
        if (this.timer) clearInterval(this.timer);
        
        this.timer = setInterval(() => {
            this._next();
        }, this.options.interval);
        
        console.log(`⏱️ [AutoSlider] Started: ${this.options.interval}ms`);
    }
    
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('⏹️ [AutoSlider] Stopped');
        }
    }
    
    _next() {
        if (this.total <= 1) return;
        
        const nextIndex = (this.current + 1) % this.total;
        const currentSlide = this.slides[this.current];
        const nextSlide = this.slides[nextIndex];
        
        // Fade out current
        currentSlide.classList.remove('active');
        currentSlide.setAttribute('aria-hidden', 'true');
        
        // Fade in next (с небольшой задержкой для плавного cross-fade)
        setTimeout(() => {
            nextSlide.classList.add('active');
            nextSlide.setAttribute('aria-hidden', 'false');
            
            // Update particles
            this._initParticles(nextIndex + 1);
            
            this.current = nextIndex;
            console.log(`🔄 [AutoSlider] Slide ${nextIndex + 1}/${this.total}`);
        }, this.options.transitionDuration / 2);
    }
    
    _initParticles(cardNumber) {
        const container = document.getElementById(`particles-${cardNumber}`);
        if (!container) return;
        
        // Clear existing
        container.innerHTML = '';
        
        // Create particles
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 4 + 's';
            particle.style.animationDuration = (3 + Math.random() * 2) + 's';
            particle.style.width = (2 + Math.random() * 2) + 'px';
            particle.style.height = particle.style.width;
            container.appendChild(particle);
        }
    }
    
    destroy() {
        this.stop();
        console.log('🗑️ [AutoSlider] Destroyed');
    }
}


// === Main App ===
class FrackOffApp {
    constructor() {
        this.config = {
            storageKey: 'frack_off_user_data',
            baseUrl: window.location.origin + window.location.pathname,
            toastDuration: 4000
        };

        this._phraseDict = {
            'Милостивый государь': '§A', 'Уважаемый коллега': '§B',
            'позвольте': '§C', 'с величайшим': '§D', 'С глубочайшим уважением': '§F',
            'Ваш покорный слуга': '§G', 'не сочтите за': '§I', 'с уважением': '§Y',
            'что': '§1', 'как': '§2', 'вам': '§4', 'вас': '§5', 'бы': '§8',
            'не': '§b', 'и': '§c', 'на': '§j', 'в': '§k', 'с': '§l'
        };
        this._phraseDictReverse = {};
        for (const [k, v] of Object.entries(this._phraseDict)) {
            this._phraseDictReverse[v] = k;
        }

        this.presetMessages = [
            { id: 1, title: "Классический отказ", text: "Милостивый государь, позвольте с величайшим тактом заметить, что ваше дальнейшее пребывание здесь может быть расценено как нарушение неписаных правил приличия.", signature: "С глубочайшим уважением, Дворецкий" },
            { id: 2, title: "Изящное игнорирование", text: "Ваш энтузиазм, безусловно, достоин восхищения, однако в данный момент он несколько неуместен. Не соблаговолите ли вы направить его в более подходящее русло?", signature: "Ваш покорный слуга" },
            { id: 3, title: "Аристократичное «нет»", text: "Осмелюсь предположить, что где-то там, вдали от сего места, есть дело, которое отчаянно нуждается в вашем внимании. Не соизволите ли вы отправиться туда?", signature: "Лорд Фрак" },
            { id: 4, title: "Вежливое прощание", text: "С прискорбием вынужден констатировать, что наши пути, увы, расходятся. Желаю вам благополучного путешествия в противоположном направлении.", signature: "Глава бюро игнорирования" },
            { id: 5, title: "Утончённый отказ", text: "Ваше общество, вне всяких сомнений, уникально. Однако, в силу обстоятельств непреодолимой силы, оно не может быть принято в настоящий момент.", signature: "Секретарь Его Сиятельства" },
            { id: 6, title: "Дипломатичное «прощайте»", text: "Позвольте выразить уверенность, что ваши таланты будут гораздо более востребованы в ином месте. Не сочтите за труд последовать туда незамедлительно.", signature: "Советник по этикету" },
            { id: 7, title: "Благородное отстранение", text: "С величайшей деликатностью осмеливаюсь намекнуть, что ваше присутствие, при всей его несомненной ценности, в данную минуту создаёт определённую дисгармонию в пространстве сего кабинета.", signature: "Хранитель тишины и покоя" },
            { id: 8, title: "Изящное перенаправление", text: "Позвольте с глубоким почтением предположить, что судьба, в своей бесконечной мудрости, приготовила для вас занятие в ином уголке вселенной. Не угодно ли будет последовать её зову?", signature: "Интерпретатор воли небес" },
            { id: 9, title: "Утончённое невмешательство", text: "Ваша инициатива, безусловно, заслуживает отдельной оды, однако в контексте текущих обстоятельств она напоминает рояль в балетном классе — прекрасна, но не совсем к месту.", signature: "Мастер метафор и намёков" },
            { id: 10, title: "Аристократичное отдаление", text: "С прискорбием, но с твёрдой решимостью вынужден заметить: расстояние между нами, увеличенное на несколько кварталов, пойдёт на пользу нам обоим.", signature: "Советник по пространственной гармонии" },
            { id: 11, title: "Вежливый побег", text: "Не сочтите за дерзость, но если бы я мог незаметно исчезнуть — я бы уже это сделал. Поскольку это невозможно, позвольте хотя бы намекнуть: дверь находится там, а вы — здесь.", signature: "Философ открытых дверей" },
            { id: 12, title: "Дипломатичное отступление", text: "Ваша настойчивость достойна памятника, однако, увы, не в моём сердце. Позвольте предложить вам альтернативу: направление, противоположное моему.", signature: "Посол по особым поручениям" },
            { id: 13, title: "Изящная пауза", text: "Между вашим вопросом и моим желанием ответить возникла пауза столь красноречивая, что слова кажутся излишними. Не соблаговолите ли вы её прочесть?", signature: "Ценитель красноречивого молчания" },
            { id: 14, title: "Благородное игнорирование", text: "Иногда высшая форма вежливости — это деликатное притворство, что вы уже ушли. Позвольте мне проявить эту добродетель в полной мере.", signature: "Гроссмейстер этикета" },
            { id: 15, title: "Утончённое отклонение", text: "Ваше предложение подобно изысканному десерту на завтрак: восхитительно, но совершенно не вовремя. Не отведаете ли вы его в более подходящий час? Где-нибудь в другом месте.", signature: "Сомелье уместности" },
            { id: 16, title: "Аристократичное «до свидания»", text: "Позвольте заверить: наша встреча останется в моей памяти как яркий пример того, как не стоит проводить время. С благодарностью за урок и пожеланием скорейшего расставания.", signature: "Летописец мимолётных впечатлений" },
            { id: 17, title: "Философское отдаление", text: "Если бы каждый человек был островом, я бы с удовольствием отправил вас в кругосветное путешествие. Увы, мы на одном материке. Но ничто не мешает вам прогуляться до соседнего полуострова.", signature: "Мыслитель в отставке" },
            { id: 18, title: "Поэтическое прощание", text: "Роза прекрасна, но не в кармане пиджака. Вы — как та роза: великолепны, но, к сожалению, не в том месте, где хотелось бы видеть вас сейчас.", signature: "Бард недосказанности" },
            { id: 19, title: "Изящный побег в прошлое", text: "Если бы у меня была машина времени, я бы вернулся в тот момент, когда ещё можно было вежливо отказаться от этой беседы. Поскольку машины нет, остаётся лишь намекнуть: выход — там.", signature: "Хранитель упущенных возможностей" },
            { id: 20, title: "Апофеоз вежливости", text: "Я мог бы сказать «нет» прямо. Но где же тогда место для изящества? Поэтому скажу иначе: ваше общество — как трюфель в борще: бесценно, но, увы, не к месту.", signature: "Верховный Маэстро Намёков" },
            { id: 21, title: "Приглашение к оценке", text: "Позвольте с подобающей скромностью заметить, что, прежде чем продолжать наш диалог, было бы весьма благоразумно уделить внимание сему скромному сервису.\n\nНе соблаговолите ли вы ознакомиться с его возможностями и поделиться вашим мудрым суждением?\n\nВаша оценка станет для нас бесценным ориентиром.", signature: "Хранитель вашего мнения", category: 'feedback' },
            { id: 22, title: "Просьба о рецензии", text: "Осмелюсь выразить надежду, что вы не откажете в любезности бросить благосклонный взор на сей скромный проект.\n\nВаше экспертное мнение будет принято с живейшей благодарностью и глубочайшим уважением.", signature: "Ваш преданный слуга", category: 'feedback' },
            { id: 23, title: "Намёк на обратную связь", text: "Между нами говоря, сей сервис подобен молодому вину: он уже приятен, но ещё нуждается в оценке знатока.\n\nНе окажете ли вы ему честь продегустировать и оставить пару слов в книге впечатлений?", signature: "Сомелье пользовательского опыта", category: 'feedback' },
            { id: 24, title: "Размышление с просьбой", text: "Истинное совершенство рождается в диалоге.\n\nПозвольте предложить вам роль мудрого наставника: ознакомьтесь с сим творением и поделитесь своими мыслями.\n\nВаше слово для нас — как печать на воске.", signature: "Ученик вашего вкуса", category: 'feedback' },
            { id: 25, title: "Коллегиальное «не сейчас»", text: "Уважаемый коллега, позвольте заметить, что в данный момент мои приоритеты не позволяют уделить должное внимание вашему предложению.\n\nНе сочтите за дерзость, если я позволю себе вернуться к этому вопросу в более подходящий момент.", signature: "Ваш коллега по цеху", category: 'work' },
            { id: 26, title: "Дипломатичный перенос", text: "Благодарю за приглашение к диалогу.\n\nОднако, осмелюсь предложить перенести нашу беседу на время, когда я смогу быть максимально полезен и внимателен.\n\nНадеюсь на ваше понимание.", signature: "Командный игрок", category: 'work' },
            { id: 27, title: "«Не могу, но хочу»", text: "Ваш запрос важен и интересен.\n\nОднако, в силу текущей загрузки, я вынужден отказаться от возможности помочь прямо сейчас.\n\nЕсли ситуация изменится — вы узнаете об этом первым.", signature: "Ваш соратник", category: 'work' },
            { id: 28, title: "Профессиональная пауза", text: "Позвольте взять паузу для осмысления вашего предложения.\n\nИногда лучшее «да» рождается после честного «не сейчас».\n\nЯ вернусь к вам с ответом, как только смогу сформулировать его с должной тщательностью.", signature: "Ответственный коллега", category: 'work' },
            { id: 29, title: "Приглашение к ознакомлению", text: "Уважаемый коллега, позвольте предложить вашему вниманию один любопытный проект.\n\nСие творение, именуемое FRACK OFF, призвано облагородить искусство деликатного отказа.\n\nНе окажете ли вы мне честь ознакомиться с ним?", signature: "Ваш коллега по цеху", category: 'feedback' },
            { id: 30, title: "Коллегиальный обзор", text: "Друзья, осмелюсь привлечь ваше внимание к одному занятному инструменту.\n\nОн помогает формулировать отказы так, чтобы никто не обиделся, а все поняли.\n\nНе уделите ли вы несколько минут на ознакомление?", signature: "Командный игрок", category: 'feedback' },
            { id: 31, title: "Докладная с приглашением", text: "Позвольте доложить: в рамках экспериментов был создан сервис изящных отказов.\n\nСмею надеяться, что он заслуживает вашего благосклонного внимания.\n\nБуду признателен за любую оценку.", signature: "Инициативный сотрудник", category: 'feedback' }
        ];

        this.dom = {};
        this.state = { isOpened: false, currentMessage: null, activeTab: 'preset' };
        this.slider = null;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🚀 [FRACK OFF] Init started');
        this.cacheDOM();
        this.bindEvents();
        this.setupYear();
        this.setupDate();
        this.renderPresets();
        this.loadCustomMessage();
        
        // Инициализация слайдера
        setTimeout(() => this.initSlider(), 100);
        // Проверка URL для шаринга
        setTimeout(() => this.checkUrlForSharedMessage(), 200);
        
        console.log('✅ [FRACK OFF] Init complete');
    }

    cacheDOM() {
        this.dom = {
            cardsSlider: document.getElementById('cards-slider'),
            envelopeContainer: document.getElementById('envelope-container'),
            waxSeal: document.getElementById('wax-seal'),
            letterText: document.getElementById('letter-text'),
            letterSignature: document.getElementById('letter-signature'),
            letterDate: document.getElementById('letter-date'),
            letterContent: document.getElementById('letter-content'),
            getLetterBtn: document.getElementById('get-letter-btn'),
            closeBtn: document.getElementById('close-btn'),
            shareBtn: document.getElementById('share-btn'),
            saveImageBtn: document.getElementById('save-image-btn'),
            currentYear: document.getElementById('current-year'),
            modalOverlay: document.getElementById('modal-overlay'),
            openSettingsBtn: document.getElementById('open-settings-btn'),
            closeModalBtn: document.getElementById('close-modal'),
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            presetList: document.getElementById('preset-list'),
            messageForm: document.getElementById('message-form'),
            customText: document.getElementById('custom-text'),
            customSignature: document.getElementById('custom-signature'),
            charCount: document.getElementById('char-count'),
            resetDefaultsBtn: document.getElementById('reset-defaults'),
            toastContainer: document.getElementById('toast-container')
        };
    }

    bindEvents() {
        this.dom.getLetterBtn?.addEventListener('click', () => this.openModal());
        this.dom.openSettingsBtn?.addEventListener('click', () => this.openModal());
        this.dom.closeModalBtn?.addEventListener('click', () => this.closeModal());
        this.dom.modalOverlay?.addEventListener('click', (e) => { 
            if (e.target === this.dom.modalOverlay) this.closeModal(); 
        });
        this.dom.tabBtns.forEach(btn => btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab)));
        this.dom.waxSeal?.addEventListener('click', (e) => { e.stopPropagation(); this.openEnvelope(); });
        this.dom.closeBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.closeEnvelope(); });
        document.addEventListener('click', (e) => {
            if (this.state.isOpened && this.dom.envelopeContainer && 
                !this.dom.envelopeContainer.contains(e.target) && 
                e.target !== this.dom.getLetterBtn) {
                this.closeEnvelope();
            }
        });
        this.dom.shareBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.shareLetter(); });
        this.dom.saveImageBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.saveLetterImage(); });
        this.dom.messageForm?.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.dom.resetDefaultsBtn?.addEventListener('click', () => this.resetToDefaults());
        this.dom.customText?.addEventListener('input', () => this.updateCharCount());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.dom.modalOverlay?.classList.contains('active')) this.closeModal();
                else if (this.state.isOpened) this.closeEnvelope();
            }
        });
    }

    setupYear() { 
        if (this.dom.currentYear) {
            this.dom.currentYear.textContent = new Date().getFullYear(); 
        }
    }
    
    setupDate() {
        if (this.dom.letterDate) {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            this.dom.letterDate.textContent = new Date().toLocaleDateString('ru-RU', options);
        }
    }

    escapeHtml(text) { 
        const div = document.createElement('div'); 
        div.textContent = text; 
        return div.innerHTML; 
    }

    // === ПРЕСЕТЫ ===
    renderPresets() {
        if (!this.dom.presetList) return;
        this.dom.presetList.innerHTML = this.presetMessages.map(msg => `
            <div class="preset-item" data-id="${msg.id}" role="listitem" tabindex="0">
                <h4>${msg.title}</h4>
                <p>${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}</p>
            </div>
        `).join('');
        
        this.dom.presetList.addEventListener('click', (e) => {
            const item = e.target.closest('.preset-item');
            if (item) {
                const id = parseInt(item.dataset.id);
                const message = this.presetMessages.find(m => m.id === id);
                if (message) this.selectMessage(message);
            }
        });
        
        this.dom.presetList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const item = e.target.closest('.preset-item');
                if (item) {
                    e.preventDefault();
                    const id = parseInt(item.dataset.id);
                    const message = this.presetMessages.find(m => m.id === id);
                    if (message) this.selectMessage(message);
                }
            }
        });
    }

    switchTab(tabName) {
        this.state.activeTab = tabName;
        this.dom.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
            btn.setAttribute('aria-selected', btn.dataset.tab === tabName ? 'true' : 'false');
        });
        this.dom.tabContents.forEach(content => {
            const isActive = content.id === `${tabName}-tab`;
            content.classList.toggle('active', isActive);
            content.hidden = !isActive;
        });
    }

    selectMessage(message) { 
        this.state.currentMessage = message; 
        this.closeModal(); 
        this.openEnvelope(); 
    }

    // === КОНВЕРТ ===
    openEnvelope() {
        if (this.state.isOpened || !this.state.currentMessage) return;
        
        // Пауза слайдера при открытии
        if (this.slider) this.slider.stop();
        
        this.dom.envelopeContainer?.classList.add('visible');
        
        setTimeout(() => {
            this.dom.envelopeContainer?.classList.add('open');
            const msg = this.state.currentMessage;
            
            this.dom.letterText.innerHTML = this.escapeHtml(msg.text)
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');
            this.dom.letterText.innerHTML = `<p>${this.dom.letterText.innerHTML}</p>`;
            
            this.dom.letterSignature.textContent = msg.signature;
            this.state.isOpened = true;
            
            console.log('✉️ Envelope opened for:', msg.title);
        }, 100);
    }

    closeEnvelope() {
        this.dom.envelopeContainer?.classList.remove('open');
        this.state.isOpened = false;
        
        // Возобновляем слайдер
        if (this.slider) this.slider.start();
        
        setTimeout(() => {
            this.dom.envelopeContainer?.classList.remove('visible');
            this.dom.letterText.innerHTML = '';
            this.dom.letterSignature.textContent = '';
            this.state.currentMessage = null;
        }, 400);
    }

    openModal() { 
        this.dom.modalOverlay?.classList.add('active'); 
        this.switchTab('preset'); 
    }
    
    closeModal() { 
        this.dom.modalOverlay?.classList.remove('active'); 
    }

    // === СЖАТИЕ ===
    compressWithDict(text) {
        let result = text;
        for (const [phrase, code] of Object.entries(this._phraseDict)) {
            result = result.replaceAll(phrase, code);
        }
        return result;
    }

    decompressWithDict(text) {
        let result = text;
        for (const [phrase, code] of Object.entries(this._phraseDictReverse)) {
            result = result.replaceAll(code, phrase);
        }
        return result;
    }

    compressMessage(data) {
        try {
            const json = JSON.stringify([data.t, data.s]);
            return 'z' + LZString.compressToEncodedURIComponent(json);
        } catch (e) { 
            console.error('Compress error:', e); 
            return null; 
        }
    }

    decompressMessage(compressed) {
        try {
            if (!compressed) return null;
            
            const prefix = compressed[0];
            const payload = compressed.slice(1);
            let json;
            
            if (prefix === 'z' && typeof LZString !== 'undefined') {
                json = LZString.decompressFromEncodedURIComponent(payload);
            } else {
                json = decodeURIComponent(atob(compressed));
            }
            
            if (!json) return null;
            
            const arr = JSON.parse(json);
            if (!Array.isArray(arr) || arr.length < 2) return null;
            
            return { t: arr[0], s: arr[1] };
            
        } catch (e) {
            console.error('❌ Decompress error:', e);
            return null;
        }
    }

    // === ПОЛЬЗОВАТЕЛЬСКИЕ СООБЩЕНИЯ ===
    loadCustomMessage() {
        try {
            const stored = localStorage.getItem(this.config.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                if (this.dom.customText) this.dom.customText.value = data.text || '';
                if (this.dom.customSignature) this.dom.customSignature.value = data.signature || '';
            }
        } catch (error) { console.warn('Load custom error:', error); }
    }

    updateCharCount() {
        if (this.dom.customText && this.dom.charCount) {
            const count = this.dom.customText.value.length;
            const span = this.dom.charCount.querySelector('span');
            if (span) span.textContent = count;
            this.dom.charCount.style.color = count > 450 ? '#ef4444' : count > 400 ? '#f59e0b' : '';
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        const text = this.dom.customText?.value.trim();
        const signature = this.dom.customSignature?.value.trim();
        if (!text || !signature) { this.showToast('Заполните все поля', 'error'); return; }
        if (text.length < 20) { this.showToast('Текст слишком краток', 'error'); return; }
        try {
            localStorage.setItem(this.config.storageKey, JSON.stringify({ text, signature }));
            const customMessage = { id: Date.now(), title: "Ваше послание", text, signature, isCustom: true };
            this.closeModal(); this.selectMessage(customMessage); this.showToast('Послание сохранено!', 'success');
        } catch (error) { this.showToast('Ошибка сохранения', 'error'); }
    }

    resetToDefaults() {
        if (confirm('Удалить сохранённое послание?')) {
            localStorage.removeItem(this.config.storageKey);
            if (this.dom.customText) this.dom.customText.value = '';
            if (this.dom.customSignature) this.dom.customSignature.value = '';
            this.showToast('Настройки сброшены', 'info');
        }
    }

    // === ШАРИНГ ===
    async shareLetter() {
        if (!this.state.currentMessage) { this.showToast('Выберите послание', 'info'); return; }
        try {
            const msg = this.state.currentMessage;
            let shareUrl;
            
            if (msg.id && msg.id <= 1000) {
                shareUrl = `${this.config.baseUrl}?m=p${msg.id}`;
            } else {
                const compressed = this.compressMessage({ t: msg.text, s: msg.signature });
                if (!compressed) { this.showToast('Ошибка кодирования', 'error'); return; }
                shareUrl = `${this.config.baseUrl}?m=${compressed}`;
            }
            
            await navigator.clipboard.writeText(shareUrl);
            this.showToast('Ссылка скопирована!', 'success');
            console.log('🔗 Shared URL:', shareUrl);
        } catch (err) { 
            console.error('Share error:', err); 
            this.showToast('Ошибка', 'error'); 
        }
    }

    // === ПРОВЕРКА ССЫЛКИ ===
    checkUrlForSharedMessage() {
        const params = new URLSearchParams(window.location.search);
        const msgParam = params.get('m');
        
        if (!msgParam) return;
        
        // Пресеты
        if (msgParam.startsWith('p')) {
            const presetId = parseInt(msgParam.slice(1));
            const preset = this.presetMessages.find(m => m.id === presetId);
            if (preset) {
                this._displaySharedMessage(preset, 'Пресет загружен');
                this._cleanUrl();
            } else {
                this.showToast('Пресет не найден', 'error');
            }
            return;
        }
        
        // Кастомные
        const decoded = this.decompressMessage(msgParam);
        
        if (!decoded || !decoded.t || !decoded.s) {
            this.showToast('Ссылка повреждена', 'error');
            this._cleanUrl();
            return;
        }
        
        const customMessage = {
            title: "Получено по ссылке",
            text: decoded.t,
            signature: decoded.s,
            isShared: true
        };
        
        this._displaySharedMessage(customMessage, 'Письмо загружено');
        this._cleanUrl();
    }

    _displaySharedMessage(message, toastText) {
        this.state.currentMessage = message;
        
        if (this.dom.letterDate) {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            this.dom.letterDate.textContent = new Date().toLocaleDateString('ru-RU', options);
        }
        
        this.dom.letterText.innerHTML = this.escapeHtml(message.text)
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        this.dom.letterText.innerHTML = `<p>${this.dom.letterText.innerHTML}</p>`;
        
        this.dom.letterSignature.textContent = message.signature;
        
        this.dom.envelopeContainer?.classList.add('visible');
        
        setTimeout(() => {
            this.dom.envelopeContainer?.classList.add('open');
            this.state.isOpened = true;
            this.showToast(toastText, 'success');
        }, 150);
    }

    _cleanUrl() {
        if (history.replaceState) {
            history.replaceState({}, document.title, this.config.baseUrl);
        }
    }

    // === ГЕНЕРАЦИЯ КАРТИНКИ ===
    async generateLetterImage() {
        if (!this.state.currentMessage) {
            this.showToast('Выберите послание', 'info');
            return null;
        }

        try {
            if (typeof QRCode === 'undefined') {
                this.showToast('Ошибка: QR библиотека не загружена', 'error');
                return null;
            }

            const activeSlide = document.querySelector('.card-slide.active');
            if (!activeSlide) return null;

            const img = activeSlide.querySelector('.card-image');
            if (!img) return null;

            // Wait for image load
            if (!img.complete || img.naturalWidth === 0) {
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error('Image load failed'));
                    setTimeout(resolve, 2000);
                });
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 960;
            canvas.height = 1280;
            const scale = 2;

            // Background
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Vignette
            const vignette = ctx.createRadialGradient(
                canvas.width/2, canvas.height/2, canvas.height * 0.3,
                canvas.width/2, canvas.height/2, canvas.height * 0.9
            );
            vignette.addColorStop(0, 'rgba(0,0,0,0)');
            vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Header
            const headerHeight = 300 * scale;
            ctx.fillStyle = 'rgba(10, 10, 13, 0.98)';
            ctx.fillRect(0, 0, canvas.width, headerHeight);
            
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
            ctx.lineWidth = 4 * scale;
            ctx.beginPath();
            ctx.moveTo(0, headerHeight);
            ctx.lineTo(canvas.width, headerHeight);
            ctx.stroke();

            // Title
            ctx.fillStyle = 'rgba(212, 175, 55, 1)';
            ctx.font = `bold ${52 * scale}px "Playfair Display", serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FRACK OFF', canvas.width/2, 70 * scale);
            
            ctx.fillStyle = 'rgba(180, 180, 196, 1)';
            ctx.font = `italic ${24 * scale}px "Cormorant Garamond", serif`;
            ctx.fillText('Бюро изящных отказов', canvas.width/2, 124 * scale);

            // QR Code
            const qrCanvas = document.createElement('canvas');
            const shareUrl = this.state.currentMessage.id && this.state.currentMessage.id <= 1000
                ? `${this.config.baseUrl}?m=p${this.state.currentMessage.id}`
                : `${this.config.baseUrl}?m=${this.compressMessage({
                    t: this.state.currentMessage.text, 
                    s: this.state.currentMessage.signature
                })}`;
            
            await QRCode.toCanvas(qrCanvas, shareUrl, {
                width: 220 * scale,
                margin: 3,
                color: { dark: '#0a0a0d', light: '#f8f4e9' },
                errorCorrectionLevel: 'H'
            });
            
            const qrSize = 220 * scale;
            const qrX = (canvas.width - qrSize) / 2;
            const qrY = 180 * scale;
            
            ctx.fillStyle = '#f8f4e9';
            ctx.fillRect(qrX - 20 * scale, qrY - 20 * scale, qrSize + 40 * scale, qrSize + 40 * scale);
            
            ctx.strokeStyle = 'rgba(212, 175, 55, 1)';
            ctx.lineWidth = 8 * scale;
            ctx.strokeRect(qrX - 20 * scale, qrY - 20 * scale, qrSize + 40 * scale, qrSize + 40 * scale);
            
            ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
            
            ctx.fillStyle = 'rgba(212, 175, 55, 1)';
            ctx.font = `bold ${20 * scale}px "Playfair Display", serif`;
            ctx.textAlign = 'center';
            ctx.fillText('frackoff.ru', canvas.width/2, qrY + qrSize + 44 * scale);

            // Separator
            const separatorY = qrY + qrSize + 90 * scale;
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
            ctx.lineWidth = 2 * scale;
            ctx.setLineDash([10 * scale, 6 * scale]);
            ctx.beginPath();
            ctx.moveTo(80 * scale, separatorY);
            ctx.lineTo(canvas.width - 80 * scale, separatorY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Beige area
            const textTop = separatorY + 80 * scale;
            const textBottom = canvas.height - 80 * scale;
            const textHeight = textBottom - textTop;
            const textMargin = 60 * scale;
            
            ctx.fillStyle = 'rgba(248, 244, 233, 0.98)';
            if (ctx.roundRect) {
                ctx.roundRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight, 16 * scale);
            } else {
                ctx.fillRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight);
            }
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
            ctx.lineWidth = 3 * scale;
            if (ctx.roundRect) {
                ctx.roundRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight, 16 * scale);
            } else {
                ctx.strokeRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight);
            }
            ctx.stroke();

            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            console.log('✅ [IMAGE] Generated:', dataUrl.length, 'chars');
            return { dataUrl };
            
        } catch (error) {
            console.error('❌ [IMAGE] Fatal error:', error);
            this.showToast('Не удалось: ' + error.message, 'error');
            return this._generateFallbackImage();
        }
    }

    _generateFallbackImage() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 960;
            canvas.height = 1280;
            const scale = 2;

            // Gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#0a0a0d');
            gradient.addColorStop(0.3, '#121218');
            gradient.addColorStop(1, '#1a1a22');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Border
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
            ctx.lineWidth = 4 * scale;
            ctx.strokeRect(30 * scale, 30 * scale, canvas.width - 60 * scale, canvas.height - 60 * scale);

            // Header
            const headerHeight = 300 * scale;
            ctx.fillStyle = 'rgba(10, 10, 13, 0.98)';
            ctx.fillRect(0, 0, canvas.width, headerHeight);
            
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
            ctx.lineWidth = 4 * scale;
            ctx.beginPath();
            ctx.moveTo(0, headerHeight);
            ctx.lineTo(canvas.width, headerHeight);
            ctx.stroke();

            ctx.fillStyle = 'rgba(212, 175, 55, 1)';
            ctx.font = `bold ${52 * scale}px "Playfair Display", serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FRACK OFF', canvas.width/2, 70 * scale);
            
            ctx.fillStyle = 'rgba(180, 180, 196, 1)';
            ctx.font = `italic ${24 * scale}px "Cormorant Garamond", serif`;
            ctx.fillText('Бюро изящных отказов', canvas.width/2, 124 * scale);

            // QR
            const qrCanvas = document.createElement('canvas');
            const shareUrl = this.state.currentMessage.id && this.state.currentMessage.id <= 1000
                ? `${this.config.baseUrl}?m=p${this.state.currentMessage.id}`
                : `${this.config.baseUrl}?m=${this.compressMessage({
                    t: this.state.currentMessage.text, 
                    s: this.state.currentMessage.signature
                })}`;
            
            return QRCode.toCanvas(qrCanvas, shareUrl, { 
                width: 220 * scale, 
                margin: 3,
                color: { dark: '#0a0a0d', light: '#f8f4e9' },
                errorCorrectionLevel: 'H'
            }).then(() => {
                const qrSize = 220 * scale;
                const qrX = (canvas.width - qrSize) / 2;
                const qrY = 180 * scale;
                
                ctx.fillStyle = '#f8f4e9';
                ctx.fillRect(qrX - 20 * scale, qrY - 20 * scale, qrSize + 40 * scale, qrSize + 40 * scale);
                
                ctx.strokeStyle = 'rgba(212, 175, 55, 1)';
                ctx.lineWidth = 8 * scale;
                ctx.strokeRect(qrX - 20 * scale, qrY - 20 * scale, qrSize + 40 * scale, qrSize + 40 * scale);
                
                ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
                
                ctx.fillStyle = 'rgba(212, 175, 55, 1)';
                ctx.font = `bold ${20 * scale}px "Playfair Display", serif`;
                ctx.textAlign = 'center';
                ctx.fillText('frackoff.ru', canvas.width/2, qrY + qrSize + 44 * scale);

                // Separator
                const separatorY = qrY + qrSize + 90 * scale;
                ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
                ctx.lineWidth = 2 * scale;
                ctx.setLineDash([10 * scale, 6 * scale]);
                ctx.beginPath();
                ctx.moveTo(80 * scale, separatorY);
                ctx.lineTo(canvas.width - 80 * scale, separatorY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Beige area
                const textTop = separatorY + 80 * scale;
                const textBottom = canvas.height - 80 * scale;
                const textHeight = textBottom - textTop;
                const textMargin = 60 * scale;
                
                ctx.fillStyle = 'rgba(248, 244, 233, 0.98)';
                if (ctx.roundRect) {
                    ctx.roundRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight, 16 * scale);
                } else {
                    ctx.fillRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight);
                }
                ctx.fill();
                
                ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
                ctx.lineWidth = 3 * scale;
                if (ctx.roundRect) {
                    ctx.roundRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight, 16 * scale);
                } else {
                    ctx.strokeRect(textMargin, textTop, canvas.width - textMargin * 2, textHeight);
                }
                ctx.stroke();

                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                console.log('✅ [FALLBACK] Image generated');
                return { dataUrl };
            });
            
        } catch (e) {
            console.error('❌ [FALLBACK] Failed:', e);
            this.showToast('Не удалось создать картинку', 'error');
            return null;
        }
    }

    async saveLetterImage() {
        this.showToast('Генерирую...', 'info');
        const result = await this.generateLetterImage();
        if (!result) {
            console.error('❌ No result from generateLetterImage');
            return;
        }
        
        console.log('💾 Saving image...');
        const link = document.createElement('a');
        link.href = result.dataUrl;
        link.download = `frackoff_${new Date().toISOString().slice(0,10)}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('Сохранено! 📸', 'success');
    }

    // === СЛАЙДЕР — ИНИЦИАЛИЗАЦИЯ ===
    initSlider() {
        console.log('🃏 [Slider] Initializing auto-fade slider...');
        
        const slides = document.querySelectorAll('.card-slide');
        if (slides.length === 0) {
            console.error('❌ [Slider] No slides found!');
            return;
        }

        // Создаём экземпляр авто-слайдера
        this.slider = new AutoSlider('cards-slider', {
            interval: 2000,           // 2 секунды
            transitionDuration: 800   // 800ms fade
        });
        
        console.log('✅ [Slider] Auto-fade slider ready');
    }

    // === TOAST ===
    showToast(message, type = 'info') {
        if (!this.dom.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        this.dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), this.config.toastDuration);
    }
}

// === ЗАПУСК ===
window.frackOffApp = new FrackOffApp();

console.log(`
╔══════════════════════════════════════╗
║         FRACK OFF v3.8.0             ║
║    Изящные отказы с шармом           ║
╠══════════════════════════════════════╣
║  powered by dev4rev                  ║
╚══════════════════════════════════════╝
`);