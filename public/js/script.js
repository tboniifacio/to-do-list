// JavaScript responsavel pela logica da lista de tarefas (tema, filtros e persistencia).
(() => {
    const THEME_KEY = 'theme';
    const ITEMS_KEY = 'todoItems';
    const FILTERS = Object.freeze({
        todos: 'todos',
        ativos: 'ativos',
        concluidos: 'concluidos'
    });
    const FILTER_HASH_MAP = Object.freeze({
        '#todos': FILTERS.todos,
        '#ativos': FILTERS.ativos,
        '#concluidos': FILTERS.concluidos
    });

    const state = {
        items: [],
        filter: FILTERS.todos
    };

    let listRoot = null;
    let templateItem = null;
    let counterNode = null;
    let filterLinks = [];
    let resetLink = null;
    let themeToggle = null;
    let inputField = null;

    applyThemeFromStorage();

    document.addEventListener('DOMContentLoaded', () => {
        listRoot = findListRoot();
        templateItem = captureTemplateItem();
        themeToggle = document.querySelector('.darkmode-toggle');
        inputField = document.querySelector('input[type="text"]');
        ({ filters: filterLinks, reset: resetLink } = collectFooterLinks());
        counterNode = locateCounterNode();

        const storedItems = loadItems();
        if (storedItems.length) {
            state.items = storedItems;
        } else {
            state.items = readItemsFromDOM();
            saveItems();
        }

        renderItems(state.items);
        updateCounter();
        applyFilter(state.filter);
        bindEvents();
        syncThemeToggleState();
    });

    function applyThemeFromStorage() {
        const storedTheme = localStorage.getItem(THEME_KEY);
        if (storedTheme === 'dark') {
            document.body.classList.add('darkmode');
        } else if (storedTheme === 'light') {
            document.body.classList.remove('darkmode');
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('darkmode');
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        syncThemeToggleState();
    }

    function readItemsFromDOM() {
        if (!listRoot) {
            return [];
        }
        return getItemElements().map(extractItemData);
    }

    function saveItems(items = state.items) {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    }

    function loadItems() {
        try {
            const raw = localStorage.getItem(ITEMS_KEY);
            if (!raw) {
                return [];
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .filter(item => item && typeof item.text === 'string')
                .map(item => ({
                    text: item.text,
                    done: Boolean(item.done)
                }));
        } catch (error) {
            console.error('Falha ao ler itens salvos:', error);
            return [];
        }
    }

    function renderItems(items) {
        if (!listRoot) {
            return;
        }
        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            fragment.appendChild(createItemElement(item));
        });

        getItemElements().forEach(node => node.remove());
        listRoot.appendChild(fragment);

        if (!templateItem) {
            const firstRendered = listRoot.querySelector('.item');
            if (firstRendered) {
                templateItem = sanitizeTemplateElement(firstRendered);
            }
        }
    }

    function updateCounter() {
        if (!counterNode) {
            return;
        }
        const remaining = state.items.filter(item => !item.done).length;
        const label = remaining === 1 ? 'item restante' : 'itens restantes';
        const text = `${remaining} ${label}`;

        if (counterNode.nodeType === Node.TEXT_NODE) {
            counterNode.textContent = text;
        } else {
            counterNode.textContent = text;
        }
    }

    function applyFilter(type = state.filter) {
        if (!listRoot) {
            return;
        }
        state.filter = type;

        getItemElements().forEach(item => {
            const isCompleted = item.classList.contains('item-checked');
            let visible = true;

            if (type === FILTERS.ativos) {
                visible = !isCompleted;
            } else if (type === FILTERS.concluidos) {
                visible = isCompleted;
            }

            item.style.display = visible ? '' : 'none';
        });

        filterLinks.forEach(link => {
            const linkFilter = link.dataset.filter;
            const isActive = linkFilter === type;
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function clearCompleted() {
        const remaining = state.items.filter(item => !item.done);
        if (remaining.length === state.items.length) {
            return;
        }
        state.items = remaining;
        saveItems();
        renderItems(state.items);
        updateCounter();
        applyFilter(state.filter);
    }

    function findListRoot() {
        const firstItem = document.querySelector('.item');
        if (firstItem && firstItem.parentElement) {
            return firstItem.parentElement;
        }

        const container = document.querySelector('.container');
        if (!container) {
            return null;
        }

        const selectors = [
            '.todo-items',
            '.todo-list',
            '.items',
            '.list',
            '.tasks',
            '.task-list',
            'ul',
            'ol'
        ];

        for (const selector of selectors) {
            const candidate = container.querySelector(selector);
            if (
                candidate &&
                !candidate.classList.contains('footer') &&
                !candidate.closest('.footer')
            ) {
                return candidate;
            }
        }

        return container;
    }

    function captureTemplateItem() {
        if (!listRoot) {
            return null;
        }
        const candidate = listRoot.querySelector('.item');
        return candidate ? sanitizeTemplateElement(candidate) : null;
    }

    function sanitizeTemplateElement(element) {
        const clone = element.cloneNode(true);
        clone.classList.remove('item-checked');
        const checkbox = clone.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = false;
            checkbox.removeAttribute('checked');
        }
        const span = clone.querySelector('span');
        if (span) {
            span.textContent = '';
        }
        return clone;
    }

    function createItemElement({ text, done }) {
        let element;

        if (templateItem) {
            element = templateItem.cloneNode(true);
        } else {
            element = document.createElement('div');
            element.classList.add('item');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            const span = document.createElement('span');
            element.append(checkbox, span);
        }

        const checkbox = element.querySelector('input[type="checkbox"]');
        const span = element.querySelector('span');

        if (span) {
            span.textContent = text;
        }
        if (checkbox) {
            checkbox.checked = Boolean(done);
        }
        element.classList.toggle('item-checked', Boolean(done));

        if (!templateItem) {
            templateItem = sanitizeTemplateElement(element);
        }

        return element;
    }

    function getItemElements() {
        if (!listRoot) {
            return [];
        }
        return Array.from(listRoot.querySelectorAll('.item'));
    }

    function collectFooterLinks() {
        const footer = document.querySelector('.footer');
        if (!footer) {
            return { filters: [], reset: null };
        }

        const links = Array.from(footer.querySelectorAll('a[href]'));
        const filters = [];
        let reset = null;

        links.forEach(link => {
            const href = (link.getAttribute('href') || '').toLowerCase();
            const filter = FILTER_HASH_MAP[href];

            if (filter) {
                link.dataset.filter = filter;
                filters.push(link);
            } else if (href === '#reset') {
                reset = link;
            }
        });

        return { filters, reset };
    }

    function locateCounterNode() {
        const footer = document.querySelector('.footer');
        if (!footer) {
            return null;
        }

        const textWalker = document.createTreeWalker(
            footer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );

        const textNode = textWalker.nextNode();
        if (textNode) {
            return textNode;
        }

        return footer.querySelector('[data-counter], .item-count, .count, span, p') || null;
    }

    function bindEvents() {
        if (themeToggle) {
            themeToggle.addEventListener('click', event => {
                event.preventDefault();
                toggleTheme();
            });
        }

        if (listRoot) {
            listRoot.addEventListener('change', handleListChange);
        }

        if (inputField) {
            inputField.addEventListener('keydown', handleInputKeydown);
        }

        filterLinks.forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                applyFilter(link.dataset.filter || FILTERS.todos);
            });
        });

        if (resetLink) {
            resetLink.addEventListener('click', event => {
                event.preventDefault();
                clearCompleted();
            });
        }
    }

    function syncThemeToggleState() {
        if (!themeToggle) {
            return;
        }
        const isDark = document.body.classList.contains('darkmode');
        themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }

    function handleListChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
            return;
        }

        const itemElement = target.closest('.item');
        if (!itemElement) {
            return;
        }

        itemElement.classList.toggle('item-checked', target.checked);
        const index = findItemIndex(itemElement);
        if (index === -1) {
            return;
        }

        state.items[index].done = target.checked;
        saveItems();
        updateCounter();
        applyFilter(state.filter);
    }

    function handleInputKeydown(event) {
        if (event.key !== 'Enter') {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }

        const value = target.value.trim();
        if (!value) {
            return;
        }

        state.items.push({ text: value, done: false });
        saveItems();
        renderItems(state.items);
        updateCounter();
        applyFilter(state.filter);

        target.value = '';
    }

    function findItemIndex(itemElement) {
        return getItemElements().indexOf(itemElement);
    }

    function extractItemData(itemElement) {
        const checkbox = itemElement.querySelector('input[type="checkbox"]');
        const span = itemElement.querySelector('span');
        const text = span ? span.textContent.trim() : '';
        const done = itemElement.classList.contains('item-checked') || (checkbox ? checkbox.checked : false);

        return { text, done };
    }
})();
