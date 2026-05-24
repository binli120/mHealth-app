/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Localised copy for the Create Account / registration flow.
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"

export interface RegisterCopy {
  // Header / page title
  backToHome: string
  pageTitle: string
  // Role select
  roleTitle: string
  roleDescription: string
  roleApplicantLabel: string
  roleApplicantDescription: string
  roleSocialWorkerLabel: string
  roleSocialWorkerDescription: string
  orSignUpQuickly: string
  continueWithGoogle: string
  googleNote: string
  alreadyHaveAccount: string
  signIn: string
  // Company search
  back: string
  companyTitle: string
  companyDescription: string
  companyPlaceholder: string
  companyApproved: string
  companyNoResults: string
  // Form step
  swAccountTitle: string
  applicantAccountTitle: string
  swAccountDescription: string
  applicantAccountDescription: string
  emailDomainNote: string
  firstNameLabel: string
  firstNamePlaceholder: string
  lastNameLabel: string
  lastNamePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  emailSwPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  jobTitleLabel: string
  jobTitlePlaceholder: string
  licenseLabel: string
  licenseOptional: string
  licensePlaceholder: string
  passwordLabel: string
  passwordPlaceholder: string
  passwordHint: string
  /** Password strength meter labels and rule descriptions. */
  password: PasswordCopy
  swReviewNotice: string
  createAccountButton: string
  creatingAccount: string
  // Verify email step
  verifyTitle: string
  verifySentTo: string
  swVerifyNotice: string
  resendButton: string
  sending: string
  goToSignIn: string
  // Footer
  needHelp: string
  // Validation errors
  emailRequired: string
  passwordTooWeak: string
  emailDomainMismatch: string
  selectCompanyFirst: string
}

export interface PasswordCopy {
  strengthLabels: Record<"weak" | "fair" | "good" | "strong", string>
  rules: Record<"length" | "uppercase" | "lowercase" | "digit" | "special", string>
}

const PASSWORD_COPY: Record<SupportedLanguage, PasswordCopy> = {
  en: {
    strengthLabels: { weak: "Weak", fair: "Fair", good: "Good", strong: "Strong" },
    rules: {
      length:    "At least 12 characters",
      uppercase: "One uppercase letter (A–Z)",
      lowercase: "One lowercase letter (a–z)",
      digit:     "One number (0–9)",
      special:   "One special character (!@#$…)",
    },
  },
  "zh-CN": {
    strengthLabels: { weak: "弱", fair: "一般", good: "良好", strong: "强" },
    rules: {
      length:    "至少 12 个字符",
      uppercase: "一个大写字母（A–Z）",
      lowercase: "一个小写字母（a–z）",
      digit:     "一个数字（0–9）",
      special:   "一个特殊字符（!@#$…）",
    },
  },
  ht: {
    strengthLabels: { weak: "Fèb", fair: "Mwayen", good: "Bon", strong: "Fò" },
    rules: {
      length:    "Omwen 12 karaktè",
      uppercase: "Yon lèt majiskil (A–Z)",
      lowercase: "Yon lèt miniskil (a–z)",
      digit:     "Yon chif (0–9)",
      special:   "Yon karaktè espesyal (!@#$…)",
    },
  },
  "pt-BR": {
    strengthLabels: { weak: "Fraca", fair: "Regular", good: "Boa", strong: "Forte" },
    rules: {
      length:    "Pelo menos 12 caracteres",
      uppercase: "Uma letra maiúscula (A–Z)",
      lowercase: "Uma letra minúscula (a–z)",
      digit:     "Um número (0–9)",
      special:   "Um caractere especial (!@#$…)",
    },
  },
  es: {
    strengthLabels: { weak: "Débil", fair: "Regular", good: "Buena", strong: "Fuerte" },
    rules: {
      length:    "Al menos 12 caracteres",
      uppercase: "Una letra mayúscula (A–Z)",
      lowercase: "Una letra minúscula (a–z)",
      digit:     "Un número (0–9)",
      special:   "Un carácter especial (!@#$…)",
    },
  },
  vi: {
    strengthLabels: { weak: "Yếu", fair: "Trung bình", good: "Tốt", strong: "Mạnh" },
    rules: {
      length:    "Ít nhất 12 ký tự",
      uppercase: "Một chữ hoa (A–Z)",
      lowercase: "Một chữ thường (a–z)",
      digit:     "Một chữ số (0–9)",
      special:   "Một ký tự đặc biệt (!@#$…)",
    },
  },
}

const COPY: Record<SupportedLanguage, RegisterCopy> = {
  en: {
    backToHome: "Back to Home",
    pageTitle: "Create Account",
    roleTitle: "I am…",
    roleDescription: "Choose how you want to use HealthCompass MA",
    roleApplicantLabel: "Applying for Benefits",
    roleApplicantDescription: "I want to apply for MassHealth or other benefit programs",
    roleSocialWorkerLabel: "Social Worker / Case Manager",
    roleSocialWorkerDescription: "I help clients apply for benefits at a licensed agency",
    orSignUpQuickly: "Or sign up quickly",
    continueWithGoogle: "Continue with Google",
    googleNote: "Google sign-up creates a benefit applicant account",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign in",
    back: "Back",
    companyTitle: "Find Your Agency",
    companyDescription: "Search for the social work agency or organization you work for",
    companyPlaceholder: "Agency name (e.g. 'Boston Medical')",
    companyApproved: "✓ Approved",
    companyNoResults: "No results yet — click search or press Enter",
    swAccountTitle: "Social Worker Account",
    applicantAccountTitle: "Account Information",
    swAccountDescription: "Use your company email address to register",
    applicantAccountDescription: "Create an account to save your progress",
    emailDomainNote: "must end in @{domain}",
    firstNameLabel: "First Name",
    firstNamePlaceholder: "John",
    lastNameLabel: "Last Name",
    lastNamePlaceholder: "Doe",
    emailLabel: "Email Address",
    emailPlaceholder: "you@example.com",
    emailSwPlaceholder: "you@{domain}",
    phoneLabel: "Phone Number",
    phonePlaceholder: "(555) 123-4567",
    jobTitleLabel: "Job Title",
    jobTitlePlaceholder: "e.g. Case Manager, Social Worker",
    licenseLabel: "License Number",
    licenseOptional: "(optional)",
    licensePlaceholder: "e.g. LCSW-123456",
    passwordLabel: "Create Password",
    passwordPlaceholder: "Create a strong password",
    passwordHint: "Must meet all requirements below",
    password: PASSWORD_COPY.en,
    swReviewNotice: "Your account will be reviewed by an admin before you can access the social worker portal.",
    createAccountButton: "Create Account",
    creatingAccount: "Creating Account…",
    verifyTitle: "Verify Your Email",
    verifySentTo: "We sent a confirmation link to",
    swVerifyNotice: "After email verification, an admin will review and approve your account.",
    resendButton: "Resend Confirmation Email",
    sending: "Sending…",
    goToSignIn: "Go to Sign In",
    needHelp: "Need help? Email",
    emailRequired: "Email is required.",
    passwordTooWeak: "Please create a stronger password that meets all requirements.",
    emailDomainMismatch: "Your email must use your company domain (@{domain}).",
    selectCompanyFirst: "Please select your company first.",
  },

  "zh-CN": {
    backToHome: "返回首页",
    pageTitle: "创建账户",
    roleTitle: "我是…",
    roleDescription: "选择您使用 HealthCompass MA 的方式",
    roleApplicantLabel: "申请福利",
    roleApplicantDescription: "我想申请 MassHealth 或其他福利项目",
    roleSocialWorkerLabel: "社会工作者 / 案例管理员",
    roleSocialWorkerDescription: "我在持牌机构帮助客户申请福利",
    orSignUpQuickly: "或快速注册",
    continueWithGoogle: "使用 Google 继续",
    googleNote: "Google 注册将创建福利申请账户",
    alreadyHaveAccount: "已有账户？",
    signIn: "登录",
    back: "返回",
    companyTitle: "查找您的机构",
    companyDescription: "搜索您所在的社会工作机构或组织",
    companyPlaceholder: "机构名称（例如 'Boston Medical'）",
    companyApproved: "✓ 已认证",
    companyNoResults: "暂无结果 — 点击搜索或按回车键",
    swAccountTitle: "社会工作者账户",
    applicantAccountTitle: "账户信息",
    swAccountDescription: "请使用公司邮箱地址注册",
    applicantAccountDescription: "创建账户以保存您的进度",
    emailDomainNote: "必须以 @{domain} 结尾",
    firstNameLabel: "名",
    firstNamePlaceholder: "张",
    lastNameLabel: "姓",
    lastNamePlaceholder: "伟",
    emailLabel: "电子邮件地址",
    emailPlaceholder: "您的邮箱@example.com",
    emailSwPlaceholder: "您的邮箱@{domain}",
    phoneLabel: "手机号码",
    phonePlaceholder: "(555) 123-4567",
    jobTitleLabel: "职位",
    jobTitlePlaceholder: "例如：案例管理员、社会工作者",
    licenseLabel: "执照号码",
    licenseOptional: "（可选）",
    licensePlaceholder: "例如：LCSW-123456",
    passwordLabel: "创建密码",
    passwordPlaceholder: "设置一个强密码",
    passwordHint: "必须满足以下所有要求",
    password: PASSWORD_COPY["zh-CN"],
    swReviewNotice: "您的账户将在管理员审核后方可访问社会工作者门户。",
    createAccountButton: "创建账户",
    creatingAccount: "正在创建账户…",
    verifyTitle: "验证您的邮箱",
    verifySentTo: "我们已向以下地址发送了确认链接：",
    swVerifyNotice: "邮箱验证后，管理员将审核并批准您的账户。",
    resendButton: "重新发送确认邮件",
    sending: "发送中…",
    goToSignIn: "前往登录",
    needHelp: "需要帮助？请发送邮件至",
    emailRequired: "请输入电子邮件地址。",
    passwordTooWeak: "请创建满足所有要求的更强密码。",
    emailDomainMismatch: "您的邮箱必须使用公司域名（@{domain}）。",
    selectCompanyFirst: "请先选择您的公司。",
  },

  ht: {
    backToHome: "Retounen nan Akèy",
    pageTitle: "Kreye Kont",
    roleTitle: "Mwen se…",
    roleDescription: "Chwazi kijan ou vle itilize HealthCompass MA",
    roleApplicantLabel: "Mande Benefis",
    roleApplicantDescription: "Mwen vle aplike pou MassHealth oswa lòt pwogram benefis",
    roleSocialWorkerLabel: "Travayè Sosyal / Jestyon Ka",
    roleSocialWorkerDescription: "Mwen ede kliyan aplike pou benefis nan yon ajans otorize",
    orSignUpQuickly: "Oswa enskri rapidman",
    continueWithGoogle: "Kontinye avèk Google",
    googleNote: "Enskri ak Google kreye yon kont demann benefis",
    alreadyHaveAccount: "Déjà gen yon kont?",
    signIn: "Konekte",
    back: "Retounen",
    companyTitle: "Jwenn Ajans Ou",
    companyDescription: "Chèche ajans travay sosyal oswa òganizasyon ou travay pou",
    companyPlaceholder: "Non ajans (pa egzanp 'Boston Medical')",
    companyApproved: "✓ Apwouve",
    companyNoResults: "Pa gen rezilta — klike chèche oswa peze Antre",
    swAccountTitle: "Kont Travayè Sosyal",
    applicantAccountTitle: "Enfòmasyon Kont",
    swAccountDescription: "Itilize adrès imèl konpayi ou pou enskri",
    applicantAccountDescription: "Kreye yon kont pou sove pwogrè ou",
    emailDomainNote: "dwe fini ak @{domain}",
    firstNameLabel: "Prenon",
    firstNamePlaceholder: "Jean",
    lastNameLabel: "Siyati",
    lastNamePlaceholder: "Pierre",
    emailLabel: "Adrès Imèl",
    emailPlaceholder: "ou@egzanp.com",
    emailSwPlaceholder: "ou@{domain}",
    phoneLabel: "Nimewo Telefòn",
    phonePlaceholder: "(555) 123-4567",
    jobTitleLabel: "Tit Travay",
    jobTitlePlaceholder: "pa egzanp Jestyon Ka, Travayè Sosyal",
    licenseLabel: "Nimewo Lisans",
    licenseOptional: "(opsyonèl)",
    licensePlaceholder: "pa egzanp LCSW-123456",
    passwordLabel: "Kreye Modpas",
    passwordPlaceholder: "Kreye yon modpas solid",
    passwordHint: "Dwe satisfè tout egzijans anba yo",
    password: PASSWORD_COPY.ht,
    swReviewNotice: "Kont ou ap revize pa yon administratè anvan ou ka aksede pòtay travayè sosyal la.",
    createAccountButton: "Kreye Kont",
    creatingAccount: "Ap kreye kont…",
    verifyTitle: "Verifye Imèl Ou",
    verifySentTo: "Nou te voye yon lyen konfirmasyon a",
    swVerifyNotice: "Apre verifikasyon imèl, yon administratè pral revize epi apwouve kont ou.",
    resendButton: "Voye Imèl Konfirmasyon Ankò",
    sending: "Ap voye…",
    goToSignIn: "Ale nan Koneksyon",
    needHelp: "Bezwen èd? Imèl",
    emailRequired: "Adrès imèl obligatwa.",
    passwordTooWeak: "Tanpri kreye yon modpas ki satisfè tout egzijans yo.",
    emailDomainMismatch: "Imèl ou dwe itilize domèn konpayi a (@{domain}).",
    selectCompanyFirst: "Tanpri chwazi konpayi ou an premye.",
  },

  "pt-BR": {
    backToHome: "Voltar ao Início",
    pageTitle: "Criar Conta",
    roleTitle: "Eu sou…",
    roleDescription: "Escolha como deseja usar o HealthCompass MA",
    roleApplicantLabel: "Solicitando Benefícios",
    roleApplicantDescription: "Quero me inscrever no MassHealth ou em outros programas de benefícios",
    roleSocialWorkerLabel: "Assistente Social / Gestor de Casos",
    roleSocialWorkerDescription: "Ajudo clientes a se inscreverem em benefícios em uma agência licenciada",
    orSignUpQuickly: "Ou cadastre-se rapidamente",
    continueWithGoogle: "Continuar com o Google",
    googleNote: "Cadastro com Google cria uma conta de solicitante de benefícios",
    alreadyHaveAccount: "Já tem uma conta?",
    signIn: "Entrar",
    back: "Voltar",
    companyTitle: "Encontre Sua Agência",
    companyDescription: "Pesquise a agência de serviço social ou organização em que você trabalha",
    companyPlaceholder: "Nome da agência (ex: 'Boston Medical')",
    companyApproved: "✓ Aprovado",
    companyNoResults: "Sem resultados ainda — clique em pesquisar ou pressione Enter",
    swAccountTitle: "Conta de Assistente Social",
    applicantAccountTitle: "Informações da Conta",
    swAccountDescription: "Use o endereço de e-mail da sua empresa para se registrar",
    applicantAccountDescription: "Crie uma conta para salvar seu progresso",
    emailDomainNote: "deve terminar em @{domain}",
    firstNameLabel: "Nome",
    firstNamePlaceholder: "João",
    lastNameLabel: "Sobrenome",
    lastNamePlaceholder: "Silva",
    emailLabel: "Endereço de E-mail",
    emailPlaceholder: "voce@exemplo.com",
    emailSwPlaceholder: "voce@{domain}",
    phoneLabel: "Número de Telefone",
    phonePlaceholder: "(555) 123-4567",
    jobTitleLabel: "Cargo",
    jobTitlePlaceholder: "ex: Gestor de Casos, Assistente Social",
    licenseLabel: "Número de Licença",
    licenseOptional: "(opcional)",
    licensePlaceholder: "ex: LCSW-123456",
    passwordLabel: "Criar Senha",
    passwordPlaceholder: "Crie uma senha forte",
    passwordHint: "Deve atender a todos os requisitos abaixo",
    password: PASSWORD_COPY["pt-BR"],
    swReviewNotice: "Sua conta será revisada por um administrador antes de acessar o portal do assistente social.",
    createAccountButton: "Criar Conta",
    creatingAccount: "Criando Conta…",
    verifyTitle: "Verifique Seu E-mail",
    verifySentTo: "Enviamos um link de confirmação para",
    swVerifyNotice: "Após a verificação do e-mail, um administrador revisará e aprovará sua conta.",
    resendButton: "Reenviar E-mail de Confirmação",
    sending: "Enviando…",
    goToSignIn: "Ir para Login",
    needHelp: "Precisa de ajuda? E-mail",
    emailRequired: "O e-mail é obrigatório.",
    passwordTooWeak: "Por favor, crie uma senha mais forte que atenda a todos os requisitos.",
    emailDomainMismatch: "Seu e-mail deve usar o domínio da empresa (@{domain}).",
    selectCompanyFirst: "Por favor, selecione sua empresa primeiro.",
  },

  es: {
    backToHome: "Volver al Inicio",
    pageTitle: "Crear Cuenta",
    roleTitle: "Yo soy…",
    roleDescription: "Elige cómo quieres usar HealthCompass MA",
    roleApplicantLabel: "Solicitando Beneficios",
    roleApplicantDescription: "Quiero solicitar MassHealth u otros programas de beneficios",
    roleSocialWorkerLabel: "Trabajador Social / Gestor de Casos",
    roleSocialWorkerDescription: "Ayudo a clientes a solicitar beneficios en una agencia autorizada",
    orSignUpQuickly: "O regístrate rápidamente",
    continueWithGoogle: "Continuar con Google",
    googleNote: "El registro con Google crea una cuenta de solicitante de beneficios",
    alreadyHaveAccount: "¿Ya tienes una cuenta?",
    signIn: "Iniciar sesión",
    back: "Atrás",
    companyTitle: "Encuentra Tu Agencia",
    companyDescription: "Busca la agencia de trabajo social u organización donde trabajas",
    companyPlaceholder: "Nombre de agencia (ej: 'Boston Medical')",
    companyApproved: "✓ Aprobado",
    companyNoResults: "Sin resultados todavía — haz clic en buscar o presiona Enter",
    swAccountTitle: "Cuenta de Trabajador Social",
    applicantAccountTitle: "Información de la Cuenta",
    swAccountDescription: "Usa el correo electrónico de tu empresa para registrarte",
    applicantAccountDescription: "Crea una cuenta para guardar tu progreso",
    emailDomainNote: "debe terminar en @{domain}",
    firstNameLabel: "Nombre",
    firstNamePlaceholder: "Juan",
    lastNameLabel: "Apellido",
    lastNamePlaceholder: "García",
    emailLabel: "Correo Electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    emailSwPlaceholder: "tu@{domain}",
    phoneLabel: "Número de Teléfono",
    phonePlaceholder: "(555) 123-4567",
    jobTitleLabel: "Cargo",
    jobTitlePlaceholder: "ej: Gestor de Casos, Trabajador Social",
    licenseLabel: "Número de Licencia",
    licenseOptional: "(opcional)",
    licensePlaceholder: "ej: LCSW-123456",
    passwordLabel: "Crear Contraseña",
    passwordPlaceholder: "Crea una contraseña segura",
    passwordHint: "Debe cumplir todos los requisitos a continuación",
    password: PASSWORD_COPY.es,
    swReviewNotice: "Tu cuenta será revisada por un administrador antes de que puedas acceder al portal del trabajador social.",
    createAccountButton: "Crear Cuenta",
    creatingAccount: "Creando Cuenta…",
    verifyTitle: "Verifica Tu Correo",
    verifySentTo: "Enviamos un enlace de confirmación a",
    swVerifyNotice: "Después de la verificación del correo, un administrador revisará y aprobará tu cuenta.",
    resendButton: "Reenviar Correo de Confirmación",
    sending: "Enviando…",
    goToSignIn: "Ir a Iniciar Sesión",
    needHelp: "¿Necesitas ayuda? Correo",
    emailRequired: "El correo electrónico es obligatorio.",
    passwordTooWeak: "Por favor, crea una contraseña más segura que cumpla todos los requisitos.",
    emailDomainMismatch: "Tu correo debe usar el dominio de tu empresa (@{domain}).",
    selectCompanyFirst: "Por favor, selecciona tu empresa primero.",
  },

  vi: {
    backToHome: "Quay lại Trang chủ",
    pageTitle: "Tạo Tài Khoản",
    roleTitle: "Tôi là…",
    roleDescription: "Chọn cách bạn muốn sử dụng HealthCompass MA",
    roleApplicantLabel: "Đăng ký Phúc lợi",
    roleApplicantDescription: "Tôi muốn đăng ký MassHealth hoặc các chương trình phúc lợi khác",
    roleSocialWorkerLabel: "Nhân viên Xã hội / Quản lý Ca",
    roleSocialWorkerDescription: "Tôi giúp khách hàng đăng ký phúc lợi tại một cơ quan được cấp phép",
    orSignUpQuickly: "Hoặc đăng ký nhanh",
    continueWithGoogle: "Tiếp tục với Google",
    googleNote: "Đăng ký bằng Google tạo tài khoản người xin phúc lợi",
    alreadyHaveAccount: "Đã có tài khoản?",
    signIn: "Đăng nhập",
    back: "Quay lại",
    companyTitle: "Tìm Cơ quan của Bạn",
    companyDescription: "Tìm kiếm cơ quan hoặc tổ chức công tác xã hội mà bạn làm việc",
    companyPlaceholder: "Tên cơ quan (vd: 'Boston Medical')",
    companyApproved: "✓ Đã Duyệt",
    companyNoResults: "Chưa có kết quả — nhấp tìm kiếm hoặc nhấn Enter",
    swAccountTitle: "Tài Khoản Nhân viên Xã hội",
    applicantAccountTitle: "Thông tin Tài khoản",
    swAccountDescription: "Sử dụng địa chỉ email công ty để đăng ký",
    applicantAccountDescription: "Tạo tài khoản để lưu tiến trình của bạn",
    emailDomainNote: "phải kết thúc bằng @{domain}",
    firstNameLabel: "Tên",
    firstNamePlaceholder: "Minh",
    lastNameLabel: "Họ",
    lastNamePlaceholder: "Nguyễn",
    emailLabel: "Địa chỉ Email",
    emailPlaceholder: "ban@vidu.com",
    emailSwPlaceholder: "ban@{domain}",
    phoneLabel: "Số Điện thoại",
    phonePlaceholder: "(555) 123-4567",
    jobTitleLabel: "Chức danh",
    jobTitlePlaceholder: "vd: Quản lý Ca, Nhân viên Xã hội",
    licenseLabel: "Số Giấy phép",
    licenseOptional: "(tùy chọn)",
    licensePlaceholder: "vd: LCSW-123456",
    passwordLabel: "Tạo Mật khẩu",
    passwordPlaceholder: "Tạo mật khẩu mạnh",
    passwordHint: "Phải đáp ứng tất cả các yêu cầu bên dưới",
    password: PASSWORD_COPY.vi,
    swReviewNotice: "Tài khoản của bạn sẽ được quản trị viên xem xét trước khi bạn có thể truy cập cổng nhân viên xã hội.",
    createAccountButton: "Tạo Tài Khoản",
    creatingAccount: "Đang tạo tài khoản…",
    verifyTitle: "Xác minh Email của Bạn",
    verifySentTo: "Chúng tôi đã gửi liên kết xác nhận đến",
    swVerifyNotice: "Sau khi xác minh email, quản trị viên sẽ xem xét và phê duyệt tài khoản của bạn.",
    resendButton: "Gửi lại Email Xác nhận",
    sending: "Đang gửi…",
    goToSignIn: "Đến Trang Đăng nhập",
    needHelp: "Cần trợ giúp? Email",
    emailRequired: "Email là bắt buộc.",
    passwordTooWeak: "Vui lòng tạo mật khẩu mạnh hơn đáp ứng tất cả các yêu cầu.",
    emailDomainMismatch: "Email của bạn phải sử dụng tên miền công ty (@{domain}).",
    selectCompanyFirst: "Vui lòng chọn công ty của bạn trước.",
  },
}

export function getRegisterCopy(language: SupportedLanguage): RegisterCopy {
  return COPY[language]
}
