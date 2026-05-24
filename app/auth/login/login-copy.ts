/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Localised copy for the Sign In / login page.
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"

export interface LoginCopy {
  backToHome: string
  welcomeBack: string
  continuationSubtitle: string
  defaultSubtitle: string
  cardTitle: string
  cardDescription: string
  emailLabel: string
  emailPlaceholder: string
  passwordLabel: string
  forgotPassword: string
  passwordPlaceholder: string
  rememberEmail: string
  signInButton: string
  signingIn: string
  orContinueWith: string
  checkingPasskey: string
  signInWithPasskey: string
  signInWithGoogle: string
  noAccount: string
  createOne: string
  needHelp: string
  // Validation / error messages
  emailRequired: string
  passkeyEmailRequired: string
  passkeyNotAvailable: string
  unableSignInPasskey: string
  unableSignInGoogle: string
  unableSignIn: string
}

const COPY: Record<SupportedLanguage, LoginCopy> = {
  en: {
    backToHome: "Back to Home",
    welcomeBack: "Welcome Back",
    continuationSubtitle: "Please sign in to continue.",
    defaultSubtitle: "Sign in to your HealthCompass MA account",
    cardTitle: "Sign In",
    cardDescription: "Enter your credentials to access your account",
    emailLabel: "Email Address",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    forgotPassword: "Forgot password?",
    passwordPlaceholder: "Enter your password",
    rememberEmail: "Remember email address",
    signInButton: "Sign In",
    signingIn: "Signing in...",
    orContinueWith: "Or continue with",
    checkingPasskey: "Checking passkey...",
    signInWithPasskey: "Sign in with passkey",
    signInWithGoogle: "Sign in with Google",
    noAccount: "Don't have an account?",
    createOne: "Create one",
    needHelp: "Need help? Email",
    emailRequired: "Email is required.",
    passkeyEmailRequired: "Enter your email before using a passkey.",
    passkeyNotAvailable: "No passkey is available for this email.",
    unableSignInPasskey: "Unable to sign in with passkey.",
    unableSignInGoogle: "Unable to sign in with Google.",
    unableSignIn: "Unable to sign in.",
  },

  "zh-CN": {
    backToHome: "返回首页",
    welcomeBack: "欢迎回来",
    continuationSubtitle: "请登录以继续。",
    defaultSubtitle: "登录您的 HealthCompass MA 账户",
    cardTitle: "登录",
    cardDescription: "输入您的凭据以访问账户",
    emailLabel: "电子邮件地址",
    emailPlaceholder: "您的邮箱@example.com",
    passwordLabel: "密码",
    forgotPassword: "忘记密码？",
    passwordPlaceholder: "输入您的密码",
    rememberEmail: "记住邮箱地址",
    signInButton: "登录",
    signingIn: "登录中...",
    orContinueWith: "或使用以下方式继续",
    checkingPasskey: "正在验证通行密钥...",
    signInWithPasskey: "使用通行密钥登录",
    signInWithGoogle: "使用 Google 登录",
    noAccount: "还没有账户？",
    createOne: "立即注册",
    needHelp: "需要帮助？请发送邮件至",
    emailRequired: "请输入电子邮件地址。",
    passkeyEmailRequired: "使用通行密钥前请先输入邮箱。",
    passkeyNotAvailable: "此邮箱没有可用的通行密钥。",
    unableSignInPasskey: "无法使用通行密钥登录。",
    unableSignInGoogle: "无法使用 Google 登录。",
    unableSignIn: "无法登录。",
  },

  ht: {
    backToHome: "Retounen nan Akèy",
    welcomeBack: "Byenvini Tounen",
    continuationSubtitle: "Tanpri konekte pou kontinye.",
    defaultSubtitle: "Konekte nan kont HealthCompass MA ou",
    cardTitle: "Konekte",
    cardDescription: "Antre enfòmasyon ou pou aksede kont ou",
    emailLabel: "Adrès Imèl",
    emailPlaceholder: "ou@egzanp.com",
    passwordLabel: "Modpas",
    forgotPassword: "Bliye modpas?",
    passwordPlaceholder: "Antre modpas ou",
    rememberEmail: "Sonje adrès imèl",
    signInButton: "Konekte",
    signingIn: "Ap konekte...",
    orContinueWith: "Oswa kontinye avèk",
    checkingPasskey: "Ap verifye kle pase...",
    signInWithPasskey: "Konekte avèk kle pase",
    signInWithGoogle: "Konekte avèk Google",
    noAccount: "Ou pa gen yon kont?",
    createOne: "Kreye youn",
    needHelp: "Bezwen èd? Imèl",
    emailRequired: "Adrès imèl obligatwa.",
    passkeyEmailRequired: "Antre imèl ou anvan ou itilize kle pase.",
    passkeyNotAvailable: "Pa gen kle pase disponib pou imèl sa a.",
    unableSignInPasskey: "Pa kapab konekte avèk kle pase.",
    unableSignInGoogle: "Pa kapab konekte avèk Google.",
    unableSignIn: "Pa kapab konekte.",
  },

  "pt-BR": {
    backToHome: "Voltar ao Início",
    welcomeBack: "Bem-vindo de Volta",
    continuationSubtitle: "Por favor, entre para continuar.",
    defaultSubtitle: "Entre na sua conta HealthCompass MA",
    cardTitle: "Entrar",
    cardDescription: "Insira suas credenciais para acessar sua conta",
    emailLabel: "Endereço de E-mail",
    emailPlaceholder: "voce@exemplo.com",
    passwordLabel: "Senha",
    forgotPassword: "Esqueceu a senha?",
    passwordPlaceholder: "Digite sua senha",
    rememberEmail: "Lembrar endereço de e-mail",
    signInButton: "Entrar",
    signingIn: "Entrando...",
    orContinueWith: "Ou continue com",
    checkingPasskey: "Verificando chave de acesso...",
    signInWithPasskey: "Entrar com chave de acesso",
    signInWithGoogle: "Entrar com Google",
    noAccount: "Não tem uma conta?",
    createOne: "Crie uma",
    needHelp: "Precisa de ajuda? E-mail",
    emailRequired: "O e-mail é obrigatório.",
    passkeyEmailRequired: "Digite seu e-mail antes de usar a chave de acesso.",
    passkeyNotAvailable: "Nenhuma chave de acesso disponível para este e-mail.",
    unableSignInPasskey: "Não foi possível entrar com a chave de acesso.",
    unableSignInGoogle: "Não foi possível entrar com o Google.",
    unableSignIn: "Não foi possível entrar.",
  },

  es: {
    backToHome: "Volver al Inicio",
    welcomeBack: "Bienvenido de Nuevo",
    continuationSubtitle: "Por favor, inicia sesión para continuar.",
    defaultSubtitle: "Inicia sesión en tu cuenta de HealthCompass MA",
    cardTitle: "Iniciar Sesión",
    cardDescription: "Ingresa tus credenciales para acceder a tu cuenta",
    emailLabel: "Correo Electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    passwordLabel: "Contraseña",
    forgotPassword: "¿Olvidaste tu contraseña?",
    passwordPlaceholder: "Ingresa tu contraseña",
    rememberEmail: "Recordar correo electrónico",
    signInButton: "Iniciar Sesión",
    signingIn: "Iniciando sesión...",
    orContinueWith: "O continuar con",
    checkingPasskey: "Verificando clave de acceso...",
    signInWithPasskey: "Iniciar sesión con clave de acceso",
    signInWithGoogle: "Iniciar sesión con Google",
    noAccount: "¿No tienes una cuenta?",
    createOne: "Crea una",
    needHelp: "¿Necesitas ayuda? Correo",
    emailRequired: "El correo electrónico es obligatorio.",
    passkeyEmailRequired: "Ingresa tu correo antes de usar la clave de acceso.",
    passkeyNotAvailable: "No hay clave de acceso disponible para este correo.",
    unableSignInPasskey: "No se pudo iniciar sesión con la clave de acceso.",
    unableSignInGoogle: "No se pudo iniciar sesión con Google.",
    unableSignIn: "No se pudo iniciar sesión.",
  },

  vi: {
    backToHome: "Quay lại Trang chủ",
    welcomeBack: "Chào Mừng Trở Lại",
    continuationSubtitle: "Vui lòng đăng nhập để tiếp tục.",
    defaultSubtitle: "Đăng nhập vào tài khoản HealthCompass MA của bạn",
    cardTitle: "Đăng Nhập",
    cardDescription: "Nhập thông tin đăng nhập để truy cập tài khoản",
    emailLabel: "Địa chỉ Email",
    emailPlaceholder: "ban@vidu.com",
    passwordLabel: "Mật khẩu",
    forgotPassword: "Quên mật khẩu?",
    passwordPlaceholder: "Nhập mật khẩu của bạn",
    rememberEmail: "Ghi nhớ địa chỉ email",
    signInButton: "Đăng Nhập",
    signingIn: "Đang đăng nhập...",
    orContinueWith: "Hoặc tiếp tục với",
    checkingPasskey: "Đang kiểm tra khóa truy cập...",
    signInWithPasskey: "Đăng nhập bằng khóa truy cập",
    signInWithGoogle: "Đăng nhập bằng Google",
    noAccount: "Chưa có tài khoản?",
    createOne: "Tạo một tài khoản",
    needHelp: "Cần trợ giúp? Email",
    emailRequired: "Email là bắt buộc.",
    passkeyEmailRequired: "Nhập email trước khi sử dụng khóa truy cập.",
    passkeyNotAvailable: "Không có khóa truy cập nào cho email này.",
    unableSignInPasskey: "Không thể đăng nhập bằng khóa truy cập.",
    unableSignInGoogle: "Không thể đăng nhập bằng Google.",
    unableSignIn: "Không thể đăng nhập.",
  },
}

export function getLoginCopy(language: SupportedLanguage): LoginCopy {
  return COPY[language]
}
