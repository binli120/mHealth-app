/**
 * Landing page copy — all UI strings translated into all 6 supported languages.
 * @author Bin Lee
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"

export interface LandingCopy {
  // Header
  navProblem: string
  navHowItWorks: string
  navWhyUs: string
  navLiveAssistance: string
  navAppealHelp: string
  navResources: string
  signIn: string
  getStarted: string
  newLabel: string
  aiLabel: string
  // Hero
  heroBadge: string
  heroH1Line1: string
  heroH1Shimmer: string
  heroDesc: string
  heroTags: string[]
  btnCheckEligibility: string
  btnStartApplication: string
  // BenefitPreview
  previewAnalyzing: string
  previewResult: string
  previewMissedBenefit: string
  previewSaved: string
  previewLanguages: string
  previewVoice: string
  // Problem section
  probLabel: string
  probTitle: string
  probDesc: string
  problemItems: { title: string; body: string }[]
  // How It Works
  howLabel: string
  howTitle: string
  howDesc: string
  steps: { title: string; body: string }[]
  // Why Us
  whyLabel: string
  whyTitle: string
  whyDesc: string
  featureItems: { title: string; body: string }[]
  // Stats
  statLabels: [string, string, string, string]
  // Live Assistance
  liveFeatureLabel: string
  liveTitleLine1: string
  liveTitleLine2: string
  liveDesc: string
  liveChecklist: string[]
  liveCards: { title: string; body: string }[]
  btnGetConnected: string
  // Appeal
  appealBadge: string
  appealTitleLine1: string
  appealTitleLine2: string
  appealDesc: string
  appealChecklist: string[]
  appealCards: { title: string; body: string }[]
  btnTryAppealAI: string
  btnCreateAccount: string
  // Testimonials
  testimonialsLabel: string
  testimonialsTitle: string
  // CTA
  ctaTitle: string
  ctaDesc: string
  btnCTAEligibility: string
  btnCTASignIn: string
  // Footer
  footerDesc: string
  footerProgramsLabel: string
  footerPlatformLabel: string
  footerSupportLabel: string
  footerProgramLinks: string[]
  footerPlatformLinks: string[]
  footerCopyright: string
}

// ── English ───────────────────────────────────────────────────────────────────

const EN: LandingCopy = {
  navProblem: "The Problem",
  navHowItWorks: "How It Works",
  navWhyUs: "Why Us",
  navLiveAssistance: "Live Assistance",
  navAppealHelp: "Appeal Help",
  navResources: "Resources",
  signIn: "Sign In",
  getStarted: "Get Started",
  newLabel: "NEW",
  aiLabel: "AI",
  heroBadge: "AI-powered benefit navigation for Massachusetts",
  heroH1Line1: "Find every benefit",
  heroH1Shimmer: "you deserve",
  heroDesc: "Massachusetts residents miss thousands in annual benefits because the system is too complex. HealthCompass MA checks 9+ programs at once and guides you through every application — for free.",
  heroTags: ["Free to use", "9+ programs", "6 languages", "Voice messaging", "~15 min to apply"],
  btnCheckEligibility: "Check My Eligibility",
  btnStartApplication: "Start Application",
  previewAnalyzing: "Analyzing your eligibility…",
  previewResult: "🎉 4 programs found — up to $2,400/mo in benefits",
  previewMissedBenefit: "💡 Missed benefit detected",
  previewSaved: "✅ Application saved",
  previewLanguages: "🌐 6 languages supported",
  previewVoice: "🎙️ Voice + auto-translation",
  probLabel: "The Problem",
  probTitle: "Benefits exist — but they're nearly impossible to navigate",
  probDesc: "Massachusetts offers billions in annual aid across dozens of programs. Yet most eligible residents miss out because the process is fragmented, confusing, and time-consuming.",
  problemItems: [
    { title: "You don't know what you qualify for", body: "With 30+ state and federal programs, each with different income limits and rules, most people have no idea which benefits they're entitled to." },
    { title: "Every program has separate paperwork", body: "Applying for MassHealth, SNAP, and LIHEAP separately means filling out the same information three times, on three different websites." },
    { title: "Benefits slip through the cracks", body: "The average Massachusetts family misses $4,800/year in unclaimed benefits — not because they don't qualify, but because they never knew to apply." },
  ],
  howLabel: "How It Works",
  howTitle: "From confusion to coverage in 4 steps",
  howDesc: "We eliminate the guesswork at every stage — from figuring out what you qualify for, to submitting applications and tracking outcomes.",
  steps: [
    { title: "Answer a few questions", body: "Tell us about your household size, income, and situation — takes about 5 minutes." },
    { title: "See programs you qualify for", body: "Our AI instantly checks your profile against MassHealth, SNAP, EITC, LIHEAP, WIC, and more." },
    { title: "Apply with guided steps", body: "We walk you through each application with plain-language explanations and a document checklist." },
    { title: "Track everything in one place", body: "Monitor application status, renewal deadlines, and benefit amounts from your dashboard." },
  ],
  whyLabel: "Why HealthCompass MA",
  whyTitle: "Built for real Massachusetts families",
  whyDesc: "Every feature was designed around one goal: make sure eligible residents receive every dollar they're entitled to, with as little friction as possible.",
  featureItems: [
    { title: "AI Eligibility Engine", body: "Cross-check your profile against 9+ state and federal programs in seconds — no paperwork required." },
    { title: "Benefit Stacking", body: "Most programs can be combined. We show every program you qualify for, not just one — maximizing your total benefit." },
    { title: "Guided Applications", body: "Step-by-step walkthroughs with plain-language explanations, document checklists, and real-time validation." },
    { title: "AI Chat Assistant", body: "Ask questions any time. Our MassHealth assistant explains programs, deadlines, and next steps in plain language." },
    { title: "6 Languages", body: "Full support for English, 简体中文, Español, Português, Kreyòl ayisyen, and Tiếng Việt." },
    { title: "Private & Secure", body: "Your data is encrypted end-to-end and never sold. You control what you share and with whom." },
    { title: "Appeal Assistance", body: "AI trained on real MassHealth denial cases. Paste your notice, get a tailored evidence checklist and a cited appeal letter grounded in actual regulations." },
    { title: "Live Social Worker Chat", body: "Connect directly with a licensed social worker via real-time messaging, screen sharing, and secure voice notes." },
    { title: "Voice Messaging", body: "Send voice messages to your social worker — automatically transcribed on delivery so nothing gets lost in translation." },
    { title: "Auto-Translation", body: "Speak in any language. Voice messages are instantly transcribed and translated to English using AI — no interpreter needed." },
  ],
  statLabels: ["Benefit programs checked", "Languages supported", "Average time to apply", "Max combined monthly benefit"],
  liveFeatureLabel: "New Feature",
  liveTitleLine1: "Real human support,",
  liveTitleLine2: "in any language",
  liveDesc: "Sometimes you need more than an AI. HealthCompass MA connects you directly with licensed social workers — with voice messaging, automatic translation, and screen sharing built right in.",
  liveChecklist: [
    "Real-time direct messaging with your assigned social worker",
    "Voice messages with automatic AI transcription on delivery",
    "Instant auto-translation — speak any language, read in English",
    "Screen sharing for guided, step-by-step application walkthroughs",
    "Secure in-chat file and image sharing",
  ],
  liveCards: [
    { title: "Direct Messaging", body: "Secure, real-time chat between patients and social workers — no phone tag, no wait rooms." },
    { title: "Voice Notes", body: "Record and send voice messages — automatically transcribed so the other side can read or listen." },
    { title: "Auto-Translation", body: "Whisper detects the language; Ollama translates to English — instantly, without a human interpreter." },
    { title: "Screen Sharing", body: "Social workers can share their screen to walk patients through complex forms in real time." },
  ],
  btnGetConnected: "Get Connected",
  appealBadge: "AI trained on real MassHealth denials",
  appealTitleLine1: "Got denied? Our AI has",
  appealTitleLine2: "seen it before",
  appealDesc: "Our model is trained on thousands of actual MassHealth denial cases — and learns from every new one the community submits. Paste your notice and get a tailored evidence checklist, legal arguments grounded in real regulations, and a fully-cited draft appeal letter in minutes.",
  appealChecklist: [
    "AI trained on thousands of real MassHealth denial cases — and improving with every new one",
    "RAG-powered research pulls from official regulations, legal aid guides, and court records",
    "Evidence checklist tailored to your exact denial category",
    "Cited appeal letter grounded in real legal sources, not generic templates",
    "The model gets smarter the more denials the community shares",
  ],
  appealCards: [
    { title: "Trained on Real Denials", body: "Our model is fine-tuned on actual MassHealth denial notices. It recognizes patterns — and knows how courts and EOHHS resolve them." },
    { title: "Regulatory Research", body: "Every answer is grounded in MassHealth CMRs, EOHHS policy bulletins, and legal aid resources — not generic advice." },
    { title: "Evidence Checklist", body: "Paste your denial notice and get a tailored document list — exactly what you need to build your case, nothing more." },
    { title: "Gets Better Over Time", body: "Each real denial submitted to the platform trains the next version of the model — making every future appeal stronger." },
  ],
  btnTryAppealAI: "Try Appeal Letter AI",
  btnCreateAccount: "Create Free Account",
  testimonialsLabel: "Real Stories",
  testimonialsTitle: "Real help for real families",
  ctaTitle: "Stop missing benefits you've already earned",
  ctaDesc: "It takes 15 minutes. It's completely free. The average family discovers over $2,400/month in available benefits.",
  btnCTAEligibility: "Check My Eligibility — Free",
  btnCTASignIn: "Sign In to Continue",
  footerDesc: "Helping Massachusetts residents discover and access the health and social benefits they deserve.",
  footerProgramsLabel: "Programs",
  footerPlatformLabel: "Platform",
  footerSupportLabel: "Support",
  footerProgramLinks: ["MassHealth", "SNAP / Food Assistance", "EITC Tax Credits", "LIHEAP Energy Aid"],
  footerPlatformLinks: ["Eligibility Checker", "Benefit Stack Tool", "Live Assistance", "Appeal Assistance", "Appeal Letter (AI)", "Knowledge Center", "Create Account"],
  footerCopyright: "© 2026 HealthCompass MA. Not affiliated with the Commonwealth of Massachusetts. All rights reserved.",
}

// ── Spanish ───────────────────────────────────────────────────────────────────

const ES: LandingCopy = {
  navProblem: "El Problema",
  navHowItWorks: "Cómo Funciona",
  navWhyUs: "Por Qué Nosotros",
  navLiveAssistance: "Asistencia en Vivo",
  navAppealHelp: "Ayuda con Apelaciones",
  navResources: "Recursos",
  signIn: "Iniciar Sesión",
  getStarted: "Empezar",
  newLabel: "NUEVO",
  aiLabel: "IA",
  heroBadge: "Navegación de beneficios con IA para Massachusetts",
  heroH1Line1: "Encuentra todos los beneficios",
  heroH1Shimmer: "que mereces",
  heroDesc: "Los residentes de Massachusetts pierden miles de dólares en beneficios anuales porque el sistema es demasiado complejo. HealthCompass MA verifica más de 9 programas a la vez y te guía en cada solicitud — gratis.",
  heroTags: ["Gratis", "9+ programas", "6 idiomas", "Mensajes de voz", "~15 min para solicitar"],
  btnCheckEligibility: "Verificar Mi Elegibilidad",
  btnStartApplication: "Iniciar Solicitud",
  previewAnalyzing: "Analizando tu elegibilidad…",
  previewResult: "🎉 4 programas encontrados — hasta $2,400/mes en beneficios",
  previewMissedBenefit: "💡 Beneficio no reclamado detectado",
  previewSaved: "✅ Solicitud guardada",
  previewLanguages: "🌐 6 idiomas disponibles",
  previewVoice: "🎙️ Voz + traducción automática",
  probLabel: "El Problema",
  probTitle: "Los beneficios existen — pero son casi imposibles de navegar",
  probDesc: "Massachusetts ofrece miles de millones en ayuda anual en docenas de programas. Sin embargo, la mayoría de los residentes elegibles los pierden porque el proceso es fragmentado, confuso y consume mucho tiempo.",
  problemItems: [
    { title: "No sabes para qué calificas", body: "Con más de 30 programas estatales y federales, cada uno con diferentes límites de ingresos y reglas, la mayoría de la gente no sabe qué beneficios le corresponden." },
    { title: "Cada programa tiene papeles separados", body: "Solicitar MassHealth, SNAP y LIHEAP por separado significa llenar la misma información tres veces, en tres sitios web diferentes." },
    { title: "Los beneficios se pierden", body: "La familia promedio de Massachusetts pierde $4,800/año en beneficios sin reclamar — no porque no califiquen, sino porque nunca supieron que podían solicitarlos." },
  ],
  howLabel: "Cómo Funciona",
  howTitle: "De la confusión a la cobertura en 4 pasos",
  howDesc: "Eliminamos las suposiciones en cada etapa — desde determinar para qué calificas, hasta enviar solicitudes y rastrear resultados.",
  steps: [
    { title: "Responde algunas preguntas", body: "Cuéntanos sobre el tamaño de tu hogar, ingresos y situación — toma unos 5 minutos." },
    { title: "Ve los programas para los que calificas", body: "Nuestra IA verifica instantáneamente tu perfil con MassHealth, SNAP, EITC, LIHEAP, WIC y más." },
    { title: "Solicita con pasos guiados", body: "Te guiamos en cada solicitud con explicaciones en lenguaje sencillo y una lista de documentos." },
    { title: "Rastrea todo en un solo lugar", body: "Monitorea el estado de la solicitud, fechas de renovación y montos de beneficios desde tu panel." },
  ],
  whyLabel: "Por Qué HealthCompass MA",
  whyTitle: "Construido para familias reales de Massachusetts",
  whyDesc: "Cada función fue diseñada con un objetivo: asegurarse de que los residentes elegibles reciban cada dólar al que tienen derecho, con la menor fricción posible.",
  featureItems: [
    { title: "Motor de Elegibilidad con IA", body: "Verifica tu perfil con más de 9 programas estatales y federales en segundos — sin papeleo." },
    { title: "Acumulación de Beneficios", body: "La mayoría de los programas se pueden combinar. Mostramos todos los programas para los que calificas, no solo uno." },
    { title: "Solicitudes Guiadas", body: "Guías paso a paso con explicaciones en lenguaje sencillo, listas de documentos y validación en tiempo real." },
    { title: "Asistente de Chat con IA", body: "Haz preguntas en cualquier momento. Nuestro asistente MassHealth explica programas, plazos y próximos pasos." },
    { title: "6 Idiomas", body: "Soporte completo para inglés, 简体中文, español, português, kreyòl ayisyen y tiếng việt." },
    { title: "Privado y Seguro", body: "Tus datos están cifrados de extremo a extremo y nunca se venden. Controlas lo que compartes y con quién." },
    { title: "Asistencia para Apelaciones", body: "IA entrenada en casos reales de denegación de MassHealth. Pega tu aviso y obtén una lista de evidencia personalizada." },
    { title: "Chat con Trabajador Social en Vivo", body: "Conéctate directamente con un trabajador social licenciado a través de mensajería en tiempo real y notas de voz." },
    { title: "Mensajes de Voz", body: "Envía mensajes de voz a tu trabajador social — transcritos automáticamente para que nada se pierda." },
    { title: "Traducción Automática", body: "Habla en cualquier idioma. Los mensajes de voz se transcriben y traducen al inglés usando IA." },
  ],
  statLabels: ["Programas de beneficios verificados", "Idiomas disponibles", "Tiempo promedio para solicitar", "Beneficio mensual combinado máximo"],
  liveFeatureLabel: "Nueva Función",
  liveTitleLine1: "Apoyo humano real,",
  liveTitleLine2: "en cualquier idioma",
  liveDesc: "A veces necesitas más que una IA. HealthCompass MA te conecta directamente con trabajadores sociales licenciados — con mensajes de voz, traducción automática y pantalla compartida.",
  liveChecklist: [
    "Mensajería directa en tiempo real con tu trabajador social asignado",
    "Mensajes de voz con transcripción automática de IA al entregarse",
    "Traducción automática instantánea — habla cualquier idioma, lee en inglés",
    "Pantalla compartida para guías de solicitud paso a paso",
    "Intercambio seguro de archivos e imágenes en el chat",
  ],
  liveCards: [
    { title: "Mensajería Directa", body: "Chat seguro en tiempo real entre pacientes y trabajadores sociales — sin llamadas perdidas, sin salas de espera." },
    { title: "Notas de Voz", body: "Graba y envía mensajes de voz — transcritos automáticamente para que el otro lado pueda leer o escuchar." },
    { title: "Traducción Automática", body: "Whisper detecta el idioma; Ollama traduce al inglés — al instante, sin intérprete humano." },
    { title: "Pantalla Compartida", body: "Los trabajadores sociales pueden compartir su pantalla para guiar a los pacientes en formularios complejos." },
  ],
  btnGetConnected: "Conectarse",
  appealBadge: "IA entrenada en denegaciones reales de MassHealth",
  appealTitleLine1: "¿Fue denegado? Nuestra IA",
  appealTitleLine2: "ya lo ha visto",
  appealDesc: "Nuestro modelo está entrenado en miles de casos reales de denegación de MassHealth — y aprende de cada nuevo caso. Pega tu aviso y obtén una lista de evidencia personalizada, argumentos legales y una carta de apelación en minutos.",
  appealChecklist: [
    "IA entrenada en miles de casos reales de denegación de MassHealth — y mejorando con cada nuevo caso",
    "Investigación RAG extrae de regulaciones oficiales, guías de asistencia legal y registros judiciales",
    "Lista de evidencia adaptada a tu categoría exacta de denegación",
    "Carta de apelación citada basada en fuentes legales reales, no plantillas genéricas",
    "El modelo se vuelve más inteligente cuantas más denegaciones comparte la comunidad",
  ],
  appealCards: [
    { title: "Entrenado en Denegaciones Reales", body: "Nuestro modelo está ajustado en avisos reales de denegación de MassHealth. Reconoce patrones — y sabe cómo los tribunales y EOHHS los resuelven." },
    { title: "Investigación Regulatoria", body: "Cada respuesta está basada en CMRs de MassHealth, boletines de política de EOHHS y recursos de asistencia legal." },
    { title: "Lista de Evidencia", body: "Pega tu aviso de denegación y obtén una lista de documentos personalizada — exactamente lo que necesitas para tu caso." },
    { title: "Mejora con el Tiempo", body: "Cada denegación real enviada a la plataforma entrena la próxima versión del modelo — haciendo cada apelación futura más sólida." },
  ],
  btnTryAppealAI: "Probar IA de Carta de Apelación",
  btnCreateAccount: "Crear Cuenta Gratis",
  testimonialsLabel: "Historias Reales",
  testimonialsTitle: "Ayuda real para familias reales",
  ctaTitle: "Deja de perder beneficios que ya ganaste",
  ctaDesc: "Toma 15 minutos. Es completamente gratis. La familia promedio descubre más de $2,400/mes en beneficios disponibles.",
  btnCTAEligibility: "Verificar Mi Elegibilidad — Gratis",
  btnCTASignIn: "Iniciar Sesión para Continuar",
  footerDesc: "Ayudando a los residentes de Massachusetts a descubrir y acceder a los beneficios de salud y sociales que merecen.",
  footerProgramsLabel: "Programas",
  footerPlatformLabel: "Plataforma",
  footerSupportLabel: "Soporte",
  footerProgramLinks: ["MassHealth", "SNAP / Asistencia Alimentaria", "Créditos Fiscales EITC", "Ayuda Energética LIHEAP"],
  footerPlatformLinks: ["Verificador de Elegibilidad", "Herramienta de Acumulación", "Asistencia en Vivo", "Asistencia para Apelaciones", "Carta de Apelación (IA)", "Centro de Conocimiento", "Crear Cuenta"],
  footerCopyright: "© 2026 HealthCompass MA. No afiliado con el Commonwealth de Massachusetts. Todos los derechos reservados.",
}

// ── Chinese (Simplified) ──────────────────────────────────────────────────────

const ZH_CN: LandingCopy = {
  navProblem: "问题所在",
  navHowItWorks: "如何运作",
  navWhyUs: "为何选择我们",
  navLiveAssistance: "实时援助",
  navAppealHelp: "申诉帮助",
  navResources: "资源",
  signIn: "登录",
  getStarted: "开始使用",
  newLabel: "新",
  aiLabel: "AI",
  heroBadge: "马萨诸塞州AI驱动的福利导航",
  heroH1Line1: "找到您应得的",
  heroH1Shimmer: "每一项福利",
  heroDesc: "马萨诸塞州居民因系统过于复杂而错过数千美元的年度福利。HealthCompass MA一次检查9个以上项目，并为您免费指导每一步申请。",
  heroTags: ["免费使用", "9+个项目", "6种语言", "语音消息", "~15分钟申请"],
  btnCheckEligibility: "检查我的资格",
  btnStartApplication: "开始申请",
  previewAnalyzing: "正在分析您的资格…",
  previewResult: "🎉 找到4个项目 — 每月最高$2,400的福利",
  previewMissedBenefit: "💡 检测到未申领的福利",
  previewSaved: "✅ 申请已保存",
  previewLanguages: "🌐 支持6种语言",
  previewVoice: "🎙️ 语音 + 自动翻译",
  probLabel: "问题所在",
  probTitle: "福利存在 — 但几乎无法导航",
  probDesc: "马萨诸塞州每年提供数十亿美元的援助，涵盖数十个项目。然而，大多数符合条件的居民因流程碎片化、复杂且耗时而错过这些福利。",
  problemItems: [
    { title: "您不知道自己有资格申请什么", body: "有30多个州和联邦项目，每个项目有不同的收入限制和规定，大多数人不知道自己有权享受哪些福利。" },
    { title: "每个项目都有单独的文件", body: "分别申请MassHealth、SNAP和LIHEAP意味着在三个不同网站上填写三次相同的信息。" },
    { title: "福利从缝隙中溜走", body: "马萨诸塞州普通家庭每年错过$4,800的未申领福利 — 不是因为不符合资格，而是因为他们从不知道可以申请。" },
  ],
  howLabel: "如何运作",
  howTitle: "4步从困惑到获得保障",
  howDesc: "我们消除了每个阶段的猜测 — 从弄清楚您有资格申请什么，到提交申请和跟踪结果。",
  steps: [
    { title: "回答几个问题", body: "告诉我们您的家庭规模、收入和情况 — 大约需要5分钟。" },
    { title: "查看您有资格申请的项目", body: "我们的AI立即根据MassHealth、SNAP、EITC、LIHEAP、WIC等检查您的个人资料。" },
    { title: "按指导步骤申请", body: "我们通过通俗易懂的解释和文件清单指导您完成每份申请。" },
    { title: "在一处跟踪所有内容", body: "从仪表板监控申请状态、续期截止日期和福利金额。" },
  ],
  whyLabel: "为何选择HealthCompass MA",
  whyTitle: "专为马萨诸塞州真实家庭打造",
  whyDesc: "每个功能都围绕一个目标设计：确保符合条件的居民以尽可能少的摩擦获得他们有权享有的每一美元。",
  featureItems: [
    { title: "AI资格引擎", body: "在几秒钟内将您的个人资料与9个以上的州和联邦项目进行交叉检查 — 无需文件。" },
    { title: "福利叠加", body: "大多数项目可以组合。我们显示您有资格申请的每个项目，而不仅仅是一个。" },
    { title: "指导申请", body: "逐步指导，通俗易懂的解释，文件清单和实时验证。" },
    { title: "AI聊天助手", body: "随时提问。我们的MassHealth助手用通俗语言解释项目、截止日期和后续步骤。" },
    { title: "6种语言", body: "完全支持英语、简体中文、西班牙语、葡萄牙语、海地克里奥尔语和越南语。" },
    { title: "私密与安全", body: "您的数据经端对端加密，从不出售。您控制分享的内容和对象。" },
    { title: "申诉援助", body: "AI在真实的MassHealth拒绝案例上进行训练。粘贴您的通知，获取量身定制的证据清单。" },
    { title: "实时社会工作者聊天", body: "通过实时消息、屏幕共享和安全语音笔记直接与持牌社会工作者联系。" },
    { title: "语音消息", body: "向您的社会工作者发送语音消息 — 送达时自动转录，确保没有任何遗漏。" },
    { title: "自动翻译", body: "用任何语言说话。语音消息使用AI即时转录并翻译成英语 — 无需翻译员。" },
  ],
  statLabels: ["已检查福利项目", "支持的语言", "平均申请时间", "最高月度组合福利"],
  liveFeatureLabel: "新功能",
  liveTitleLine1: "真人支持，",
  liveTitleLine2: "任何语言均可",
  liveDesc: "有时您需要的不仅仅是AI。HealthCompass MA将您直接与持牌社会工作者连接 — 内置语音消息、自动翻译和屏幕共享。",
  liveChecklist: [
    "与您的指定社会工作者实时直接消息",
    "语音消息，送达时自动AI转录",
    "即时自动翻译 — 用任何语言说话，用英语阅读",
    "屏幕共享，逐步指导申请流程",
    "安全的聊天内文件和图像共享",
  ],
  liveCards: [
    { title: "直接消息", body: "患者和社会工作者之间安全、实时的聊天 — 无需打电话，无需等候室。" },
    { title: "语音笔记", body: "录制并发送语音消息 — 自动转录，对方可以阅读或收听。" },
    { title: "自动翻译", body: "Whisper检测语言；Ollama翻译成英语 — 即时，无需人工翻译。" },
    { title: "屏幕共享", body: "社会工作者可以共享屏幕，实时引导患者填写复杂表格。" },
  ],
  btnGetConnected: "立即连接",
  appealBadge: "AI在真实的MassHealth拒绝案例上进行训练",
  appealTitleLine1: "被拒绝了？我们的AI",
  appealTitleLine2: "见过这种情况",
  appealDesc: "我们的模型在数千个真实的MassHealth拒绝案例上进行训练 — 并从每个新提交的案例中学习。粘贴您的通知，在几分钟内获取量身定制的证据清单、基于真实法规的法律论点和完整引用的申诉信草稿。",
  appealChecklist: [
    "AI在数千个真实的MassHealth拒绝案例上进行训练 — 并随着每个新案例不断改进",
    "RAG驱动的研究从官方法规、法律援助指南和法院记录中提取",
    "根据您确切的拒绝类别定制的证据清单",
    "基于真实法律来源的引用申诉信，而非通用模板",
    "社区分享的拒绝案例越多，模型就越智能",
  ],
  appealCards: [
    { title: "在真实拒绝案例上训练", body: "我们的模型在真实的MassHealth拒绝通知上进行微调。它识别模式 — 并知道法院和EOHHS如何解决这些问题。" },
    { title: "法规研究", body: "每个答案都以MassHealth CMR、EOHHS政策公告和法律援助资源为基础 — 而非通用建议。" },
    { title: "证据清单", body: "粘贴您的拒绝通知，获取量身定制的文件清单 — 恰好是您建立案件所需的内容。" },
    { title: "随时间改进", body: "每个提交到平台的真实拒绝案例都会训练下一版本的模型 — 使每次未来的申诉更强大。" },
  ],
  btnTryAppealAI: "尝试申诉信AI",
  btnCreateAccount: "创建免费账户",
  testimonialsLabel: "真实故事",
  testimonialsTitle: "为真实家庭提供真实帮助",
  ctaTitle: "停止错过您已经获得的福利",
  ctaDesc: "只需15分钟。完全免费。普通家庭发现每月超过$2,400的可用福利。",
  btnCTAEligibility: "检查我的资格 — 免费",
  btnCTASignIn: "登录继续",
  footerDesc: "帮助马萨诸塞州居民发现并获取他们应得的健康和社会福利。",
  footerProgramsLabel: "项目",
  footerPlatformLabel: "平台",
  footerSupportLabel: "支持",
  footerProgramLinks: ["MassHealth", "SNAP / 食品援助", "EITC税收抵免", "LIHEAP能源援助"],
  footerPlatformLinks: ["资格检查器", "福利叠加工具", "实时援助", "申诉援助", "申诉信 (AI)", "知识中心", "创建账户"],
  footerCopyright: "© 2026 HealthCompass MA。与马萨诸塞州联邦政府无关联。版权所有。",
}

// ── Haitian Creole ────────────────────────────────────────────────────────────

const HT: LandingCopy = {
  navProblem: "Pwoblèm nan",
  navHowItWorks: "Kijan Sa Travay",
  navWhyUs: "Poukisa Nou",
  navLiveAssistance: "Asistans an Dirèk",
  navAppealHelp: "Èd pou Apèl",
  navResources: "Resous",
  signIn: "Konekte",
  getStarted: "Kòmanse",
  newLabel: "NOUVO",
  aiLabel: "AI",
  heroBadge: "Navigasyon benefis avèk AI pou Massachusetts",
  heroH1Line1: "Jwenn chak benefis",
  heroH1Shimmer: "ou merite",
  heroDesc: "Rezidan Massachusetts rate dè milye de dola nan benefis anyèl paske sistèm nan twò konplèks. HealthCompass MA tcheke 9+ pwogram alafwa epi gide ou nan chak aplikasyon — gratis.",
  heroTags: ["Gratis", "9+ pwogram", "6 lang", "Mesaj vwa", "~15 min pou aplike"],
  btnCheckEligibility: "Tcheke Kalifikasyon M",
  btnStartApplication: "Kòmanse Aplikasyon",
  previewAnalyzing: "Ap analize kalifikasyon ou…",
  previewResult: "🎉 4 pwogram jwenn — jiska $2,400/mwa nan benefis",
  previewMissedBenefit: "💡 Benefis rate detekte",
  previewSaved: "✅ Aplikasyon sove",
  previewLanguages: "🌐 6 lang sipòte",
  previewVoice: "🎙️ Vwa + tradiksyon otomatik",
  probLabel: "Pwoblèm nan",
  probTitle: "Benefis egziste — men yo prèske enposib pou navige",
  probDesc: "Massachusetts ofri dè milya nan èd anyèl atravè douzèn pwogram. Sepandan, pifò rezidan ki kalifye rate paske pwosesis la fraksyone, konfizyon, epi pran anpil tan.",
  problemItems: [
    { title: "Ou pa konnen sa ou kalifye pou li", body: "Avèk 30+ pwogram leta ak federal, chak ak limit revni ak règ diferan, pifò moun pa konnen ki benefis yo gen dwa pou jwenn." },
    { title: "Chak pwogram gen papye separe", body: "Aplike pou MassHealth, SNAP, ak LIHEAP separeman vle di ranpli menm enfòmasyon twa fwa, sou twa sit entènèt diferan." },
    { title: "Benefis glise nan fant yo", body: "Fanmi Massachusetts mwayèn rate $4,800/ane nan benefis ki pa reklame — se pa paske yo pa kalifye, men paske yo pa t janm konnen yo te kapab aplike." },
  ],
  howLabel: "Kijan Sa Travay",
  howTitle: "De konfizyon rive kouvèti nan 4 etap",
  howDesc: "Nou elimine devinen nan chak etap — de detèmine sa ou kalifye pou li, jiska soumèt aplikasyon ak swiv rezilta.",
  steps: [
    { title: "Reponn kèk kesyon", body: "Di nou sou gwosè kay ou, revni, ak sitiyasyon — pran anviwon 5 minit." },
    { title: "Wè pwogram ou kalifye pou yo", body: "AI nou an imedyatman tcheke pwofil ou kont MassHealth, SNAP, EITC, LIHEAP, WIC, ak plis." },
    { title: "Aplike avèk etap gide", body: "Nou gide ou nan chak aplikasyon ak eksplikasyon lang klè ak yon lis dokiman." },
    { title: "Swiv tout bagay nan yon sèl kote", body: "Surveye estati aplikasyon, dat renouvèlman, ak montan benefis depi tableau de bord ou." },
  ],
  whyLabel: "Poukisa HealthCompass MA",
  whyTitle: "Bati pou fanmi Massachusetts reyèl",
  whyDesc: "Chak karakteristik te fèt pou yon sèl objektif: asire rezidan ki kalifye resevwa chak dola yo gen dwa, ak pi piti friksyon posib.",
  featureItems: [
    { title: "Motè Kalifikasyon AI", body: "Tcheke pwofil ou kont 9+ pwogram leta ak federal an segonn — pa gen papye ki nesesè." },
    { title: "Akimilasyon Benefis", body: "Pifò pwogram ka konbine. Nou montre chak pwogram ou kalifye pou li, pa sèlman youn." },
    { title: "Aplikasyon Gide", body: "Gid etap pa etap ak eksplikasyon lang klè, lis dokiman, ak validasyon an tan reyèl." },
    { title: "Asistan Chat AI", body: "Poze kesyon nenpòt lè. Asistan MassHealth nou an eksplike pwogram, dat limit, ak pwochen etap." },
    { title: "6 Lang", body: "Sipò konplè pou anglè, 简体中文, español, português, kreyòl ayisyen, ak tiếng việt." },
    { title: "Prive ak Sekirize", body: "Done ou yo chifre de bout an bout epi pa janm vann. Ou kontwole sa ou pataje ak ki moun." },
    { title: "Asistans pou Apèl", body: "AI fòme sou ka refize reyèl MassHealth. Kole avi ou, jwenn yon lis prèv pèsonalize." },
    { title: "Chat Travayè Sosyal an Dirèk", body: "Konekte dirèkteman ak yon travayè sosyal lisansye via mesajri an tan reyèl ak nòt vwa sekirize." },
    { title: "Mesaj Vwa", body: "Voye mesaj vwa bay travayè sosyal ou — otomatikman transkrip à livraison." },
    { title: "Tradiksyon Otomatik", body: "Pale nan nenpòt lang. Mesaj vwa yo imedyatman transkrip epi tradui an anglè ak AI." },
  ],
  statLabels: ["Pwogram benefis tcheke", "Lang sipòte", "Tan mwayèn pou aplike", "Benefis mansyèl konbine maks"],
  liveFeatureLabel: "Nouvo Karakteristik",
  liveTitleLine1: "Sipò imen reyèl,",
  liveTitleLine2: "nan nenpòt lang",
  liveDesc: "Pafwa ou bezwen plis pase yon AI. HealthCompass MA konekte ou dirèkteman ak travayè sosyal lisansye — ak mesaj vwa, tradiksyon otomatik, ak pataj ekran.",
  liveChecklist: [
    "Mesajri dirèk an tan reyèl ak travayè sosyal ou asiyen",
    "Mesaj vwa ak transkripyon AI otomatik à livraison",
    "Tradiksyon otomatik imedya — pale nenpòt lang, li an anglè",
    "Pataj ekran pou gid aplikasyon etap pa etap",
    "Pataj fichye ak imaj sekirize nan chat",
  ],
  liveCards: [
    { title: "Mesajri Dirèk", body: "Chat sekirize, an tan reyèl ant pasyan ak travayè sosyal — pa gen apèl manke, pa gen sal datant." },
    { title: "Nòt Vwa", body: "Anrejistre ak voye mesaj vwa — otomatikman transkrip pou lòt bò ka li oswa koute." },
    { title: "Tradiksyon Otomatik", body: "Whisper detekte lang lan; Ollama tradui an anglè — imedyatman, san entèprèt imen." },
    { title: "Pataj Ekran", body: "Travayè sosyal yo ka pataje ekran yo pou gide pasyan yo nan fòm konplèks an tan reyèl." },
  ],
  btnGetConnected: "Konekte Kounye a",
  appealBadge: "AI fòme sou refize reyèl MassHealth",
  appealTitleLine1: "Yo refize ou? AI nou an",
  appealTitleLine2: "deja wè sa",
  appealDesc: "Modèl nou an fòme sou dè milye de ka refize reyèl MassHealth — epi aprann de chak nouvo ka. Kole avi ou epi jwenn yon lis prèv pèsonalize, agiman legal, ak yon lèt apèl kite sitasyon an minit.",
  appealChecklist: [
    "AI fòme sou dè milye de ka refize reyèl MassHealth — epi amelyore ak chak nouvo ka",
    "Rechèch RAG tire de règleman ofisyèl, gid asistans legal, ak dosye tribinal",
    "Lis prèv adapte a kategori refize egzak ou",
    "Lèt apèl ki site baze sou sous legal reyèl, pa modèl jeneral",
    "Modèl la vin pi entèlijan plis refize kominote a pataje",
  ],
  appealCards: [
    { title: "Fòme sou Refize Reyèl", body: "Modèl nou an fine-tune sou avi refize reyèl MassHealth. Li rekonèt modèl — epi konnen kijan tribinal ak EOHHS rezoud yo." },
    { title: "Rechèch Reyèglman", body: "Chak repons baze sou CMR MassHealth, bilten politik EOHHS, ak resous asistans legal." },
    { title: "Lis Prèv", body: "Kole avi refize ou epi jwenn yon lis dokiman pèsonalize — egzakteman sa ou bezwen pou bati ka ou." },
    { title: "Vin Pi Bon Avèk Tan", body: "Chak refize reyèl soumèt nan platfòm lan fòme pwochen vèsyon modèl lan — fè chak apèl kap vini pi solid." },
  ],
  btnTryAppealAI: "Eseye AI Lèt Apèl",
  btnCreateAccount: "Kreye Kont Gratis",
  testimonialsLabel: "Istwa Reyèl",
  testimonialsTitle: "Èd reyèl pou fanmi reyèl",
  ctaTitle: "Sispann rate benefis ou deja touche",
  ctaDesc: "Sa pran 15 minit. Li totalman gratis. Fanmi mwayèn dekouvri plis pase $2,400/mwa nan benefis disponib.",
  btnCTAEligibility: "Tcheke Kalifikasyon M — Gratis",
  btnCTASignIn: "Konekte pou Kontinye",
  footerDesc: "Ede rezidan Massachusetts dekouvri ak jwenn aksè a benefis sante ak sosyal yo merite.",
  footerProgramsLabel: "Pwogram",
  footerPlatformLabel: "Platfòm",
  footerSupportLabel: "Sipò",
  footerProgramLinks: ["MassHealth", "SNAP / Asistans Manje", "Kredi Taks EITC", "Èd Enèji LIHEAP"],
  footerPlatformLinks: ["Verifikateur Kalifikasyon", "Zouti Akimilasyon Benefis", "Asistans an Dirèk", "Asistans pou Apèl", "Lèt Apèl (AI)", "Sant Konesans", "Kreye Kont"],
  footerCopyright: "© 2026 HealthCompass MA. Pa afilye avèk Commonwealth of Massachusetts. Tout dwa rezève.",
}

// ── Portuguese (Brazil) ───────────────────────────────────────────────────────

const PT_BR: LandingCopy = {
  navProblem: "O Problema",
  navHowItWorks: "Como Funciona",
  navWhyUs: "Por Que Nós",
  navLiveAssistance: "Assistência ao Vivo",
  navAppealHelp: "Ajuda com Recurso",
  navResources: "Recursos",
  signIn: "Entrar",
  getStarted: "Começar",
  newLabel: "NOVO",
  aiLabel: "IA",
  heroBadge: "Navegação de benefícios com IA para Massachusetts",
  heroH1Line1: "Encontre todos os benefícios",
  heroH1Shimmer: "que você merece",
  heroDesc: "Residentes de Massachusetts perdem milhares em benefícios anuais porque o sistema é muito complexo. HealthCompass MA verifica mais de 9 programas de uma vez e guia você em cada solicitação — de graça.",
  heroTags: ["Gratuito", "9+ programas", "6 idiomas", "Mensagens de voz", "~15 min para solicitar"],
  btnCheckEligibility: "Verificar Minha Elegibilidade",
  btnStartApplication: "Iniciar Solicitação",
  previewAnalyzing: "Analisando sua elegibilidade…",
  previewResult: "🎉 4 programas encontrados — até $2.400/mês em benefícios",
  previewMissedBenefit: "💡 Benefício não reivindicado detectado",
  previewSaved: "✅ Solicitação salva",
  previewLanguages: "🌐 6 idiomas suportados",
  previewVoice: "🎙️ Voz + tradução automática",
  probLabel: "O Problema",
  probTitle: "Os benefícios existem — mas são quase impossíveis de navegar",
  probDesc: "Massachusetts oferece bilhões em auxílio anual em dezenas de programas. Ainda assim, a maioria dos residentes elegíveis perde porque o processo é fragmentado, confuso e demorado.",
  problemItems: [
    { title: "Você não sabe para o que se qualifica", body: "Com mais de 30 programas estaduais e federais, cada um com limites de renda e regras diferentes, a maioria das pessoas não tem ideia de quais benefícios tem direito." },
    { title: "Cada programa tem papelada separada", body: "Solicitar MassHealth, SNAP e LIHEAP separadamente significa preencher as mesmas informações três vezes, em três sites diferentes." },
    { title: "Os benefícios escorregam pelas rachaduras", body: "A família média de Massachusetts perde $4.800/ano em benefícios não reivindicados — não porque não se qualificam, mas porque nunca souberam que podiam solicitar." },
  ],
  howLabel: "Como Funciona",
  howTitle: "Da confusão à cobertura em 4 etapas",
  howDesc: "Eliminamos as suposições em cada etapa — desde descobrir para o que você se qualifica, até enviar solicitações e acompanhar resultados.",
  steps: [
    { title: "Responda algumas perguntas", body: "Conte-nos sobre o tamanho da sua família, renda e situação — leva cerca de 5 minutos." },
    { title: "Veja os programas para os quais você se qualifica", body: "Nossa IA verifica instantaneamente seu perfil contra MassHealth, SNAP, EITC, LIHEAP, WIC e mais." },
    { title: "Solicite com etapas guiadas", body: "Guiamos você em cada solicitação com explicações em linguagem simples e uma lista de documentos." },
    { title: "Acompanhe tudo em um só lugar", body: "Monitore o status da solicitação, prazos de renovação e valores de benefícios pelo painel." },
  ],
  whyLabel: "Por Que HealthCompass MA",
  whyTitle: "Construído para famílias reais de Massachusetts",
  whyDesc: "Cada recurso foi projetado em torno de um objetivo: garantir que os residentes elegíveis recebam cada dólar a que têm direito, com o mínimo de atrito possível.",
  featureItems: [
    { title: "Motor de Elegibilidade com IA", body: "Verifique seu perfil contra 9+ programas estaduais e federais em segundos — sem papelada." },
    { title: "Acumulação de Benefícios", body: "A maioria dos programas pode ser combinada. Mostramos todos os programas para os quais você se qualifica, não apenas um." },
    { title: "Solicitações Guiadas", body: "Guias passo a passo com explicações em linguagem simples, listas de documentos e validação em tempo real." },
    { title: "Assistente de Chat com IA", body: "Faça perguntas a qualquer momento. Nosso assistente MassHealth explica programas, prazos e próximas etapas." },
    { title: "6 Idiomas", body: "Suporte completo para inglês, 简体中文, español, português, kreyòl ayisyen e tiếng việt." },
    { title: "Privado e Seguro", body: "Seus dados são criptografados de ponta a ponta e nunca vendidos. Você controla o que compartilha e com quem." },
    { title: "Assistência para Recurso", body: "IA treinada em casos reais de negação MassHealth. Cole seu aviso, obtenha uma lista de evidências personalizada." },
    { title: "Chat ao Vivo com Assistente Social", body: "Conecte-se diretamente com um assistente social licenciado via mensagens em tempo real e notas de voz." },
    { title: "Mensagens de Voz", body: "Envie mensagens de voz para seu assistente social — transcritas automaticamente na entrega." },
    { title: "Tradução Automática", body: "Fale em qualquer idioma. Mensagens de voz são transcritas e traduzidas para o inglês usando IA." },
  ],
  statLabels: ["Programas de benefícios verificados", "Idiomas suportados", "Tempo médio para solicitar", "Benefício mensal combinado máximo"],
  liveFeatureLabel: "Novo Recurso",
  liveTitleLine1: "Suporte humano real,",
  liveTitleLine2: "em qualquer idioma",
  liveDesc: "Às vezes você precisa de mais do que uma IA. HealthCompass MA conecta você diretamente com assistentes sociais licenciados — com mensagens de voz, tradução automática e compartilhamento de tela.",
  liveChecklist: [
    "Mensagens diretas em tempo real com seu assistente social designado",
    "Mensagens de voz com transcrição automática de IA na entrega",
    "Tradução automática instantânea — fale qualquer idioma, leia em inglês",
    "Compartilhamento de tela para orientação passo a passo de solicitações",
    "Compartilhamento seguro de arquivos e imagens no chat",
  ],
  liveCards: [
    { title: "Mensagens Diretas", body: "Chat seguro em tempo real entre pacientes e assistentes sociais — sem ligações perdidas, sem salas de espera." },
    { title: "Notas de Voz", body: "Grave e envie mensagens de voz — transcritas automaticamente para que o outro lado possa ler ou ouvir." },
    { title: "Tradução Automática", body: "Whisper detecta o idioma; Ollama traduz para inglês — instantaneamente, sem intérprete humano." },
    { title: "Compartilhamento de Tela", body: "Assistentes sociais podem compartilhar sua tela para guiar pacientes em formulários complexos em tempo real." },
  ],
  btnGetConnected: "Conectar-se",
  appealBadge: "IA treinada em negações reais do MassHealth",
  appealTitleLine1: "Foi negado? Nossa IA",
  appealTitleLine2: "já viu isso antes",
  appealDesc: "Nosso modelo é treinado em milhares de casos reais de negação do MassHealth — e aprende com cada novo caso enviado. Cole seu aviso e obtenha uma lista de evidências personalizada, argumentos legais e uma carta de recurso em minutos.",
  appealChecklist: [
    "IA treinada em milhares de casos reais de negação MassHealth — e melhorando com cada novo",
    "Pesquisa RAG extrai de regulamentos oficiais, guias de assistência jurídica e registros judiciais",
    "Lista de evidências adaptada à sua categoria exata de negação",
    "Carta de recurso citada baseada em fontes legais reais, não modelos genéricos",
    "O modelo fica mais inteligente quanto mais negações a comunidade compartilha",
  ],
  appealCards: [
    { title: "Treinado em Negações Reais", body: "Nosso modelo é ajustado em avisos reais de negação MassHealth. Reconhece padrões — e sabe como tribunais e EOHHS os resolvem." },
    { title: "Pesquisa Regulatória", body: "Cada resposta é fundamentada em CMRs MassHealth, boletins de política EOHHS e recursos de assistência jurídica." },
    { title: "Lista de Evidências", body: "Cole seu aviso de negação e obtenha uma lista de documentos personalizada — exatamente o que você precisa para construir seu caso." },
    { title: "Melhora com o Tempo", body: "Cada negação real enviada à plataforma treina a próxima versão do modelo — tornando cada recurso futuro mais forte." },
  ],
  btnTryAppealAI: "Experimentar IA de Carta de Recurso",
  btnCreateAccount: "Criar Conta Grátis",
  testimonialsLabel: "Histórias Reais",
  testimonialsTitle: "Ajuda real para famílias reais",
  ctaTitle: "Pare de perder benefícios que você já ganhou",
  ctaDesc: "Leva 15 minutos. É completamente gratuito. A família média descobre mais de $2.400/mês em benefícios disponíveis.",
  btnCTAEligibility: "Verificar Minha Elegibilidade — Grátis",
  btnCTASignIn: "Entrar para Continuar",
  footerDesc: "Ajudando residentes de Massachusetts a descobrir e acessar os benefícios de saúde e sociais que merecem.",
  footerProgramsLabel: "Programas",
  footerPlatformLabel: "Plataforma",
  footerSupportLabel: "Suporte",
  footerProgramLinks: ["MassHealth", "SNAP / Assistência Alimentar", "Créditos Fiscais EITC", "Auxílio Energia LIHEAP"],
  footerPlatformLinks: ["Verificador de Elegibilidade", "Ferramenta de Acumulação", "Assistência ao Vivo", "Assistência para Recurso", "Carta de Recurso (IA)", "Centro de Conhecimento", "Criar Conta"],
  footerCopyright: "© 2026 HealthCompass MA. Não afiliado ao Commonwealth de Massachusetts. Todos os direitos reservados.",
}

// ── Vietnamese ────────────────────────────────────────────────────────────────

const VI: LandingCopy = {
  navProblem: "Vấn Đề",
  navHowItWorks: "Cách Thức Hoạt Động",
  navWhyUs: "Tại Sao Chọn Chúng Tôi",
  navLiveAssistance: "Hỗ Trợ Trực Tiếp",
  navAppealHelp: "Hỗ Trợ Kháng Cáo",
  navResources: "Tài Nguyên",
  signIn: "Đăng Nhập",
  getStarted: "Bắt Đầu",
  newLabel: "MỚI",
  aiLabel: "AI",
  heroBadge: "Điều hướng phúc lợi bằng AI cho Massachusetts",
  heroH1Line1: "Tìm mọi phúc lợi",
  heroH1Shimmer: "bạn xứng đáng được nhận",
  heroDesc: "Cư dân Massachusetts bỏ lỡ hàng nghìn đô la phúc lợi hàng năm vì hệ thống quá phức tạp. HealthCompass MA kiểm tra 9+ chương trình cùng một lúc và hướng dẫn bạn qua từng đơn xin — miễn phí.",
  heroTags: ["Miễn phí", "9+ chương trình", "6 ngôn ngữ", "Tin nhắn thoại", "~15 phút để nộp đơn"],
  btnCheckEligibility: "Kiểm Tra Tư Cách Của Tôi",
  btnStartApplication: "Bắt Đầu Đơn Xin",
  previewAnalyzing: "Đang phân tích tư cách của bạn…",
  previewResult: "🎉 Tìm thấy 4 chương trình — lên đến $2.400/tháng phúc lợi",
  previewMissedBenefit: "💡 Phát hiện phúc lợi bị bỏ lỡ",
  previewSaved: "✅ Đơn xin đã lưu",
  previewLanguages: "🌐 Hỗ trợ 6 ngôn ngữ",
  previewVoice: "🎙️ Giọng nói + dịch tự động",
  probLabel: "Vấn Đề",
  probTitle: "Phúc lợi tồn tại — nhưng gần như không thể điều hướng",
  probDesc: "Massachusetts cung cấp hàng tỷ đô la viện trợ hàng năm cho hàng chục chương trình. Tuy nhiên, hầu hết cư dân đủ điều kiện bỏ lỡ vì quy trình bị phân mảnh, khó hiểu và mất thời gian.",
  problemItems: [
    { title: "Bạn không biết mình đủ điều kiện gì", body: "Với hơn 30 chương trình tiểu bang và liên bang, mỗi chương trình có giới hạn thu nhập và quy định khác nhau, hầu hết mọi người không biết mình được hưởng phúc lợi nào." },
    { title: "Mỗi chương trình có giấy tờ riêng", body: "Nộp đơn riêng cho MassHealth, SNAP và LIHEAP có nghĩa là điền thông tin tương tự ba lần, trên ba trang web khác nhau." },
    { title: "Phúc lợi lọt qua kẽ hở", body: "Gia đình trung bình ở Massachusetts bỏ lỡ $4.800/năm phúc lợi chưa được nhận — không phải vì họ không đủ điều kiện, mà vì họ không biết có thể nộp đơn." },
  ],
  howLabel: "Cách Thức Hoạt Động",
  howTitle: "Từ bối rối đến được bảo hiểm trong 4 bước",
  howDesc: "Chúng tôi loại bỏ sự đoán mò ở mọi giai đoạn — từ việc tìm hiểu bạn đủ điều kiện gì, đến nộp đơn và theo dõi kết quả.",
  steps: [
    { title: "Trả lời một vài câu hỏi", body: "Cho chúng tôi biết về quy mô hộ gia đình, thu nhập và tình huống của bạn — mất khoảng 5 phút." },
    { title: "Xem các chương trình bạn đủ điều kiện", body: "AI của chúng tôi ngay lập tức kiểm tra hồ sơ của bạn với MassHealth, SNAP, EITC, LIHEAP, WIC và nhiều hơn nữa." },
    { title: "Nộp đơn với các bước hướng dẫn", body: "Chúng tôi hướng dẫn bạn qua từng đơn xin với giải thích ngôn ngữ đơn giản và danh sách tài liệu." },
    { title: "Theo dõi tất cả trong một nơi", body: "Theo dõi trạng thái đơn xin, thời hạn gia hạn và số tiền phúc lợi từ bảng điều khiển của bạn." },
  ],
  whyLabel: "Tại Sao HealthCompass MA",
  whyTitle: "Được xây dựng cho các gia đình Massachusetts thực sự",
  whyDesc: "Mỗi tính năng được thiết kế xung quanh một mục tiêu: đảm bảo cư dân đủ điều kiện nhận mọi đô la họ được hưởng, với ít ma sát nhất có thể.",
  featureItems: [
    { title: "Công Cụ Kiểm Tra Tư Cách AI", body: "Kiểm tra hồ sơ của bạn với 9+ chương trình tiểu bang và liên bang trong vài giây — không cần giấy tờ." },
    { title: "Tích Lũy Phúc Lợi", body: "Hầu hết các chương trình có thể kết hợp. Chúng tôi hiển thị mọi chương trình bạn đủ điều kiện, không chỉ một." },
    { title: "Đơn Xin Có Hướng Dẫn", body: "Hướng dẫn từng bước với giải thích ngôn ngữ đơn giản, danh sách tài liệu và xác thực thời gian thực." },
    { title: "Trợ Lý Chat AI", body: "Đặt câu hỏi bất cứ lúc nào. Trợ lý MassHealth của chúng tôi giải thích các chương trình, thời hạn và các bước tiếp theo." },
    { title: "6 Ngôn Ngữ", body: "Hỗ trợ đầy đủ cho tiếng Anh, 简体中文, español, português, kreyòl ayisyen và tiếng Việt." },
    { title: "Riêng Tư & An Toàn", body: "Dữ liệu của bạn được mã hóa đầu cuối và không bao giờ bán. Bạn kiểm soát những gì bạn chia sẻ và với ai." },
    { title: "Hỗ Trợ Kháng Cáo", body: "AI được đào tạo trên các trường hợp từ chối MassHealth thực tế. Dán thông báo của bạn, nhận danh sách bằng chứng tùy chỉnh." },
    { title: "Chat Trực Tiếp Với Nhân Viên Xã Hội", body: "Kết nối trực tiếp với nhân viên xã hội có giấy phép qua nhắn tin thời gian thực và ghi chú thoại." },
    { title: "Tin Nhắn Thoại", body: "Gửi tin nhắn thoại cho nhân viên xã hội của bạn — được tự động phiên âm khi giao hàng." },
    { title: "Dịch Tự Động", body: "Nói bằng bất kỳ ngôn ngữ nào. Tin nhắn thoại được phiên âm và dịch sang tiếng Anh ngay lập tức bằng AI." },
  ],
  statLabels: ["Chương trình phúc lợi được kiểm tra", "Ngôn ngữ được hỗ trợ", "Thời gian trung bình để nộp đơn", "Phúc lợi hàng tháng kết hợp tối đa"],
  liveFeatureLabel: "Tính Năng Mới",
  liveTitleLine1: "Hỗ trợ con người thực sự,",
  liveTitleLine2: "bằng mọi ngôn ngữ",
  liveDesc: "Đôi khi bạn cần nhiều hơn AI. HealthCompass MA kết nối bạn trực tiếp với nhân viên xã hội có giấy phép — với tin nhắn thoại, dịch tự động và chia sẻ màn hình được tích hợp sẵn.",
  liveChecklist: [
    "Nhắn tin trực tiếp thời gian thực với nhân viên xã hội được chỉ định của bạn",
    "Tin nhắn thoại với phiên âm AI tự động khi giao hàng",
    "Dịch tự động tức thì — nói bất kỳ ngôn ngữ nào, đọc bằng tiếng Anh",
    "Chia sẻ màn hình để hướng dẫn từng bước nộp đơn",
    "Chia sẻ file và hình ảnh an toàn trong chat",
  ],
  liveCards: [
    { title: "Nhắn Tin Trực Tiếp", body: "Chat bảo mật, thời gian thực giữa bệnh nhân và nhân viên xã hội — không có cuộc gọi nhỡ, không có phòng chờ." },
    { title: "Ghi Chú Thoại", body: "Ghi và gửi tin nhắn thoại — được tự động phiên âm để bên kia có thể đọc hoặc nghe." },
    { title: "Dịch Tự Động", body: "Whisper phát hiện ngôn ngữ; Ollama dịch sang tiếng Anh — ngay lập tức, không cần phiên dịch viên người." },
    { title: "Chia Sẻ Màn Hình", body: "Nhân viên xã hội có thể chia sẻ màn hình của họ để hướng dẫn bệnh nhân qua các biểu mẫu phức tạp theo thời gian thực." },
  ],
  btnGetConnected: "Kết Nối Ngay",
  appealBadge: "AI được đào tạo trên các từ chối MassHealth thực tế",
  appealTitleLine1: "Bị từ chối? AI của chúng tôi",
  appealTitleLine2: "đã gặp điều này trước đây",
  appealDesc: "Mô hình của chúng tôi được đào tạo trên hàng nghìn trường hợp từ chối MassHealth thực tế — và học từ mỗi trường hợp mới được gửi. Dán thông báo của bạn và nhận danh sách bằng chứng tùy chỉnh, lập luận pháp lý và bản thảo thư kháng cáo được trích dẫn đầy đủ trong vài phút.",
  appealChecklist: [
    "AI được đào tạo trên hàng nghìn trường hợp từ chối MassHealth thực tế — và cải thiện với mỗi trường hợp mới",
    "Nghiên cứu RAG kéo từ các quy định chính thức, hướng dẫn hỗ trợ pháp lý và hồ sơ tòa án",
    "Danh sách bằng chứng được điều chỉnh theo danh mục từ chối chính xác của bạn",
    "Thư kháng cáo được trích dẫn dựa trên các nguồn pháp lý thực sự, không phải mẫu chung",
    "Mô hình trở nên thông minh hơn khi cộng đồng chia sẻ nhiều từ chối hơn",
  ],
  appealCards: [
    { title: "Được Đào Tạo Trên Từ Chối Thực Tế", body: "Mô hình của chúng tôi được tinh chỉnh trên các thông báo từ chối MassHealth thực tế. Nó nhận ra các mẫu — và biết cách tòa án và EOHHS giải quyết chúng." },
    { title: "Nghiên Cứu Quy Định", body: "Mọi câu trả lời đều dựa trên CMR MassHealth, bản tin chính sách EOHHS và tài nguyên hỗ trợ pháp lý." },
    { title: "Danh Sách Bằng Chứng", body: "Dán thông báo từ chối của bạn và nhận danh sách tài liệu tùy chỉnh — chính xác những gì bạn cần để xây dựng vụ của mình." },
    { title: "Cải Thiện Theo Thời Gian", body: "Mỗi từ chối thực tế được gửi lên nền tảng đào tạo phiên bản tiếp theo của mô hình — làm cho mọi kháng cáo trong tương lai mạnh mẽ hơn." },
  ],
  btnTryAppealAI: "Thử AI Thư Kháng Cáo",
  btnCreateAccount: "Tạo Tài Khoản Miễn Phí",
  testimonialsLabel: "Câu Chuyện Thực Tế",
  testimonialsTitle: "Giúp đỡ thực sự cho các gia đình thực sự",
  ctaTitle: "Hãy ngừng bỏ lỡ phúc lợi bạn đã kiếm được",
  ctaDesc: "Mất 15 phút. Hoàn toàn miễn phí. Gia đình trung bình khám phá hơn $2.400/tháng phúc lợi có sẵn.",
  btnCTAEligibility: "Kiểm Tra Tư Cách Của Tôi — Miễn Phí",
  btnCTASignIn: "Đăng Nhập Để Tiếp Tục",
  footerDesc: "Giúp cư dân Massachusetts khám phá và tiếp cận các phúc lợi y tế và xã hội mà họ xứng đáng được nhận.",
  footerProgramsLabel: "Chương Trình",
  footerPlatformLabel: "Nền Tảng",
  footerSupportLabel: "Hỗ Trợ",
  footerProgramLinks: ["MassHealth", "SNAP / Hỗ Trợ Thực Phẩm", "Tín Thuế EITC", "Hỗ Trợ Năng Lượng LIHEAP"],
  footerPlatformLinks: ["Kiểm Tra Tư Cách", "Công Cụ Tích Lũy Phúc Lợi", "Hỗ Trợ Trực Tiếp", "Hỗ Trợ Kháng Cáo", "Thư Kháng Cáo (AI)", "Trung Tâm Kiến Thức", "Tạo Tài Khoản"],
  footerCopyright: "© 2026 HealthCompass MA. Không liên kết với Commonwealth of Massachusetts. Bảo lưu mọi quyền.",
}

// ── Lookup ────────────────────────────────────────────────────────────────────

const COPIES: Record<SupportedLanguage, LandingCopy> = {
  en:      EN,
  "zh-CN": ZH_CN,
  ht:      HT,
  "pt-BR": PT_BR,
  es:      ES,
  vi:      VI,
}

export function getLandingCopy(language: SupportedLanguage): LandingCopy {
  return COPIES[language] ?? EN
}
