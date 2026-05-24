/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Localised copy for the MFA enrolment UI (MfaEnrollStep + /setup-mfa page).
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"

export interface MfaCopy {
  // Card header
  cardTitle: string
  cardDescription: string
  // Loading / error states
  generating: string
  enrollError: string
  // Step 1
  step1Label: string
  step1Help: string
  cantScan: string
  copyKey: string
  // Step 2
  step2Label: string
  codePlaceholder: string
  // Buttons
  enableButton: string
  verifying: string
  cancelButton: string
  // Verify errors
  invalidCode: string
  verifyFailed: string
  // Standalone page (setup-mfa)
  pageTitle: string
  pageSubtitle: string
  pageFootnote: string
  sessionExpired: string
  goToSignIn: string
  backToLogin: string
}

const COPY: Record<SupportedLanguage, MfaCopy> = {
  en: {
    cardTitle: "Set Up Authenticator App",
    cardDescription: "Protect your account with two-factor authentication",
    generating: "Generating your setup code…",
    enrollError: "Unable to start 2FA setup. Please refresh and try again.",
    step1Label: "Scan with your authenticator app",
    step1Help: "Use Google Authenticator, Authy, or any TOTP-compatible app.",
    cantScan: "Can't scan? Enter this key manually:",
    copyKey: "Copy secret key",
    step2Label: "Enter the 6-digit code from your app",
    codePlaceholder: "000000",
    enableButton: "Enable Two-Factor Authentication",
    verifying: "Verifying…",
    cancelButton: "Cancel & Sign Out",
    invalidCode: "Invalid code — please wait for the next code and try again.",
    verifyFailed: "Unable to verify. Please try again.",
    pageTitle: "Secure Your Account",
    pageSubtitle: "One last step — set up two-factor authentication to finish creating your account.",
    pageFootnote: "Two-factor authentication is required for all accounts.",
    sessionExpired: "Your session has expired. Please sign in again.",
    goToSignIn: "Go to Sign In",
    backToLogin: "Back to Login",
  },

  "zh-CN": {
    cardTitle: "设置验证器应用",
    cardDescription: "使用双重身份验证保护您的账户",
    generating: "正在生成设置码…",
    enrollError: "无法启动双重验证设置，请刷新页面后重试。",
    step1Label: "使用验证器应用扫描",
    step1Help: "请使用 Google Authenticator、Authy 或任何支持 TOTP 的应用。",
    cantScan: "无法扫描？请手动输入此密钥：",
    copyKey: "复制密钥",
    step2Label: "输入应用中显示的 6 位验证码",
    codePlaceholder: "000000",
    enableButton: "启用双重身份验证",
    verifying: "正在验证…",
    cancelButton: "取消并退出登录",
    invalidCode: "验证码无效，请等待下一个验证码后重试。",
    verifyFailed: "验证失败，请重试。",
    pageTitle: "保护您的账户",
    pageSubtitle: "最后一步 — 设置双重身份验证以完成账户创建。",
    pageFootnote: "所有账户均需启用双重身份验证。",
    sessionExpired: "您的会话已过期，请重新登录。",
    goToSignIn: "前往登录",
    backToLogin: "返回登录",
  },

  ht: {
    cardTitle: "Konfigire Aplikasyon Otantifikatè",
    cardDescription: "Pwoteje kont ou avèk otantifikasyon de-faktè",
    generating: "Ap jenere kòd konfigirasyon ou…",
    enrollError: "Pa kapab kòmanse konfigirasyon 2FA. Tanpri aktyalize epi eseye ankò.",
    step1Label: "Eskane ak aplikasyon otantifikatè ou",
    step1Help: "Itilize Google Authenticator, Authy, oswa nenpòt aplikasyon ki konpatib ak TOTP.",
    cantScan: "Pa ka eskane? Antre kle sa manyèlman:",
    copyKey: "Kopye kle sekrè",
    step2Label: "Antre kòd 6 chif ki soti nan aplikasyon ou",
    codePlaceholder: "000000",
    enableButton: "Aktive Otantifikasyon De-Faktè",
    verifying: "Ap verifye…",
    cancelButton: "Anile epi Dekonekte",
    invalidCode: "Kòd la pa valid — tanpri tann pwochen kòd la epi eseye ankò.",
    verifyFailed: "Pa kapab verifye. Tanpri eseye ankò.",
    pageTitle: "Sekirize Kont Ou",
    pageSubtitle: "Dènye etap — konfigire otantifikasyon de-faktè pou fini kreye kont ou.",
    pageFootnote: "Otantifikasyon de-faktè obligatwa pou tout kont.",
    sessionExpired: "Sesyon ou te ekspire. Tanpri konekte ankò.",
    goToSignIn: "Ale nan Koneksyon",
    backToLogin: "Retounen nan Koneksyon",
  },

  "pt-BR": {
    cardTitle: "Configurar Aplicativo Autenticador",
    cardDescription: "Proteja sua conta com autenticação de dois fatores",
    generating: "Gerando seu código de configuração…",
    enrollError: "Não foi possível iniciar a configuração 2FA. Atualize a página e tente novamente.",
    step1Label: "Escaneie com seu aplicativo autenticador",
    step1Help: "Use o Google Authenticator, Authy ou qualquer aplicativo compatível com TOTP.",
    cantScan: "Não consegue escanear? Insira esta chave manualmente:",
    copyKey: "Copiar chave secreta",
    step2Label: "Insira o código de 6 dígitos do seu aplicativo",
    codePlaceholder: "000000",
    enableButton: "Ativar Autenticação de Dois Fatores",
    verifying: "Verificando…",
    cancelButton: "Cancelar e Sair",
    invalidCode: "Código inválido — aguarde o próximo código e tente novamente.",
    verifyFailed: "Não foi possível verificar. Tente novamente.",
    pageTitle: "Proteja Sua Conta",
    pageSubtitle: "Último passo — configure a autenticação de dois fatores para concluir a criação da sua conta.",
    pageFootnote: "A autenticação de dois fatores é obrigatória para todas as contas.",
    sessionExpired: "Sua sessão expirou. Por favor, faça login novamente.",
    goToSignIn: "Ir para Login",
    backToLogin: "Voltar ao Login",
  },

  es: {
    cardTitle: "Configurar Aplicación Autenticadora",
    cardDescription: "Protege tu cuenta con autenticación de dos factores",
    generating: "Generando tu código de configuración…",
    enrollError: "No se pudo iniciar la configuración 2FA. Por favor, actualiza e intenta de nuevo.",
    step1Label: "Escanea con tu aplicación autenticadora",
    step1Help: "Usa Google Authenticator, Authy o cualquier aplicación compatible con TOTP.",
    cantScan: "¿No puedes escanear? Ingresa esta clave manualmente:",
    copyKey: "Copiar clave secreta",
    step2Label: "Ingresa el código de 6 dígitos de tu aplicación",
    codePlaceholder: "000000",
    enableButton: "Activar Autenticación de Dos Factores",
    verifying: "Verificando…",
    cancelButton: "Cancelar y Cerrar Sesión",
    invalidCode: "Código inválido — por favor espera el siguiente código e intenta de nuevo.",
    verifyFailed: "No se pudo verificar. Por favor, intenta de nuevo.",
    pageTitle: "Protege Tu Cuenta",
    pageSubtitle: "Último paso — configura la autenticación de dos factores para terminar de crear tu cuenta.",
    pageFootnote: "La autenticación de dos factores es obligatoria para todas las cuentas.",
    sessionExpired: "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.",
    goToSignIn: "Ir a Iniciar Sesión",
    backToLogin: "Volver al Login",
  },

  vi: {
    cardTitle: "Cài Đặt Ứng Dụng Xác Thực",
    cardDescription: "Bảo vệ tài khoản của bạn bằng xác thực hai yếu tố",
    generating: "Đang tạo mã cài đặt…",
    enrollError: "Không thể bắt đầu cài đặt 2FA. Vui lòng làm mới trang và thử lại.",
    step1Label: "Quét bằng ứng dụng xác thực của bạn",
    step1Help: "Sử dụng Google Authenticator, Authy hoặc bất kỳ ứng dụng tương thích TOTP nào.",
    cantScan: "Không thể quét? Nhập khóa này thủ công:",
    copyKey: "Sao chép khóa bí mật",
    step2Label: "Nhập mã 6 chữ số từ ứng dụng của bạn",
    codePlaceholder: "000000",
    enableButton: "Bật Xác Thực Hai Yếu Tố",
    verifying: "Đang xác minh…",
    cancelButton: "Hủy & Đăng Xuất",
    invalidCode: "Mã không hợp lệ — vui lòng chờ mã tiếp theo và thử lại.",
    verifyFailed: "Không thể xác minh. Vui lòng thử lại.",
    pageTitle: "Bảo Mật Tài Khoản Của Bạn",
    pageSubtitle: "Bước cuối cùng — cài đặt xác thực hai yếu tố để hoàn tất tạo tài khoản.",
    pageFootnote: "Xác thực hai yếu tố là bắt buộc cho tất cả tài khoản.",
    sessionExpired: "Phiên của bạn đã hết hạn. Vui lòng đăng nhập lại.",
    goToSignIn: "Đến Trang Đăng Nhập",
    backToLogin: "Quay lại Đăng Nhập",
  },
}

export function getMfaCopy(language: SupportedLanguage): MfaCopy {
  return COPY[language]
}
