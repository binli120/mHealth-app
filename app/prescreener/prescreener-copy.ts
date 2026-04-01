import { type SupportedLanguage } from "@/lib/i18n/languages"
import type { Step } from "./page.types"

interface PrescreenerCopy {
  back: string
  title: string
  restart: string
  estimateOnlyLead: string
  estimateOnlyBody: string
  resultsReady: string
  calculating: string
  stepLabel: (step: number, total: number) => string
  percentComplete: (progress: number) => string
  householdReply: (count: number) => string
  incomeReply: (formattedAmount: string) => string
  householdReference: (householdSize: number) => string
  yourIncomeAt: (fplPct: number) => string
  supportHours: string
  summaryLikely: (program: string) => string
  summaryPossibly: string
  summaryUnlikely: string
  summaryNonMA: string
  summaryFallback: string
  resultsTitle: string
  householdLabel: string
  annualIncomeLabel: string
  incomeLevelLabel: string
  nextSteps: string
  startFullApplication: string
  checkAgain: string
  callMassHealth: string
  fpl100: string
  fpl138: string
  fpl200: string
  fpl300: string
  steps: {
    intro: string
    massachusetts: string
    anotherState: string
    notMA: string
    movingToMA: string
    notMoving: string
    age: string
    ageUnder1: string
    age1to18: string
    age19to26: string
    age27to64: string
    age65Plus: string
    pregnancy: string
    yes: string
    no: string
    householdSize: string
    householdPlaceholder: string
    householdHint: string
    income: string
    incomePlaceholder: string
    incomeHint: string
    citizenship: string
    citizen: string
    permanentResident: string
    otherQualifiedImmigrant: string
    undocumented: string
    disability: string
    disabilityYes: string
    medicare: string
    medicareYes: string
    notSure: string
    employerInsurance: string
    employerNo: string
    done: string
  }
}

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  ht: "fr-HT",
  "pt-BR": "pt-BR",
  es: "es-US",
  vi: "vi-VN",
}

const COPY: Record<SupportedLanguage, PrescreenerCopy> = {
  en: {
    back: "Back",
    title: "Eligibility Pre-Screener",
    restart: "Restart",
    estimateOnlyLead: "Pre-screening estimate only.",
    estimateOnlyBody: "This is not an official eligibility determination. Based on 2026 FPL guidelines and MassHealth regulations.",
    resultsReady: "Here are your pre-screening results:",
    calculating: "Calculating...",
    stepLabel: (step, total) => `Step ${step} of ${total}`,
    percentComplete: (progress) => `${progress}% complete`,
    householdReply: (count) => `${count} ${count === 1 ? "person" : "people"}`,
    incomeReply: (formattedAmount) => `${formattedAmount} / year`,
    householdReference: (householdSize) => `2026 FPL Reference - Household of ${householdSize}`,
    yourIncomeAt: (fplPct) => `Your income is at ${fplPct}% FPL`,
    supportHours: "(Mon-Fri, 8am-5pm) for personalized assistance.",
    summaryLikely: (program) => `Based on your responses, you likely qualify for ${program}. This is a pre-screening estimate; a full application is needed for official enrollment.`,
    summaryPossibly: "Based on your responses, you may qualify for coverage. Complete a full application to get an official determination.",
    summaryUnlikely: "Based on your responses, you may not qualify for MassHealth. You may have other coverage options available.",
    summaryNonMA: "MassHealth is only available to Massachusetts residents.",
    summaryFallback: "Please complete a full application for an official determination.",
    resultsTitle: "Pre-Screening Complete",
    householdLabel: "Household",
    annualIncomeLabel: "Annual Income",
    incomeLevelLabel: "Income Level",
    nextSteps: "Next Steps",
    startFullApplication: "Start Full Application",
    checkAgain: "Check Again",
    callMassHealth: "Call MassHealth at",
    fpl100: "100% FPL",
    fpl138: "138% FPL (Medicaid)",
    fpl200: "200% FPL",
    fpl300: "300% FPL",
    steps: {
      intro: "Hi! I'm the MassHealth Eligibility Assistant. I can estimate which health coverage programs you may qualify for in under 5 minutes.\n\nLet's get started. Where do you currently live?",
      massachusetts: "Massachusetts",
      anotherState: "Another state",
      notMA: "MassHealth is only available to Massachusetts residents. You may have coverage options in your state. Visit healthcare.gov to explore.\n\nAre you planning to move to Massachusetts?",
      movingToMA: "Yes, I'm moving to MA",
      notMoving: "No",
      age: "How old are you?",
      ageUnder1: "Under 1 year",
      age1to18: "1–18 years",
      age19to26: "19–26 years",
      age27to64: "27–64 years",
      age65Plus: "65 or older",
      pregnancy: "Are you currently pregnant?",
      yes: "Yes",
      no: "No",
      householdSize: "How many people are in your household? Include yourself, your spouse or partner, and any children or other dependents you claim on taxes.",
      householdPlaceholder: "e.g. 1, 2, 3",
      householdHint: "Count everyone who lives with you and would be included on your tax return.",
      income: "What is your household's estimated annual income before taxes? Include wages, Social Security, disability, unemployment, and any other regular income.",
      incomePlaceholder: "e.g. 25000",
      incomeHint: "Round to the nearest dollar. Enter 0 if there is no income.",
      citizenship: "What is your citizenship or immigration status?",
      citizen: "U.S. Citizen",
      permanentResident: "Lawful Permanent Resident (Green Card)",
      otherQualifiedImmigrant: "Other qualified immigrant",
      undocumented: "Undocumented / No status",
      disability: "Do you have a disability, or do you receive SSI or SSDI?",
      disabilityYes: "Yes - SSI/SSDI or documented disability",
      medicare: "Are you currently enrolled in Medicare (Part A or Part B)?",
      medicareYes: "Yes, I have Medicare",
      notSure: "Not sure",
      employerInsurance: "Does your employer, or your spouse's employer, currently offer health insurance that you could enroll in?",
      employerNo: "No / Not applicable",
      done: "Thanks. Let me check your eligibility now...",
    },
  },
  "zh-CN": {
    back: "返回",
    title: "资格预筛查",
    restart: "重新开始",
    estimateOnlyLead: "仅为预筛查估算。",
    estimateOnlyBody: "这不是正式的资格认定。依据 2026 年联邦贫困线指南和 MassHealth 规定。",
    resultsReady: "这是您的预筛查结果：",
    calculating: "计算中...",
    stepLabel: (step, total) => `第 ${step} 步，共 ${total} 步`,
    percentComplete: (progress) => `已完成 ${progress}%`,
    householdReply: (count) => `${count} 人`,
    incomeReply: (formattedAmount) => `${formattedAmount} / 年`,
    householdReference: (householdSize) => `2026 年 FPL 参考 - ${householdSize} 人家庭`,
    yourIncomeAt: (fplPct) => `您的收入约为 FPL 的 ${fplPct}%`,
    supportHours: "周一至周五，上午 8 点至下午 5 点，可提供个性化协助。",
    summaryLikely: (program) => `根据您的回答，您很可能符合 ${program}。这只是预筛查估算；正式参保仍需完成完整申请。`,
    summaryPossibly: "根据您的回答，您可能符合某种保障。请完成完整申请以获得正式认定。",
    summaryUnlikely: "根据您的回答，您可能不符合 MassHealth 资格，但仍可能有其他保障选择。",
    summaryNonMA: "MassHealth 仅适用于马萨诸塞州居民。",
    summaryFallback: "请完成完整申请以获得正式认定。",
    resultsTitle: "预筛查完成",
    householdLabel: "家庭人数",
    annualIncomeLabel: "年收入",
    incomeLevelLabel: "收入水平",
    nextSteps: "下一步",
    startFullApplication: "开始完整申请",
    checkAgain: "重新筛查",
    callMassHealth: "请致电 MassHealth",
    fpl100: "100% FPL",
    fpl138: "138% FPL（医疗补助）",
    fpl200: "200% FPL",
    fpl300: "300% FPL",
    steps: {
      intro: "您好！我是 MassHealth 资格助手。我可以在 5 分钟内估算您可能符合哪些医疗保障项目。\n\n我们开始吧。您目前住在哪里？",
      massachusetts: "马萨诸塞州",
      anotherState: "其他州",
      notMA: "MassHealth 仅向马萨诸塞州居民提供。您所在州也许有可用的保险选项，可访问 healthcare.gov 查看。\n\n您是否计划搬到马萨诸塞州？",
      movingToMA: "是的，我要搬去马萨诸塞州",
      notMoving: "否",
      age: "您多大年龄？",
      ageUnder1: "不到 1 岁",
      age1to18: "1-18 岁",
      age19to26: "19-26 岁",
      age27to64: "27-64 岁",
      age65Plus: "65 岁或以上",
      pregnancy: "您目前怀孕了吗？",
      yes: "是",
      no: "否",
      householdSize: "您的家庭有几口人？请包括您本人、配偶或伴侣，以及您报税时申报的子女或其他受抚养人。",
      householdPlaceholder: "例如 1、2、3",
      householdHint: "请计算与您同住并会在报税中列入的人。",
      income: "您家庭税前预计年收入是多少？请包括工资、社保、残障福利、失业金及其他固定收入。",
      incomePlaceholder: "例如 25000",
      incomeHint: "请四舍五入到美元。若没有收入，请填 0。",
      citizenship: "您的公民身份或移民身份是什么？",
      citizen: "美国公民",
      permanentResident: "合法永久居民（绿卡）",
      otherQualifiedImmigrant: "其他符合条件的移民",
      undocumented: "无证件 / 无身份",
      disability: "您是否有残障，或正在领取 SSI 或 SSDI？",
      disabilityYes: "是 - 领取 SSI/SSDI 或有记录在案的残障",
      medicare: "您目前是否参加了 Medicare（A 部分或 B 部分）？",
      medicareYes: "是，我有 Medicare",
      notSure: "不确定",
      employerInsurance: "您本人或您配偶的雇主目前是否提供您可以加入的医疗保险？",
      employerNo: "否 / 不适用",
      done: "谢谢。现在我来核算您的资格...",
    },
  },
  ht: {
    back: "Retounen",
    title: "Pre-evalyasyon Elijiblite",
    restart: "Rekòmanse",
    estimateOnlyLead: "Sa a se sèlman yon estimasyon.",
    estimateOnlyBody: "Sa a pa yon desizyon ofisyèl sou elijiblite. Li baze sou gid FPL 2026 ak règleman MassHealth.",
    resultsReady: "Men rezilta pre-evalyasyon ou yo:",
    calculating: "Ap kalkile...",
    stepLabel: (step, total) => `Etap ${step} sou ${total}`,
    percentComplete: (progress) => `${progress}% fini`,
    householdReply: (count) => `${count} moun`,
    incomeReply: (formattedAmount) => `${formattedAmount} pa ane`,
    householdReference: (householdSize) => `Referans FPL 2026 - Fwaye ${householdSize} moun`,
    yourIncomeAt: (fplPct) => `Revni ou se ${fplPct}% FPL`,
    supportHours: "(Lendi-Vandredi, 8am-5pm) pou asistans pèsonalize.",
    summaryLikely: (program) => `Dapre repons ou yo, ou sanble kalifye pou ${program}. Sa a se yon estimasyon; ou bezwen yon aplikasyon konplè pou desizyon ofisyèl.`,
    summaryPossibly: "Dapre repons ou yo, ou ka kalifye pou kouvèti. Ranpli yon aplikasyon konplè pou jwenn desizyon ofisyèl.",
    summaryUnlikely: "Dapre repons ou yo, ou ka pa kalifye pou MassHealth. Ou ka gen lòt opsyon kouvèti.",
    summaryNonMA: "MassHealth disponib sèlman pou moun ki rete Massachusetts.",
    summaryFallback: "Tanpri ranpli yon aplikasyon konplè pou yon desizyon ofisyèl.",
    resultsTitle: "Pre-evalyasyon an fini",
    householdLabel: "Fwaye",
    annualIncomeLabel: "Revni Anyèl",
    incomeLevelLabel: "Nivo Revni",
    nextSteps: "Pwochen Etap",
    startFullApplication: "Kòmanse Aplikasyon Konplè",
    checkAgain: "Tcheke Ankò",
    callMassHealth: "Rele MassHealth nan",
    fpl100: "100% FPL",
    fpl138: "138% FPL (Medicaid)",
    fpl200: "200% FPL",
    fpl300: "300% FPL",
    steps: {
      intro: "Bonjou! Mwen se Asistan Elijiblite MassHealth la. Mwen ka estime ki pwogram kouvèti sante ou ka kalifye pou yo nan mwens pase 5 minit.\n\nAnn kòmanse. Ki kote ou ap viv kounye a?",
      massachusetts: "Massachusetts",
      anotherState: "Yon lòt eta",
      notMA: "MassHealth disponib sèlman pou rezidan Massachusetts. Ou ka gen opsyon kouvèti nan eta pa ou. Vizite healthcare.gov pou chèche yo.\n\nÈske ou planifye pou deplase ale Massachusetts?",
      movingToMA: "Wi, mwen pral viv MA",
      notMoving: "Non",
      age: "Ki laj ou genyen?",
      ageUnder1: "Mwens pase 1 an",
      age1to18: "1-18 ane",
      age19to26: "19-26 ane",
      age27to64: "27-64 ane",
      age65Plus: "65 ane oswa plis",
      pregnancy: "Èske ou ansent kounye a?",
      yes: "Wi",
      no: "Non",
      householdSize: "Konbyen moun ki nan fwaye ou? Mete tèt ou, mari oswa madanm ou oswa patnè ou, ak nenpòt timoun oswa lòt depandan ou mete sou taks.",
      householdPlaceholder: "egzanp 1, 2, 3",
      householdHint: "Konte tout moun ki ap viv avè ou epi ou ta mete sou deklarasyon taks ou.",
      income: "Konbyen revni estime fwaye ou genyen pa ane anvan taks? Mete salè, Sekirite Sosyal, andikap, chomaj, ak lòt revni regilye.",
      incomePlaceholder: "egzanp 25000",
      incomeHint: "Awondi a dola ki pi pre a. Mete 0 si pa gen revni.",
      citizenship: "Ki estati sitwayènte oswa imigrasyon ou?",
      citizen: "Sitwayen ameriken",
      permanentResident: "Rezidan Pèmanan Legal (Kat Vèt)",
      otherQualifiedImmigrant: "Lòt imigran ki kalifye",
      undocumented: "San papye / Pa gen estati",
      disability: "Èske ou gen yon andikap, oswa ou resevwa SSI oswa SSDI?",
      disabilityYes: "Wi - SSI/SSDI oswa andikap ki dokimante",
      medicare: "Èske ou enskri nan Medicare kounye a (Pati A oswa Pati B)?",
      medicareYes: "Wi, mwen gen Medicare",
      notSure: "Mwen pa sèten",
      employerInsurance: "Èske anplwayè ou oswa anplwayè mari/madanm ou ofri asirans sante ou ka enskri ladan li?",
      employerNo: "Non / Pa aplikab",
      done: "Mèsi. Kite m verifye elijiblite ou kounye a...",
    },
  },
  "pt-BR": {
    back: "Voltar",
    title: "Pré-triagem de Elegibilidade",
    restart: "Reiniciar",
    estimateOnlyLead: "Apenas estimativa de pré-triagem.",
    estimateOnlyBody: "Isto não é uma determinação oficial de elegibilidade. Baseado nas diretrizes FPL de 2026 e nas regras do MassHealth.",
    resultsReady: "Aqui estão os resultados da sua pré-triagem:",
    calculating: "Calculando...",
    stepLabel: (step, total) => `Etapa ${step} de ${total}`,
    percentComplete: (progress) => `${progress}% concluído`,
    householdReply: (count) => `${count} ${count === 1 ? "pessoa" : "pessoas"}`,
    incomeReply: (formattedAmount) => `${formattedAmount} por ano`,
    householdReference: (householdSize) => `Referência FPL 2026 - Família de ${householdSize}`,
    yourIncomeAt: (fplPct) => `Sua renda está em ${fplPct}% do FPL`,
    supportHours: "(Seg-Sex, 8h-17h) para assistência personalizada.",
    summaryLikely: (program) => `Com base nas suas respostas, é provável que você se qualifique para ${program}. Esta é uma estimativa; a inscrição oficial exige uma aplicação completa.`,
    summaryPossibly: "Com base nas suas respostas, você pode se qualificar para cobertura. Complete uma aplicação completa para uma decisão oficial.",
    summaryUnlikely: "Com base nas suas respostas, talvez você não se qualifique para o MassHealth. Pode haver outras opções de cobertura.",
    summaryNonMA: "O MassHealth está disponível apenas para residentes de Massachusetts.",
    summaryFallback: "Complete uma aplicação completa para uma decisão oficial.",
    resultsTitle: "Pré-triagem concluída",
    householdLabel: "Família",
    annualIncomeLabel: "Renda Anual",
    incomeLevelLabel: "Nível de Renda",
    nextSteps: "Próximos Passos",
    startFullApplication: "Iniciar Aplicação Completa",
    checkAgain: "Verificar Novamente",
    callMassHealth: "Ligue para o MassHealth em",
    fpl100: "100% do FPL",
    fpl138: "138% do FPL (Medicaid)",
    fpl200: "200% do FPL",
    fpl300: "300% do FPL",
    steps: {
      intro: "Olá! Sou o Assistente de Elegibilidade do MassHealth. Posso estimar, em menos de 5 minutos, para quais programas de cobertura de saúde você pode se qualificar.\n\nVamos começar. Onde você mora atualmente?",
      massachusetts: "Massachusetts",
      anotherState: "Outro estado",
      notMA: "O MassHealth está disponível apenas para residentes de Massachusetts. Você pode ter opções de cobertura no seu estado. Visite healthcare.gov para explorar.\n\nVocê planeja se mudar para Massachusetts?",
      movingToMA: "Sim, vou me mudar para MA",
      notMoving: "Não",
      age: "Qual é a sua idade?",
      ageUnder1: "Menos de 1 ano",
      age1to18: "1-18 anos",
      age19to26: "19-26 anos",
      age27to64: "27-64 anos",
      age65Plus: "65 anos ou mais",
      pregnancy: "Você está grávida no momento?",
      yes: "Sim",
      no: "Não",
      householdSize: "Quantas pessoas há na sua família? Inclua você, seu cônjuge ou parceiro e quaisquer filhos ou dependentes que você declara no imposto.",
      householdPlaceholder: "ex.: 1, 2, 3",
      householdHint: "Conte todos que moram com você e que seriam incluídos na sua declaração de imposto.",
      income: "Qual é a renda anual estimada da sua família antes dos impostos? Inclua salários, Seguro Social, benefícios por incapacidade, desemprego e outras rendas regulares.",
      incomePlaceholder: "ex.: 25000",
      incomeHint: "Arredonde para o dólar mais próximo. Digite 0 se não houver renda.",
      citizenship: "Qual é a sua cidadania ou situação imigratória?",
      citizen: "Cidadão dos EUA",
      permanentResident: "Residente Permanente Legal (Green Card)",
      otherQualifiedImmigrant: "Outro imigrante qualificado",
      undocumented: "Sem documentos / Sem status",
      disability: "Você tem alguma deficiência, ou recebe SSI ou SSDI?",
      disabilityYes: "Sim - SSI/SSDI ou deficiência documentada",
      medicare: "Você está inscrito no Medicare no momento (Parte A ou Parte B)?",
      medicareYes: "Sim, tenho Medicare",
      notSure: "Não tenho certeza",
      employerInsurance: "Seu empregador, ou o empregador do seu cônjuge, oferece seguro de saúde no qual você poderia se inscrever?",
      employerNo: "Não / Não se aplica",
      done: "Obrigado. Vou verificar sua elegibilidade agora...",
    },
  },
  es: {
    back: "Atrás",
    title: "Preevaluación de Elegibilidad",
    restart: "Reiniciar",
    estimateOnlyLead: "Solo es una estimación preliminar.",
    estimateOnlyBody: "Esto no es una determinación oficial de elegibilidad. Se basa en las guías FPL de 2026 y en las regulaciones de MassHealth.",
    resultsReady: "Estos son los resultados de su preevaluación:",
    calculating: "Calculando...",
    stepLabel: (step, total) => `Paso ${step} de ${total}`,
    percentComplete: (progress) => `${progress}% completado`,
    householdReply: (count) => `${count} ${count === 1 ? "persona" : "personas"}`,
    incomeReply: (formattedAmount) => `${formattedAmount} al año`,
    householdReference: (householdSize) => `Referencia FPL 2026 - Hogar de ${householdSize}`,
    yourIncomeAt: (fplPct) => `Su ingreso está en ${fplPct}% del FPL`,
    supportHours: "(Lun-Vie, 8am-5pm) para asistencia personalizada.",
    summaryLikely: (program) => `Según sus respuestas, es probable que califique para ${program}. Esta es una estimación preliminar; la inscripción oficial requiere una solicitud completa.`,
    summaryPossibly: "Según sus respuestas, podría calificar para cobertura. Complete una solicitud completa para obtener una determinación oficial.",
    summaryUnlikely: "Según sus respuestas, es posible que no califique para MassHealth. Puede haber otras opciones de cobertura disponibles.",
    summaryNonMA: "MassHealth solo está disponible para residentes de Massachusetts.",
    summaryFallback: "Complete una solicitud completa para una determinación oficial.",
    resultsTitle: "Preevaluación completada",
    householdLabel: "Hogar",
    annualIncomeLabel: "Ingreso Anual",
    incomeLevelLabel: "Nivel de Ingreso",
    nextSteps: "Próximos Pasos",
    startFullApplication: "Comenzar Solicitud Completa",
    checkAgain: "Verificar de Nuevo",
    callMassHealth: "Llame a MassHealth al",
    fpl100: "100% del FPL",
    fpl138: "138% del FPL (Medicaid)",
    fpl200: "200% del FPL",
    fpl300: "300% del FPL",
    steps: {
      intro: "¡Hola! Soy el Asistente de Elegibilidad de MassHealth. Puedo estimar en menos de 5 minutos para qué programas de cobertura médica podría calificar.\n\nComencemos. ¿Dónde vive actualmente?",
      massachusetts: "Massachusetts",
      anotherState: "Otro estado",
      notMA: "MassHealth solo está disponible para residentes de Massachusetts. Es posible que tenga opciones de cobertura en su estado. Visite healthcare.gov para explorar.\n\n¿Está planeando mudarse a Massachusetts?",
      movingToMA: "Sí, me mudaré a MA",
      notMoving: "No",
      age: "¿Qué edad tiene?",
      ageUnder1: "Menos de 1 año",
      age1to18: "1-18 años",
      age19to26: "19-26 años",
      age27to64: "27-64 años",
      age65Plus: "65 años o más",
      pregnancy: "¿Está embarazada actualmente?",
      yes: "Sí",
      no: "No",
      householdSize: "¿Cuántas personas hay en su hogar? Inclúyase a usted, a su cónyuge o pareja, y a cualquier hijo u otro dependiente que declare en impuestos.",
      householdPlaceholder: "ej. 1, 2, 3",
      householdHint: "Cuente a todas las personas que viven con usted y que incluiría en su declaración de impuestos.",
      income: "¿Cuál es el ingreso anual estimado de su hogar antes de impuestos? Incluya salarios, Seguro Social, discapacidad, desempleo y cualquier otro ingreso regular.",
      incomePlaceholder: "ej. 25000",
      incomeHint: "Redondee al dólar más cercano. Ingrese 0 si no hay ingresos.",
      citizenship: "¿Cuál es su estatus de ciudadanía o inmigración?",
      citizen: "Ciudadano de EE. UU.",
      permanentResident: "Residente Permanente Legal (Green Card)",
      otherQualifiedImmigrant: "Otro inmigrante calificado",
      undocumented: "Indocumentado / Sin estatus",
      disability: "¿Tiene una discapacidad o recibe SSI o SSDI?",
      disabilityYes: "Sí - SSI/SSDI o discapacidad documentada",
      medicare: "¿Está inscrito actualmente en Medicare (Parte A o Parte B)?",
      medicareYes: "Sí, tengo Medicare",
      notSure: "No estoy seguro",
      employerInsurance: "¿Su empleador o el empleador de su cónyuge ofrece actualmente un seguro médico en el que usted podría inscribirse?",
      employerNo: "No / No aplica",
      done: "Gracias. Ahora revisaré su elegibilidad...",
    },
  },
  vi: {
    back: "Quay lại",
    title: "Sàng Lọc Điều Kiện",
    restart: "Bắt đầu lại",
    estimateOnlyLead: "Chỉ là ước tính sàng lọc ban đầu.",
    estimateOnlyBody: "Đây không phải là quyết định chính thức về điều kiện. Dựa trên hướng dẫn FPL năm 2026 và quy định của MassHealth.",
    resultsReady: "Đây là kết quả sàng lọc của bạn:",
    calculating: "Đang tính toán...",
    stepLabel: (step, total) => `Bước ${step}/${total}`,
    percentComplete: (progress) => `Hoàn thành ${progress}%`,
    householdReply: (count) => `${count} người`,
    incomeReply: (formattedAmount) => `${formattedAmount} mỗi năm`,
    householdReference: (householdSize) => `Tham chiếu FPL 2026 - Hộ gia đình ${householdSize} người`,
    yourIncomeAt: (fplPct) => `Thu nhập của bạn ở mức ${fplPct}% FPL`,
    supportHours: "(Thứ Hai-Thứ Sáu, 8am-5pm) để được hỗ trợ cá nhân.",
    summaryLikely: (program) => `Dựa trên câu trả lời của bạn, nhiều khả năng bạn đủ điều kiện cho ${program}. Đây là ước tính ban đầu; cần nộp hồ sơ đầy đủ để có quyết định chính thức.`,
    summaryPossibly: "Dựa trên câu trả lời của bạn, bạn có thể đủ điều kiện nhận bảo hiểm. Hãy hoàn tất hồ sơ đầy đủ để được xác định chính thức.",
    summaryUnlikely: "Dựa trên câu trả lời của bạn, bạn có thể không đủ điều kiện cho MassHealth. Bạn vẫn có thể có lựa chọn bảo hiểm khác.",
    summaryNonMA: "MassHealth chỉ dành cho cư dân Massachusetts.",
    summaryFallback: "Vui lòng hoàn tất hồ sơ đầy đủ để có quyết định chính thức.",
    resultsTitle: "Đã hoàn tất sàng lọc",
    householdLabel: "Hộ gia đình",
    annualIncomeLabel: "Thu nhập hàng năm",
    incomeLevelLabel: "Mức thu nhập",
    nextSteps: "Các bước tiếp theo",
    startFullApplication: "Bắt đầu hồ sơ đầy đủ",
    checkAgain: "Kiểm tra lại",
    callMassHealth: "Gọi MassHealth theo số",
    fpl100: "100% FPL",
    fpl138: "138% FPL (Medicaid)",
    fpl200: "200% FPL",
    fpl300: "300% FPL",
    steps: {
      intro: "Xin chào! Tôi là Trợ lý Điều kiện MassHealth. Tôi có thể ước tính trong vòng chưa đến 5 phút bạn có thể đủ điều kiện cho chương trình bảo hiểm y tế nào.\n\nHãy bắt đầu. Hiện tại bạn đang sống ở đâu?",
      massachusetts: "Massachusetts",
      anotherState: "Tiểu bang khác",
      notMA: "MassHealth chỉ dành cho cư dân Massachusetts. Bạn có thể có các lựa chọn bảo hiểm tại tiểu bang của mình. Hãy truy cập healthcare.gov để tìm hiểu.\n\nBạn có dự định chuyển đến Massachusetts không?",
      movingToMA: "Có, tôi sẽ chuyển đến MA",
      notMoving: "Không",
      age: "Bạn bao nhiêu tuổi?",
      ageUnder1: "Dưới 1 tuổi",
      age1to18: "1-18 tuổi",
      age19to26: "19-26 tuổi",
      age27to64: "27-64 tuổi",
      age65Plus: "Từ 65 tuổi trở lên",
      pregnancy: "Hiện tại bạn có đang mang thai không?",
      yes: "Có",
      no: "Không",
      householdSize: "Có bao nhiêu người trong hộ gia đình của bạn? Bao gồm bạn, vợ/chồng hoặc bạn đời, và bất kỳ con cái hoặc người phụ thuộc nào bạn khai thuế.",
      householdPlaceholder: "ví dụ 1, 2, 3",
      householdHint: "Hãy tính tất cả những người sống cùng bạn và sẽ được đưa vào hồ sơ thuế.",
      income: "Thu nhập hàng năm ước tính của hộ gia đình bạn trước thuế là bao nhiêu? Bao gồm tiền lương, An sinh Xã hội, trợ cấp khuyết tật, thất nghiệp và các khoản thu nhập thường xuyên khác.",
      incomePlaceholder: "ví dụ 25000",
      incomeHint: "Làm tròn đến đô la gần nhất. Nhập 0 nếu không có thu nhập.",
      citizenship: "Tình trạng quốc tịch hoặc di trú của bạn là gì?",
      citizen: "Công dân Hoa Kỳ",
      permanentResident: "Thường trú nhân hợp pháp (Thẻ xanh)",
      otherQualifiedImmigrant: "Người nhập cư đủ điều kiện khác",
      undocumented: "Không giấy tờ / Không có tình trạng",
      disability: "Bạn có khuyết tật, hoặc đang nhận SSI hay SSDI không?",
      disabilityYes: "Có - SSI/SSDI hoặc khuyết tật có giấy tờ",
      medicare: "Hiện tại bạn có tham gia Medicare (Phần A hoặc Phần B) không?",
      medicareYes: "Có, tôi có Medicare",
      notSure: "Không chắc",
      employerInsurance: "Chủ lao động của bạn, hoặc của vợ/chồng bạn, hiện có cung cấp bảo hiểm y tế mà bạn có thể tham gia không?",
      employerNo: "Không / Không áp dụng",
      done: "Cảm ơn. Tôi sẽ kiểm tra điều kiện của bạn ngay bây giờ...",
    },
  },
}

export function getPrescreenerCopy(language: SupportedLanguage): PrescreenerCopy {
  return COPY[language]
}

export function getPrescreenerLocale(language: SupportedLanguage): string {
  return LOCALE_MAP[language]
}

export function formatPrescreenerCurrency(value: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(getPrescreenerLocale(language), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPrescreenerInteger(value: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(getPrescreenerLocale(language)).format(value)
}

export function getPrescreenerSteps(language: SupportedLanguage): Step[] {
  const copy = getPrescreenerCopy(language)

  return [
    {
      id: "intro",
      botMessage: copy.steps.intro,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.massachusetts, value: true, emoji: "🏠" },
        { label: copy.steps.anotherState, value: false, emoji: "📍" },
      ],
      dataKey: "livesInMA",
      next: (val) => (val === true ? "age" : "not_ma"),
    },
    {
      id: "not_ma",
      botMessage: copy.steps.notMA,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.movingToMA, value: true, emoji: "📦" },
        { label: copy.steps.notMoving, value: false, emoji: "✗" },
      ],
      dataKey: null,
      next: (val) => (val === true ? "age" : "done"),
    },
    {
      id: "age",
      botMessage: copy.steps.age,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.ageUnder1, value: 0, emoji: "👶" },
        { label: copy.steps.age1to18, value: 10, emoji: "🧒" },
        { label: copy.steps.age19to26, value: 22, emoji: "🎓" },
        { label: copy.steps.age27to64, value: 40, emoji: "👤" },
        { label: copy.steps.age65Plus, value: 70, emoji: "🧓" },
      ],
      dataKey: "age",
      next: (val) => {
        if ((val as number) < 1) return "household_size"
        if ((val as number) <= 18) return "household_size"
        if ((val as number) >= 65) return "household_size"
        return "pregnancy_check"
      },
    },
    {
      id: "pregnancy_check",
      botMessage: copy.steps.pregnancy,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.yes, value: true, emoji: "🤰" },
        { label: copy.steps.no, value: false, emoji: "✗" },
      ],
      dataKey: "isPregnant",
      next: "household_size",
    },
    {
      id: "household_size",
      botMessage: copy.steps.householdSize,
      inputType: "number",
      placeholder: copy.steps.householdPlaceholder,
      hint: copy.steps.householdHint,
      min: 1,
      max: 20,
      dataKey: "householdSize",
      next: "income",
    },
    {
      id: "income",
      botMessage: copy.steps.income,
      inputType: "currency",
      placeholder: copy.steps.incomePlaceholder,
      hint: copy.steps.incomeHint,
      min: 0,
      dataKey: "annualIncome",
      next: "citizenship",
    },
    {
      id: "citizenship",
      botMessage: copy.steps.citizenship,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.citizen, value: "citizen", emoji: "🇺🇸" },
        { label: copy.steps.permanentResident, value: "qualified_immigrant", emoji: "🟩" },
        { label: copy.steps.otherQualifiedImmigrant, value: "qualified_immigrant", emoji: "📄" },
        { label: copy.steps.undocumented, value: "undocumented", emoji: "🔒" },
      ],
      dataKey: "citizenshipStatus",
      next: (_, data) => {
        if (data.citizenshipStatus === "undocumented") return "done"
        if ((data.age ?? 0) >= 60 || (data.hasDisability ?? false)) return "disability"
        return "disability"
      },
    },
    {
      id: "disability",
      botMessage: copy.steps.disability,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.disabilityYes, value: true, emoji: "♿" },
        { label: copy.steps.no, value: false, emoji: "✗" },
      ],
      dataKey: "hasDisability",
      next: (val, data) => {
        const age = data.age ?? 0
        if (age >= 65 || val === true) return "medicare"
        return "employer_insurance"
      },
    },
    {
      id: "medicare",
      botMessage: copy.steps.medicare,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.medicareYes, value: true, emoji: "🏥" },
        { label: copy.steps.no, value: false, emoji: "✗" },
        { label: copy.steps.notSure, value: false, emoji: "❓" },
      ],
      dataKey: "hasMedicare",
      next: "employer_insurance",
    },
    {
      id: "employer_insurance",
      botMessage: copy.steps.employerInsurance,
      inputType: "quickreply",
      quickReplies: [
        { label: copy.steps.yes, value: true, emoji: "🏢" },
        { label: copy.steps.employerNo, value: false, emoji: "✗" },
      ],
      dataKey: "hasEmployerInsurance",
      next: "done",
    },
    {
      id: "done",
      botMessage: copy.steps.done,
      inputType: "done",
      dataKey: null,
      next: "done",
    },
  ]
}
