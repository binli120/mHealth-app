/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { type SupportedLanguage } from "@/lib/i18n/languages"

interface TypePageCopy {
  backToHome: string
  pageTitle: string
  pageSubtitle: string
  eligible: string
  helpTitle: string
  helpDescription: string
  runQuickCheck: string
  quickCheckTitle: string
  quickCheckDescription: string
  quickCheckIntro: string
  eligibleLabel: string
  startOver: string
  selectEligibleApplication: string
  existingDraftTitle: (typeLabel: string) => string
  existingDraftDescription: string
  startNewApplication: string
  continueExistingApplication: string
  questions: {
    addingPersonToExistingCase: { prompt: string; yes: string; no: string }
    ageGroup: { prompt: string; senior: string; under65: string }
    needsLongTermCare: { prompt: string; yes: string; no: string }
    hasMedicare: { prompt: string; yes: string; no: string }
  }
  reasons: {
    aca3ap: string
    saca2_longterm: string
    saca2_senior: string
    msp: string
    aca3: string
  }
  appTypes: {
    aca3: { title: string; description: string }
    aca3ap: { title: string; description: string }
    saca2: { title: string; description: string }
    msp: { title: string; description: string }
  }
}

const COPY: Record<SupportedLanguage, TypePageCopy> = {
  en: {
    backToHome: "Back to Dashboard",
    pageTitle: "Choose Your MassHealth Application",
    pageSubtitle: "Select the exact form you need to complete",
    eligible: "Eligible",
    helpTitle: "Not sure which to choose?",
    helpDescription: "Answer a few questions and Compass will highlight the likely application type.",
    runQuickCheck: "Run Quick Eligibility Check",
    quickCheckTitle: "Quick Eligibility Check",
    quickCheckDescription:
      "This quick check routes you to the most likely MassHealth application. Final eligibility is determined after the application is reviewed.",
    quickCheckIntro: "I can help choose between ACA-3, ACA-3-AP, SACA-2, and MSP.",
    eligibleLabel: "is marked Eligible.",
    startOver: "Start Over",
    selectEligibleApplication: "Select Eligible Application",
    existingDraftTitle: (typeLabel) => `You have an unfinished ${typeLabel} application`,
    existingDraftDescription:
      "Would you like to continue where you left off, or start a brand new application?",
    startNewApplication: "Start New Application",
    continueExistingApplication: "Continue Existing Application",
    questions: {
      addingPersonToExistingCase: {
        prompt: "Are you adding another person to an existing MassHealth household case?",
        yes: "Yes",
        no: "No",
      },
      ageGroup: {
        prompt: "Is the person applying age 65 or older?",
        senior: "Yes, 65 or older",
        under65: "No, under 65",
      },
      needsLongTermCare: {
        prompt: "Do they need long-term-care services, nursing facility coverage, or similar support?",
        yes: "Yes",
        no: "No",
      },
      hasMedicare: {
        prompt: "Do they have Medicare and mainly need help paying Medicare costs?",
        yes: "Yes",
        no: "No",
      },
    },
    reasons: {
      aca3ap: "You are adding another person to an existing ACA-3 household case.",
      saca2_longterm: "You selected long-term-care coverage.",
      saca2_senior: "You selected age 65 or older.",
      msp: "You selected Medicare and may need help with Medicare costs.",
      aca3: "You selected the standard coverage path for most individuals and families.",
    },
    appTypes: {
      aca3: {
        title: "Massachusetts Application for Health and Dental Coverage and Help Paying Costs",
        description: "Standard application for most individuals and families.",
      },
      aca3ap: {
        title: "Massachusetts Application for Health and Dental Coverage and Help Paying Costs - Additional Persons",
        description: "Use when adding people to an existing ACA-3 based household case.",
      },
      saca2: {
        title: "Application for Health Coverage for Seniors and People Needing Long-Term-Care Services",
        description: "For seniors and applicants seeking long-term-care related coverage.",
      },
      msp: {
        title: "Medicare Savings Programs Application",
        description: "For help paying Medicare costs (premiums and other Medicare expenses).",
      },
    },
  },

  "zh-CN": {
    backToHome: "返回仪表板",
    pageTitle: "选择您的 MassHealth 申请",
    pageSubtitle: "选择您需要填写的具体表格",
    eligible: "符合条件",
    helpTitle: "不确定选哪个？",
    helpDescription: "回答几个问题，Compass 将为您标出最可能适合的申请类型。",
    runQuickCheck: "快速资格检查",
    quickCheckTitle: "快速资格检查",
    quickCheckDescription:
      "此快速检查将引导您找到最可能适合的 MassHealth 申请。最终资格将在申请审核后确定。",
    quickCheckIntro: "我可以帮助您在 ACA-3、ACA-3-AP、SACA-2 和 MSP 之间做出选择。",
    eligibleLabel: "已标记为符合条件。",
    startOver: "重新开始",
    selectEligibleApplication: "选择符合条件的申请",
    existingDraftTitle: (typeLabel) => `您有一个未完成的 ${typeLabel} 申请`,
    existingDraftDescription: "您想从上次中断的地方继续，还是开始一个全新的申请？",
    startNewApplication: "开始新申请",
    continueExistingApplication: "继续现有申请",
    questions: {
      addingPersonToExistingCase: {
        prompt: "您是否要将另一个人添加到现有的 MassHealth 家庭案例中？",
        yes: "是",
        no: "否",
      },
      ageGroup: {
        prompt: "申请人是否年满 65 岁？",
        senior: "是，65 岁或以上",
        under65: "否，65 岁以下",
      },
      needsLongTermCare: {
        prompt: "他们是否需要长期护理服务、护理机构保险或类似支持？",
        yes: "是",
        no: "否",
      },
      hasMedicare: {
        prompt: "他们是否拥有 Medicare，并且主要需要帮助支付 Medicare 费用？",
        yes: "是",
        no: "否",
      },
    },
    reasons: {
      aca3ap: "您正在将另一个人添加到现有的 ACA-3 家庭案例中。",
      saca2_longterm: "您选择了长期护理保险。",
      saca2_senior: "您选择了 65 岁或以上。",
      msp: "您选择了 Medicare，可能需要帮助支付 Medicare 费用。",
      aca3: "您选择了适合大多数个人和家庭的标准保险途径。",
    },
    appTypes: {
      aca3: {
        title: "马萨诸塞州健康和牙科保险及费用援助申请",
        description: "适用于大多数个人和家庭的标准申请。",
      },
      aca3ap: {
        title: "马萨诸塞州健康和牙科保险及费用援助申请 - 附加人员",
        description: "在向现有 ACA-3 家庭案例添加人员时使用。",
      },
      saca2: {
        title: "老年人及需要长期护理服务人员的健康保险申请",
        description: "适用于老年人及寻求长期护理相关保险的申请人。",
      },
      msp: {
        title: "Medicare 储蓄计划申请",
        description: "用于帮助支付 Medicare 费用（保费及其他 Medicare 开支）。",
      },
    },
  },

  ht: {
    backToHome: "Retounen nan Tablo de Bò",
    pageTitle: "Chwazi Aplikasyon MassHealth Ou",
    pageSubtitle: "Chwazi fòm egzak ou bezwen ranpli",
    eligible: "Elijib",
    helpTitle: "Pa sèten kiyès pou chwazi?",
    helpDescription: "Reponn kèk kesyon e Compass pral mete aksan sou kalite aplikasyon ki pi posib.",
    runQuickCheck: "Fè Vèrifikasyon Elijiblite Rapid",
    quickCheckTitle: "Vèrifikasyon Elijiblite Rapid",
    quickCheckDescription:
      "Vèrifikasyon rapid sa a dirije ou nan aplikasyon MassHealth ki pi porbab. Elijiblite final la detèmine apre aplikasyon an revize.",
    quickCheckIntro: "Mwen ka ede ou chwazi ant ACA-3, ACA-3-AP, SACA-2, ak MSP.",
    eligibleLabel: "make Elijib.",
    startOver: "Recommanse",
    selectEligibleApplication: "Chwazi Aplikasyon Elijib",
    existingDraftTitle: (typeLabel) => `Ou gen yon aplikasyon ${typeLabel} ki pa fini`,
    existingDraftDescription:
      "Èske ou vle kontinye kote ou te rete a, oswa kòmanse yon nouvo aplikasyon?",
    startNewApplication: "Kòmanse Nouvo Aplikasyon",
    continueExistingApplication: "Kontinye Aplikasyon Egzistan",
    questions: {
      addingPersonToExistingCase: {
        prompt: "Èske w ap ajoute yon lòt moun nan yon ka fwaye MassHealth ki egziste deja?",
        yes: "Wi",
        no: "Non",
      },
      ageGroup: {
        prompt: "Èske moun k ap aplike a gen 65 an oswa plis?",
        senior: "Wi, 65 an oswa plis",
        under65: "Non, mwens pase 65 an",
      },
      needsLongTermCare: {
        prompt: "Èske yo bezwen sèvis swen alontèm, kouvèti etablisman enfimye, oswa sipò similè?",
        yes: "Wi",
        no: "Non",
      },
      hasMedicare: {
        prompt: "Èske yo gen Medicare epi yo bezwen èd prensipalman pou peye depans Medicare?",
        yes: "Wi",
        no: "Non",
      },
    },
    reasons: {
      aca3ap: "Ou ap ajoute yon lòt moun nan yon ka fwaye ACA-3 ki egziste deja.",
      saca2_longterm: "Ou te chwazi kouvèti swen alontèm.",
      saca2_senior: "Ou te chwazi 65 an oswa plis.",
      msp: "Ou te chwazi Medicare epi ou ka bezwen èd pou depans Medicare.",
      aca3: "Ou te chwazi wout kouvèti estanda pou pifò moun ak fanmi.",
    },
    appTypes: {
      aca3: {
        title: "Aplikasyon Massachusetts pou Kouvèti Sante ak Dantè ak Èd pou Peye Depans",
        description: "Aplikasyon estanda pou pifò moun ak fanmi.",
      },
      aca3ap: {
        title: "Aplikasyon Massachusetts pou Kouvèti Sante ak Dantè ak Èd pou Peye Depans - Pèsonn Adisyonèl",
        description: "Itilize lè w ap ajoute moun nan yon ka fwaye ki baze sou ACA-3 ki egziste deja.",
      },
      saca2: {
        title: "Aplikasyon pou Kouvèti Sante pou Granmoun Aje ak Moun ki Bezwen Sèvis Swen Alontèm",
        description: "Pou granmoun aje ak aplikan k ap chèche kouvèti ki gen rapò ak swen alontèm.",
      },
      msp: {
        title: "Aplikasyon Pwogram Ekonomi Medicare",
        description: "Pou èd pou peye depans Medicare (prim ak lòt depans Medicare).",
      },
    },
  },

  "pt-BR": {
    backToHome: "Voltar ao Painel",
    pageTitle: "Escolha Seu Pedido MassHealth",
    pageSubtitle: "Selecione o formulário exato que você precisa preencher",
    eligible: "Elegível",
    helpTitle: "Não sabe qual escolher?",
    helpDescription: "Responda algumas perguntas e o Compass destacará o tipo de pedido mais provável.",
    runQuickCheck: "Verificação Rápida de Elegibilidade",
    quickCheckTitle: "Verificação Rápida de Elegibilidade",
    quickCheckDescription:
      "Esta verificação rápida direciona você para o pedido MassHealth mais provável. A elegibilidade final é determinada após a análise do pedido.",
    quickCheckIntro: "Posso ajudá-lo a escolher entre ACA-3, ACA-3-AP, SACA-2 e MSP.",
    eligibleLabel: "está marcado como Elegível.",
    startOver: "Recomeçar",
    selectEligibleApplication: "Selecionar Pedido Elegível",
    existingDraftTitle: (typeLabel) => `Você tem um pedido ${typeLabel} inacabado`,
    existingDraftDescription: "Deseja continuar de onde parou, ou iniciar um novo pedido?",
    startNewApplication: "Iniciar Novo Pedido",
    continueExistingApplication: "Continuar Pedido Existente",
    questions: {
      addingPersonToExistingCase: {
        prompt: "Você está adicionando outra pessoa a um caso de família MassHealth existente?",
        yes: "Sim",
        no: "Não",
      },
      ageGroup: {
        prompt: "A pessoa que está se candidatando tem 65 anos ou mais?",
        senior: "Sim, 65 anos ou mais",
        under65: "Não, com menos de 65 anos",
      },
      needsLongTermCare: {
        prompt: "Eles precisam de serviços de cuidados de longa duração, cobertura de instituição de enfermagem ou suporte similar?",
        yes: "Sim",
        no: "Não",
      },
      hasMedicare: {
        prompt: "Eles têm Medicare e precisam principalmente de ajuda para pagar os custos do Medicare?",
        yes: "Sim",
        no: "Não",
      },
    },
    reasons: {
      aca3ap: "Você está adicionando outra pessoa a um caso de família ACA-3 existente.",
      saca2_longterm: "Você selecionou a cobertura de cuidados de longa duração.",
      saca2_senior: "Você selecionou 65 anos ou mais.",
      msp: "Você selecionou Medicare e pode precisar de ajuda com os custos do Medicare.",
      aca3: "Você selecionou o caminho de cobertura padrão para a maioria dos indivíduos e famílias.",
    },
    appTypes: {
      aca3: {
        title: "Pedido de Massachusetts para Cobertura de Saúde e Odontológica e Ajuda para Pagar Custos",
        description: "Pedido padrão para a maioria dos indivíduos e famílias.",
      },
      aca3ap: {
        title: "Pedido de Massachusetts para Cobertura de Saúde e Odontológica e Ajuda para Pagar Custos - Pessoas Adicionais",
        description: "Use ao adicionar pessoas a um caso de família baseado em ACA-3 existente.",
      },
      saca2: {
        title: "Pedido de Cobertura de Saúde para Idosos e Pessoas que Precisam de Serviços de Cuidado de Longa Duração",
        description: "Para idosos e candidatos que buscam cobertura relacionada a cuidados de longa duração.",
      },
      msp: {
        title: "Pedido de Programas de Economia do Medicare",
        description: "Para ajuda para pagar os custos do Medicare (prêmios e outras despesas do Medicare).",
      },
    },
  },

  es: {
    backToHome: "Volver al Panel",
    pageTitle: "Elija Su Solicitud de MassHealth",
    pageSubtitle: "Seleccione el formulario exacto que necesita completar",
    eligible: "Elegible",
    helpTitle: "¿No sabe cuál elegir?",
    helpDescription: "Responda algunas preguntas y Compass destacará el tipo de solicitud más probable.",
    runQuickCheck: "Verificación Rápida de Elegibilidad",
    quickCheckTitle: "Verificación Rápida de Elegibilidad",
    quickCheckDescription:
      "Esta verificación rápida lo dirige al pedido de MassHealth más probable. La elegibilidad final se determina después de revisar la solicitud.",
    quickCheckIntro: "Puedo ayudarle a elegir entre ACA-3, ACA-3-AP, SACA-2 y MSP.",
    eligibleLabel: "está marcado como Elegible.",
    startOver: "Empezar de Nuevo",
    selectEligibleApplication: "Seleccionar Solicitud Elegible",
    existingDraftTitle: (typeLabel) => `Tiene una solicitud ${typeLabel} sin terminar`,
    existingDraftDescription:
      "¿Le gustaría continuar donde lo dejó, o comenzar una solicitud completamente nueva?",
    startNewApplication: "Iniciar Nueva Solicitud",
    continueExistingApplication: "Continuar Solicitud Existente",
    questions: {
      addingPersonToExistingCase: {
        prompt: "¿Está agregando a otra persona a un caso de hogar MassHealth existente?",
        yes: "Sí",
        no: "No",
      },
      ageGroup: {
        prompt: "¿La persona que solicita tiene 65 años o más?",
        senior: "Sí, 65 años o más",
        under65: "No, menor de 65 años",
      },
      needsLongTermCare: {
        prompt: "¿Necesitan servicios de cuidado a largo plazo, cobertura de instalaciones de enfermería o apoyo similar?",
        yes: "Sí",
        no: "No",
      },
      hasMedicare: {
        prompt: "¿Tienen Medicare y principalmente necesitan ayuda para pagar los costos de Medicare?",
        yes: "Sí",
        no: "No",
      },
    },
    reasons: {
      aca3ap: "Está agregando a otra persona a un caso de hogar ACA-3 existente.",
      saca2_longterm: "Seleccionó la cobertura de cuidado a largo plazo.",
      saca2_senior: "Seleccionó 65 años o más.",
      msp: "Seleccionó Medicare y puede necesitar ayuda con los costos de Medicare.",
      aca3: "Seleccionó el camino de cobertura estándar para la mayoría de las personas y familias.",
    },
    appTypes: {
      aca3: {
        title: "Solicitud de Massachusetts para Cobertura de Salud y Dental y Ayuda para Pagar Costos",
        description: "Solicitud estándar para la mayoría de los individuos y familias.",
      },
      aca3ap: {
        title: "Solicitud de Massachusetts para Cobertura de Salud y Dental y Ayuda para Pagar Costos - Personas Adicionales",
        description: "Úselo cuando agregue personas a un caso de hogar existente basado en ACA-3.",
      },
      saca2: {
        title: "Solicitud de Cobertura de Salud para Personas Mayores y Personas que Necesitan Servicios de Cuidado a Largo Plazo",
        description: "Para personas mayores y solicitantes que buscan cobertura relacionada con el cuidado a largo plazo.",
      },
      msp: {
        title: "Solicitud de Programas de Ahorro de Medicare",
        description: "Para ayuda para pagar los costos de Medicare (primas y otros gastos de Medicare).",
      },
    },
  },

  vi: {
    backToHome: "Quay lại Bảng điều khiển",
    pageTitle: "Chọn Đơn MassHealth Của Bạn",
    pageSubtitle: "Chọn mẫu đơn chính xác bạn cần điền",
    eligible: "Đủ điều kiện",
    helpTitle: "Không chắc chọn cái nào?",
    helpDescription:
      "Trả lời một vài câu hỏi và Compass sẽ đánh dấu loại đơn có khả năng phù hợp nhất.",
    runQuickCheck: "Kiểm Tra Đủ Điều Kiện Nhanh",
    quickCheckTitle: "Kiểm Tra Đủ Điều Kiện Nhanh",
    quickCheckDescription:
      "Kiểm tra nhanh này sẽ hướng bạn đến đơn MassHealth có khả năng phù hợp nhất. Đủ điều kiện cuối cùng được xác định sau khi đơn được xem xét.",
    quickCheckIntro: "Tôi có thể giúp bạn chọn giữa ACA-3, ACA-3-AP, SACA-2 và MSP.",
    eligibleLabel: "được đánh dấu là Đủ điều kiện.",
    startOver: "Bắt đầu lại",
    selectEligibleApplication: "Chọn Đơn Đủ Điều Kiện",
    existingDraftTitle: (typeLabel) => `Bạn có một đơn ${typeLabel} chưa hoàn thành`,
    existingDraftDescription:
      "Bạn có muốn tiếp tục từ chỗ đã dừng, hay bắt đầu một đơn mới hoàn toàn?",
    startNewApplication: "Bắt Đầu Đơn Mới",
    continueExistingApplication: "Tiếp Tục Đơn Hiện Có",
    questions: {
      addingPersonToExistingCase: {
        prompt: "Bạn có đang thêm người khác vào hộ gia đình MassHealth hiện có không?",
        yes: "Có",
        no: "Không",
      },
      ageGroup: {
        prompt: "Người nộp đơn có từ 65 tuổi trở lên không?",
        senior: "Có, từ 65 tuổi trở lên",
        under65: "Không, dưới 65 tuổi",
      },
      needsLongTermCare: {
        prompt: "Họ có cần dịch vụ chăm sóc dài hạn, bảo hiểm cơ sở điều dưỡng hoặc hỗ trợ tương tự không?",
        yes: "Có",
        no: "Không",
      },
      hasMedicare: {
        prompt: "Họ có Medicare và chủ yếu cần hỗ trợ thanh toán chi phí Medicare không?",
        yes: "Có",
        no: "Không",
      },
    },
    reasons: {
      aca3ap: "Bạn đang thêm người khác vào hộ gia đình ACA-3 hiện có.",
      saca2_longterm: "Bạn đã chọn bảo hiểm chăm sóc dài hạn.",
      saca2_senior: "Bạn đã chọn từ 65 tuổi trở lên.",
      msp: "Bạn đã chọn Medicare và có thể cần hỗ trợ về chi phí Medicare.",
      aca3: "Bạn đã chọn con đường bảo hiểm tiêu chuẩn cho hầu hết các cá nhân và gia đình.",
    },
    appTypes: {
      aca3: {
        title: "Đơn Massachusetts cho Bảo Hiểm Sức Khỏe và Nha Khoa và Hỗ Trợ Thanh Toán Chi Phí",
        description: "Đơn tiêu chuẩn cho hầu hết các cá nhân và gia đình.",
      },
      aca3ap: {
        title: "Đơn Massachusetts cho Bảo Hiểm Sức Khỏe và Nha Khoa và Hỗ Trợ Thanh Toán Chi Phí - Người Bổ Sung",
        description: "Sử dụng khi thêm người vào hộ gia đình ACA-3 hiện có.",
      },
      saca2: {
        title: "Đơn Bảo Hiểm Sức Khỏe cho Người Cao Tuổi và Người Cần Dịch Vụ Chăm Sóc Dài Hạn",
        description: "Dành cho người cao tuổi và người nộp đơn tìm kiếm bảo hiểm liên quan đến chăm sóc dài hạn.",
      },
      msp: {
        title: "Đơn Chương Trình Tiết Kiệm Medicare",
        description: "Để được hỗ trợ thanh toán chi phí Medicare (phí bảo hiểm và các chi phí Medicare khác).",
      },
    },
  },
}

export function getTypeCopy(language: SupportedLanguage): TypePageCopy {
  return COPY[language]
}
