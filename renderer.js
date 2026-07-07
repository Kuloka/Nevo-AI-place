/* ============================================
   Nevo Renderer
   Chat-first assistant. Ollama-powered.
   ============================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ============================================================
  //  STATE
  // ============================================================
  let data = { groups: [], chats: [] };     // РїРµСЂСЃРёСЃС‚РµРЅС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ
  let settings = {
    selectedModel: null,
    thinkLevel: "medium",
    accessMode: "ask",
    appLanguage: "en",
    theme: "light",
    computeMode: "auto",
    downloadedLanguages: ["en"]
  };

  let currentChatId = null;
  let isGenerating = false;
  let abortController = null;

  let ollamaRunning = false;
  let availableModels = [];          // СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹Рµ РјРѕРґРµР»Рё [{name,size,details}]
  let pullingModels = {};            // { modelName: percent }
  let ollamaEnsureInFlight = false;

  let attachments = [];              // [{kind:'image'|'file', name, dataUrl, base64, text}]

  let thinkingEl = null;
  let activeCodeActivityEl = null;
  let lastCodeActivity = null;
  let currentCodeProjectFolderName = null;
  let currentThinkingLines = [];
  let agentProgress = [];
  let progressDismissed = false;
  let codingPreviewItems = [];
  let expandedModelFamilies = new Set();
  let acceptedChangeChatId = null;
  let pendingApprovalResolve = null;
  let thinkingTicker = null;
  let thinkingStartedAt = 0;
  let panelFileTabsState = [];
  let activePanelFileKey = null;
  let typingTimer = null;

  // ============================================================
  //  DOM
  // ============================================================
  const messagesEl = $("messages");
  const welcomeEl = $("welcomeScreen");
  const welcomeTitle = $("welcomeTitle");
  const appEl = document.querySelector(".app");
  const mainArea = document.querySelector(".main-area");
  const inputEl = $("userInput");
  const sendBtn = $("sendBtn");
  const stopBtn = $("stopBtn");
  const chatContainer = $("chatContainer");
  const attachBtn = $("attachBtn");
  const fileInput = $("fileInput");
  const attachmentStrip = $("attachmentStrip");
  const statusDot = $("statusDot");
  const welcomeHint = $("welcomeHint");
  const openProjectsBtn = $("openProjectsBtn");
  const searchChatsBtn = $("searchChatsBtn");
  const settingsBtn = $("settingsBtn");
  const settingsModal = $("settingsModal");
  const closeSettingsBtn = $("closeSettingsBtn");
  const appLanguageSelect = $("appLanguageSelect");
  const themeSegment = $("themeSegment");
  const computeSegment = $("computeSegment");
  const languagePackList = $("languagePackList");
  const toggleTabBtn = $("toggleTabBtn");
  const sideLogo = document.querySelector(".side-logo");
  const toolbarExplorerBtn = $("toolbarExplorerBtn");
  const toolbarTerminalBtn = $("toolbarTerminalBtn");
  const toolbarPanelBtn = $("toolbarPanelBtn");
  const terminalPanel = $("terminalPanel");
  const terminalOutput = $("terminalOutput");
  const terminalInput = $("terminalInput");
  const terminalCwd = $("terminalCwd");
  const closeTerminalBtn = $("closeTerminalBtn");
  const sidePanel = $("sidePanel");
  const closePanelBtn = $("closePanelBtn");
  const progressCard = $("progressCard");
  const progressHideBtn = $("progressHideBtn");
  const progressCount = $("progressCount");
  const progressList = $("progressList");
  const panelProgressList = $("panelProgressList");
  const panelFileTabsEl = $("panelFileTabs");
  const panelFileViewerEl = $("panelFileViewer");
  const accessBtn = $("accessBtn");
  const accessLabel = $("accessLabel");
  const accessDropdown = $("accessDropdown");
  const approvalModal = $("approvalModal");
  const approvalText = $("approvalText");
  const approvalAcceptBtn = $("approvalAcceptBtn");
  const approvalAcceptChatBtn = $("approvalAcceptChatBtn");
  const approvalDenyBtn = $("approvalDenyBtn");
  const approvalCloseBtn = $("approvalCloseBtn");
  const setupSheet = $("setupSheet");
  const setupQuestion = $("setupQuestion");
  const setupOptions = $("setupOptions");

  const modelBtn = $("modelBtn");
  const modelLabel = $("modelLabel");
  const modelDropdown = $("modelDropdown");

  const thinkBtn = $("thinkBtn");
  const thinkLabel = $("thinkLabel");
  const thinkDropdown = $("thinkDropdown");
  const modelsSearch = $("modelsSearch");

  const chatHistoryList = $("chatHistoryList");
  const sidebarScroll = $("sidebarScroll");
  const sidebarMiniScroll = $("sidebarMiniScroll");
  const sidebarMiniThumb = $("sidebarMiniThumb");

  const APP_LANGUAGES = [
    { code: "en", name: "English" },
    { code: "ru", name: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
    { code: "es", name: "Espa\u00f1ol" },
    { code: "zh", name: "\u4e2d\u6587" },
    { code: "hi", name: "\u0939\u093f\u0928\u094d\u0926\u0940" },
    { code: "ar", name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
    { code: "pt", name: "Portugu\u00eas" },
    { code: "fr", name: "Fran\u00e7ais" },
    { code: "de", name: "Deutsch" },
    { code: "ja", name: "\u65e5\u672c\u8a9e" },
    { code: "ko", name: "\ud55c\uad6d\uc5b4" },
    { code: "it", name: "Italiano" },
    { code: "tr", name: "T\u00fcrk\u00e7e" },
    { code: "pl", name: "Polski" },
    { code: "uk", name: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430" },
  ];

  const UI_TEXT = {
    en: {
      settings: "Settings",
      theme: "Theme",
      themeDesc: "Choose the visual theme.",
      dark: "Dark",
      light: "Light",
      languagePacks: "Language packs",
      languagePacksDesc: "Download a language, then choose it for the app interface.",
      download: "Download",
      choose: "Choose",
      selected: "Selected",
      newChat: "New chat",
      projects: "Projects",
      recent: "Recent",
      emptyRecent: "Write something to the neural network and your chats will be saved here.",
      models: "Models",
      chooseModel: "Choose model",
      askPlaceholder: "Ask Nevo anything...",
      modelSearch: "Search models...",
      folderPlaceholder: "Folder name...",
      setupTitle: "Clarify the task",
      newFolder: "New folder",
      create: "Create",
      intro: "Intro",
      explain: "Explain topic",
      ideas: "Project ideas",
      translate: "Translate",
      access: {
        ask: "Ask before changes",
        auto: "Edit automatically",
        plan: "Plan mode",
        full: "Full access",
      },
      setupInterfaceQuestion: "What kind of interface should it be?",
      setupDashboard: "Dashboard / workspace",
      setupPortfolio: "Portfolio / personal page",
      setupSaas: "SaaS / product interface",
      setupVisualQuestion: "Which visual mode?",
      setupDark: "Dark theme",
      setupLight: "Light theme",
      setupMixed: "Mixed contrast theme",
      setupStackQuestion: "What should it be built with?",
      setupCustom: "Custom option",
      setupCustomPlaceholder: "Describe your option...",
      setupUse: "Use",
      interfaceParameters: "Interface parameters",
      interfaceType: "Type",
      visualMode: "Visual mode",
      stack: "Language/stack",
      drawUnderstanding: "Understanding what to draw",
      drawPreparing: "Preparing the image request",
      drawBase: "Building the composition",
      drawDetails: "Refining details",
      drawAlmost: "Almost ready",
      drawFinal: "Final touch",
      imageCardTitle: "Image creation",
      imagePrompt: "Prompt",
      imageGenerating: "Generating procedural artwork...",
      needMoreModels: "Need more models?",
      catalog: "Catalog",
      computeMode: "Compute mode",
      computeModeDesc: "Auto uses the best available device. CPU is safer for PCs without a GPU.",
      progress: "Progress",
      nevoActions: "Nevo actions",
      codingPreview: "Coding preview",
      approvalTitle: "Ask before changes",
      approvalDefault: "Nevo wants to edit a file.",
      accept: "Accept",
      acceptInChat: "Accept in this chat",
      denied: "Denied",
      motivationLines: [
        "When you start, I start.",
        "Make the idea real.",
        "Turn the blank screen into progress.",
        "Start small. Ship something alive.",
        "Design it. Break it. Make it better.",
        "Your next version starts here.",
      ],
    },
    ru: {
      "settings": "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
      "theme": "\u0422\u0435\u043c\u0430",
      "themeDesc": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u043d\u0435\u0448\u043d\u0438\u0439 \u0432\u0438\u0434 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f.",
      "dark": "\u0422\u0451\u043c\u043d\u0430\u044f",
      "light": "\u0421\u0432\u0435\u0442\u043b\u0430\u044f",
      "languagePacks": "\u042f\u0437\u044b\u043a\u0438 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430",
      "languagePacksDesc": "\u0421\u043a\u0430\u0447\u0430\u0439\u0442\u0435 \u044f\u0437\u044b\u043a, \u043f\u043e\u0442\u043e\u043c \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0435\u0433\u043e \u0434\u043b\u044f \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430.",
      "download": "\u0421\u043a\u0430\u0447\u0430\u0442\u044c",
      "choose": "\u0412\u044b\u0431\u0440\u0430\u0442\u044c",
      "selected": "\u0412\u044b\u0431\u0440\u0430\u043d",
      "newChat": "\u041d\u043e\u0432\u044b\u0439 \u0447\u0430\u0442",
      "projects": "\u041f\u0440\u043e\u0435\u043a\u0442\u044b",
      "recent": "\u041d\u0435\u0434\u0430\u0432\u043d\u0435\u0435",
      "emptyRecent": "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0447\u0442\u043e-\u0442\u043e \u043d\u0435\u0439\u0440\u043e\u0441\u0435\u0442\u0438, \u0438 \u0432\u0430\u0448\u0438 \u0447\u0430\u0442\u044b \u0431\u0443\u0434\u0443\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b \u0437\u0434\u0435\u0441\u044c.",
      "models": "\u041c\u043e\u0434\u0435\u043b\u0438",
      "chooseModel": "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043c\u043e\u0434\u0435\u043b\u044c",
      "askPlaceholder": "\u0421\u043f\u0440\u043e\u0441\u0438\u0442\u0435 Nevo \u043e \u0447\u0451\u043c \u0443\u0433\u043e\u0434\u043d\u043e...",
      "modelSearch": "\u041f\u043e\u0438\u0441\u043a \u043c\u043e\u0434\u0435\u043b\u0435\u0439...",
      "folderPlaceholder": "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0430\u043f\u043a\u0438...",
      "setupTitle": "\u0423\u0442\u043e\u0447\u043d\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443",
      "newFolder": "\u041d\u043e\u0432\u0430\u044f \u043f\u0430\u043f\u043a\u0430",
      "create": "\u0421\u043e\u0437\u0434\u0430\u0442\u044c",
      "intro": "\u0417\u043d\u0430\u043a\u043e\u043c\u0441\u0442\u0432\u043e",
      "explain": "\u041e\u0431\u044a\u044f\u0441\u043d\u0438 \u0442\u0435\u043c\u0443",
      "ideas": "\u0418\u0434\u0435\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
      "translate": "\u041f\u0435\u0440\u0435\u0432\u043e\u0434",
      "access": {
            "ask": "\u0421\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u0442\u044c \u043f\u0435\u0440\u0435\u0434 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f\u043c\u0438",
            "auto": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438",
            "plan": "\u0420\u0435\u0436\u0438\u043c \u043f\u043b\u0430\u043d\u0430",
            "full": "\u041f\u043e\u043b\u043d\u044b\u0439 \u0434\u043e\u0441\u0442\u0443\u043f"
      },
      "setupInterfaceQuestion": "\u041a\u0430\u043a\u043e\u0439 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0441\u0434\u0435\u043b\u0430\u0442\u044c?",
      "setupDashboard": "\u0414\u0430\u0448\u0431\u043e\u0440\u0434 / \u0440\u0430\u0431\u043e\u0447\u0430\u044f \u043f\u0430\u043d\u0435\u043b\u044c",
      "setupPortfolio": "\u041f\u043e\u0440\u0442\u0444\u043e\u043b\u0438\u043e / \u043b\u0438\u0447\u043d\u0430\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430",
      "setupSaas": "SaaS / \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432\u044b\u0439 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441",
      "setupVisualQuestion": "\u041a\u0430\u043a\u043e\u0439 \u0440\u0435\u0436\u0438\u043c \u0441\u0434\u0435\u043b\u0430\u0442\u044c?",
      "setupDark": "\u0422\u0451\u043c\u043d\u0430\u044f \u0442\u0435\u043c\u0430",
      "setupLight": "\u0421\u0432\u0435\u0442\u043b\u0430\u044f \u0442\u0435\u043c\u0430",
      "setupMixed": "\u041a\u043e\u043d\u0442\u0440\u0430\u0441\u0442\u043d\u0430\u044f mixed-\u0442\u0435\u043c\u0430",
      "setupStackQuestion": "\u041d\u0430 \u0447\u0451\u043c \u043f\u0438\u0441\u0430\u0442\u044c?",
      "setupCustom": "\u0421\u0432\u043e\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442",
      "setupCustomPlaceholder": "\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u0432\u043e\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442...",
      "setupUse": "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c",
      "interfaceParameters": "\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430",
      "interfaceType": "\u0422\u0438\u043f",
      "visualMode": "\u0420\u0435\u0436\u0438\u043c",
      "stack": "\u042f\u0437\u044b\u043a/\u0441\u0442\u0435\u043a",
      "drawUnderstanding": "\u041f\u043e\u043d\u0438\u043c\u0430\u044e, \u0447\u0442\u043e \u043d\u0443\u0436\u043d\u043e \u043d\u0430\u0440\u0438\u0441\u043e\u0432\u0430\u0442\u044c",
      "drawPreparing": "\u0413\u043e\u0442\u043e\u0432\u043b\u044e \u0437\u0430\u043f\u0440\u043e\u0441 \u043a \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044e",
      "drawBase": "\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u043c \u043e\u0441\u043d\u043e\u0432\u0443",
      "drawDetails": "\u0414\u043e\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u0435\u043c \u0434\u0435\u0442\u0430\u043b\u0438",
      "drawAlmost": "\u041f\u043e\u0447\u0442\u0438 \u0433\u043e\u0442\u043e\u0432\u043e",
      "drawFinal": "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0448\u0442\u0440\u0438\u0445",
      "imageCardTitle": "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f",
      "imagePrompt": "\u0417\u0430\u043f\u0440\u043e\u0441",
      "imageGenerating": "\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u0430\u0431\u0441\u0442\u0440\u0430\u043a\u0442\u043d\u043e\u0433\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f...",
      "needMoreModels": "\u041d\u0443\u0436\u043d\u043e \u0431\u043e\u043b\u044c\u0448\u0435 \u043c\u043e\u0434\u0435\u043b\u0435\u0439?",
      "catalog": "\u041a\u0430\u0442\u0430\u043b\u043e\u0433",
      "computeMode": "\u0420\u0435\u0436\u0438\u043c \u0432\u044b\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u0439",
      "computeModeDesc": "Auto \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0442 \u043b\u0443\u0447\u0448\u0435\u0435 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u043e. CPU \u043d\u0430\u0434\u0451\u0436\u043d\u0435\u0435 \u0434\u043b\u044f \u041f\u041a \u0431\u0435\u0437 \u0432\u0438\u0434\u0435\u043e\u043a\u0430\u0440\u0442\u044b.",
      "progress": "\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441",
      "nevoActions": "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f Nevo",
      "codingPreview": "\u041f\u0440\u0435\u0432\u044c\u044e \u043a\u043e\u0434\u0430",
      "approvalTitle": "\u0421\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u043f\u0435\u0440\u0435\u0434 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f\u043c\u0438",
      "approvalDefault": "Nevo \u0445\u043e\u0447\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u0430\u0439\u043b.",
      "accept": "\u041f\u0440\u0438\u043d\u044f\u0442\u044c",
      "acceptInChat": "\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u0432 \u044d\u0442\u043e\u043c \u0447\u0430\u0442\u0435",
      "denied": "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c",
      "motivationLines": [
            "\u0421\u043e\u0431\u0435\u0440\u0438 \u0442\u043e, \u0447\u0442\u043e \u0434\u0430\u0432\u043d\u043e \u043a\u0440\u0443\u0442\u0438\u0442\u0441\u044f \u0432 \u0433\u043e\u043b\u043e\u0432\u0435.",
            "\u041f\u0440\u0435\u0432\u0440\u0430\u0442\u0438 \u043f\u0443\u0441\u0442\u043e\u0439 \u044d\u043a\u0440\u0430\u043d \u0432 \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441.",
            "\u041a\u043e\u0433\u0434\u0430 \u043d\u0430\u0447\u043d\u0451\u0448\u044c \u0442\u044b, \u043d\u0430\u0447\u043d\u0443 \u044f.",
            "\u041d\u0430\u0447\u043d\u0438 \u0441 \u043c\u0430\u043b\u043e\u0433\u043e. \u0414\u043e\u0432\u0435\u0434\u0438 \u0434\u043e \u0436\u0438\u0432\u043e\u0433\u043e.",
            "\u0418\u0434\u0435\u044f \u0436\u0434\u0451\u0442 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f."
      ]
}

  };

  const EXTRA_UI_TEXT = {
    es: {
      settings: "Configuracion",
      theme: "Tema",
      themeDesc: "Elige el tema visual.",
      dark: "Oscuro",
      light: "Claro",
      languagePacks: "Paquetes de idioma",
      languagePacksDesc: "Descarga un idioma y luego elige uno para la interfaz.",
      download: "Descargar",
      choose: "Elegir",
      selected: "Seleccionado",
      newChat: "Nuevo chat",
      projects: "Proyectos",
      recent: "Reciente",
      models: "Modelos",
      chooseModel: "Elegir modelo",
      askPlaceholder: "Pregunta a Nevo cualquier cosa...",
      modelSearch: "Buscar modelos...",
      setupTitle: "Aclarar tarea",
      access: { ask: "Preguntar antes de cambios", auto: "Editar automaticamente", plan: "Modo plan", full: "Acceso completo" },
      motivationLines: ["Construye lo que sigues imaginando.", "Haz real la idea.", "Tu siguiente version empieza aqui."],
    },
    fr: {
      settings: "Parametres",
      theme: "Theme",
      themeDesc: "Choisissez le theme visuel.",
      dark: "Sombre",
      light: "Clair",
      languagePacks: "Packs de langue",
      languagePacksDesc: "Telechargez une langue, puis choisissez-la pour l'interface.",
      download: "Telecharger",
      choose: "Choisir",
      selected: "Selectionne",
      newChat: "Nouveau chat",
      projects: "Projets",
      recent: "Recent",
      models: "Modeles",
      chooseModel: "Choisir un modele",
      askPlaceholder: "Demandez n'importe quoi a Nevo...",
      modelSearch: "Rechercher des modeles...",
      setupTitle: "Preciser la tache",
      access: { ask: "Demander avant modifications", auto: "Modifier automatiquement", plan: "Mode plan", full: "Acces complet" },
      motivationLines: ["Construis ce que tu imagines.", "Rends l'idee reelle.", "Ta prochaine version commence ici."],
    },
    de: {
      settings: "Einstellungen",
      theme: "Design",
      themeDesc: "Wahle das visuelle Design.",
      dark: "Dunkel",
      light: "Hell",
      languagePacks: "Sprachpakete",
      languagePacksDesc: "Lade eine Sprache herunter und wahle sie fur die Oberflache.",
      download: "Herunterladen",
      choose: "Wahlen",
      selected: "Ausgewahlt",
      newChat: "Neuer Chat",
      projects: "Projekte",
      recent: "Zuletzt",
      models: "Modelle",
      chooseModel: "Modell wahlen",
      askPlaceholder: "Frag Nevo alles...",
      modelSearch: "Modelle suchen...",
      setupTitle: "Aufgabe klaren",
      access: { ask: "Vor Anderungen fragen", auto: "Automatisch bearbeiten", plan: "Planmodus", full: "Voller Zugriff" },
      motivationLines: ["Baue, was du dir vorstellst.", "Mach die Idee real.", "Deine nachste Version beginnt hier."],
    },
    pt: {
      settings: "Configuracoes",
      theme: "Tema",
      themeDesc: "Escolha o tema visual.",
      dark: "Escuro",
      light: "Claro",
      languagePacks: "Pacotes de idioma",
      languagePacksDesc: "Baixe um idioma e escolha-o para a interface.",
      download: "Baixar",
      choose: "Escolher",
      selected: "Selecionado",
      newChat: "Novo chat",
      projects: "Projetos",
      recent: "Recentes",
      models: "Modelos",
      chooseModel: "Escolher modelo",
      askPlaceholder: "Pergunte qualquer coisa ao Nevo...",
      modelSearch: "Buscar modelos...",
      setupTitle: "Esclarecer tarefa",
      access: { ask: "Perguntar antes de alterar", auto: "Editar automaticamente", plan: "Modo plano", full: "Acesso total" },
      motivationLines: ["Construa o que voce imagina.", "Torne a ideia real.", "Sua proxima versao comeca aqui."],
    },
    it: {
      settings: "Impostazioni",
      theme: "Tema",
      themeDesc: "Scegli il tema visivo.",
      dark: "Scuro",
      light: "Chiaro",
      languagePacks: "Pacchetti lingua",
      languagePacksDesc: "Scarica una lingua e sceglila per l'interfaccia.",
      download: "Scarica",
      choose: "Scegli",
      selected: "Selezionato",
      newChat: "Nuova chat",
      projects: "Progetti",
      recent: "Recenti",
      models: "Modelli",
      chooseModel: "Scegli modello",
      askPlaceholder: "Chiedi qualsiasi cosa a Nevo...",
      modelSearch: "Cerca modelli...",
      setupTitle: "Chiarisci attivita",
      access: { ask: "Chiedi prima delle modifiche", auto: "Modifica automaticamente", plan: "Modalita piano", full: "Accesso completo" },
      motivationLines: ["Costruisci cio che immagini.", "Rendi reale l'idea.", "La tua prossima versione inizia qui."],
    },
    tr: {
      settings: "Ayarlar",
      theme: "Tema",
      themeDesc: "Gorsel temayi sec.",
      dark: "Koyu",
      light: "Acik",
      languagePacks: "Dil paketleri",
      languagePacksDesc: "Bir dil indir, sonra arayuz icin sec.",
      download: "Indir",
      choose: "Sec",
      selected: "Secildi",
      newChat: "Yeni sohbet",
      projects: "Projeler",
      recent: "Son",
      models: "Modeller",
      chooseModel: "Model sec",
      askPlaceholder: "Nevo'ya istedigini sor...",
      modelSearch: "Model ara...",
      setupTitle: "Gorevi netlestir",
      access: { ask: "Degisiklikten once sor", auto: "Otomatik duzenle", plan: "Plan modu", full: "Tam erisim" },
      motivationLines: ["Hayal ettigini insa et.", "Fikri gercege donustur.", "Sonraki surumun burada baslar."],
    },
    pl: {
      settings: "Ustawienia",
      theme: "Motyw",
      themeDesc: "Wybierz wyglad aplikacji.",
      dark: "Ciemny",
      light: "Jasny",
      languagePacks: "Pakiety jezykowe",
      languagePacksDesc: "Pobierz jezyk, a potem wybierz go dla interfejsu.",
      download: "Pobierz",
      choose: "Wybierz",
      selected: "Wybrano",
      newChat: "Nowy czat",
      projects: "Projekty",
      recent: "Ostatnie",
      models: "Modele",
      chooseModel: "Wybierz model",
      askPlaceholder: "Zapytaj Nebule o cokolwiek...",
      modelSearch: "Szukaj modeli...",
      setupTitle: "Doprecyzuj zadanie",
      access: { ask: "Pytaj przed zmianami", auto: "Edytuj automatycznie", plan: "Tryb planu", full: "Pelny dostep" },
      motivationLines: ["Zbuduj to, co sobie wyobrazasz.", "Zmien pomysl w rzeczywistosc.", "Twoja nastepna wersja zaczyna sie tutaj."],
    },
    uk: {
      settings: "\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
      theme: "\u0422\u0435\u043c\u0430",
      themeDesc: "\u041e\u0431\u0435\u0440\u0456\u0442\u044c \u0432\u0456\u0437\u0443\u0430\u043b\u044c\u043d\u0443 \u0442\u0435\u043c\u0443.",
      dark: "\u0422\u0435\u043c\u043d\u0430",
      light: "\u0421\u0432\u0456\u0442\u043b\u0430",
      languagePacks: "\u041c\u043e\u0432\u043d\u0456 \u043f\u0430\u043a\u0435\u0442\u0438",
      download: "\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438",
      choose: "\u0412\u0438\u0431\u0440\u0430\u0442\u0438",
      selected: "\u0412\u0438\u0431\u0440\u0430\u043d\u043e",
      newChat: "\u041d\u043e\u0432\u0438\u0439 \u0447\u0430\u0442",
      projects: "\u041f\u0440\u043e\u0454\u043a\u0442\u0438",
      recent: "\u041d\u0435\u0434\u0430\u0432\u043d\u0456",
      models: "\u041c\u043e\u0434\u0435\u043b\u0456",
      askPlaceholder: "\u0417\u0430\u043f\u0438\u0442\u0430\u0439 Nevo \u043f\u0440\u043e \u0449\u043e \u0437\u0430\u0432\u0433\u043e\u0434\u043d\u043e...",
      access: { ask: "\u041f\u0438\u0442\u0430\u0442\u0438 \u043f\u0435\u0440\u0435\u0434 \u0437\u043c\u0456\u043d\u0430\u043c\u0438", auto: "\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u0442\u0438 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u043d\u043e", plan: "\u0420\u0435\u0436\u0438\u043c \u043f\u043b\u0430\u043d\u0443", full: "\u041f\u043e\u0432\u043d\u0438\u0439 \u0434\u043e\u0441\u0442\u0443\u043f" },
      motivationLines: ["\u0417\u0431\u0435\u0440\u0438 \u0442\u0435, \u0449\u043e \u0434\u0430\u0432\u043d\u043e \u0443\u044f\u0432\u043b\u044f\u0454\u0448.", "\u0417\u0440\u043e\u0431\u0438 \u0456\u0434\u0435\u044e \u0436\u0438\u0432\u043e\u044e.", "\u0422\u0432\u043e\u044f \u043d\u0430\u0441\u0442\u0443\u043f\u043d\u0430 \u0432\u0435\u0440\u0441\u0456\u044f \u043f\u043e\u0447\u0438\u043d\u0430\u0454\u0442\u044c\u0441\u044f \u0442\u0443\u0442."],
    },
  };

  ["zh", "hi", "ar", "ja", "ko"].forEach(code => {
    EXTRA_UI_TEXT[code] = {
      settings: UI_TEXT.en.settings,
      languagePacks: UI_TEXT.en.languagePacks,
      download: UI_TEXT.en.download,
      choose: UI_TEXT.en.choose,
      selected: UI_TEXT.en.selected,
      newChat: UI_TEXT.en.newChat,
      projects: UI_TEXT.en.projects,
      recent: UI_TEXT.en.recent,
      models: UI_TEXT.en.models,
      motivationLines: UI_TEXT.en.motivationLines,
    };
  });

  Object.entries(EXTRA_UI_TEXT).forEach(([code, pack]) => {
    UI_TEXT[code] = {
      ...UI_TEXT.en,
      ...pack,
      access: { ...UI_TEXT.en.access, ...(pack.access || {}) },
      motivationLines: pack.motivationLines || UI_TEXT.en.motivationLines,
    };
  });

  Object.assign(UI_TEXT.ru, {
    emptyRecent: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0447\u0442\u043e-\u0442\u043e \u043d\u0435\u0439\u0440\u043e\u0441\u0435\u0442\u0438, \u0438 \u0432\u0430\u0448\u0438 \u0447\u0430\u0442\u044b \u0431\u0443\u0434\u0443\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b \u0437\u0434\u0435\u0441\u044c."
  });

  const EMPTY_RECENT_TEXT = {
    es: "Escribe algo a la IA y tus chats se guardaran aqui.",
    fr: "Ecris quelque chose a l'IA et tes chats seront sauvegardes ici.",
    de: "Schreibe der KI etwas, und deine Chats werden hier gespeichert.",
    pt: "Escreva algo para a IA e seus chats serao salvos aqui.",
    it: "Scrivi qualcosa all'IA e le tue chat saranno salvate qui.",
    tr: "Yapay zekaya bir sey yaz, sohbetlerin burada kaydedilecek.",
    pl: "Napisz cos do AI, a twoje czaty zostana zapisane tutaj.",
    uk: "\u041d\u0430\u043f\u0438\u0448\u0456\u0442\u044c \u0449\u043e\u0441\u044c \u043d\u0435\u0439\u0440\u043e\u043c\u0435\u0440\u0435\u0436\u0456, \u0456 \u0432\u0430\u0448\u0456 \u0447\u0430\u0442\u0438 \u0431\u0443\u0434\u0443\u0442\u044c \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u0456 \u0442\u0443\u0442."
  };
  Object.entries(EMPTY_RECENT_TEXT).forEach(([code, text]) => {
    if (UI_TEXT[code]) UI_TEXT[code].emptyRecent = text;
  });

  function t(key) {
    const lang = UI_TEXT[settings.appLanguage] ? settings.appLanguage : "en";
    return key.split(".").reduce((obj, part) => obj && obj[part], UI_TEXT[lang]) || key;
  }

  function setTooltip(el, text) {
    if (!el || !text) return;
    el.setAttribute("title", text);
    el.setAttribute("aria-label", text);
    el.setAttribute("data-tooltip", text);
  }

  function applyButtonTooltips() {
    const tooltips = {
      settingsBtn: "Settings",
      toggleTabBtn: "Close sidebar",
      toolbarExplorerBtn: "Explorer",
      toolbarTerminalBtn: "Toggle terminal",
      toolbarPanelBtn: "Toggle panel",
      progressHideBtn: "Collapse progress",
      closePanelBtn: "Close panel",
      closeTerminalBtn: "Close terminal",
      attachBtn: "Attach file",
      sendBtn: "Send",
      stopBtn: "Stop",
      modelBtn: "Choose model",
      accessBtn: "Access mode",
      thinkBtn: "Thinking level",
      closeSettingsBtn: "Close",
      closeModelsBtn: "Close",
      closeGroupBtn: "Close",
      approvalCloseBtn: "Close"
    };
    Object.entries(tooltips).forEach(([id, text]) => setTooltip($(id), text));
  }

  // ============================================================
  //  РљРђРўРђР›РћР“ РњРћР”Р•Р›Р•Р™
  // ============================================================
  const MODEL_CATALOG = [
    { name: "gemma4:12b",        desc: "Google Gemma 4 12B - reasoning, code, vision",                   size: "~8 GB",   category: "Google",   vision: true,  think: true },
    { name: "gemma4:e4b",        desc: "Google Gemma 4 E4B - fast multimodal model",                     size: "~3 GB",   category: "Google",   vision: true,  think: true },
    { name: "gemma3:4b",         desc: "Google Gemma 3 4B - light vision model",                         size: "~3.3 GB", category: "Google",   vision: true },
    { name: "gemma3:12b",        desc: "Google Gemma 3 12B - stronger single-GPU model",                  size: "~8.1 GB", category: "Google",   vision: true },
    { name: "gpt-oss:20b",       desc: "OpenAI GPT-OSS 20B - open-weight reasoning and tool use",         size: "~12 GB",  category: "OpenAI",   think: true },
    { name: "gpt-oss:120b",      desc: "OpenAI GPT-OSS 120B - large reasoning model",                     size: "~70 GB",  category: "OpenAI",   think: true },
    { name: "qwen3.5:4b",        desc: "Qwen 3.5 4B - modern lightweight multimodal model",               size: "~3 GB",   category: "Qwen",     vision: true,  think: true },
    { name: "qwen3.5:9b",        desc: "Qwen 3.5 9B - universal next-generation model",                   size: "~6 GB",   category: "Qwen",     vision: true,  think: true },
    { name: "qwen3:8b",          desc: "Qwen 3 8B - thinking, coding, tool use",                          size: "~5 GB",   category: "Qwen",     think: true },
    { name: "qwen3:4b",          desc: "Qwen 3 4B - fast reasoning for everyday PCs",                     size: "~2.5 GB", category: "Qwen",     think: true },
    { name: "qwen3:1.7b",        desc: "Qwen 3 1.7B - light model for weaker PCs",                        size: "~1.5 GB", category: "Qwen",     think: true },
    { name: "qwen3-coder:30b",   desc: "Qwen3 Coder 30B - agentic coding and long context",               size: "~18 GB",  category: "Code" },
    { name: "qwen2.5-coder:7b",  desc: "Qwen 2.5 Coder 7B - practical coding model",                     size: "~4.7 GB", category: "Code" },
    { name: "deepseek-r1:8b",    desc: "DeepSeek R1 8B - reasoning model",                               size: "~4.9 GB", category: "DeepSeek", think: true },
    { name: "deepseek-r1:14b",   desc: "DeepSeek R1 14B - stronger reasoning model",                     size: "~9 GB",   category: "DeepSeek", think: true },
    { name: "deepseek-coder:6.7b", desc: "DeepSeek Coder 6.7B - programming and code explanation",        size: "~3.8 GB", category: "Code" },
    { name: "llama3.1:8b",       desc: "Meta Llama 3.1 8B - general conversation model",                  size: "~4.7 GB", category: "Meta" },
    { name: "llama3.2:3b",       desc: "Meta Llama 3.2 3B - light and fast",                              size: "~2 GB",   category: "Meta" },
    { name: "llama3.2:1b",       desc: "Meta Llama 3.2 1B - tiny local model",                            size: "~1.3 GB", category: "Meta" },
    { name: "llama3.2-vision:11b", desc: "Meta Llama 3.2 Vision 11B - image analysis",                    size: "~7.9 GB", category: "Vision",   vision: true },
    { name: "qwen3-vl:8b",       desc: "Qwen3-VL 8B - vision, tools, thinking",                           size: "~6 GB",   category: "Vision",   vision: true,  think: true },
    { name: "qwen2.5vl:7b",      desc: "Qwen2.5-VL 7B - multimodal image model",                          size: "~5 GB",   category: "Vision",   vision: true },
    { name: "llava:7b",          desc: "LLaVA 7B - classic vision model",                                 size: "~4.7 GB", category: "Vision",   vision: true },
    { name: "llava-llama3:8b",   desc: "LLaVA Llama3 8B - vision plus dialogue",                          size: "~4.9 GB", category: "Vision",   vision: true },
    { name: "moondream:1.8b",    desc: "Moondream 1.8B - small vision model",                             size: "~1.7 GB", category: "Vision",   vision: true },
    { name: "mistral:7b",        desc: "Mistral 7B - fast general model",                                  size: "~4.1 GB", category: "Mistral" },
    { name: "mistral-nemo:12b",  desc: "Mistral Nemo 12B - balanced quality and speed",                   size: "~7.1 GB", category: "Mistral" },
    { name: "mistral-small:24b", desc: "Mistral Small 24B - strong model below 70B",                      size: "~14 GB",  category: "Mistral" },
    { name: "phi4:14b",          desc: "Microsoft Phi-4 14B - compact strong model",                      size: "~9 GB",   category: "Microsoft" },
    { name: "phi4-mini:3.8b",    desc: "Microsoft Phi-4 Mini - light multilingual/function calling",      size: "~2.5 GB", category: "Microsoft" },
    { name: "starcoder2:3b",     desc: "StarCoder2 3B - light coding model",                              size: "~1.7 GB", category: "Code" },
    { name: "codellama:7b",      desc: "Code Llama 7B - code generation and discussion",                  size: "~3.8 GB", category: "Code" },
    { name: "tinyllama:1.1b",    desc: "TinyLlama 1.1B - very light model",                               size: "~0.7 GB", category: "Small" },
    { name: "smollm2:1.7b",      desc: "SmolLM2 1.7B - compact model for weaker PCs",                     size: "~1.1 GB", category: "Small" },
  ];

  // ============================================================
  //  PERSISTENCE
  // ============================================================
  async function loadData() {
    if (!window.api) return;
    const d = await window.api.dataGet();
    if (d && d.groups && d.chats) data = d;
    migrateBrandNamesInData();
    const s = await window.api.settingsGet();
    if (s) settings = Object.assign(settings, s);
    if (!settings.appLanguage) settings.appLanguage = "en";
    if (!settings.theme) settings.theme = "light";
    if (!settings.computeMode) settings.computeMode = "auto";
    if (!Array.isArray(settings.downloadedLanguages)) settings.downloadedLanguages = ["en"];
    if (!settings.downloadedLanguages.includes("en")) settings.downloadedLanguages.unshift("en");
  }

  function migrateBrandNamesInData() {
    let changed = false;
    const rename = value => String(value || "").replace(/^NevoProject/i, "NevoProject");
    data.groups.forEach(group => {
      const nextName = rename(group.name);
      const nextFolderName = rename(group.folderName || group.name);
      if (group.name !== nextName) {
        group.name = nextName;
        changed = true;
      }
      if ((group.folderName || group.name) !== nextFolderName) {
        group.folderName = nextFolderName;
        changed = true;
      }
    });
    if (changed) setTimeout(() => persist(), 0);
  }

  async function persist() {
    if (!window.api) return;
    await window.api.dataSave(data);
    await window.api.settingsSave(settings);
  }

  function renderProgress() {
    const done = agentProgress.filter(item => item.status === "done").length;
    const total = agentProgress.length;
    if (progressCount) progressCount.textContent = `${done}/${total}`;
    if (progressCard) {
      progressCard.classList.toggle("show", total > 0);
      progressCard.classList.toggle("collapsed", total > 0 && progressDismissed);
    }
    if (progressHideBtn) {
      progressHideBtn.title = progressDismissed ? "Show progress" : "Collapse progress";
      progressHideBtn.setAttribute("aria-label", progressDismissed ? "Show progress" : "Collapse progress");
    }

    const renderInto = (root) => {
      if (!root) return;
      root.innerHTML = "";
      agentProgress.forEach(item => {
        const row = document.createElement("div");
        row.className = `progress-item ${item.status || "done"}`;
        const icon = item.status === "denied"
          ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`
          : item.status === "pending"
            ? ""
            : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        row.innerHTML = `<span class="progress-dot">${icon}</span><span class="progress-text">${escapeHtml(item.text)}</span>`;
        root.appendChild(row);
      });
    };

    renderInto(progressList);
  }

  function getPanelFileKey(item) {
    return `${item?.path || ""}${item?.file || "main.txt"}`;
  }

  function renderPanelFileTabs() {
    if (!panelFileTabsEl || !panelFileViewerEl) return;
    panelFileTabsEl.innerHTML = "";
    panelFileTabsEl.style.display = "none";

    if (!panelFileTabsState.length) {
      panelFileViewerEl.style.display = "none";
      panelFileViewerEl.innerHTML = "";
      activePanelFileKey = null;
      return;
    }

    panelFileViewerEl.style.display = "block";

    if (!panelFileTabsState.some(tab => tab.key === activePanelFileKey)) {
      activePanelFileKey = panelFileTabsState[0].key;
    }

    const active = panelFileTabsState.find(tab => tab.key === activePanelFileKey) || panelFileTabsState[0];
    const fullPath = `${active.path || ""}${active.file || "main.txt"}`;
    panelFileViewerEl.innerHTML = `
      <div class="panel-file-viewer-head">
        <strong>${escapeHtml(active.file || "main.txt")}</strong>
        <span>${escapeHtml(active.path || "")}</span>
      </div>
      <pre><code>${escapeHtml(active.code || `// ${fullPath}`)}</code></pre>
    `;
  }

  function openPanelFile(activity) {
    if (!activity) return;
    let source = activity;
    if (!source.code) {
      const key = source.key || getPanelFileKey(source);
      source = codingPreviewItems.find(item => item.key === key) || source;
    }
    if (!source.code) return;

    const key = source.key || getPanelFileKey(source);
    const tab = {
      key,
      file: source.file || "main.txt",
      path: source.path || "",
      code: source.code || ""
    };
    const index = panelFileTabsState.findIndex(item => item.key === key);
    if (index >= 0) panelFileTabsState[index] = Object.assign({}, panelFileTabsState[index], tab);
    else panelFileTabsState.unshift(tab);
    panelFileTabsState = panelFileTabsState.slice(0, 6);
    activePanelFileKey = key;
    sidePanel?.classList.add("show");
    toolbarPanelBtn?.classList.add("active");
    mainArea?.classList.add("panel-open");
    renderPanelFileTabs();
  }

  function closePanelFile(key) {
    panelFileTabsState = panelFileTabsState.filter(tab => tab.key !== key);
    if (activePanelFileKey === key) activePanelFileKey = panelFileTabsState[0]?.key || null;
    renderPanelFileTabs();
  }

  function renderCodingPreview() {
    if (!panelProgressList) return;
    panelProgressList.innerHTML = "";
    codingPreviewItems.forEach(item => {
      if (item.kind === "overview") {
        const row = document.createElement("div");
        row.className = "panel-app-card";
        row.innerHTML = `
          <div class="panel-app-title">App preview</div>
          <div class="panel-app-name">${escapeHtml(item.name || "Nevo app")}</div>
          <div class="panel-app-grid">
            <span>Interface</span><strong>${escapeHtml(item.interface || "Generated UI")}</strong>
            <span>Entry</span><strong>${escapeHtml(item.entry || "main.txt")}</strong>
            <span>Run</span><code>${escapeHtml(item.run || "Open project folder")}</code>
          </div>
        `;
        panelProgressList.appendChild(row);
        return;
      }
      const row = document.createElement("div");
      row.className = `panel-code-card ${item.state === "edited" ? "edited" : "editing"}`;
      const preview = String(item.code || "").trim().split(/\r?\n/).slice(0, 7).join("\n");
      row.innerHTML = `
        ${renderCodeActivity(item)}
        ${item.summary ? `<div class="panel-code-summary">${escapeHtml(item.summary)}</div>` : ""}
        ${preview ? `<pre class="panel-code-preview"><code>${escapeHtml(preview)}</code></pre>` : ""}
      `;
      row.addEventListener("click", () => openPanelFile(item));
      panelProgressList.appendChild(row);
    });
  }

  function upsertCodingPreview(activity, summary = "") {
    if (!activity) return;
    const key = `${activity.path || ""}${activity.file || "main.txt"}`;
    const item = Object.assign({}, activity, { key, summary });
    const index = codingPreviewItems.findIndex(existing => existing.key === key);
    if (index >= 0) codingPreviewItems[index] = Object.assign({}, codingPreviewItems[index], item);
    else codingPreviewItems.unshift(item);
    codingPreviewItems = codingPreviewItems.slice(0, 8);
    renderCodingPreview();
  }

  function inferAppPreview(activity) {
    if (!activity) return null;
    const file = activity.file || "main.txt";
    const entry = `${activity.path || ""}${file}`;
    const label = String(activity.label || "").toLowerCase();
    const code = String(activity.code || "").toLowerCase();
    let run = `open ${entry}`;
    let iface = "Code file";
    if (label === "py" || /\.py$/i.test(file)) {
      run = `py ${entry}`;
      iface = code.includes("pygame") ? "Pygame window" : code.includes("tkinter") ? "Desktop window" : "Python app";
    } else if (/\.(html|css)$/i.test(file)) {
      run = `open ${entry}`;
      iface = "Web interface";
    } else if (/\.(js|jsx|ts|tsx)$/i.test(file)) {
      run = /\.jsx|\.tsx$/i.test(file) ? "npm run dev" : `node ${entry}`;
      iface = "JavaScript interface";
    }
    return {
      kind: "overview",
      key: "__overview",
      name: file.replace(/\.[^.]+$/, "") || "Nevo app",
      interface: iface,
      entry,
      run
    };
  }

  function upsertAppPreview(activity) {
    const preview = inferAppPreview(activity);
    if (!preview) return;
    const index = codingPreviewItems.findIndex(item => item.key === preview.key);
    if (index >= 0) codingPreviewItems[index] = preview;
    else codingPreviewItems.unshift(preview);
    renderCodingPreview();
  }

  function addProgressItem(text, status = "done") {
    if (!text) return null;
    const item = { id: "p" + Date.now() + Math.random().toString(16).slice(2), text, status };
    agentProgress.push(item);
    if (agentProgress.length > 8) agentProgress = agentProgress.slice(-8);
    renderProgress();
    return item.id;
  }

  function updateProgressItem(id, status, text = null) {
    const item = agentProgress.find(p => p.id === id);
    if (!item) return;
    item.status = status;
    if (text) item.text = text;
    renderProgress();
  }

  function resetProgress() {
    agentProgress = [];
    progressDismissed = false;
    codingPreviewItems = [];
    panelFileTabsState = [];
    activePanelFileKey = null;
    renderProgress();
    renderCodingPreview();
    renderPanelFileTabs();
  }

  function updateHomeMode() {
    const chat = getCurrentChat();
    const isEmpty = !chat || !chat.messages || chat.messages.length === 0;
    mainArea?.classList.toggle("home-mode", isEmpty && !isGenerating);
    document.body.classList.toggle("is-generating", isGenerating);
  }

  function applyTheme() {
    document.body.classList.toggle("theme-light", settings.theme === "light");
    if (themeSegment) {
      themeSegment.querySelectorAll("button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.theme === settings.theme);
      });
    }
    if (computeSegment) {
      computeSegment.querySelectorAll("button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.compute === (settings.computeMode || "auto"));
      });
    }
  }

  function renderSettings() {
    const downloaded = new Set(settings.downloadedLanguages || ["en"]);
    applyAppLanguageBasics();

    if (languagePackList) {
      languagePackList.innerHTML = "";
      APP_LANGUAGES.forEach(lang => {
        const installed = downloaded.has(lang.code);
        const selected = (settings.appLanguage || "en") === lang.code;
        const label = selected ? t("selected") : installed ? t("choose") : t("download");
        const row = document.createElement("div");
        row.className = `language-pack ${selected ? "selected" : ""}`;
        row.innerHTML = `
          <div>
            <div class="language-pack-name">${escapeHtml(lang.name)}</div>
            <div class="language-pack-code">${escapeHtml(lang.code.toUpperCase())}</div>
          </div>
          <button class="catalog-btn ${installed ? "" : "primary"}" data-lang="${lang.code}" ${selected ? "disabled" : ""}>${label}</button>
        `;
        row.querySelector("button").addEventListener("click", () => {
          const next = new Set(settings.downloadedLanguages || ["en"]);
          if (!installed) {
            next.add(lang.code);
          } else {
            settings.appLanguage = lang.code;
          }
          settings.downloadedLanguages = Array.from(next);
          applyAppLanguageBasics();
          renderSidebar();
          renderSettings();
          persist();
        });
        languagePackList.appendChild(row);
      });
    }
    applyTheme();
  }

  function applyAppLanguageBasics() {
    document.documentElement.lang = settings.appLanguage || "en";
    document.title = "Nevo";
    const textById = {
      setupTitle: t("setupTitle"),
      groupModalTitle: t("newFolder"),
      saveGroupBtn: t("create"),
      accessLabel: t(`access.${settings.accessMode || "ask"}`),
      approvalTitle: t("approvalTitle"),
      approvalAcceptBtn: t("accept"),
      approvalAcceptChatBtn: t("acceptInChat"),
      approvalDenyBtn: t("denied"),
    };
    Object.entries(textById).forEach(([id, text]) => {
      const el = $(id);
      if (el) el.textContent = text;
    });
    const placeholders = [
      [inputEl, t("askPlaceholder")],
      [modelsSearch, t("modelSearch")],
      [$("groupInput"), t("folderPlaceholder")],
    ];
    placeholders.forEach(([el, text]) => { if (el) el.placeholder = text; });
    const navLabels = [
      ["newChatBtn", t("newChat")],
      ["openProjectsBtn", t("projects")],
    ];
    navLabels.forEach(([id, text]) => {
      const label = $(id)?.querySelector("span");
      if (label) label.textContent = text;
    });
    const sectionTitle = document.querySelector(".tab-section-title");
    if (sectionTitle) sectionTitle.textContent = t("recent");
    const modelsTitle = document.querySelector("#modelsModal .modal-header h2");
    if (modelsTitle) modelsTitle.textContent = t("models");
    const progressTitle = document.querySelector(".progress-head > span");
    if (progressTitle) progressTitle.textContent = t("progress");
    const panelTitle = document.querySelector(".panel-header > span");
    if (panelTitle) panelTitle.textContent = t("nevoActions");
    const panelPreviewTitle = document.querySelector(".panel-progress-title");
    if (panelPreviewTitle) panelPreviewTitle.textContent = t("codingPreview");
    if (modelLabel && !settings.selectedModel) modelLabel.textContent = t("chooseModel");
    const settingsTitle = document.querySelector("#settingsModal .modal-header h2");
    if (settingsTitle) settingsTitle.textContent = t("settings");
    const settingsTitles = settingsModal?.querySelectorAll(".settings-title");
    const settingsDescs = settingsModal?.querySelectorAll(".settings-desc");
    if (settingsTitles?.[0]) settingsTitles[0].textContent = t("theme");
    if (settingsDescs?.[0]) settingsDescs[0].textContent = t("themeDesc");
    if (settingsTitles?.[1]) settingsTitles[1].textContent = t("computeMode");
    if (settingsDescs?.[1]) settingsDescs[1].textContent = t("computeModeDesc");
    if (settingsTitles?.[2]) settingsTitles[2].textContent = t("languagePacks");
    if (settingsDescs?.[2]) settingsDescs[2].textContent = t("languagePacksDesc");
    themeSegment?.querySelector('[data-theme="dark"]') && (themeSegment.querySelector('[data-theme="dark"]').textContent = t("dark"));
    themeSegment?.querySelector('[data-theme="light"]') && (themeSegment.querySelector('[data-theme="light"]').textContent = t("light"));
    const accessDescriptions = {
      en: {
        ask: "Ask before file changes.",
        auto: "Edit files automatically.",
        plan: "Plan before editing.",
        full: "Run with fewer confirmations.",
      },
      ru: {
        ask: "\u0421\u043f\u0440\u043e\u0441\u0438\u0442 \u043f\u0435\u0440\u0435\u0434 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435\u043c \u0444\u0430\u0439\u043b\u043e\u0432.",
        auto: "\u041c\u043e\u0436\u0435\u0442 \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0444\u0430\u0439\u043b\u044b \u0441\u0430\u043c.",
        plan: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u043b\u0430\u043d, \u043f\u043e\u0442\u043e\u043c \u043a\u043e\u0434.",
        full: "\u041c\u0435\u043d\u044c\u0448\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0439.",
      }
    };
    const descPack = accessDescriptions[settings.appLanguage] || accessDescriptions.en;
    accessDropdown?.querySelectorAll(".access-item").forEach(item => {
      const mode = item.dataset.access;
      const title = item.querySelector(".access-title");
      const desc = item.querySelector(".access-desc");
      if (title) title.textContent = t(`access.${mode}`);
      if (desc) desc.textContent = descPack[mode] || accessDescriptions.en[mode];
    });
    const quickLabels = [t("intro"), t("explain"), t("ideas"), t("translate")];
    document.querySelectorAll(".quick-btn").forEach((btn, index) => {
      if (quickLabels[index]) btn.textContent = quickLabels[index];
    });
    if (welcomeEl && welcomeEl.style.display !== "none" && welcomeTitle) {
      typeWelcomeTitle();
    }
  }

  function typeWelcomeTitle() {
    if (!welcomeTitle) return;
    if (typingTimer) clearInterval(typingTimer);
    const lines = Array.isArray(t("motivationLines")) ? t("motivationLines") : UI_TEXT.en.motivationLines;
    const line = lines[Math.floor(Math.random() * lines.length)];
    let index = 0;
    welcomeTitle.textContent = "";
    welcomeTitle.classList.add("typing");
    typingTimer = setInterval(() => {
      index += 1;
      welcomeTitle.textContent = line.slice(0, index);
      if (index >= line.length) {
        clearInterval(typingTimer);
        typingTimer = setTimeout(() => welcomeTitle.classList.remove("typing"), 650);
      }
    }, 28);
  }

  async function syncProjectFolders() {
    if (!window.api || !window.api.ensureProjectFolder) return;
    let changed = false;
    for (const group of data.groups) {
      if (!group.folderName) {
        const folder = await window.api.ensureProjectFolder(group.name);
        if (folder.ok) {
          group.folderName = folder.folderName;
          changed = true;
        }
      }
    }
    if (changed) await persist();
  }

  function getCurrentChat() {
    return data.chats.find(c => c.id === currentChatId);
  }

  // ============================================================
  //  OLLAMA STATUS
  // ============================================================
  async function checkOllama() {
    if (!window.api) return;
    const res = await window.api.ollamaStatus();
    ollamaRunning = res.running;
    if (ollamaRunning) {
      availableModels = res.models || [];
      statusDot.className = "status-dot online";
      if (!settings.selectedModel && availableModels.length > 0) {
        selectModel(availableModels[0].name);
      }
      if (availableModels.length === 0) {
        welcomeHint.textContent = settings.appLanguage === "ru"
          ? "\u041d\u0435\u0442 \u043c\u043e\u0434\u0435\u043b\u0435\u0439. \u0421\u043a\u0430\u0447\u0430\u0439\u0442\u0435 \u043c\u043e\u0434\u0435\u043b\u044c \u0447\u0435\u0440\u0435\u0437 \u043a\u0430\u0442\u0430\u043b\u043e\u0433."
          : "No models yet. Download a model from the catalog.";
      } else {
        welcomeHint.textContent = settings.appLanguage === "ru"
          ? `${availableModels.length} \u043c\u043e\u0434\u0435\u043b\u0435\u0439 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u0413\u043e\u0442\u043e\u0432\u043e \u043a \u0440\u0430\u0431\u043e\u0442\u0435.`
          : `${availableModels.length} models available. Ready to work.`;
      }
    } else {
      availableModels = [];
      statusDot.className = res.installing ? "status-dot loading" : "status-dot offline";
      if (res.installing) {
        welcomeHint.textContent = settings.appLanguage === "ru" ? "Ollama \u0443\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u0442\u0441\u044f. Nevo \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442 \u0435\u0451 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438." : "Ollama is being installed. Nevo will start it automatically.";
      } else if (!res.installed) {
        welcomeHint.textContent = settings.appLanguage === "ru" ? "Ollama \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430. Nevo \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0435\u0442 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0438 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0435\u0451." : "Ollama was not found. Nevo will try to install and start it.";
      } else {
        welcomeHint.textContent = settings.appLanguage === "ru" ? "Ollama \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438." : "Ollama is starting automatically.";
      }
      if (!ollamaEnsureInFlight && window.api && window.api.ollamaEnsure) {
        ollamaEnsureInFlight = true;
        statusDot.className = "status-dot loading";
        window.api.ollamaEnsure()
          .then(() => setTimeout(checkOllama, 500))
          .finally(() => { ollamaEnsureInFlight = false; });
      }
    }
    renderModelDropdown();
  }

  // ============================================================
  //  MODEL SELECTOR
  // ============================================================
  function modelSupportsVision(name) {
    const n = name.toLowerCase();
    const cat = MODEL_CATALOG.find(m => m.name === name);
    if (cat && cat.vision) return true;
    return n.includes("vision") || n.includes("llava") || n.includes("vl") || n.includes("minicpm") || n.includes("moondream") || n.includes("gemma3") || n.includes("gemma4");
  }

  function pickVisionModelName() {
    if (settings.selectedModel && modelSupportsVision(settings.selectedModel)) return settings.selectedModel;
    const installedVision = availableModels.find(m => modelSupportsVision(m.name));
    return installedVision ? installedVision.name : null;
  }
  function modelSupportsThink(name) {
    const cat = MODEL_CATALOG.find(m => m.name === name);
    if (cat && cat.think) return true;
    const n = name.toLowerCase();
    return n.includes("r1") || n.includes("gpt-oss") || n.includes("qwen3") || n.includes("deepseek-r1");
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    const gb = bytes / 1e9;
    if (gb >= 1) return gb.toFixed(1) + " GB";
    return (bytes / 1e6).toFixed(0) + " MB";
  }

  function getModelsByLevel() {
    const levels = { "Light (<4GB)": [], "Standard (4-8GB)": [], "Powerful (>8GB)": [] };
    availableModels.forEach(m => {
      const gb = (m.size || 0) / 1e9;
      const key = gb >= 8 ? "Powerful (>8GB)" : gb >= 4 ? "Standard (4-8GB)" : "Light (<4GB)";
      levels[key].push(m);
    });
    Object.keys(levels).forEach(k => { if (levels[k].length === 0) delete levels[k]; });
    return levels;
  }

  function renderModelDropdown() {
    modelDropdown.innerHTML = "";
    if (!ollamaRunning) {
      modelDropdown.innerHTML = `
        <div class="model-empty">
          ${statusDot.classList.contains("loading") ? "Ollama is installing or starting." : "Ollama is starting automatically."}<br>
          <small>Please wait a few seconds.</small>
        </div>`;
      return;
    }
    if (availableModels.length === 0) {
      modelDropdown.innerHTML = `
        <div class="model-empty">
          No installed models.<br>
          <button class="model-empty-btn" id="ddOpenModels">${escapeHtml(t("download"))}</button>
        </div>`;
      const b = $("ddOpenModels");
      if (b) b.addEventListener("click", () => { modelDropdown.classList.remove("show"); openModelsModal(); });
      return;
    }

    const levels = getModelsByLevel();
    Object.entries(levels).forEach(([level, models]) => {
      const label = document.createElement("div");
      label.className = "model-group-label";
      label.textContent = level;
      modelDropdown.appendChild(label);
      models.forEach(m => {
        const item = document.createElement("div");
        item.className = "model-item" + (m.name === settings.selectedModel ? " selected" : "");
        const flags = [];
        if (modelSupportsVision(m.name)) flags.push("Vision");
        if (modelSupportsThink(m.name)) flags.push("Think");
        item.innerHTML = `
          <span class="model-item-name">${m.name} ${flags.length ? `<span style="opacity:0.6">${flags.join(" ")}</span>` : ""}</span>
          ${m.size ? `<span class="model-item-size">${formatSize(m.size)}</span>` : ""}
        `;
        item.addEventListener("click", () => {
          selectModel(m.name);
          modelDropdown.classList.remove("show");
        });
        modelDropdown.appendChild(item);
      });
    });

    // РєРЅРѕРїРєР° "РµС‰С‘ РјРѕРґРµР»Рё" в†’ РјРѕРґР°Р»РєР°
    const moreRow = document.createElement("div");
    moreRow.className = "model-download-row";
    moreRow.innerHTML = `<span>${escapeHtml(t("needMoreModels"))}</span>`;
    moreRow.querySelector("span").textContent = t("needMoreModels");
    const moreBtn = document.createElement("button");
    moreBtn.className = "catalog-btn primary";
    setTooltip(moreBtn, "Open model catalog");
    moreBtn.textContent = t("catalog");
    moreBtn.addEventListener("click", () => { modelDropdown.classList.remove("show"); openModelsModal(); });
    moreRow.appendChild(moreBtn);
    modelDropdown.appendChild(moreRow);
  }

  function selectModel(name) {
    settings.selectedModel = name;
    modelLabel.textContent = name;
    welcomeHint.textContent = settings.appLanguage === "ru" ? `\u041c\u043e\u0434\u0435\u043b\u044c: ${name} - \u0433\u043e\u0442\u043e\u0432\u0430.` : `Model: ${name} - ready.`;
    persist();
    renderModelDropdown();
  }

  modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    thinkDropdown.classList.remove("show");
    accessDropdown?.classList.remove("show");
    modelDropdown.classList.toggle("show");
    renderModelDropdown();
  });

  // ============================================================
  //  THINKING SELECTOR
  // ============================================================
  const THINK_LABELS = {
    max:    "Thinking: Max",
    high:   "Thinking: High",
    medium: "Thinking: Medium",
    low:    "Thinking: Low",
    none:   "No thinking",
  };
  function setThinkLevel(level) {
    settings.thinkLevel = level;
    thinkLabel.textContent = THINK_LABELS[level];
    thinkDropdown.querySelectorAll(".think-item").forEach(it => {
      it.classList.toggle("active", it.dataset.think === level);
    });
    persist();
  }
  thinkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    modelDropdown.classList.remove("show");
    accessDropdown?.classList.remove("show");
    thinkDropdown.classList.toggle("show");
  });
  thinkDropdown.querySelectorAll(".think-item").forEach(it => {
    it.addEventListener("click", () => {
      setThinkLevel(it.dataset.think);
      thinkDropdown.classList.remove("show");
    });
  });

  const ACCESS_LABELS = {
    ask: "Ask before changes",
    auto: "Edit automatically",
    plan: "Plan mode",
    full: "Full access",
  };
  function setAccessMode(mode) {
    settings.accessMode = mode || "ask";
    if (accessLabel) accessLabel.textContent = t(`access.${settings.accessMode}`) || ACCESS_LABELS[settings.accessMode] || ACCESS_LABELS.ask;
    if (accessDropdown) {
      accessDropdown.querySelectorAll(".access-item").forEach(it => {
        it.classList.toggle("active", it.dataset.access === settings.accessMode);
      });
    }
    persist();
  }
  accessBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    modelDropdown.classList.remove("show");
    thinkDropdown.classList.remove("show");
    accessDropdown?.classList.toggle("show");
  });
  accessDropdown?.querySelectorAll(".access-item").forEach(it => {
    it.addEventListener("click", () => {
      setAccessMode(it.dataset.access);
      accessDropdown.classList.remove("show");
    });
  });

  const thinkTexts = {
    max: "Max thinking lvl",
    high: "High",
    medium: "Medium",
    low: "Low",
    none: "No thinking",
  };
  thinkDropdown.querySelectorAll(".think-item").forEach(it => {
    it.textContent = thinkTexts[it.dataset.think] || it.textContent;
  });

  // Р·Р°РєСЂС‹С‚РёРµ РґСЂРѕРїРґР°СѓРЅРѕРІ РїРѕ РєР»РёРєСѓ РІРЅРµ
  document.addEventListener("click", () => {
    modelDropdown.classList.remove("show");
    thinkDropdown.classList.remove("show");
    accessDropdown?.classList.remove("show");
  });
  window.addEventListener("resize", () => {
    if (setupSheet?.classList.contains("show")) positionSetupSheet();
    if (approvalModal?.classList.contains("show")) positionAnchoredSheet(approvalModal);
    updateSidebarMiniScroll();
  });
  sidebarScroll?.addEventListener("scroll", updateSidebarMiniScroll, { passive: true });

  // ============================================================
  //  STATUS PILL вЂ” Р·Р°РїСѓСЃРє Ollama
  // ============================================================
  $("statusPill").addEventListener("click", async () => {
    statusDot.className = "status-dot loading";
    await window.api.ollamaEnsure();
    await checkOllama();
  });
  toggleTabBtn?.addEventListener("click", () => {
    appEl?.classList.add("tab-collapsed");
  });
  sideLogo?.addEventListener("click", () => {
    appEl?.classList.remove("tab-collapsed");
  });
  progressHideBtn?.addEventListener("click", () => {
    progressDismissed = !progressDismissed;
    renderProgress();
  });
  settingsBtn?.addEventListener("click", () => {
    renderSettings();
    settingsModal?.classList.add("show");
  });
  closeSettingsBtn?.addEventListener("click", () => settingsModal?.classList.remove("show"));
  settingsModal?.addEventListener("click", e => {
    if (e.target === settingsModal) settingsModal.classList.remove("show");
  });
  appLanguageSelect?.addEventListener("change", () => {
    settings.appLanguage = appLanguageSelect.value || "en";
    applyAppLanguageBasics();
    renderSettings();
    persist();
  });
  themeSegment?.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      settings.theme = btn.dataset.theme || "dark";
      applyTheme();
      persist();
    });
  });
  computeSegment?.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      settings.computeMode = btn.dataset.compute || "auto";
      applyTheme();
      persist();
      addProgressItem(`Compute mode: ${settings.computeMode}`);
    });
  });

  openProjectsBtn.addEventListener("click", async () => {
    if (!window.api || !window.api.openProjectsFolder) return;
    const res = await window.api.openProjectsFolder();
    if (res.ok) {
      appendTerminalLine(`explorer ${res.path}`);
    }
    if (!res.ok) alert("РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ РїР°РїРєСѓ РїСЂРѕРµРєС‚РѕРІ: " + (res.error || res.path || "РЅРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°"));
  });
  searchChatsBtn?.addEventListener("click", () => {
    const query = prompt("РСЃРєР°С‚СЊ С‡Р°С‚С‹:");
    if (!query) return;
    const found = data.chats.find(chat => {
      const title = chat.title || "";
      const text = (chat.messages || []).map(m => m.content || "").join("\n");
      return `${title}\n${text}`.toLowerCase().includes(query.toLowerCase());
    });
    if (found) loadChat(found.id);
  });

  function appendTerminalLine(text) {
    if (!terminalOutput) return;
    terminalOutput.textContent += (terminalOutput.textContent ? "\n" : "") + text;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  async function updateTerminalCwd() {
    if (!window.api || !window.api.getProjectsRoot || !terminalCwd) return;
    const res = await window.api.getProjectsRoot();
    if (res.ok) terminalCwd.textContent = `PS ${res.path}`;
  }

  toolbarExplorerBtn?.addEventListener("click", async () => {
    const res = await window.api.openProjectsFolder();
    if (res.ok) {
      appendTerminalLine(`explorer ${res.path}`);
    }
  });
  toolbarTerminalBtn?.addEventListener("click", async () => {
    terminalPanel.classList.toggle("show");
    toolbarTerminalBtn.classList.toggle("active", terminalPanel.classList.contains("show"));
    await updateTerminalCwd();
    if (terminalPanel.classList.contains("show") && !terminalOutput.textContent) {
      appendTerminalLine("Windows PowerShell");
      appendTerminalLine("Terminal ready.");
    }
    terminalInput?.focus();
  });
  toolbarPanelBtn?.addEventListener("click", () => {
    sidePanel.classList.toggle("show");
    toolbarPanelBtn.classList.toggle("active", sidePanel.classList.contains("show"));
    mainArea?.classList.toggle("panel-open", sidePanel.classList.contains("show"));
  });
  closeTerminalBtn?.addEventListener("click", () => {
    terminalPanel.classList.remove("show");
    toolbarTerminalBtn?.classList.remove("active");
  });
  closePanelBtn?.addEventListener("click", () => {
    sidePanel.classList.remove("show");
    toolbarPanelBtn?.classList.remove("active");
    mainArea?.classList.remove("panel-open");
  });
  terminalInput?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const cmd = terminalInput.value.trim();
    if (!cmd) return;
    terminalInput.value = "";
    appendTerminalLine(`${terminalCwd.textContent}> ${cmd}`);
    if (cmd.toLowerCase() === "explorer") {
      const res = await window.api.openProjectsFolder();
      if (res.ok) {
        appendTerminalLine(`explorer ${res.path}`);
      }
    } else {
      appendTerminalLine("Command execution is routed through Nevo actions.");
    }
  });

  // ============================================================
  //  INLINE THINKING INDICATOR
  // ============================================================
  function summarizeThinkingIntent(text, mode = "answer") {
    const raw = String(text || "").trim().replace(/\s+/g, " ");
    if (!raw) return settings.appLanguage === "ru" ? "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0445\u043e\u0447\u0435\u0442 \u043e\u0442\u0432\u0435\u0442." : "The user wants an answer.";
    const clipped = raw.length > 96 ? `${raw.slice(0, 96)}...` : raw;
    if (settings.appLanguage === "ru") {
      if (mode === "image") return `\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0445\u043e\u0447\u0435\u0442 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435: ${clipped}`;
      return `\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0445\u043e\u0447\u0435\u0442: ${clipped}`;
    }
    if (mode === "image") return `The user wants an image: ${clipped}`;
    return `The user wants: ${clipped}`;
  }

  function showThinkingMessage(mode = "answer", promptText = "") {
    removeThinkingMessage();
    currentThinkingLines = [];
    const waitingText = settings.appLanguage === "ru"
      ? (mode === "image" ? "\u0421\u043e\u0437\u0434\u0430\u044e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435" : "\u0414\u0443\u043c\u0430\u044e")
      : (mode === "image" ? "Creating image" : "Thinking");
    thinkingEl = document.createElement("div");
    thinkingEl.className = "message assistant thinking-message";
    thinkingEl.innerHTML = `
      <div class="message-body">
        <div class="thinking-inline">
          <span class="thinking-logo" aria-hidden="true">
            <img class="thinking-logo-ghost" src="resources/nevo-logo.png" alt="">
            <img class="thinking-logo-line" src="resources/nevo-logo.png" alt="">
          </span>
          <span class="thinking-label">${escapeHtml(waitingText)}</span>
          <span class="thinking-time">0s</span>
        </div>
      </div>
    `;
    messagesEl.appendChild(thinkingEl);
    thinkingStartedAt = Date.now();
    clearInterval(thinkingTicker);
    thinkingTicker = setInterval(() => {
      if (!thinkingEl) return;
      const elapsedMs = Date.now() - thinkingStartedAt;
      const timeEl = thinkingEl.querySelector(".thinking-time");
      if (timeEl) timeEl.textContent = `${Math.max(0, Math.floor(elapsedMs / 1000))}s`;
    }, 250);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function addThinkingLine(line) {
    currentThinkingLines.push(line);
  }

  function closeApproval(value) {
    approvalModal?.classList.remove("show");
    if (pendingApprovalResolve) {
      const resolve = pendingApprovalResolve;
      pendingApprovalResolve = null;
      resolve(value);
    }
  }

  function requestChangeApproval(filePath, summary) {
    if (!approvalModal || !approvalText) return Promise.resolve("accept");
    approvalText.textContent = summary || `${t("approvalDefault")} ${filePath || ""}`.trim();
    positionAnchoredSheet(approvalModal);
    approvalModal.classList.add("show");
    return new Promise(resolve => {
      pendingApprovalResolve = resolve;
    });
  }

  approvalAcceptBtn?.addEventListener("click", () => closeApproval("accept"));
  approvalAcceptChatBtn?.addEventListener("click", () => closeApproval("chat"));
  approvalDenyBtn?.addEventListener("click", () => closeApproval("deny"));
  approvalCloseBtn?.addEventListener("click", () => closeApproval("deny"));

  function removeThinkingMessage() {
    clearInterval(thinkingTicker);
    thinkingTicker = null;
    if (thinkingEl) {
      thinkingEl.remove();
      thinkingEl = null;
    }
  }

  const LANGUAGE_META = {
    js: { label: "JS", ext: "js", file: "main.js" },
    javascript: { label: "JS", ext: "js", file: "main.js" },
    jsx: { label: "JSX", ext: "jsx", file: "App.jsx" },
    ts: { label: "TS", ext: "ts", file: "main.ts" },
    typescript: { label: "TS", ext: "ts", file: "main.ts" },
    tsx: { label: "TSX", ext: "tsx", file: "App.tsx" },
    py: { label: "PY", ext: "py", file: "main.py" },
    python: { label: "PY", ext: "py", file: "main.py" },
    html: { label: "HTML", ext: "html", file: "index.html" },
    css: { label: "CSS", ext: "css", file: "styles.css" },
    json: { label: "JSON", ext: "json", file: "data.json" },
    java: { label: "JAVA", ext: "java", file: "Main.java" },
    c: { label: "C", ext: "c", file: "main.c" },
    cpp: { label: "C++", ext: "cpp", file: "main.cpp" },
    "c++": { label: "C++", ext: "cpp", file: "main.cpp" },
    cs: { label: "C#", ext: "cs", file: "Program.cs" },
    go: { label: "GO", ext: "go", file: "main.go" },
    rs: { label: "RS", ext: "rs", file: "main.rs" },
    rust: { label: "RS", ext: "rs", file: "main.rs" },
    php: { label: "PHP", ext: "php", file: "index.php" },
    rb: { label: "RB", ext: "rb", file: "main.rb" },
    ruby: { label: "RB", ext: "rb", file: "main.rb" },
    sh: { label: "SH", ext: "sh", file: "script.sh" },
    bash: { label: "SH", ext: "sh", file: "script.sh" },
    cmd: { label: "CMD", ext: "cmd", file: "start.cmd" },
    bat: { label: "BAT", ext: "bat", file: "start.cmd" },
    batch: { label: "BAT", ext: "bat", file: "start.cmd" },
    sql: { label: "SQL", ext: "sql", file: "query.sql" }
  };

  function normalizeLanguage(raw) {
    const token = String(raw || "").trim().split(/\s+/)[0].replace(/^[./\\]+/, "").toLowerCase();
    return token || "";
  }

  function stripCodeBlocks(text) {
    return String(text || "")
      .replace(/```[^\n`]*\n[\s\S]*?(?:```|$)/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function inferCodeFile(lang, info) {
    const fileMatch = String(info || "").match(/(?:^|\s)([\w.-]+\.[a-z0-9]+)(?:\s|$)/i);
    if (fileMatch) return fileMatch[1];
    const meta = LANGUAGE_META[lang] || { label: (lang || "CODE").slice(0, 6).toUpperCase(), file: "main.txt" };
    return meta.file;
  }

  function inferCodePath(fileName) {
    if (/\.(js|jsx|ts|tsx)$/i.test(fileName)) return "electron/";
    if (/\.(html|css)$/i.test(fileName)) return "web/";
    if (/\.(py|rb|php|sh|cmd|bat)$/i.test(fileName)) return "src/";
    return "";
  }

  function getLatestCodeActivity(text) {
    const re = /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g;
    let match;
    let latest = null;
    while ((match = re.exec(text))) {
      const info = match[1] || "";
      const code = match[2] || "";
      const lang = normalizeLanguage(info);
      const meta = LANGUAGE_META[lang] || { label: (lang || "CODE").slice(0, 6).toUpperCase(), file: "main.txt" };
      const file = inferCodeFile(lang, info);
      latest = {
        state: "editing",
        label: meta.label,
        file,
        path: inferCodePath(file),
        added: code.split(/\r?\n/).filter(line => line.trim()).length,
        removed: 0,
        code
      };
    }
    return latest;
  }

  const PYTHON_STDLIB = new Set([
    "abc","argparse","asyncio","base64","collections","csv","datetime","decimal","functools","hashlib","heapq",
    "html","http","itertools","json","logging","math","os","pathlib","pickle","random","re","shutil","socket",
    "sqlite3","statistics","string","subprocess","sys","threading","time","tkinter","typing","urllib","uuid"
  ]);
  const PYTHON_PACKAGE_MAP = {
    cv2: "opencv-python",
    PIL: "pillow",
    sklearn: "scikit-learn",
    yaml: "pyyaml",
    bs4: "beautifulsoup4",
    dotenv: "python-dotenv",
  };

  function detectPythonPackages(activity) {
    if (!activity || !/^(py|python)$/i.test(activity.label || "") && !/\.py$/i.test(activity.file || "")) return [];
    const code = String(activity.code || "");
    const found = new Set();
    const re = /^\s*(?:import\s+([a-zA-Z_][\w.]*)|from\s+([a-zA-Z_][\w.]*)\s+import\s+)/gm;
    let match;
    while ((match = re.exec(code))) {
      const root = String(match[1] || match[2] || "").split(".")[0];
      if (!root || PYTHON_STDLIB.has(root)) continue;
      found.add(PYTHON_PACKAGE_MAP[root] || root);
    }
    return Array.from(found);
  }

  const NODE_BUILTINS = new Set([
    "assert","buffer","child_process","crypto","events","fs","http","https","net","os","path","process","querystring",
    "readline","stream","string_decoder","timers","tls","tty","url","util","vm","zlib"
  ]);

  function detectNodePackages(activity) {
    if (!activity || !/\.(js|jsx|ts|tsx)$/i.test(activity.file || "")) return [];
    const code = String(activity.code || "");
    const found = new Set();
    const re = /(?:from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\))/g;
    let match;
    while ((match = re.exec(code))) {
      const raw = String(match[1] || match[2] || match[3] || "").trim();
      if (!raw || raw.startsWith(".") || raw.startsWith("/") || raw.startsWith("node:")) continue;
      const pkg = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0];
      if (!NODE_BUILTINS.has(pkg)) found.add(pkg);
    }
    return Array.from(found);
  }

  async function maybeInstallPythonPackages(activity, folderName) {
    const packages = detectPythonPackages(activity);
    if (!packages.length || settings.accessMode === "plan" || !window.api?.installPythonPackages) return;
    if (settings.accessMode === "ask") {
      const decision = await requestChangeApproval(
        "python packages",
        `Nevo needs to install Python packages so the app can run: ${packages.join(", ")}`
      );
      if (decision === "deny") {
        addProgressItem(`Denied package install ${packages.join(", ")}`, "denied");
        upsertCodingPreview(Object.assign({}, activity, { state: "editing" }), `Dependency install denied: ${packages.join(", ")}`);
        return;
      }
    }
    const progressId = addProgressItem(`Installing ${packages.join(", ")}`, "pending");
    appendTerminalLine(`py -m pip install ${packages.join(" ")}`);
    const result = await window.api.installPythonPackages(packages, folderName);
    if (result && result.ok) {
      updateProgressItem(progressId, "done", `Installed ${packages.join(", ")}`);
      upsertCodingPreview(Object.assign({}, activity, { state: "edited" }), `Dependencies installed: ${packages.join(", ")}`);
    } else {
      updateProgressItem(progressId, "denied", `Failed install ${packages.join(", ")}`);
      upsertCodingPreview(Object.assign({}, activity, { state: "editing" }), `Dependency install failed: ${result?.error || "pip failed"}`);
    }
  }

  function renderCodeActivity(activity) {
    if (!activity) return "";
    const stateText = activity.state === "edited" ? "Edited" : "Editing";
    const langClass = `lang-${String(activity.label || "code").toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    return `
      <div class="code-activity ${activity.state === "edited" ? "edited" : "editing"}">
        <span class="code-activity-pencil" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/><path d="m15 5 4 4"/></svg>
        </span>
        <span class="code-activity-state">${stateText}</span>
        <span class="code-lang-icon ${langClass}">${languageIconSvg(activity.label || "CODE")}</span>
        <span class="code-file-name">${escapeHtml(activity.file || "main.txt")}</span>
        ${activity.path ? `<span class="code-file-path">${escapeHtml(activity.path)}</span>` : ""}
        <span class="code-lines added">+${activity.added || 0}</span>
        <span class="code-lines removed">-${activity.removed || 0}</span>
      </div>
    `;
  }

  function languageIconSvg(label) {
    const l = String(label || "").toLowerCase();
    if (l === "html") return `<svg viewBox="0 0 64 64" aria-label="HTML"><path fill="#e44d26" d="M10 4h44l-4 50-18 6-18-6L10 4z"/><path fill="#f16529" d="M32 8h18l-3.4 42.8L32 55.8V8z"/><path fill="#fff" d="M20 17h24l-.5 6H26l.4 5H43l-1.3 16L32 47l-9.7-3-.7-8h6l.3 3.5 4.1 1.2 4.2-1.2.5-5.5H21.2L20 17z"/></svg>`;
    if (l === "css") return `<svg viewBox="0 0 64 64" aria-label="CSS"><path fill="#1572b6" d="M10 4h44l-4 50-18 6-18-6L10 4z"/><path fill="#33a9dc" d="M32 8h18l-3.4 42.8L32 55.8V8z"/><path fill="#fff" d="M20 17h24l-.5 6H27l.4 5h15.6l-1.3 16L32 47l-9.7-3-.6-7h6l.2 2.5 4.1 1.2 4.2-1.2.4-5.4H21.3L20 17z"/></svg>`;
    if (l === "py") return `<svg viewBox="0 0 64 64" aria-label="Python"><path fill="#3776ab" d="M31 4c-12 0-11 5-11 5v5h12v2H15s-8-1-8 12 7 12 7 12h4v-6s0-7 7-7h12s6 0 6-6V10s1-6-12-6z"/><circle cx="25" cy="10" r="2" fill="#fff"/><path fill="#ffd43b" d="M33 60c12 0 11-5 11-5v-5H32v-2h17s8 1 8-12-7-12-7-12h-4v6s0 7-7 7H27s-6 0-6 6v11s-1 6 12 6z"/><circle cx="39" cy="54" r="2" fill="#fff"/></svg>`;
    if (l === "c++" || l === "cpp") return `<svg viewBox="0 0 64 64" aria-label="C++"><path fill="#659ad2" d="M32 2 58 17v30L32 62 6 47V17L32 2z"/><path fill="#00599c" d="M32 2 58 17v30L32 62V2z"/><path fill="#fff" d="M31 42c-8 0-14-6-14-14s6-14 14-14c5 0 9 2 12 6l-5 3c-2-2-4-3-7-3-5 0-8 3-8 8s3 8 8 8c3 0 5-1 7-3l5 3c-3 4-7 6-12 6zM44 25h4v-4h3v4h4v3h-4v4h-3v-4h-4v-3zm9 0h4v-4h3v4h4v3h-4v4h-3v-4h-4v-3z"/></svg>`;
    if (l === "js") return `<svg viewBox="0 0 64 64" aria-label="JavaScript"><rect width="56" height="56" x="4" y="4" rx="6" fill="#f7df1e"/><path fill="#111" d="M22 46c1 2 3 3 5 3 3 0 5-1 5-5V22h6v22c0 7-4 10-10 10-5 0-9-2-11-6l5-2zm22 0c2 3 4 4 7 4 3 0 5-1 5-3 0-3-3-4-6-5l-2-1c-5-2-8-4-8-10s4-9 10-9c4 0 8 1 10 5l-5 3c-1-2-3-3-5-3s-4 1-4 3 2 3 6 5l2 1c6 2 9 5 9 10 0 6-5 9-12 9-6 0-10-3-12-7l5-2z"/></svg>`;
    return `<span class="code-lang-text">${escapeHtml(label).slice(0, 5)}</span>`;
  }

  function upsertCodeActivity(container, activity) {
    if (!activity) return;
    const previousAdded = lastCodeActivity ? lastCodeActivity.added : null;
    const previousRemoved = lastCodeActivity ? lastCodeActivity.removed : null;
    lastCodeActivity = activity;
    if (!activeCodeActivityEl) {
      activeCodeActivityEl = document.createElement("div");
      activeCodeActivityEl.className = "code-activity-wrap";
      const actions = container.querySelector(".message-actions");
      if (actions) container.insertBefore(activeCodeActivityEl, actions);
      else container.appendChild(activeCodeActivityEl);
    }
    activeCodeActivityEl.innerHTML = renderCodeActivity(activity);
    upsertAppPreview(activity);
    upsertCodingPreview(activity, activity.state === "edited" ? "Saved file preview" : "Streaming code preview");
    const addedEl = activeCodeActivityEl.querySelector(".code-lines.added");
    const removedEl = activeCodeActivityEl.querySelector(".code-lines.removed");
    if (previousAdded !== null && previousAdded !== activity.added && addedEl) {
      addedEl.classList.add("bump");
      setTimeout(() => addedEl.classList.remove("bump"), 240);
    }
    if (previousRemoved !== null && previousRemoved !== activity.removed && removedEl) {
      removedEl.classList.add("bump");
      setTimeout(() => removedEl.classList.remove("bump"), 240);
    }
  }

  async function ensureCodeProjectForCurrentChat() {
    const chat = getCurrentChat();
    if (!chat) return null;
    if (chat.groupId) {
      const existing = data.groups.find(g => g.id === chat.groupId);
      return existing ? existing.folderName || existing.name : null;
    }
    const groupName = "NevoProject";
    let folderName = groupName;
    if (window.api && window.api.ensureProjectFolder) {
      const folder = await window.api.ensureProjectFolder(groupName);
      if (folder.ok) folderName = folder.folderName;
    }
    const group = { id: "g" + Date.now(), name: folderName, folderName, collapsed: false };
    data.groups.push(group);
    chat.groupId = group.id;
    chat.updatedAt = Date.now();
    addProgressItem(`Created project ${folderName}`);
    renderSidebar();
    persist();
    return folderName;
  }

  async function writeLatestCodeActivity() {
    if (!lastCodeActivity || !lastCodeActivity.code || !window.api || !window.api.writeProjectFile) return;
    const folderName = currentCodeProjectFolderName || await ensureCodeProjectForCurrentChat();
    if (!folderName) return;
    const filePath = `${lastCodeActivity.path || ""}${lastCodeActivity.file || "main.txt"}`;
    if (settings.accessMode === "plan") {
      addProgressItem(`Plan mode: prepared ${filePath}, no file edited`);
      upsertCodingPreview(Object.assign({}, lastCodeActivity, { state: "editing" }), `Plan only: ${filePath}`);
      return;
    }
    let fileAlreadyExists = false;
    if (window.api.projectFileExists) {
      const info = await window.api.projectFileExists(folderName, filePath);
      fileAlreadyExists = !!(info && info.ok && info.exists);
    }
    const needsApproval = fileAlreadyExists && settings.accessMode === "ask" && acceptedChangeChatId !== currentChatId;
    if (needsApproval) {
      const decision = await requestChangeApproval(filePath, `Nevo wants to change an existing file: ${filePath}`);
      if (decision === "deny") {
        addProgressItem(`Denied edit ${filePath}`, "denied");
        upsertCodingPreview(Object.assign({}, lastCodeActivity, { state: "editing" }), `Denied: ${filePath}`);
        return;
      }
      if (decision === "chat") acceptedChangeChatId = currentChatId;
    }
    const progressId = addProgressItem(`${fileAlreadyExists ? "Editing" : "Creating"} ${filePath}`, "pending");
    const res = await window.api.writeProjectFile(folderName, filePath, lastCodeActivity.code);
    if (res && res.ok) {
      updateProgressItem(progressId, "done", `${res.existed ? "Edited" : "Created"} ${filePath}`);
      upsertCodingPreview(Object.assign({}, lastCodeActivity, { state: "edited" }), `${res.existed ? "Edited" : "Created"} ${filePath}`);
      await maybeInstallPythonPackages(lastCodeActivity, folderName);
      await maybeInstallNodePackages(lastCodeActivity, folderName);
    } else {
      updateProgressItem(progressId, "denied", `Failed ${filePath}`);
      upsertCodingPreview(Object.assign({}, lastCodeActivity, { state: "editing" }), `Failed: ${filePath}`);
    }
  }

  // ============================================================
  //  ATTACHMENTS
  // ============================================================
  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    for (const file of fileInput.files) addAttachment(file);
    fileInput.value = "";
  });

  function addAttachment(file) {
    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(",")[1];
        attachments.push({ kind: "image", name: file.name, dataUrl, base64 });
        renderAttachments();
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        attachments.push({ kind: "file", name: file.name, text: reader.result });
        renderAttachments();
      };
      reader.readAsText(file);
    }
  }

  function renderAttachments() {
    if (attachments.length === 0) { attachmentStrip.style.display = "none"; return; }
    attachmentStrip.style.display = "flex";
    attachmentStrip.innerHTML = "";
    attachments.forEach((a, idx) => {
      const el = document.createElement("div");
      el.className = "attachment-item" + (a.kind === "file" ? " file" : "");
      if (a.kind === "image") {
        el.innerHTML = `<img src="${a.dataUrl}" alt=""><button class="attachment-remove" data-idx="${idx}">&times;</button>`;
      } else {
        el.innerHTML = `
          <span class="file-icon"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-4-6zm-1 7V3.5L18.5 9H13z"/></svg></span>
          <span class="file-name">${a.name}</span>
          <button class="attachment-remove" data-idx="${idx}" style="position:static;width:16px;height:16px;background:transparent;color:var(--text-muted)">&times;</button>
        `;
      }
      attachmentStrip.appendChild(el);
    });
    attachmentStrip.querySelectorAll(".attachment-remove").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        attachments.splice(parseInt(b.dataset.idx), 1);
        renderAttachments();
        updateSendBtn();
      });
    });
  }

  // drag&drop С„Р°Р№Р»РѕРІ РІ composer
  const composerInner = $("composerInner");
  let dragCounter = 0;
  composerInner.addEventListener("dragenter", e => {
    e.preventDefault(); dragCounter++;
    const field = composerInner.querySelector(".composer-field");
    if (field) field.style.borderColor = "#666";
  });
  composerInner.addEventListener("dragover", e => { e.preventDefault(); });
  composerInner.addEventListener("dragleave", e => {
    e.preventDefault(); dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      const field = composerInner.querySelector(".composer-field");
      if (field) field.style.borderColor = "";
    }
  });
  composerInner.addEventListener("drop", e => {
    e.preventDefault(); dragCounter = 0;
    const field = composerInner.querySelector(".composer-field");
    if (field) field.style.borderColor = "";
    if (e.dataTransfer && e.dataTransfer.files) {
      for (const f of e.dataTransfer.files) addAttachment(f);
    }
  });

  // ============================================================
  //  MARKDOWN
  // ============================================================
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function renderMarkdown(text) {
    // РЈР±РёСЂР°РµРј <think>...</think> Р±Р»РѕРєРё РёР· РІРёРґРёРјРѕРіРѕ РІС‹РІРѕРґР°
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    cleaned = cleaned.replace(/<think>/gi, "").replace(/<\/think>/gi, "");
    let html = escapeHtml(cleaned);

    // Р‘Р»РѕС‡РЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ РѕР±СЂР°Р±Р°С‚С‹РІР°РµРј РїРѕСЃС‚СЂРѕС‡РЅРѕ
    const lines = html.split("\n");
    const out = [];
    let inUl = false, inOl = false, inCode = false, codeLang = "", codeBuf = [];

    function closeLists() {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // РєРѕРґ-Р±Р»РѕРє
      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        if (!inCode) { inCode = true; codeLang = fence[1]; codeBuf = []; }
        else { out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`); inCode = false; }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }

      // Р·Р°РіРѕР»РѕРІРєРё
      let m;
      if ((m = line.match(/^### (.+)$/))) { closeLists(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
      if ((m = line.match(/^## (.+)$/)))  { closeLists(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
      if ((m = line.match(/^# (.+)$/)))   { closeLists(); out.push(`<h1>${inline(m[1])}</h1>`); continue; }
      if ((m = line.match(/^&gt; (.+)$/))) { closeLists(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }

      // РЅРµРЅСѓРјРµСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє
      if ((m = line.match(/^[\-\*] (.+)$/))) {
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (!inUl) { out.push("<ul>"); inUl = true; }
        out.push(`<li>${inline(m[1])}</li>`);
        continue;
      }
      // РЅСѓРјРµСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє
      if ((m = line.match(/^\d+\. (.+)$/))) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (!inOl) { out.push("<ol>"); inOl = true; }
        out.push(`<li>${inline(m[1])}</li>`);
        continue;
      }

      closeLists();
      // РїСѓСЃС‚Р°СЏ СЃС‚СЂРѕРєР° в†’ СЂР°Р·РґРµР»РёС‚РµР»СЊ Р°Р±Р·Р°С†Р°
      if (line.trim() === "") out.push("");
      else out.push(inline(line));
    }
    if (inCode) out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
    closeLists();

    // РЎРѕР±РёСЂР°РµРј РІ Р°Р±Р·Р°С†С‹
    let body = out.join("\n");
    body = body.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
    // СѓРґР°Р»СЏРµРј <br> РІРѕРєСЂСѓРі Р±Р»РѕС‡РЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ (РµСЃР»Рё Р±Р»РѕРє СЃС‚РѕРёС‚ РѕС‚РґРµР»СЊРЅРѕ РІ Р°Р±Р·Р°С†Рµ)
    body = body.replace(/<br>(<(?:ul|ol|pre|h1|h2|h3|blockquote|table))/g, "$1");
    body = body.replace(/(<\/(?:ul|ol|pre|h1|h2|h3|blockquote|table)>)<br>/g, "$1");
    // СѓРґР°Р»СЏРµРј РїСѓСЃС‚С‹Рµ <p></p>
    body = body.replace(/<p>\s*<\/p>/g, "");
    return `<p>${body}</p>`;
  }

  // РёРЅР»Р°Р№РЅ-С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ: code, bold, italic
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  // ============================================================
  //  MESSAGES RENDERING
  // ============================================================
  function createMessageElement(msg) {
    const role = msg.role;
    const m = document.createElement("div");
    m.className = `message ${role}`;
    const body = document.createElement("div");
    body.className = "message-body";

    const textEl = document.createElement("div");
    textEl.className = "message-text";
    const visibleAssistantText = msg.codeActivity ? stripCodeBlocks(msg.content || "") : (msg.content || "");
    textEl.innerHTML = role === "user" ? escapeHtml(msg.content) : renderMarkdown(visibleAssistantText);
    if (role === "assistant" && !visibleAssistantText.trim()) textEl.style.display = "none";
    body.appendChild(textEl);
    if (role === "assistant" && msg.codeActivity) {
      const activityWrap = document.createElement("div");
      activityWrap.className = "code-activity-wrap";
      const finalActivity = Object.assign({}, msg.codeActivity, { state: msg.codeActivity.state || "edited" });
      activityWrap.innerHTML = renderCodeActivity(finalActivity);
      activityWrap.addEventListener("click", () => openPanelFile(finalActivity));
      activityWrap.setAttribute("role", "button");
      activityWrap.tabIndex = 0;
      activityWrap.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPanelFile(finalActivity);
        }
      });
      body.appendChild(activityWrap);
    }

    // РІР»РѕР¶РµРЅРёСЏ (РєР°СЂС‚РёРЅРєРё/С„Р°Р№Р»С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ)
    if (role === "user" && msg.images && msg.images.length) {
      const att = document.createElement("div");
      att.className = "message-attachments";
      msg.images.forEach(dataUrl => {
        const img = document.createElement("img");
        img.className = "chat-image";
        img.src = dataUrl;
        img.addEventListener("click", () => window.open(dataUrl));
        att.appendChild(img);
      });
      body.appendChild(att);
    }

    // СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅС‹Рµ Р°СЃСЃРёСЃС‚РµРЅС‚РѕРј РёР·РѕР±СЂР°Р¶РµРЅРёСЏ (Р»РѕРєР°Р»СЊРЅС‹Р№ canvas-РіРµРЅРµСЂР°С‚РѕСЂ)
    if (role === "assistant" && msg.images && msg.images.length) {
      const att = document.createElement("div");
      att.className = "message-attachments";
      msg.images.forEach(dataUrl => {
        const img = document.createElement("img");
        img.className = "chat-image";
        img.src = dataUrl;
        img.addEventListener("click", () => window.open(dataUrl));
        att.appendChild(img);
      });
      body.appendChild(att);
    }

    if (role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      const copyBtn = document.createElement("button");
      copyBtn.className = "msg-action-btn";
      setTooltip(copyBtn, "Copy response");
      copyBtn.title = "РљРѕРїРёСЂРѕРІР°С‚СЊ";
      copyBtn.innerHTML = `
        <span class="copy-icon copy-default" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="11" height="11" rx="2"/><rect x="4" y="4" width="11" height="11" rx="2"/></svg>
        </span>
        <span class="copy-icon copy-done" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
        <span class="copy-label">Copy</span>
      `;
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(msg.content || "").then(() => {
          copyBtn.classList.add("copied");
          copyBtn.querySelector(".copy-label").textContent = "copied!";
          setTimeout(() => {
            copyBtn.classList.remove("copied");
            copyBtn.querySelector(".copy-label").textContent = "Copy";
          }, 1500);
        });
      });
      actions.appendChild(copyBtn);
      body.appendChild(actions);
    }

    m.appendChild(body);
    return m;
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) {
      welcomeEl.style.display = "flex";
      if (!welcomeTitle.textContent.trim()) typeWelcomeTitle();
      updateHomeMode();
      return;
    }
    welcomeEl.style.display = "none";
    updateHomeMode();
    chat.messages.forEach(m => messagesEl.appendChild(createMessageElement(m)));
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // ============================================================
  //  SYSTEM PROMPT (РѕР±С‰РёР№ Р°СЃСЃРёСЃС‚РµРЅС‚, РЅРµ С‚РѕР»СЊРєРѕ РєРѕРґ)
  // ============================================================
  function buildSystemPrompt() {
    const base = `\u0422\u044b ? Nevo, \u0434\u0440\u0443\u0436\u0435\u043b\u044e\u0431\u043d\u044b\u0439 \u0438 \u043f\u043e\u043b\u0435\u0437\u043d\u044b\u0439 AI-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043d\u0442. \u0422\u044b \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0448\u044c \u043b\u044e\u0434\u044f\u043c \u0441 \u0440\u0430\u0437\u043d\u044b\u043c\u0438 \u0437\u0430\u0434\u0430\u0447\u0430\u043c\u0438: \u043e\u0442\u0432\u0435\u0442\u0430\u043c\u0438 \u043d\u0430 \u0432\u043e\u043f\u0440\u043e\u0441\u044b, \u043e\u0431\u044a\u044f\u0441\u043d\u0435\u043d\u0438\u044f\u043c\u0438, \u043f\u0438\u0441\u044c\u043c\u043e\u043c, \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u0430\u043c\u0438, \u0438\u0434\u0435\u044f\u043c\u0438, \u043d\u0430\u0443\u043a\u043e\u0439, \u0443\u0447\u0451\u0431\u043e\u0439, \u0431\u044b\u0442\u043e\u0432\u044b\u043c\u0438 \u0434\u0435\u043b\u0430\u043c\u0438 \u0438 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435\u043c. \u041d\u0435 \u0441\u0447\u0438\u0442\u0430\u0439, \u0447\u0442\u043e \u043b\u044e\u0431\u0430\u044f \u043f\u0440\u043e\u0441\u044c\u0431\u0430 \u00ab\u0441\u043e\u0437\u0434\u0430\u0439\u00bb \u043e\u0437\u043d\u0430\u0447\u0430\u0435\u0442 \u043a\u043e\u0434. \u041f\u0438\u0448\u0438 \u043a\u043e\u0434 \u0442\u043e\u043b\u044c\u043a\u043e \u0435\u0441\u043b\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u044f\u0432\u043d\u043e \u043f\u0440\u043e\u0441\u0438\u0442 \u043a\u043e\u0434, \u0441\u0430\u0439\u0442, \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441, \u0438\u0433\u0440\u0443 \u0438\u043b\u0438 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435. \u041e\u0442\u0432\u0435\u0447\u0430\u0439 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e \u0438 \u043f\u043e\u043d\u044f\u0442\u043d\u043e. \u0412\u0441\u0435\u0433\u0434\u0430 \u043e\u0442\u0432\u0435\u0447\u0430\u0439 \u043d\u0430 \u044f\u0437\u044b\u043a\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.`;

    const think = settings.thinkLevel;
    let thinkHint = "";
    if (think === "none") {
      thinkHint = "\u041e\u0442\u0432\u0435\u0447\u0430\u0439 \u043a\u043e\u0440\u043e\u0442\u043a\u043e \u0438 \u043f\u0440\u044f\u043c\u043e.";
    } else if (think === "low") {
      thinkHint = "\u041e\u0442\u0432\u0435\u0447\u0430\u0439 \u043a\u0440\u0430\u0442\u043a\u043e \u0438 \u043f\u043e \u0434\u0435\u043b\u0443.";
    } else if (think === "medium") {
      thinkHint = "\u0414\u0430\u0432\u0430\u0439 \u0432\u0434\u0443\u043c\u0447\u0438\u0432\u044b\u0435, \u043f\u043e\u043b\u0435\u0437\u043d\u044b\u0435 \u043e\u0442\u0432\u0435\u0442\u044b \u043e\u0431\u044b\u0447\u043d\u043e\u0439 \u0434\u043b\u0438\u043d\u044b.";
    } else if (think === "high") {
      thinkHint = "\u0420\u0430\u0437\u043c\u044b\u0448\u043b\u044f\u0439 \u0433\u043b\u0443\u0431\u0436\u0435 \u0438 \u0434\u0430\u0432\u0430\u0439 \u043f\u0440\u043e\u0434\u0443\u043c\u0430\u043d\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442.";
    } else if (think === "max") {
      thinkHint = "\u0420\u0430\u0437\u043c\u044b\u0448\u043b\u044f\u0439 \u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u043e \u0433\u043b\u0443\u0431\u043e\u043a\u043e \u0438 \u0440\u0430\u0441\u0441\u043c\u0430\u0442\u0440\u0438\u0432\u0430\u0439 \u0437\u0430\u0434\u0430\u0447\u0443 \u0441 \u0440\u0430\u0437\u043d\u044b\u0445 \u0441\u0442\u043e\u0440\u043e\u043d.";
    }
    const appBuildHint = "When the user explicitly asks to build an app, page, UI, game, interface, website, script, or code, produce complete runnable code. Put the main file in a fenced code block with the language and filename, for example ```html index.html or ```python main.py. For ordinary creative or general requests, do not produce code unless asked.";
    return `${base}\n\n${appBuildHint}\n\n${thinkHint}`;
  }

  async function maybeInstallNodePackages(activity, folderName) {
    const packages = detectNodePackages(activity);
    if (!packages.length || settings.accessMode === "plan" || !window.api?.installNodePackages) return;
    if (settings.accessMode === "ask") {
      const decision = await requestChangeApproval(
        "package.json",
        `Nevo needs to install Node packages so the app can run: ${packages.join(", ")}`
      );
      if (decision === "deny") {
        upsertCodingPreview(Object.assign({}, activity, { state: "editing" }), `Dependency install denied: ${packages.join(", ")}`);
        return;
      }
      if (decision === "chat") acceptedChangeChatId = currentChatId;
    }
    const progressId = addProgressItem(`Installing ${packages.join(", ")}`, "pending");
    const result = await window.api.installNodePackages(packages, folderName);
    if (result?.ok) {
      updateProgressItem(progressId, "done", `Installed ${packages.join(", ")}`);
      upsertCodingPreview(Object.assign({}, activity, { state: "edited" }), `Dependencies installed: ${packages.join(", ")}`);
    } else {
      updateProgressItem(progressId, "denied", `Failed install ${packages.join(", ")}`);
      upsertCodingPreview(Object.assign({}, activity, { state: "editing" }), `Dependency install failed: ${result?.error || "npm failed"}`);
    }
  }

  // ============================================================
  //  GENERATE (Ollama streaming)
  // ============================================================
  function ollamaOptionsForThink() {
    const level = settings.thinkLevel;
    const opts = { num_ctx: 32768 };
    if (level === "none") opts.num_predict = 800;
    else if (level === "low") opts.num_predict = 1200;
    else if (level === "medium") opts.num_predict = 2500;
    else if (level === "high") opts.num_predict = 5000;
    else if (level === "max") opts.num_predict = 10000;
    return opts;
  }

  function providerKindForModel(model) {
    const value = `${model.category || ""} ${model.name || ""}`.toLowerCase();
    if (value.includes("openai") || value.includes("gpt-oss")) return "openai";
    if (value.includes("google") || value.includes("gemma")) return "gemini";
    if (value.includes("qwen") || value.includes("alibaba")) return "qwen";
    if (value.includes("deepseek")) return "deepseek";
    if (value.includes("moondream")) return "moondream";
    if (value.includes("starcoder")) return "starcoder";
    if (value.includes("llava")) return "llava";
    if (value.includes("smollm")) return "huggingface";
    if (value.includes("meta") || value.includes("llama") || value.includes("tinyllama") || value.includes("codellama")) return "meta";
    if (value.includes("mistral")) return "mistral";
    if (value.includes("microsoft") || value.includes("phi")) return "microsoft";
    return "ollama";
  }

  function providerIconMarkup(model) {
    const kind = providerKindForModel(model);
    const logoMap = {
      openai: "https://commons.wikimedia.org/wiki/Special:FilePath/OpenAI_Logo.svg",
      gemini: "https://commons.wikimedia.org/wiki/Special:FilePath/Google_Gemini_logo.svg",
      qwen: "https://commons.wikimedia.org/wiki/Special:FilePath/Qwen_Logo.svg",
      mistral: "https://commons.wikimedia.org/wiki/Special:FilePath/Mistral_AI_logo_(2025%E2%80%93).svg",
      deepseek: "https://commons.wikimedia.org/wiki/Special:FilePath/DeepSeek_logo.svg",
      meta: "https://commons.wikimedia.org/wiki/Special:FilePath/Meta_Platforms_Inc._logo.svg",
      microsoft: "https://commons.wikimedia.org/wiki/Special:FilePath/Microsoft_logo.svg",
      huggingface: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
      moondream: "https://www.google.com/s2/favicons?domain=moondream.ai&sz=128",
      starcoder: "https://www.google.com/s2/favicons?domain=bigcode-project.org&sz=128",
      llava: "https://www.google.com/s2/favicons?domain=llava-vl.github.io&sz=128",
      ollama: "https://cdn.simpleicons.org/ollama/111111",
    };
    const src = logoMap[kind] || "";
    const initial = escapeHtml(providerInitial(model));
    return src
      ? `<img class="provider-logo-img provider-${kind}" src="${src}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span style="display:none">${initial}</span>`
      : `<span>${initial}</span>`;
  }

  function providerInitial(model) {
    const text = (model.category || model.name || "AI").trim();
    return text.slice(0, 2).toUpperCase();
  }

  async function generateResponse(userText, userImages) {
    let requestModel = settings.selectedModel;
    if (userImages && userImages.length) {
      requestModel = pickVisionModelName();
      if (!requestModel) {
        return "\u0414\u043b\u044f \u0444\u043e\u0442\u043e \u043d\u0443\u0436\u043d\u0430 vision-\u043c\u043e\u0434\u0435\u043b\u044c. \u0421\u043a\u0430\u0447\u0430\u0439 llama3.2-vision, llava, moondream \u0438\u043b\u0438 qwen-vl \u0432 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0435 \u043c\u043e\u0434\u0435\u043b\u0435\u0439.";
      }
      if (requestModel !== settings.selectedModel) {
        addThinkingLine(`Using vision model: ${requestModel}`);
      }
    }
    if (!ollamaRunning) return "Ollama РЅРµ Р·Р°РїСѓС‰РµРЅ. Nevo Р·Р°РїСѓСЃРєР°РµС‚ РµРіРѕ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё, РїРѕРґРѕР¶РґРёС‚Рµ РЅРµСЃРєРѕР»СЊРєРѕ СЃРµРєСѓРЅРґ.";
    if (!requestModel) return "РњРѕРґРµР»СЊ РЅРµ РІС‹Р±СЂР°РЅР°. РќР°Р¶РјРёС‚Рµ РєРЅРѕРїРєСѓ РјРѕРґРµР»Рё РІРЅРёР·Сѓ, С‡С‚РѕР±С‹ РІС‹Р±СЂР°С‚СЊ.";

    // РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ Рѕ vision
    if (userImages && userImages.length && !modelSupportsVision(settings.selectedModel)) {
      // РІСЃС‘ СЂР°РІРЅРѕ РїСЂРѕР±СѓРµРј вЂ” РЅРµРєРѕС‚РѕСЂС‹Рµ РјРѕРґРµР»Рё РїСЂРѕСЃС‚Рѕ РїСЂРѕРёРіРЅРѕСЂРёСЂСѓСЋС‚
    }

    const chat = getCurrentChat();
    const history = chat ? chat.messages.slice(0, -1) : [];

    // РёСЃС‚РѕСЂРёСЏ Р±РµР· РІР»РѕР¶РµРЅРёР№-РєР°СЂС‚РёРЅРѕРє РґР»СЏ context window
    const contextMsgs = history.slice(-12).map(m => ({
      role: m.role,
      content: m.content
    }));

    // С‚РµРєСѓС‰РµРµ СЃРѕРѕР±С‰РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (СЃ РєР°СЂС‚РёРЅРєР°РјРё Рё С‚РµРєСЃС‚РѕРј С„Р°Р№Р»РѕРІ)
    let currentUserContent = userText || "";
    if (userImages && userImages.length === 0) {
      // РЅРёС‡РµРіРѕ
    }
    const fileTexts = attachments.filter(a => a.kind === "file");
    if (fileTexts.length) {
      currentUserContent += "\n\n" + fileTexts.map(f => `File "${f.name}":\n\`\`\`\n${f.text.slice(0, 12000)}\n\`\`\``).join("\n\n");
    }

    const apiMessages = [
      { role: "system", content: buildSystemPrompt() },
      ...contextMsgs,
      { role: "user", content: currentUserContent || (userImages && userImages.length ? "Describe this image." : ""), images: (userImages && userImages.length ? userImages : undefined) }
    ];

    const reqBody = {
      model: requestModel,
      messages: apiMessages,
      stream: true,
      options: ollamaOptionsForThink()
    };
    // think-РїР°СЂР°РјРµС‚СЂ РґР»СЏ РјРѕРґРµР»РµР№, РєРѕС‚РѕСЂС‹Рµ РµРіРѕ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚
    if (modelSupportsThink(requestModel)) {
      reqBody.think = settings.thinkLevel !== "none";
    }

    abortController = new AbortController();

    try {
      const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const details = errorText ? `: ${errorText.slice(0, 220)}` : "";
        throw new Error(`HTTP ${response.status}${details}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let msgEl = null, textEl = null;
      let msgBody = null;
      let firstToken = true;
      let codeProjectEnsured = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.trim());
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const content = json.message?.content || "";
            if (content) {
              if (firstToken) {
                firstToken = false;
                addThinkingLine("Started streaming the answer");
                removeThinkingMessage();
              }
              fullText += content;
              if (!msgEl) {
                msgEl = createMessageElement({ role: "assistant", content: "" });
                msgBody = msgEl.querySelector(".message-body");
                textEl = msgEl.querySelector(".message-text");
                messagesEl.appendChild(msgEl);
              }
              const activity = getLatestCodeActivity(fullText);
              if (activity && msgBody) {
                if (!codeProjectEnsured) {
                  codeProjectEnsured = true;
                  addThinkingLine("Detected code output");
                  addProgressItem(`Detected code for ${activity.file}`);
                  ensureCodeProjectForCurrentChat().then(folderName => {
                    if (folderName) currentCodeProjectFolderName = folderName;
                    if (folderName) addThinkingLine(`Project folder: ${folderName}`);
                  });
                }
                upsertCodeActivity(msgBody, activity);
              }
              const visibleText = activity ? stripCodeBlocks(fullText) : fullText;
              textEl.innerHTML = renderMarkdown(visibleText);
              textEl.style.display = visibleText.trim() ? "" : "none";
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          } catch { /* partial */ }
        }
      }

      if (lastCodeActivity && activeCodeActivityEl) {
        lastCodeActivity = Object.assign({}, lastCodeActivity, { state: "edited" });
        activeCodeActivityEl.innerHTML = renderCodeActivity(lastCodeActivity);
        addThinkingLine(`Writing ${lastCodeActivity.file}`);
        await writeLatestCodeActivity();
        addThinkingLine("Finished");
        addProgressItem(`Finished ${lastCodeActivity.file}`);
        const doneText = settings.appLanguage === "ru"
          ? "\n\n\u042f \u0437\u0430\u043a\u043e\u043d\u0447\u0438\u043b, \u043c\u043e\u0436\u0435\u0448\u044c \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0442\u044c."
          : "\n\nI finished it, you can check it now.";
        if (!fullText.includes(doneText.trim())) fullText += doneText;
      } else {
        addProgressItem("Finished answer");
      }
      return fullText || "(РїСѓСЃС‚РѕР№ РѕС‚РІРµС‚)";
    } catch (err) {
      if (err.name === "AbortError") return "_STOPPED_";
      return `РћС€РёР±РєР°: ${err.message}`;
    } finally {
      abortController = null;
    }
  }

  // ============================================================
  //  SEND
  // ============================================================
  function updateSendBtn() {
    const hasText = inputEl.value.trim().length > 0;
    const hasAttach = attachments.length > 0;
    sendBtn.disabled = (isGenerating || (!hasText && !hasAttach));
  }

  function looksLikeBroadBuildRequest(text) {
    const lower = text.toLowerCase();
    if (lower.includes("\u0442\u0435\u043c\u0430:")) return false;
    const readableBuildWords = [
      "\u043d\u0430\u043f\u0438\u0448\u0438",
      "\u0441\u043e\u0437\u0434\u0430\u0439",
      "\u0441\u0434\u0435\u043b\u0430\u0439",
      "\u043d\u0430\u0440\u0438\u0441\u0443\u0439",
      "interface",
      "\u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441",
      "\u0441\u0430\u0439\u0442",
      "\u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435",
      "app",
      "ui",
      "\u043b\u0435\u043d\u0434\u0438\u043d\u0433"
    ];
    const readableVagueWords = [
      "\u043a\u0440\u0430\u0441\u0438\u0432",
      "\u0441\u043e\u0432\u0440\u0435\u043c\u0435\u043d",
      "\u043d\u043e\u0440\u043c\u0430\u043b\u044c\u043d",
      "\u043b\u044e\u0431\u043e\u0439",
      "\u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441"
    ];
    if (readableBuildWords.some(w => lower.includes(w)) && readableVagueWords.some(w => lower.includes(w))) {
      return true;
    }
    const buildWords = ["\u043d\u0430\u043f\u0438\u0448\u0438", "\u0441\u043e\u0437\u0434\u0430\u0439", "\u0441\u0434\u0435\u043b\u0430\u0439", "interface", "\u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441", "\u0441\u0430\u0439\u0442", "\u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435", "app", "ui", "\u043b\u0435\u043d\u0434\u0438\u043d\u0433"];
    const imageWords = ["\u043d\u0430\u0440\u0438\u0441\u0443\u0439", "\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439 \u0444\u043e\u0442\u043e", "\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439 \u043a\u0430\u0440\u0442\u0438\u043d\u043a\u0443", "draw", "generate image", "generate photo"];
    const vagueWords = ["\u043a\u0440\u0430\u0441\u0438\u0432", "\u0441\u043e\u0432\u0440\u0435\u043c\u0435\u043d", "\u043d\u043e\u0440\u043c\u0430\u043b\u044c\u043d", "\u043b\u044e\u0431\u043e\u0439", "\u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441"];
    if (imageWords.some(w => lower.includes(w))) return false;
    return buildWords.some(w => lower.includes(w)) && vagueWords.some(w => lower.includes(w)) && !lower.includes("\u0442\u0435\u043c\u0430:");
  }

  function inferBuildDetailsFromText(text) {
    const lower = text.toLowerCase();
    const has = (...words) => words.some(word => lower.includes(word));
    return {
      theme: has("dashboard", "\u0434\u0430\u0448\u0431\u043e\u0440\u0434", "\u043f\u0430\u043d\u0435\u043b\u044c") ? "dashboard" :
        has("portfolio", "\u043f\u043e\u0440\u0442\u0444\u043e\u043b\u0438\u043e") ? "portfolio" :
        has("saas", "\u043f\u0440\u043e\u0434\u0443\u043a\u0442") ? "saas" : null,
      palette: has("dark", "\u0442\u0435\u043c\u043d", "\u0442\u0451\u043c\u043d") ? "dark" :
        has("light", "\u0441\u0432\u0435\u0442\u043b") ? "light" : null,
      language: has("react") ? "react" :
        has("html", "\u0445\u0442\u043c\u043b") ? "html/css/js" :
        has("python", "\u043f\u0438\u0442\u043e\u043d", "\u043f\u0430\u0439\u0442\u043e\u043d") ? "python" :
        has("c++", "cpp", "\u0441\u0438++") ? "cpp" : null,
    };
  }

  function positionSetupSheet() {
    if (!setupSheet) return;
    const composer = $("composerInner");
    if (!composer) return;
    const field = composer.querySelector(".composer-field");
    const rect = (field || composer).getBoundingClientRect();
    const desired = window.innerHeight - rect.top - 1;
    const bottom = Math.max(86, Math.min(desired, Math.max(120, window.innerHeight - 260)));
    setupSheet.style.setProperty("--setup-bottom", `${bottom}px`);
    setupSheet.style.setProperty("--setup-width", `${Math.round(rect.width)}px`);
    setupSheet.style.setProperty("--setup-left", `${Math.round(rect.left)}px`);
  }

  function looksLikeImageGenerationRequest(text) {
    const lower = String(text || "").toLowerCase();
    const imageRevisionWords = [
      "\u043f\u0435\u0440\u0435\u0434\u0435\u043b\u0430\u0439 \u043a\u0430\u0440\u0442\u0438\u043d", "\u043f\u0435\u0440\u0435\u0434\u0435\u043b\u0430\u0439 \u0444\u043e\u0442\u043e",
      "\u0443\u043b\u0443\u0447\u0448\u0438 \u043a\u0430\u0440\u0442\u0438\u043d", "\u0443\u043b\u0443\u0447\u0448\u0438 \u0444\u043e\u0442\u043e",
      "redo image", "remake image", "improve image", "edit image"
    ];
    if (imageRevisionWords.some(w => lower.includes(w))) return true;
    const codeOnlyWords = ["\u043a\u043e\u0434", "code", "script", "\u0441\u043a\u0440\u0438\u043f\u0442"];
    const explicitImageWords = ["\u0444\u043e\u0442\u043e", "\u043a\u0430\u0440\u0442\u0438\u043d", "\u0438\u0437\u043e\u0431\u0440\u0430\u0436", "photo", "image", "picture", "drawing"];
    if (codeOnlyWords.some(w => lower.includes(w)) && !explicitImageWords.some(w => lower.includes(w))) return false;
    const generateWords = [
      "\u0441\u0433\u0435\u043d\u0435\u0440", "\u0441\u043e\u0437\u0434\u0430\u0439", "\u0441\u0434\u0435\u043b\u0430\u0439", "\u043d\u0430\u0440\u0438\u0441\u0443\u0439",
      "\u043d\u0430\u0440\u0438\u0441\u043e\u0432\u0430\u0442\u044c", "\u0438\u0437\u043e\u0431\u0440\u0430\u0437\u0438", "\u0444\u043e\u0442\u043e",
      "generate", "create", "draw", "make", "paint", "render"
    ];
    const imageWords = [
      "\u0444\u043e\u0442\u043e", "\u043a\u0430\u0440\u0442\u0438\u043d", "\u0438\u0437\u043e\u0431\u0440\u0430\u0436", "\u0440\u0438\u0441\u0443\u043d", "\u043b\u043e\u0433\u043e",
      "photo", "image", "picture", "drawing", "logo", "poster", "avatar", "wallpaper"
    ];
    const objectWords = [
      "\u0431\u0430\u043d\u0430\u043d", "\u043a\u043e\u0442", "\u043a\u043e\u0442\u0438\u043a", "\u0441\u043e\u0431\u0430\u043a", "\u0434\u043e\u043c", "\u043c\u0430\u0448\u0438\u043d",
      "\u0446\u0432\u0435\u0442\u043e\u043a", "\u043f\u0435\u0439\u0437\u0430\u0436", "\u043f\u043e\u0440\u0442\u0440\u0435\u0442", "\u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436",
      "banana", "cat", "dog", "car", "house", "flower", "landscape", "portrait", "character"
    ];
    const wantsGeneration = generateWords.some(w => lower.includes(w));
    return wantsGeneration && (imageWords.some(w => lower.includes(w)) || objectWords.some(w => lower.includes(w)));
  }

  // Р”РµС‚РµСЂРјРёРЅРёСЂРѕРІР°РЅРЅС‹Р№ РіРµРЅРµСЂР°С‚РѕСЂ РїСЃРµРІРґРѕСЃР»СѓС‡Р°Р№РЅС‹С… С‡РёСЃРµР» РёР· СЃС‚СЂРѕРєРё (seed).
  function seedFromString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  // РР·РІР»РµС‡РµРЅРёРµ РїР°Р»РёС‚СЂС‹ Рё С…Р°СЂР°РєС‚РµСЂР° СЃС†РµРЅС‹ РёР· С‚РµРєСЃС‚Р° Р·Р°РїСЂРѕСЃР°.
  function paletteFromPrompt(text) {
    const lower = String(text || "").toLowerCase();
    const colorMap = {
      "РєСЂР°СЃРЅС‹Р№": [220, 60, 50], "red": [220, 60, 50], "Р°Р»С‹Р№": [200, 30, 40],
      "РѕСЂР°РЅР¶РµРІ": [255, 130, 30], "orange": [255, 130, 30],
      "Р¶С‘Р»С‚": [245, 200, 40], "yellow": [245, 200, 40], "Р¶РµР»С‚": [245, 200, 40],
      "Р·РµР»С‘РЅ": [60, 180, 90], "green": [60, 180, 90], "Р·РµР»РµРЅ": [60, 180, 90],
      "РіРѕР»СѓР±": [80, 190, 230], "cyan": [80, 190, 230], "Р±РёСЂСЋР·": [40, 200, 190],
      "СЃРёРЅ": [50, 110, 230], "blue": [50, 110, 230],
      "С„РёРѕР»РµС‚": [150, 80, 220], "purple": [150, 80, 220], "violet": [150, 80, 220], "Р»РёР»РѕРІ": [170, 100, 210],
      "СЂРѕР·РѕРІ": [240, 120, 170], "pink": [240, 120, 170],
      "Р±РёСЂСЋР·РѕРІ": [40, 200, 190], "teal": [40, 200, 190],
      "Р±РµР»": [240, 240, 245], "white": [240, 240, 245],
      "С‡С‘СЂРЅ": [25, 25, 30], "black": [25, 25, 30], "С‡РµСЂРЅ": [25, 25, 30],
      "РєРѕСЂРёС‡РЅРµРІ": [140, 90, 50], "brown": [140, 90, 50],
      "Р·РѕР»РѕС‚": [230, 190, 80], "gold": [230, 190, 80],
    };
    const found = [];
    for (const key in colorMap) {
      if (lower.includes(key)) found.push(colorMap[key]);
    }
    const palettes = {
      warm:   [[255, 120, 50], [240, 80, 110], [255, 190, 60], [120, 40, 80]],
      cool:   [[60, 130, 220], [80, 200, 220], [120, 90, 200], [40, 60, 120]],
      nature: [[60, 170, 90], [180, 200, 70], [90, 140, 60], [40, 110, 70]],
      sunset: [[255, 90, 60], [255, 160, 60], [180, 60, 120], [70, 40, 100]],
      ocean:  [[30, 90, 160], [40, 180, 200], [20, 50, 110], [180, 230, 240]],
      mono:   [[235, 235, 240], [160, 160, 170], [90, 90, 100], [30, 30, 35]],
      cosmic: [[80, 40, 140], [200, 80, 180], [40, 80, 200], [20, 20, 60]],
    };
    let pick;
    if (lower.includes("Р·Р°РєР°С‚") || lower.includes("sunset") || lower.includes("РІРµС‡РµСЂ")) pick = palettes.sunset;
    else if (lower.includes("РјРѕСЂРµ") || lower.includes("РѕРєРµР°РЅ") || lower.includes("ocean") || lower.includes("РІРѕРґР°")) pick = palettes.ocean;
    else if (lower.includes("РєРѕСЃРјРѕСЃ") || lower.includes("Р·РІРµР·Рґ") || lower.includes("space") || lower.includes("galaxy")) pick = palettes.cosmic;
    else if (lower.includes("Р»РµСЃ") || lower.includes("forest") || lower.includes("РїСЂРёСЂРѕРґ") || lower.includes("nature")) pick = palettes.nature;
    else if (lower.includes("РЅРѕС‡СЊ") || lower.includes("night") || lower.includes("С‡С‘СЂРЅ") || lower.includes("dark")) pick = palettes.mono;
    else pick = palettes.warm;
    return found.length >= 2 ? found.slice(0, 4) : pick;
  }

  // РџСЂРѕС†РµРґСѓСЂРЅР°СЏ РіРµРЅРµСЂР°С†РёСЏ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РЅР° canvas. Р’РѕР·РІСЂР°С‰Р°РµС‚ dataURL (PNG).
  function generateImageFromPrompt(prompt) {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const rnd = seedFromString(prompt || "art");
    const palette = paletteFromPrompt(prompt);

    // Р¤РѕРЅ: РґРёР°РіРѕРЅР°Р»СЊРЅС‹Р№ РјРЅРѕРіРѕС†РІРµС‚РЅС‹Р№ РіСЂР°РґРёРµРЅС‚.
    const grad = ctx.createLinearGradient(0, 0, size, size);
    palette.forEach((c, i) => {
      grad.addColorStop(i / Math.max(1, palette.length - 1), `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // РњСЏРіРєРёРµ СЃРІРµС‚РѕРІС‹Рµ РїСЏС‚РЅР° (СЂР°РґРёР°Р»СЊРЅС‹Рµ РіСЂР°РґРёРµРЅС‚С‹) РґР»СЏ РіР»СѓР±РёРЅС‹.
    for (let i = 0; i < 4; i++) {
      const c = palette[Math.floor(rnd() * palette.length)];
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 80 + rnd() * 220;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.55)`);
      rg.addColorStop(1, `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, size, size);
    }

    const lower = String(prompt || "").toLowerCase();
    const has = (...words) => words.some(word => lower.includes(word));
    const drawSoftShadow = (x, y, w, h, alpha = 0.22) => {
      const g = ctx.createRadialGradient(x, y, 4, x, y, Math.max(w, h) * 0.72);
      g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawLeaf = (x, y, r, rot, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.8, -r * 0.35, r * 0.8, r * 0.55, 0, r);
      ctx.bezierCurveTo(-r * 0.8, r * 0.55, -r * 0.8, -r * 0.35, 0, -r);
      ctx.fill();
      ctx.restore();
    };
    const subject = has("banana", "\u0431\u0430\u043d\u0430\u043d") ? "banana" :
      has("cat", "\u043a\u043e\u0442", "\u043a\u043e\u0442\u0438\u043a") ? "cat" :
      has("dog", "\u0441\u043e\u0431\u0430\u043a", "\u043f\u0451\u0441", "\u043f\u0435\u0441") ? "dog" :
      has("house", "\u0434\u043e\u043c") ? "house" :
      has("car", "\u043c\u0430\u0448\u0438\u043d", "\u0430\u0432\u0442\u043e") ? "car" :
      has("flower", "\u0446\u0432\u0435\u0442\u043e\u043a", "\u0446\u0432\u0435\u0442\u044b") ? "flower" :
      has("portrait", "\u043f\u043e\u0440\u0442\u0440\u0435\u0442", "\u043b\u0438\u0446\u043e") ? "portrait" :
      has("landscape", "\u043f\u0435\u0439\u0437\u0430\u0436", "\u0433\u043e\u0440\u044b", "\u043b\u0435\u0441") ? "landscape" : null;

    if (subject) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.fillRect(0, 0, size, size);
    }

    if (subject === "banana") {
      const bg = ctx.createLinearGradient(0, 0, size, size);
      bg.addColorStop(0, "#fff4d6");
      bg.addColorStop(0.48, "#ff9a62");
      bg.addColorStop(1, "#6d3245");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      const glow = ctx.createRadialGradient(384, 170, 20, 384, 170, 280);
      glow.addColorStop(0, "rgba(255, 236, 132, 0.72)");
      glow.addColorStop(1, "rgba(255, 236, 132, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      drawSoftShadow(size * 0.52, size * 0.74, 178, 34, 0.22);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(92, 316);
      ctx.bezierCurveTo(172, 426, 383, 399, 461, 172);
      ctx.bezierCurveTo(382, 284, 228, 339, 116, 250);
      ctx.closePath();
      ctx.fillStyle = "#ffd84d";
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#9f6420";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(137, 288);
      ctx.bezierCurveTo(232, 355, 371, 304, 430, 202);
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = 13;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(125, 318);
      ctx.bezierCurveTo(224, 382, 370, 343, 439, 203);
      ctx.strokeStyle = "rgba(96, 58, 17, 0.34)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = "#5b3318";
      ctx.beginPath(); ctx.ellipse(93, 316, 22, 14, -0.45, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(461, 172, 22, 12, -0.78, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(125, 80, 20, 0.36)";
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(168 + i * 22, 304 - Math.sin(i * 0.82) * 30, 2.1 + rnd() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (subject === "cat" || subject === "dog") {
      const fur = subject === "cat" ? "#f2b36b" : "#b98252";
      drawSoftShadow(260, 380, 130, 34, 0.2);
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(260, 300, 108, 92, 0, 0, Math.PI * 2);
      ctx.fill();
      if (subject === "cat") {
        ctx.beginPath();
        ctx.moveTo(180, 245); ctx.lineTo(210, 160); ctx.lineTo(246, 235);
        ctx.moveTo(274, 235); ctx.lineTo(312, 160); ctx.lineTo(340, 245);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(170, 285, 34, 66, -0.35, 0, Math.PI * 2);
        ctx.ellipse(350, 285, 34, 66, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#151515";
      ctx.beginPath(); ctx.arc(224, 286, 8, 0, Math.PI * 2); ctx.arc(296, 286, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = subject === "cat" ? "#ed7d60" : "#3b2118";
      ctx.beginPath(); ctx.arc(260, 315, subject === "cat" ? 7 : 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#4f2d21";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(260, 322); ctx.quadraticCurveTo(244, 338, 226, 328);
      ctx.moveTo(260, 322); ctx.quadraticCurveTo(276, 338, 294, 328);
      ctx.stroke();
    } else if (subject === "house") {
      drawSoftShadow(258, 392, 150, 35, 0.18);
      ctx.fillStyle = "#f0d4ad"; ctx.fillRect(150, 250, 220, 150);
      ctx.fillStyle = "#be4b34";
      ctx.beginPath(); ctx.moveTo(126, 258); ctx.lineTo(260, 150); ctx.lineTo(396, 258); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#5d3627"; ctx.fillRect(238, 322, 48, 78);
      ctx.fillStyle = "#74bde8"; ctx.fillRect(176, 285, 48, 42); ctx.fillRect(300, 285, 48, 42);
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 5; ctx.strokeRect(150, 250, 220, 150);
    } else if (subject === "car") {
      drawSoftShadow(260, 372, 165, 28, 0.22);
      ctx.fillStyle = "#ff6a3d";
      ctx.beginPath(); ctx.roundRect(110, 270, 300, 82, 24); ctx.fill();
      ctx.beginPath(); ctx.moveTo(176, 270); ctx.lineTo(220, 215); ctx.lineTo(312, 215); ctx.lineTo(356, 270); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#bde8ff"; ctx.fillRect(218, 228, 78, 38);
      ctx.fillStyle = "#181818"; ctx.beginPath(); ctx.arc(180, 354, 32, 0, Math.PI * 2); ctx.arc(340, 354, 32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f6f6f6"; ctx.beginPath(); ctx.arc(180, 354, 13, 0, Math.PI * 2); ctx.arc(340, 354, 13, 0, Math.PI * 2); ctx.fill();
    } else if (subject === "flower") {
      ctx.strokeStyle = "#2f8f55"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(260, 410); ctx.bezierCurveTo(250, 340, 270, 285, 260, 230); ctx.stroke();
      drawLeaf(226, 334, 34, -0.9, "#4caf68");
      drawLeaf(296, 315, 34, 0.85, "#4caf68");
      const petals = ["#ff6f91", "#ff9671", "#ffc75f", "#f9f871", "#d65db1"];
      for (let i = 0; i < 10; i++) drawLeaf(260, 220, 56, (Math.PI * 2 * i) / 10, petals[i % petals.length]);
      ctx.fillStyle = "#6a3b18"; ctx.beginPath(); ctx.arc(260, 220, 34, 0, Math.PI * 2); ctx.fill();
    } else if (subject === "landscape") {
      const sky = ctx.createLinearGradient(0, 0, 0, size);
      sky.addColorStop(0, "#8fd3ff"); sky.addColorStop(0.6, "#fff0b8"); sky.addColorStop(1, "#5fab6a");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#f9cf5a"; ctx.beginPath(); ctx.arc(390, 110, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#506a7c"; ctx.beginPath(); ctx.moveTo(0, 330); ctx.lineTo(150, 160); ctx.lineTo(292, 330); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#394d5b"; ctx.beginPath(); ctx.moveTo(180, 330); ctx.lineTo(330, 140); ctx.lineTo(512, 330); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f5f7fa"; ctx.beginPath(); ctx.moveTo(330, 140); ctx.lineTo(296, 184); ctx.lineTo(358, 184); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#4f9e5d"; ctx.fillRect(0, 330, size, 182);
    } else if (subject === "portrait") {
      drawSoftShadow(260, 382, 116, 28, 0.18);
      ctx.fillStyle = "#f2c7a0"; ctx.beginPath(); ctx.ellipse(260, 235, 82, 98, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3c2419"; ctx.beginPath(); ctx.ellipse(260, 182, 88, 46, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#151515"; ctx.beginPath(); ctx.arc(230, 236, 7, 0, Math.PI * 2); ctx.arc(290, 236, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#a3514b"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(260, 275, 28, 0.15, Math.PI - 0.15); ctx.stroke();
      ctx.fillStyle = "#3f5f90"; ctx.beginPath(); ctx.roundRect(160, 344, 200, 92, 28); ctx.fill();
    }

    // Р“РµРѕРјРµС‚СЂРёС‡РµСЃРєРёРµ С„РѕСЂРјС‹, РµСЃР»Рё Р·Р°РїСЂРѕСЃ РїСЂРѕ Р°Р±СЃС‚СЂР°РєС†РёСЋ/РіРµРѕРјРµС‚СЂРёСЋ/Р»РѕРіРѕС‚РёРї.
    if (!subject && (lower.includes("РіРµРѕРјРµС‚СЂ") || lower.includes("abstract") || lower.includes("Р»РѕРіРѕС‚РёРї") || lower.includes("logo") || lower.includes("РїР°С‚С‚РµСЂРЅ"))) {
      const shapes = 10 + Math.floor(rnd() * 14);
      for (let i = 0; i < shapes; i++) {
        const c = palette[Math.floor(rnd() * palette.length)];
        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.3 + rnd() * 0.5})`;
        const x = rnd() * size;
        const y = rnd() * size;
        const w = 40 + rnd() * 160;
        const h = 40 + rnd() * 160;
        const kind = Math.floor(rnd() * 3);
        if (kind === 0) {
          ctx.beginPath();
          ctx.arc(x, y, w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 1) {
          ctx.fillRect(x - w / 2, y - h / 2, w, h);
        } else {
          ctx.beginPath();
          ctx.moveTo(x, y - h / 2);
          ctx.lineTo(x + w / 2, y + h / 2);
          ctx.lineTo(x - w / 2, y + h / 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Р—РІС‘Р·РґС‹/С‚РѕС‡РєРё РґР»СЏ РєРѕСЃРјРёС‡РµСЃРєРёС…/РЅРѕС‡РЅС‹С… СЃС†РµРЅ.
    if (lower.includes("РєРѕСЃРјРѕСЃ") || lower.includes("Р·РІРµР·Рґ") || lower.includes("space") || lower.includes("star") || lower.includes("РЅРѕС‡СЊ") || lower.includes("night")) {
      const stars = 120 + Math.floor(rnd() * 180);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      for (let i = 0; i < stars; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const r = rnd() * 1.8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Р’РѕР»РЅС‹/Р»РёРЅРёРё РґР»СЏ РїРµР№Р·Р°Р¶РµР№ Рё РІРѕРґС‹.
    if (lower.includes("РјРѕСЂРµ") || lower.includes("РѕРєРµР°РЅ") || lower.includes("ocean") || lower.includes("РІРѕР»РЅР°") || lower.includes("water") || lower.includes("РїРµР№Р·Р°Р¶") || lower.includes("landscape")) {
      for (let i = 0; i < 6; i++) {
        const c = palette[Math.floor(rnd() * palette.length)];
        ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.5)`;
        ctx.lineWidth = 2 + rnd() * 6;
        ctx.beginPath();
        const baseY = size * 0.45 + i * (size * 0.09);
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= size; x += 16) {
          ctx.lineTo(x, baseY + Math.sin((x / size) * Math.PI * 4 + i) * (18 + rnd() * 24));
        }
        ctx.stroke();
      }
    }

    // РЎРёР»СѓСЌС‚ РєСЂСѓРіР° (СЃРѕР»РЅС†Рµ/Р»СѓРЅР°) РґР»СЏ Р·Р°РєР°С‚РѕРІ/РЅРѕС‡Рё.
    if (lower.includes("Р·Р°РєР°С‚") || lower.includes("sunset") || lower.includes("СЃРѕР»РЅС†") || lower.includes("sun") || lower.includes("Р»СѓРЅР°") || lower.includes("moon") || lower.includes("РЅРѕС‡СЊ") || lower.includes("night")) {
      const c = palette[0];
      ctx.fillStyle = `rgba(${Math.min(255, c[0] + 40)}, ${Math.min(255, c[1] + 40)}, ${Math.min(255, c[2] + 40)}, 0.9)`;
      ctx.beginPath();
      ctx.arc(size * (0.3 + rnd() * 0.4), size * 0.32, 50 + rnd() * 30, 0, Math.PI * 2);
      ctx.fill();
    }

    // Р›С‘РіРєР°СЏ Р·РµСЂРЅРёСЃС‚РѕСЃС‚СЊ РґР»СЏ С‚РµРєСЃС‚СѓСЂС‹.
    const img = ctx.getImageData(0, 0, size, size);
    const data = img.data;
    const noisePower = subject ? 5 : 18;
    for (let i = 0; i < data.length; i += 4) {
      const n = (rnd() - 0.5) * noisePower;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);

    return canvas.toDataURL("image/png");
  }

  function buildOnlineImagePrompt(prompt) {
    const raw = String(prompt || "").trim();
    const lower = raw.toLowerCase();
    const has = (...words) => words.some(word => lower.includes(word));
    let subject = raw || "simple object";
    if (has("\u0431\u0430\u043d\u0430\u043d", "banana")) {
      subject = "one single ripe yellow banana, curved whole banana, clearly recognizable banana, centered, isolated subject, not sliced, not mango, not corn, not salad, not dessert";
    } else if (has("\u043a\u043e\u0442", "\u043a\u043e\u0442\u0438\u043a", "cat", "kitten")) {
      subject = "one cute domestic cat, clearly recognizable cat, full body or portrait, soft fur, natural anatomy, not a rabbit, not a toy";
    } else if (has("\u0441\u043e\u0431\u0430\u043a", "\u043f\u0435\u0441", "\u043f\u0451\u0441", "dog", "puppy")) {
      subject = "one friendly dog, clearly recognizable dog, natural anatomy, soft fur";
    } else if (has("\u0434\u043e\u043c", "house")) {
      subject = "one cozy house, clear architecture, front view";
    } else if (has("\u043c\u0430\u0448\u0438\u043d", "\u0430\u0432\u0442\u043e", "car")) {
      subject = "one modern car, clearly recognizable vehicle, three quarter view";
    } else if (has("\u0446\u0432\u0435\u0442\u043e\u043a", "\u0446\u0432\u0435\u0442\u044b", "flower")) {
      subject = "one beautiful flower, detailed petals, centered composition";
    }
    return `${subject}, high quality, clean composition, centered subject, sharp focus, pleasant lighting, detailed, no text, no watermark`;
  }

  function preloadImage(src, timeoutMs = 45000) {
    return new Promise(resolve => {
      const img = new Image();
      let settled = false;
      const finish = ok => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      img.onload = () => {
        clearTimeout(timer);
        finish(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        finish(false);
      };
      img.src = src;
    });
  }

  async function renderImageGenerationPlaceholder(prompt) {
    // РљР°СЂС‚РѕС‡РєР°-Р·Р°РіСЂСѓР·РєР° СЃ РїСѓР»СЊСЃРёСЂСѓСЋС‰РёРјРё С‚РѕС‡РєР°РјРё.
    const msgEl = createMessageElement({ role: "assistant", content: "" });
    const body = msgEl.querySelector(".message-body");
    const card = document.createElement("div");
    card.className = "image-gen-card";
    card.innerHTML = `
      <div class="image-gen-title">${escapeHtml(t("imageCardTitle"))}</div>
      <div class="image-gen-stage"></div>
      <div class="image-gen-dots" aria-hidden="true">${Array.from({ length: 364 }).map((_, i) => `<span style="--i:${i}"></span>`).join("")}</div>
    `;
    const stageEl = card.querySelector(".image-gen-stage");
    const stages = [t("drawBase"), t("drawDetails"), t("drawAlmost"), t("drawFinal")];
    let stageIdx = 0;
    stageEl.textContent = stages[0];
    const stageTimer = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1);
      stageEl.textContent = stages[stageIdx];
    }, 450);
    const textEl = msgEl.querySelector(".message-text");
    if (textEl) textEl.style.display = "none";
    if (body) body.appendChild(card);
    messagesEl.appendChild(msgEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Р”Р°С‘Рј Р°РЅРёРјР°С†РёРё В«РїСЂРѕРёРіСЂР°С‚СЊСЃСЏВ» 1.8СЃ РїРµСЂРµРґ РїРѕРєР°Р·РѕРј СЂРµР·СѓР»СЊС‚Р°С‚Р°.
    const onlinePrompt = buildOnlineImagePrompt(prompt);
    const encodedPrompt = encodeURIComponent(onlinePrompt);
    const onlineUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&nologo=true&enhance=true&model=flux&seed=${Math.abs(seedFromString(prompt || "nevo")() * 1000000000) | 0}`;
    const fallbackDataUrl = generateImageFromPrompt(prompt);
    const loaded = await preloadImage(onlineUrl);
    clearInterval(stageTimer);
    const dataUrl = loaded ? onlineUrl : fallbackDataUrl;
    card.remove();

    if (textEl) {
      textEl.style.display = "";
      textEl.innerHTML = renderMarkdown(`**${t("imagePrompt")}:** ${prompt}`);
    }
    // Р”РѕР±Р°РІР»СЏРµРј СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РІ С‚РµР»Рѕ СЃРѕРѕР±С‰РµРЅРёСЏ.
    const att = document.createElement("div");
    att.className = "message-attachments";
    const img = document.createElement("img");
    img.className = "chat-image";
    img.src = dataUrl;
    img.addEventListener("click", () => window.open(dataUrl));
    att.appendChild(img);
    body.appendChild(att);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return dataUrl;
  }

  function positionAnchoredSheet(el) {
    if (!el) return;
    const composer = $("composerInner");
    if (!composer) return;
    const field = composer.querySelector(".composer-field");
    const rect = (field || composer).getBoundingClientRect();
    const desired = window.innerHeight - rect.top - 1;
    const bottom = Math.max(86, Math.min(desired, Math.max(120, window.innerHeight - 260)));
    el.style.setProperty("--setup-bottom", `${bottom}px`);
    el.style.setProperty("--setup-width", `${Math.round(rect.width)}px`);
    el.style.setProperty("--setup-left", `${Math.round(rect.left)}px`);
  }

  function askSetupStep(question, options) {
    if (!setupSheet || !setupQuestion || !setupOptions) return Promise.resolve(null);
    positionSetupSheet();
    setupQuestion.textContent = question;
    setupOptions.innerHTML = "";
    setupSheet.classList.add("show");
    setupSheet.setAttribute("aria-hidden", "false");

    return new Promise(resolve => {
      options.forEach(option => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `setup-option ${option.kind || ""}`;
        btn.textContent = option.label;
        btn.addEventListener("click", () => {
          if (option.kind === "custom") {
            const existing = setupOptions.querySelector(".setup-custom-row");
            if (existing) {
              existing.querySelector("input")?.focus();
              return;
            }
            const row = document.createElement("div");
            row.className = "setup-custom-row";
            row.innerHTML = `
              <input class="setup-custom-input" type="text" placeholder="${escapeHtml(t("setupCustomPlaceholder"))}">
              <button class="setup-custom-submit" type="button">${escapeHtml(t("setupUse"))}</button>
            `;
            const input = row.querySelector("input");
            const submit = row.querySelector("button");
            const finish = () => {
              const value = input.value.trim();
              if (!value) return;
              setupSheet.classList.remove("show");
              setupSheet.setAttribute("aria-hidden", "true");
              resolve(value);
            };
            submit.addEventListener("click", finish);
            input.addEventListener("keydown", e => {
              if (e.key === "Enter") {
                e.preventDefault();
                finish();
              }
            });
            setupOptions.appendChild(row);
            input.focus();
            return;
          }
          setupSheet.classList.remove("show");
          setupSheet.setAttribute("aria-hidden", "true");
          resolve(option.value);
        });
        setupOptions.appendChild(btn);
      });
    });
  }

  async function collectBuildDetails(text) {
    if (!looksLikeBroadBuildRequest(text)) return text;
    const inferred = inferBuildDetailsFromText(text);
    const theme = inferred.theme || await askSetupStep(t("setupInterfaceQuestion"), [
      { label: t("setupDashboard"), value: "dashboard" },
      { label: t("setupPortfolio"), value: "portfolio" },
      { label: t("setupSaas"), value: "saas" },
      { label: t("setupCustom"), value: "custom", kind: "custom" },
    ]);
    const palette = inferred.palette || await askSetupStep(t("setupVisualQuestion"), [
      { label: t("setupDark"), value: "dark" },
      { label: t("setupLight"), value: "light" },
      { label: t("setupMixed"), value: "mixed" },
      { label: t("setupCustom"), value: "custom", kind: "custom" },
    ]);
    const language = inferred.language || await askSetupStep(t("setupStackQuestion"), [
      { label: "HTML + CSS + JS", value: "html/css/js" },
      { label: "React", value: "react" },
      { label: "Python", value: "python" },
      { label: "C++", value: "cpp" },
    ]);
    return `${text}\n\n${t("interfaceParameters")}:\n- ${t("interfaceType")}: ${theme}\n- ${t("visualMode")}: ${palette}\n- ${t("stack")}: ${language}`;
  }

  function imagePromptFromChatFallback(currentText) {
    const text = String(currentText || "").trim();
    const lower = text.toLowerCase();
    const vague = [
      "\u043f\u0435\u0440\u0435\u0434\u0435\u043b\u0430\u0439", "\u0443\u043b\u0443\u0447\u0448\u0438", "\u0435\u0449\u0435 \u0440\u0430\u0437", "\u0434\u0440\u0443\u0433\u0443\u044e",
      "redo", "remake", "improve", "again", "another"
    ].some(word => lower.includes(word));
    if (!vague) return text;
    const chat = getCurrentChat();
    const previous = (chat?.messages || []).slice().reverse().find(msg => msg.role === "assistant" && msg.images?.length && msg.content);
    const match = String(previous?.content || "").match(/(?:Prompt|\u0417\u0430\u043f\u0440\u043e\u0441)\*\*:\s*(.+)$/i);
    const prompt = match ? match[1].trim() : "";
    return prompt ? `${prompt}. ${text}` : text;
  }

  async function sendMessage() {
    const displayText = inputEl.value.trim();
    let text = displayText;
    const imgs = attachments.filter(a => a.kind === "image").map(a => a.base64);
    if ((!text && attachments.length === 0) || isGenerating) return;
    const wantsImageGeneration = looksLikeImageGenerationRequest(text);
    if (!wantsImageGeneration) {
      text = await collectBuildDetails(text);
    }
    resetProgress();
    if (!currentChatId) createNewChat();
    activeCodeActivityEl = null;
    lastCodeActivity = null;
    currentCodeProjectFolderName = null;

    const chat = getCurrentChat();
    const userMsg = {
      role: "user",
      content: displayText || "",
      images: attachments.filter(a => a.kind === "image").map(a => a.dataUrl)
    };
    chat.messages.push(userMsg);
    if (!chat.title) chat.title = (displayText || "\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435").slice(0, 40);
    chat.updatedAt = Date.now();

    // Clear composer
    inputEl.value = "";
    autoResize();
    attachments = [];
    renderAttachments();

    // UI
    welcomeEl.style.display = "none";
    renderMessages();
    updateSendBtn();

    if (wantsImageGeneration) {
      sendBtn.style.display = "none";
      stopBtn.style.display = "flex";
      isGenerating = true;
      updateHomeMode();
      const imagePrompt = imagePromptFromChatFallback(displayText || text);
      showThinkingMessage("image", imagePrompt);
      addThinkingLine(t("drawUnderstanding"));
      setTimeout(() => addThinkingLine(t("drawPreparing")), 250);
      setTimeout(() => addThinkingLine(t("drawDetails")), 650);
      await new Promise(resolve => setTimeout(resolve, 1200));
      removeThinkingMessage();
      const imageDataUrl = await renderImageGenerationPlaceholder(imagePrompt);
      chat.messages.push({
        role: "assistant",
        content: `**${t("imagePrompt")}:** ${imagePrompt}`,
        images: [imageDataUrl]
      });
      chat.updatedAt = Date.now();
      isGenerating = false;
      updateHomeMode();
      stopBtn.style.display = "none";
      sendBtn.style.display = "flex";
      updateSendBtn();
      renderSidebar();
      persist();
      return;
    }

    sendBtn.style.display = "none";
    stopBtn.style.display = "flex";
    isGenerating = true;
    updateHomeMode();
    showThinkingMessage("answer", text);

    const reply = await generateResponse(text, imgs);

    removeThinkingMessage();
    isGenerating = false;
    updateHomeMode();
    stopBtn.style.display = "none";
    sendBtn.style.display = "flex";

    if (reply !== "_STOPPED_") {
      const assistantMsg = { role: "assistant", content: reply };
      if (lastCodeActivity) {
        assistantMsg.codeActivity = Object.assign({}, lastCodeActivity, { state: "edited" });
      }
      chat.messages.push(assistantMsg);
      chat.updatedAt = Date.now();
    }
    renderMessages();
    updateSendBtn();
    renderSidebar();
    persist();
  }

  stopBtn.addEventListener("click", () => { if (abortController) abortController.abort(); });

  // input
  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + "px";
  }
  inputEl.addEventListener("input", () => { autoResize(); updateSendBtn(); });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn.addEventListener("click", sendMessage);

  // quick actions
  document.querySelectorAll(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      inputEl.value = btn.dataset.prompt;
      autoResize();
      updateSendBtn();
      sendMessage();
    });
  });

  // ============================================================
  //  CHATS & GROUPS (sidebar)
  // ============================================================
  function createNewChat() {
    const chat = {
      id: "c" + Date.now(),
      groupId: null,
      title: "",
      messages: [],
      model: settings.selectedModel,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    data.chats.unshift(chat);
    currentChatId = chat.id;
    if (welcomeTitle) welcomeTitle.textContent = "";
    renderSidebar();
    renderMessages();
    persist();
    inputEl.focus();
  }
  $("newChatBtn").addEventListener("click", createNewChat);

  function deleteChat(id) {
    data.chats = data.chats.filter(c => c.id !== id);
    if (currentChatId === id) {
      currentChatId = data.chats.length ? data.chats[0].id : null;
      renderMessages();
    }
    renderSidebar();
    persist();
  }

  function moveToGroup(chatId, groupId) {
    const c = data.chats.find(c => c.id === chatId);
    if (c) { c.groupId = groupId; c.updatedAt = Date.now(); }
    renderSidebar();
    persist();
  }

  // --- РјРѕРґР°Р»РєР° РіСЂСѓРїРїС‹ ---
  let editingGroupId = null;
  function openGroupModal(editId = null) {
    editingGroupId = editId;
    $("groupModalTitle").textContent = editId ? "РџРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ РїР°РїРєСѓ" : "РќРѕРІР°СЏ РїР°РїРєР°";
    $("groupInput").value = editId ? (data.groups.find(g => g.id === editId) || {}).name || "" : "";
    $("groupModal").classList.add("show");
    setTimeout(() => $("groupInput").focus(), 50);
  }
  function closeGroupModal() { $("groupModal").classList.remove("show"); }
  const newGroupBtn = $("newGroupBtn");
  if (newGroupBtn) newGroupBtn.addEventListener("click", () => openGroupModal());
  $("closeGroupBtn").addEventListener("click", closeGroupModal);
  $("groupModal").addEventListener("click", e => { if (e.target === $("groupModal")) closeGroupModal(); });
  $("saveGroupBtn").addEventListener("click", async () => {
    const name = $("groupInput").value.trim();
    if (!name) return;
    if (editingGroupId) {
      const g = data.groups.find(g => g.id === editingGroupId);
      if (g) {
        if (window.api && window.api.renameProjectFolder) {
          const folder = await window.api.renameProjectFolder(g.folderName || g.name, name);
          if (folder.ok) g.folderName = folder.folderName;
          else alert("РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ РїР°РїРєСѓ РїСЂРѕРµРєС‚Р°: " + (folder.error || "РЅРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°"));
        }
        g.name = name;
      }
    } else {
      let folderName = name;
      if (window.api && window.api.ensureProjectFolder) {
        const folder = await window.api.ensureProjectFolder(name);
        if (folder.ok) folderName = folder.folderName;
        else alert("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїР°РїРєСѓ РїСЂРѕРµРєС‚Р°: " + (folder.error || "РЅРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°"));
      }
      data.groups.push({ id: "g" + Date.now(), name, folderName, collapsed: false });
    }
    closeGroupModal();
    renderSidebar();
    persist();
  });
  $("groupInput").addEventListener("keydown", e => { if (e.key === "Enter") $("saveGroupBtn").click(); });

  function deleteGroup(id) {
    if (!confirm("РЈРґР°Р»РёС‚СЊ РїР°РїРєСѓ? Р§Р°С‚С‹ РІРЅСѓС‚СЂРё РѕСЃС‚Р°РЅСѓС‚СЃСЏ (РїРµСЂРµР№РґСѓС‚ РІ РѕР±С‰РёР№ СЃРїРёСЃРѕРє).")) return;
    data.groups = data.groups.filter(g => g.id !== id);
    data.chats.forEach(c => { if (c.groupId === id) c.groupId = null; });
    renderSidebar();
    persist();
  }

  function updateSidebarMiniScroll() {
    if (!sidebarScroll || !sidebarMiniScroll || !sidebarMiniThumb || appEl?.classList.contains("tab-collapsed")) return;

    const total = Math.round(sidebarScroll.scrollHeight);
    const view = Math.round(sidebarScroll.clientHeight);
    const maxScroll = Math.max(0, total - view);
    const visible = maxScroll > 0;
    sidebarMiniScroll.classList.toggle("visible", visible);
    if (!visible) return;

    const trackHeight = Math.round(sidebarMiniScroll.clientHeight);
    const thumbHeight = Math.max(38, Math.round((view / total) * trackHeight));
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = Math.round((sidebarScroll.scrollTop / maxScroll) * maxThumbTop);

    sidebarMiniThumb.style.height = `${thumbHeight}px`;
    sidebarMiniThumb.style.transform = `translateY(${thumbTop}px)`;
  }

  function renderSidebar() {
    chatHistoryList.innerHTML = "";

    // С‡Р°С‚С‹ Р±РµР· РіСЂСѓРїРїС‹
    const ungrouped = data.chats.filter(c => !c.groupId);
    ungrouped.forEach(c => chatHistoryList.appendChild(buildChatItem(c)));

    // РіСЂСѓРїРїС‹
    data.groups.forEach(g => {
      const groupChats = data.chats.filter(c => c.groupId === g.id);
      const wrap = document.createElement("div");
      wrap.className = "chat-group";

      const header = document.createElement("div");
      header.className = "chat-group-header";
      header.innerHTML = `
        <span class="chat-group-chevron ${g.collapsed ? "" : "open"}">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
        </span>
        <span class="chat-group-name">${escapeHtml(g.name)}</span>
        <span class="chat-group-actions">
          <button class="chat-group-action" title="РџРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ" data-act="rename">
            <svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="chat-group-action" title="РЈРґР°Р»РёС‚СЊ" data-act="delete">
            <svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </span>
      `;
      header.addEventListener("click", (e) => {
        if (e.target.closest("[data-act]")) return;
        g.collapsed = !g.collapsed;
        renderSidebar();
        persist();
      });
      const renameGroupBtn = header.querySelector('[data-act="rename"]');
      const deleteGroupBtn = header.querySelector('[data-act="delete"]');
      setTooltip(renameGroupBtn, "Rename project");
      setTooltip(deleteGroupBtn, "Delete project");
      renameGroupBtn.addEventListener("click", (e) => { e.stopPropagation(); openGroupModal(g.id); });
      deleteGroupBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteGroup(g.id); });

      const body = document.createElement("div");
      body.className = "chat-group-body" + (g.collapsed ? " collapsed" : "");
      groupChats.forEach(c => body.appendChild(buildChatItem(c)));

      wrap.appendChild(header);
      wrap.appendChild(body);
      chatHistoryList.appendChild(wrap);
    });

    if (data.chats.length === 0) {
      const hint = document.createElement("div");
      hint.className = "history-drop-hint";
      hint.textContent = t("emptyRecent");
      chatHistoryList.appendChild(hint);
    }
    requestAnimationFrame(updateSidebarMiniScroll);
  }

  function buildChatItem(c) {
    const item = document.createElement("div");
    item.className = "history-item" + (c.id === currentChatId ? " active" : "");
    item.draggable = true;

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = c.title || "РќРѕРІС‹Р№ С‡Р°С‚";
    item.appendChild(title);

    // РјРµРЅСЋ "РїРµСЂРµРјРµСЃС‚РёС‚СЊ"
    const moveBtn = document.createElement("button");
    moveBtn.className = "history-item-del";
    setTooltip(moveBtn, "Move to project");
    moveBtn.title = "Р’ РїР°РїРєСѓ";
    moveBtn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
    moveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showMoveMenu(c.id, moveBtn);
    });
    item.appendChild(moveBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "history-item-del";
    setTooltip(delBtn, "Delete chat");
    delBtn.title = "РЈРґР°Р»РёС‚СЊ";
    delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
    delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteChat(c.id); });
    item.appendChild(delBtn);

    item.addEventListener("click", () => loadChat(c.id));

    // drag&drop
    item.addEventListener("dragstart", () => { item.dataset.drag = c.id; });
    return item;
  }

  function showMoveMenu(chatId, anchor) {
    // РїСЂРѕСЃС‚РѕР№ prompt-СЃРїРёСЃРѕРє РіСЂСѓРїРї
    const options = ["(Р±РµР· РіСЂСѓРїРїС‹)", ...data.groups.map(g => g.name)];
    const choice = prompt("Р’С‹Р±РµСЂРёС‚Рµ РїР°РїРєСѓ:\n" + options.map((o, i) => `${i}: ${o}`).join("\n"), "0");
    if (choice === null) return;
    const idx = parseInt(choice);
    if (isNaN(idx)) return;
    if (idx === 0) moveToGroup(chatId, null);
    else moveToGroup(chatId, data.groups[idx - 1].id);
  }

  function loadChat(id) {
    currentChatId = id;
    const c = getCurrentChat();
    if (c && c.model && c.model !== settings.selectedModel) {
      // РїРѕРґРіСЂСѓР¶Р°РµРј РјРѕРґРµР»СЊ С‡Р°С‚Р°
      settings.selectedModel = c.model;
      modelLabel.textContent = c.model;
    }
    renderMessages();
    renderSidebar();
    inputEl.focus();
  }

  // drop С‡Р°С‚Р° РЅР° РіСЂСѓРїРїСѓ
  chatHistoryList.addEventListener("dragover", e => e.preventDefault());
  chatHistoryList.addEventListener("drop", e => {
    e.preventDefault();
    const header = e.target.closest(".chat-group-header");
    if (header) {
      const dragging = chatHistoryList.querySelector('[data-drag]');
      if (dragging) {
        const groupName = header.querySelector(".chat-group-name").textContent;
        const g = data.groups.find(g => g.name === groupName);
        if (g) moveToGroup(dragging.dataset.drag, g.id);
        delete dragging.dataset.drag;
      }
    }
  });

  // ============================================================
  //  MODELS MODAL
  // ============================================================
  function openModelsModal() {
    $("modelsModal").classList.add("show");
    if (modelsSearch) {
      modelsSearch.value = "";
      setTimeout(() => modelsSearch.focus(), 30);
    }
    renderModelsCatalog(modelsSearch ? modelsSearch.value : "");
  }
  function closeModelsModal() { $("modelsModal").classList.remove("show"); }
  $("closeModelsBtn").addEventListener("click", closeModelsModal);
  $("modelsModal").addEventListener("click", e => { if (e.target === $("modelsModal")) closeModelsModal(); });

  if (modelsSearch) {
    modelsSearch.addEventListener("input", () => renderModelsCatalog(modelsSearch.value));
  }

  function modelFamilyName(model) {
    const name = model.name.toLowerCase();
    if (name.startsWith("llama") || name.includes("codellama")) return "Llama";
    if (name.startsWith("qwen")) return "Qwen";
    if (name.startsWith("gemma")) return "Gemma";
    if (name.startsWith("gpt-oss")) return "GPT-OSS";
    if (name.startsWith("deepseek")) return "DeepSeek";
    if (name.startsWith("mistral")) return "Mistral";
    if (name.startsWith("phi")) return "Phi";
    if (name.startsWith("llava")) return "LLaVA";
    if (name.startsWith("starcoder")) return "StarCoder";
    if (name.startsWith("tinyllama")) return "TinyLlama";
    if (name.startsWith("smollm")) return "SmolLM";
    if (name.startsWith("moondream")) return "Moondream";
    return model.category || "Other";
  }

  function renderModelsCatalog(filter) {
    const body = $("modelsModalBody");
    body.innerHTML = "";

    if (!ollamaRunning) {
      const warn = document.createElement("div");
      warn.className = "model-empty";
      warn.innerHTML = `${statusDot.classList.contains("loading") ? "Ollama СѓСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РёР»Рё Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ." : "Ollama Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё."}<br><small>РџРѕРґРѕР¶РґРёС‚Рµ РЅРµСЃРєРѕР»СЊРєРѕ СЃРµРєСѓРЅРґ Рё РѕС‚РєСЂРѕР№С‚Рµ РєР°С‚Р°Р»РѕРі СЃРЅРѕРІР°.</small>`;
      body.appendChild(warn);
      return;
    }

    const installedNames = availableModels.map(m => m.name);
    const lower = (filter || "").toLowerCase();
    const allModels = [...MODEL_CATALOG];
    availableModels
      .filter(m => !MODEL_CATALOG.find(c => c.name === m.name))
      .forEach(m => allModels.push({
        name: m.name,
        desc: "Installed locally",
        size: formatSize(m.size),
        category: "Installed"
      }));

    const families = {};
    allModels.forEach(model => {
      const family = modelFamilyName(model);
      const matches = !lower ||
        family.toLowerCase().includes(lower) ||
        model.name.toLowerCase().includes(lower) ||
        String(model.desc || "").toLowerCase().includes(lower) ||
        String(model.category || "").toLowerCase().includes(lower);
      if (!matches) return;
      if (!families[family]) families[family] = [];
      families[family].push(model);
    });

    const familyNames = Object.keys(families).sort((a, b) => a.localeCompare(b));
    familyNames.forEach(family => {
      const models = families[family].sort((a, b) => a.name.localeCompare(b.name));
      const installedCount = models.filter(m => installedNames.includes(m.name)).length;
      const hasPulling = models.some(m => pullingModels[m.name] !== undefined);
      const isOpen = lower || expandedModelFamilies.has(family);

      const section = document.createElement("section");
      section.className = `model-family ${isOpen ? "open" : ""}`;
      const head = document.createElement("button");
      head.type = "button";
      head.className = "model-family-head";
      const familyMeta = `${models.length} versions${installedCount ? ` - ${installedCount} installed` : ""}${hasPulling ? " - downloading" : ""}`;
      head.innerHTML = `
        <span class="model-family-icon">${providerIconMarkup(models[0])}</span>
        <span class="model-family-main">
          <strong>${escapeHtml(family)}</strong>
          <small>${escapeHtml(familyMeta)}</small>
        </span>
        <span class="model-family-chevron">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      `;
      head.addEventListener("click", () => {
        const nextOpen = !expandedModelFamilies.has(family);
        if (nextOpen) expandedModelFamilies.add(family);
        else expandedModelFamilies.delete(family);
        section.classList.toggle("open", nextOpen);
      });
      section.appendChild(head);

      const list = document.createElement("div");
      list.className = "model-version-list";
      const listInner = document.createElement("div");
      listInner.className = "model-version-inner";
      models.forEach((m, index) => {
        const isInstalled = installedNames.includes(m.name);
        const isActive = m.name === settings.selectedModel;
        const isPulling = pullingModels[m.name] !== undefined;

        let statusHtml = "";
        if (isActive) statusHtml += `<span class="catalog-item-status active">Active</span>`;
        else if (isInstalled) statusHtml += `<span class="catalog-item-status installed">Installed</span>`;
        else statusHtml += `<span class="catalog-item-status">Ready</span>`;
        if (m.vision) statusHtml += `<span class="catalog-item-status">Vision</span>`;
        if (m.think) statusHtml += `<span class="catalog-item-status">Think</span>`;

        let actionHtml = "";
        if (isPulling) {
          const pct = pullingModels[m.name];
          actionHtml = `<div class="catalog-progress-wrap"><div class="catalog-progress"><div class="catalog-progress-fill" style="width:${pct}%"></div></div><span>${pct}%</span></div>`;
        } else if (isInstalled) {
          actionHtml = isActive
            ? `<button class="catalog-btn" disabled>${escapeHtml(t("selected"))}</button>`
            : `<div class="catalog-actions"><button class="catalog-btn primary" data-action="select" data-model="${m.name}">${escapeHtml(t("choose"))}</button><button class="catalog-btn danger" data-action="delete" data-model="${m.name}" title="Delete" aria-label="Delete model" data-tooltip="Delete model">\u00d7</button></div>`;
        } else {
          actionHtml = `<button class="catalog-btn primary" data-action="pull" data-model="${m.name}">${escapeHtml(t("download"))}</button>`;
        }

        const item = document.createElement("div");
        item.className = "catalog-item compact";
        item.style.setProperty("--item-index", String(Math.min(index, 6)));
        item.innerHTML = `
          <div class="catalog-item-info">
            <div class="catalog-item-name">${escapeHtml(m.name)}</div>
            <div class="catalog-item-desc">${escapeHtml(m.desc || "")}</div>
            <div class="catalog-item-meta">${statusHtml}<span class="catalog-size">${escapeHtml(m.size || "")}</span></div>
          </div>
          <div class="catalog-action">${actionHtml}</div>
        `;

        item.querySelectorAll(".catalog-btn[data-action]").forEach(btn => {
          btn.addEventListener("click", async () => {
            const action = btn.dataset.action;
            const model = btn.dataset.model;
            if (action === "select") {
              selectModel(model);
              renderModelsCatalog(modelsSearch ? modelsSearch.value : filter);
            } else if (action === "pull") {
              await pullModel(model, modelsSearch ? modelsSearch.value : filter);
            } else if (action === "delete") {
              if (confirm(`Delete model "${model}"?`)) {
                const deleted = await window.api.deleteModel(model);
                if (deleted?.ok && settings.selectedModel === model) {
                  settings.selectedModel = null;
                  if (modelLabel) modelLabel.textContent = t("chooseModel");
                  await persist();
                }
                await checkOllama();
                renderModelsCatalog(modelsSearch ? modelsSearch.value : filter);
              }
            }
          });
        });
        listInner.appendChild(item);
      });
      list.appendChild(listInner);
      section.appendChild(list);
      body.appendChild(section);
    });

    if (familyNames.length === 0) {
      const empty = document.createElement("div");
      empty.className = "model-empty";
      empty.textContent = "Nothing found.";
      body.appendChild(empty);
    }
  }

  async function pullModel(modelName, filter) {
    pullingModels[modelName] = 0;
    renderModelsCatalog(filter);
    const result = await window.api.pullModel(modelName);
    delete pullingModels[modelName];
    await checkOllama();
    if (result.ok) {
      selectModel(modelName);
    } else {
      alert((settings.appLanguage === "ru" ? "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u0430\u0447\u0430\u0442\u044c \u043c\u043e\u0434\u0435\u043b\u044c: " : "Failed to download model: ") + (result.error || (settings.appLanguage === "ru" ? "\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430" : "unknown error")));
    }
    renderModelsCatalog(filter);
  }

  // РїСЂРѕРіСЂРµСЃСЃ СЃРєР°С‡РёРІР°РЅРёСЏ
  if (window.api && window.api.onPullProgress) {
    window.api.onPullProgress((d) => {
      if (d.model && d.percent !== undefined) {
        pullingModels[d.model] = d.percent;
        const fills = document.querySelectorAll(".catalog-progress-fill");
        const items = document.querySelectorAll(".catalog-item");
        items.forEach(item => {
          const name = item.querySelector(".catalog-item-name");
          if (name && name.textContent.includes(d.model)) {
            const fill = item.querySelector(".catalog-progress-fill");
            const pctText = item.querySelector(".catalog-progress + span");
            if (fill) fill.style.width = d.percent + "%";
            if (pctText) pctText.textContent = d.percent + "%";
          }
        });
      }
    });
  }

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    await loadData();
    await syncProjectFolders();
    setThinkLevel(settings.thinkLevel || "medium");
    setAccessMode(settings.accessMode || "ask");
    applyTheme();
    applyAppLanguageBasics();
    applyButtonTooltips();
    renderSettings();
    renderProgress();
    if (settings.selectedModel) modelLabel.textContent = settings.selectedModel;
    typeWelcomeTitle();
    renderSidebar();
    renderMessages();
    updateSendBtn();
    await checkOllama();
    // РїРѕРІС‚РѕСЂРЅР°СЏ РїСЂРѕРІРµСЂРєР° СЃС‚Р°С‚СѓСЃР° Ollama РєР°Р¶РґС‹Рµ 15СЃ
    setInterval(checkOllama, 15000);
    inputEl.focus();
  }

  init();

})();
