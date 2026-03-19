/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"

export interface AppealCopy {
  dashboard: string
  appealAssistant: string
  pageTitle: string
  pageDescription: string
  analysisFailed: string
  unexpectedError: string
  retry: string
  serverError: string
  formTitle: string
  denialReason: string
  denialReasonPlaceholder: string
  uploadLetter: string
  optional: string
  uploadHelp: string
  attachLetter: string
  extracting: string
  removeDocument: string
  uploadSuccess: string
  uploadEmpty: string
  dismissError: string
  replaceFile: string
  additionalDetails: string
  additionalDetailsPlaceholder: string
  analyzing: string
  analyzeMyDenial: string
  success: string
  denialReasonPrefix: string
  meaningTitle: string
  letterTitle: string
  copyLetter: string
  copied: string
  letterFallback: string
  evidenceTitle: string
  startOver: string
  disclaimer: string
}

const COPY: Record<SupportedLanguage, AppealCopy> = {
  en: {
    dashboard: "Dashboard",
    appealAssistant: "Appeal Assistant",
    pageTitle: "Appeal Your MassHealth Denial",
    pageDescription: "Select your denial reason and we'll generate a personalized explanation, formal appeal letter, and evidence checklist — ready to submit.",
    analysisFailed: "Analysis failed",
    unexpectedError: "An unexpected error occurred.",
    retry: "Try Again",
    serverError: "Could not connect to the server. Please try again.",
    formTitle: "Tell us about your denial",
    denialReason: "Reason for denial",
    denialReasonPlaceholder: "Select the reason your application was denied…",
    uploadLetter: "Upload denial letter",
    optional: "optional",
    uploadHelp: "Attach a photo or scan of your denial letter so the AI can read the specific details. Accepted: JPEG, PNG, WEBP, PDF (max 10 MB).",
    attachLetter: "Click to attach denial letter…",
    extracting: "Extracting document content…",
    removeDocument: "Remove document",
    uploadSuccess: "Document read successfully — AI will use it to personalise your appeal.",
    uploadEmpty: "No text could be extracted. The appeal will use the reason you selected above.",
    dismissError: "Dismiss error",
    replaceFile: "Replace with a different file",
    additionalDetails: "Additional details",
    additionalDetailsPlaceholder: "Any extra context — e.g. the letter date, specific wording, or details not shown in the document…",
    analyzing: "Analyzing…",
    analyzeMyDenial: "Analyze My Denial",
    success: "Appeal analysis complete",
    denialReasonPrefix: "Denial reason:",
    meaningTitle: "What This Means",
    letterTitle: "Your Appeal Letter",
    copyLetter: "Copy Letter",
    copied: "Copied!",
    letterFallback: "Appeal letter could not be generated. Please try again.",
    evidenceTitle: "Evidence to Gather",
    startOver: "Start Over",
    disclaimer: "This analysis is AI-generated and is not legal advice. For complex cases, consider consulting a benefits attorney or legal aid organization.",
  },
  "zh-CN": {
    dashboard: "仪表板",
    appealAssistant: "申诉助手",
    pageTitle: "对 MassHealth 拒绝决定提出申诉",
    pageDescription: "选择拒绝原因，我们将生成个性化说明、正式申诉信和证据清单，供您直接提交。",
    analysisFailed: "分析失败",
    unexpectedError: "发生了意外错误。",
    retry: "重试",
    serverError: "无法连接到服务器。请重试。",
    formTitle: "告诉我们您的拒绝情况",
    denialReason: "拒绝原因",
    denialReasonPlaceholder: "请选择您的申请被拒绝的原因…",
    uploadLetter: "上传拒绝信",
    optional: "可选",
    uploadHelp: "上传拒绝信的照片或扫描件，以便 AI 读取具体细节。支持 JPEG、PNG、WEBP、PDF（最大 10 MB）。",
    attachLetter: "点击上传拒绝信…",
    extracting: "正在提取文件内容…",
    removeDocument: "移除文件",
    uploadSuccess: "文件读取成功，AI 将据此生成更个性化的申诉内容。",
    uploadEmpty: "未能提取文本。申诉将使用您上面选择的原因。",
    dismissError: "关闭错误",
    replaceFile: "换一个文件",
    additionalDetails: "补充说明",
    additionalDetailsPlaceholder: "其他背景信息，例如信件日期、原文措辞或文件中未体现的内容…",
    analyzing: "分析中…",
    analyzeMyDenial: "分析我的拒绝决定",
    success: "申诉分析已完成",
    denialReasonPrefix: "拒绝原因：",
    meaningTitle: "这意味着什么",
    letterTitle: "您的申诉信",
    copyLetter: "复制信件",
    copied: "已复制！",
    letterFallback: "无法生成申诉信。请重试。",
    evidenceTitle: "需要准备的证据",
    startOver: "重新开始",
    disclaimer: "此分析由 AI 生成，不构成法律建议。对于复杂案件，请考虑咨询福利律师或法律援助机构。",
  },
  ht: {
    dashboard: "Tablo de bò",
    appealAssistant: "Asistan Apèl",
    pageTitle: "Fè Apèl kont Refi MassHealth ou",
    pageDescription: "Chwazi rezon refi a epi n ap kreye yon eksplikasyon pèsonalize, yon lèt apèl fòmèl, ak yon lis prèv pou soumèt.",
    analysisFailed: "Analiz la echwe",
    unexpectedError: "Yon erè inatandi rive.",
    retry: "Eseye ankò",
    serverError: "Pa t kapab konekte ak sèvè a. Tanpri eseye ankò.",
    formTitle: "Di nou sou refi ou a",
    denialReason: "Rezon refi a",
    denialReasonPlaceholder: "Chwazi rezon aplikasyon ou a te refize…",
    uploadLetter: "Telechaje lèt refi a",
    optional: "opsyonèl",
    uploadHelp: "Mete yon foto oswa eskanè lèt refi a pou AI a ka li detay yo. Aksepte: JPEG, PNG, WEBP, PDF (maksimòm 10 MB).",
    attachLetter: "Klike pou mete lèt refi a…",
    extracting: "Ap ekstrè kontni dokiman an…",
    removeDocument: "Retire dokiman an",
    uploadSuccess: "Dokiman an li byen — AI a pral itilize li pou pèsonalize apèl ou a.",
    uploadEmpty: "Pa t gen tèks pou ekstrè. Apèl la ap sèvi ak rezon ou te chwazi a.",
    dismissError: "Fèmen erè a",
    replaceFile: "Ranplase ak yon lòt fichye",
    additionalDetails: "Lòt detay",
    additionalDetailsPlaceholder: "Nenpòt lòt kontèks, pa egzanp dat lèt la, mo egzak yo, oswa detay ki pa nan dokiman an…",
    analyzing: "Ap analize…",
    analyzeMyDenial: "Analize Refi Mwen",
    success: "Analiz apèl la fini",
    denialReasonPrefix: "Rezon refi a:",
    meaningTitle: "Sa Vle Di Kisa",
    letterTitle: "Lèt Apèl Ou a",
    copyLetter: "Kopye Lèt la",
    copied: "Kopye!",
    letterFallback: "Pa t kapab jenere lèt apèl la. Tanpri eseye ankò.",
    evidenceTitle: "Prèv pou Rasanble",
    startOver: "Kòmanse Ankò",
    disclaimer: "Analiz sa a fèt pa AI e li pa konsèy legal. Pou ka konplike, konsidere konsilte yon avoka benefis oswa yon òganizasyon asistans legal.",
  },
  "pt-BR": {
    dashboard: "Painel",
    appealAssistant: "Assistente de Recurso",
    pageTitle: "Recorra da sua negativa do MassHealth",
    pageDescription: "Selecione o motivo da negativa e vamos gerar uma explicação personalizada, uma carta formal de recurso e uma lista de provas para envio.",
    analysisFailed: "Falha na análise",
    unexpectedError: "Ocorreu um erro inesperado.",
    retry: "Tentar novamente",
    serverError: "Não foi possível conectar ao servidor. Tente novamente.",
    formTitle: "Conte sobre a sua negativa",
    denialReason: "Motivo da negativa",
    denialReasonPlaceholder: "Selecione o motivo da negativa da sua solicitação…",
    uploadLetter: "Enviar carta de negativa",
    optional: "opcional",
    uploadHelp: "Anexe uma foto ou digitalização da carta de negativa para que a IA leia os detalhes. Aceito: JPEG, PNG, WEBP, PDF (máx. 10 MB).",
    attachLetter: "Clique para anexar a carta de negativa…",
    extracting: "Extraindo conteúdo do documento…",
    removeDocument: "Remover documento",
    uploadSuccess: "Documento lido com sucesso — a IA vai usá-lo para personalizar seu recurso.",
    uploadEmpty: "Não foi possível extrair texto. O recurso usará o motivo selecionado acima.",
    dismissError: "Fechar erro",
    replaceFile: "Substituir por outro arquivo",
    additionalDetails: "Detalhes adicionais",
    additionalDetailsPlaceholder: "Qualquer contexto extra, por exemplo a data da carta, a redação específica ou detalhes que não aparecem no documento…",
    analyzing: "Analisando…",
    analyzeMyDenial: "Analisar Minha Negativa",
    success: "Análise do recurso concluída",
    denialReasonPrefix: "Motivo da negativa:",
    meaningTitle: "O Que Isso Significa",
    letterTitle: "Sua Carta de Recurso",
    copyLetter: "Copiar Carta",
    copied: "Copiado!",
    letterFallback: "Não foi possível gerar a carta de recurso. Tente novamente.",
    evidenceTitle: "Provas para Reunir",
    startOver: "Começar de Novo",
    disclaimer: "Esta análise foi gerada por IA e não constitui aconselhamento jurídico. Em casos complexos, considere consultar um advogado de benefícios ou uma organização de assistência jurídica.",
  },
  es: {
    dashboard: "Panel",
    appealAssistant: "Asistente de Apelación",
    pageTitle: "Apelar la denegación de MassHealth",
    pageDescription: "Seleccione el motivo de la denegación y generaremos una explicación personalizada, una carta formal de apelación y una lista de pruebas para enviar.",
    analysisFailed: "Análisis fallido",
    unexpectedError: "Ocurrió un error inesperado.",
    retry: "Intentar de nuevo",
    serverError: "No se pudo conectar al servidor. Inténtelo de nuevo.",
    formTitle: "Cuéntenos sobre su denegación",
    denialReason: "Motivo de la denegación",
    denialReasonPlaceholder: "Seleccione el motivo por el que se negó su solicitud…",
    uploadLetter: "Subir carta de denegación",
    optional: "opcional",
    uploadHelp: "Adjunte una foto o escaneo de su carta de denegación para que la IA lea los detalles. Aceptado: JPEG, PNG, WEBP, PDF (máx. 10 MB).",
    attachLetter: "Haga clic para adjuntar la carta de denegación…",
    extracting: "Extrayendo el contenido del documento…",
    removeDocument: "Quitar documento",
    uploadSuccess: "Documento leído correctamente: la IA lo usará para personalizar su apelación.",
    uploadEmpty: "No se pudo extraer texto. La apelación usará el motivo que seleccionó arriba.",
    dismissError: "Cerrar error",
    replaceFile: "Reemplazar con otro archivo",
    additionalDetails: "Detalles adicionales",
    additionalDetailsPlaceholder: "Cualquier contexto adicional, por ejemplo la fecha de la carta, el texto exacto o detalles que no aparecen en el documento…",
    analyzing: "Analizando…",
    analyzeMyDenial: "Analizar Mi Denegación",
    success: "Análisis de apelación completo",
    denialReasonPrefix: "Motivo de la denegación:",
    meaningTitle: "Qué Significa Esto",
    letterTitle: "Su Carta de Apelación",
    copyLetter: "Copiar Carta",
    copied: "¡Copiado!",
    letterFallback: "No se pudo generar la carta de apelación. Inténtelo de nuevo.",
    evidenceTitle: "Pruebas para Reunir",
    startOver: "Empezar de Nuevo",
    disclaimer: "Este análisis fue generado por IA y no constituye asesoría legal. En casos complejos, considere consultar a un abogado de beneficios o a una organización de ayuda legal.",
  },
  vi: {
    dashboard: "Bảng điều khiển",
    appealAssistant: "Trợ Lý Kháng Cáo",
    pageTitle: "Kháng cáo quyết định từ chối MassHealth",
    pageDescription: "Chọn lý do bị từ chối và chúng tôi sẽ tạo phần giải thích cá nhân hóa, thư kháng cáo chính thức và danh sách bằng chứng để nộp.",
    analysisFailed: "Phân tích thất bại",
    unexpectedError: "Đã xảy ra lỗi không mong muốn.",
    retry: "Thử lại",
    serverError: "Không thể kết nối tới máy chủ. Vui lòng thử lại.",
    formTitle: "Hãy cho chúng tôi biết về việc bị từ chối của bạn",
    denialReason: "Lý do bị từ chối",
    denialReasonPlaceholder: "Chọn lý do đơn của bạn bị từ chối…",
    uploadLetter: "Tải thư từ chối lên",
    optional: "không bắt buộc",
    uploadHelp: "Đính kèm ảnh hoặc bản quét thư từ chối để AI đọc các chi tiết cụ thể. Hỗ trợ: JPEG, PNG, WEBP, PDF (tối đa 10 MB).",
    attachLetter: "Bấm để đính kèm thư từ chối…",
    extracting: "Đang trích xuất nội dung tài liệu…",
    removeDocument: "Xóa tài liệu",
    uploadSuccess: "Đã đọc tài liệu thành công — AI sẽ dùng tài liệu này để cá nhân hóa đơn kháng cáo của bạn.",
    uploadEmpty: "Không thể trích xuất văn bản. Đơn kháng cáo sẽ dùng lý do bạn chọn ở trên.",
    dismissError: "Đóng lỗi",
    replaceFile: "Thay bằng tệp khác",
    additionalDetails: "Chi tiết bổ sung",
    additionalDetailsPlaceholder: "Bất kỳ bối cảnh bổ sung nào, ví dụ ngày trên thư, câu chữ cụ thể hoặc các chi tiết không có trong tài liệu…",
    analyzing: "Đang phân tích…",
    analyzeMyDenial: "Phân Tích Quyết Định Từ Chối",
    success: "Đã hoàn tất phân tích kháng cáo",
    denialReasonPrefix: "Lý do bị từ chối:",
    meaningTitle: "Điều Này Có Nghĩa Là Gì",
    letterTitle: "Thư Kháng Cáo Của Bạn",
    copyLetter: "Sao Chép Thư",
    copied: "Đã sao chép!",
    letterFallback: "Không thể tạo thư kháng cáo. Vui lòng thử lại.",
    evidenceTitle: "Bằng Chứng Cần Chuẩn Bị",
    startOver: "Bắt Đầu Lại",
    disclaimer: "Phân tích này do AI tạo ra và không phải là tư vấn pháp lý. Với các trường hợp phức tạp, hãy cân nhắc tham khảo luật sư về phúc lợi hoặc tổ chức hỗ trợ pháp lý.",
  },
}

export function getAppealAssistantCopy(language: SupportedLanguage): AppealCopy {
  return COPY[language] ?? COPY.en
}
