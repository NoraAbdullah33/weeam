// Saudi regulatory knowledge base (RAG source).
//
// A curated catalog of the key controls each authority (DGA, NCA, NDMO, PDPL,
// CST) regulates. Every control carries the official requirement text in Arabic
// — this is the grounding that is retrieved and handed to Llama, so the model
// judges the uploaded document against the REAL requirement and never invents
// regulations. `concepts` (Arabic + English synonyms) power lightweight lexical
// retrieval so the most relevant controls surface first.

export const AUTH_AR: Record<string, string> = {
  DGA: "هيئة الحكومة الرقمية",
  NCA: "الهيئة الوطنية للأمن السيبراني",
  NDMO: "مكتب إدارة البيانات الوطنية",
  PDPL: "نظام حماية البيانات الشخصية",
  CST: "هيئة الاتصالات والفضاء والتقنية",
};

export const AUTH_EN: Record<string, string> = {
  DGA: "Digital Government Authority",
  NCA: "National Cybersecurity Authority",
  NDMO: "National Data Management Office",
  PDPL: "Personal Data Protection Law",
  CST: "Communications, Space & Technology Commission",
};

export interface Control {
  authority: string;
  reference_id: string;
  title_ar: string;
  section: string;
  source_document: string;
  source_url: string;
  /** The official requirement, in Arabic — the RAG grounding handed to Llama. */
  requirement_ar: string;
  /** Synonym groups (Arabic + English) for lexical retrieval ranking. */
  concepts: string[][];
}

export const CATALOG: Control[] = [
  // ---- DGA — Digital Government Authority ----
  { authority: "DGA", reference_id: "DGA-ITG-01", section: "حوكمة تقنية المعلومات",
    title_ar: "إطار حوكمة تقنية المعلومات ومواءمتها مع الاستراتيجية",
    source_document: "ضوابط ومعايير الحكومة الرقمية", source_url: "https://dga.gov.sa",
    requirement_ar: "يجب أن تعتمد الجهة إطاراً موثقاً لحوكمة تقنية المعلومات يحدد الأدوار والمسؤوليات ولجان الحوكمة، ويضمن مواءمة مبادرات التقنية مع الأهداف الاستراتيجية للجهة.",
    concepts: [["حوكمة", "governance"], ["تقنية المعلومات", "تكنولوجيا", "information technology", " it "], ["مواءمة", "استراتيجية", "alignment", "strategy"]] },
  { authority: "DGA", reference_id: "DGA-DT-02", section: "التحول الرقمي",
    title_ar: "استراتيجية التحول الرقمي ورقمنة الخدمات",
    source_document: "إطار التحول الرقمي الحكومي", source_url: "https://dga.gov.sa",
    requirement_ar: "يجب أن تمتلك الجهة استراتيجية معتمدة للتحول الرقمي تتضمن رقمنة الخدمات الحكومية وتحسين تجربة المستفيد وقياس نضج التحول الرقمي.",
    concepts: [["التحول الرقمي", "digital transformation", "رقمنة"], ["الخدمات الرقمية", "digital services", "خدمات إلكترونية"]] },
  { authority: "DGA", reference_id: "DGA-PM-03", section: "إدارة المشاريع والتغيير",
    title_ar: "حوكمة إدارة المشاريع وإدارة التغيير المؤسسي",
    source_document: "دليل إدارة المشاريع الحكومية", source_url: "https://dga.gov.sa",
    requirement_ar: "يجب أن تطبق الجهة منهجية موثقة لإدارة المشاريع وإدارة التغيير المؤسسي، مع مكتب لإدارة المشاريع يتابع النطاق والجدول الزمني والمخاطر.",
    concepts: [["إدارة المشاريع", "project management", "pmo", "مكتب المشاريع"], ["إدارة التغيير", "change management", "التغيير"]] },
  { authority: "DGA", reference_id: "DGA-EA-04", section: "البنية المؤسسية والتكامل",
    title_ar: "البنية المؤسسية والتكامل والتشغيل البيني",
    source_document: "معيار البنية المؤسسية", source_url: "https://dga.gov.sa",
    requirement_ar: "يجب أن توثّق الجهة بنيتها المؤسسية وتضمن التكامل والتشغيل البيني بين الأنظمة عبر القنوات الوطنية المعتمدة لتبادل البيانات.",
    concepts: [["البنية المؤسسية", "enterprise architecture", "معمارية"], ["التكامل", "integration", "interoperability", "التشغيل البيني"]] },
  { authority: "DGA", reference_id: "DGA-KPI-05", section: "قياس الأداء المؤسسي",
    title_ar: "مؤشرات قياس الأداء وربطها بالأهداف الاستراتيجية",
    source_document: "إطار قياس الأداء المؤسسي", source_url: "https://dga.gov.sa",
    requirement_ar: "يجب أن تحدد الجهة مؤشرات أداء رئيسية قابلة للقياس مرتبطة بأهدافها الاستراتيجية، وتراجعها دورياً لضمان تحقيق المستهدفات.",
    concepts: [["مؤشرات الأداء", "kpi", "kpis", "مؤشر"], ["الأهداف", "objectives", "المستهدفات", "targets"]] },

  // ---- NCA — National Cybersecurity Authority ----
  { authority: "NCA", reference_id: "NCA-ECC-1-1", section: "سياسة أمن المعلومات",
    title_ar: "سياسة الأمن السيبراني وأمن المعلومات المعتمدة",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    requirement_ar: "يجب أن تعتمد الجهة سياسة موثقة للأمن السيبراني وأمن المعلومات، تُعتمد من صاحب الصلاحية وتُعمّم وتُراجع دورياً.",
    concepts: [["أمن المعلومات", "information security", "الأمن السيبراني", "cybersecurity", "cyber security"], ["سياسة", "policy", "معتمدة"]] },
  { authority: "NCA", reference_id: "NCA-ECC-1-5", section: "إدارة المخاطر السيبرانية",
    title_ar: "إدارة مخاطر الأمن السيبراني وتقييمها دورياً",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    requirement_ar: "يجب أن تطبق الجهة منهجية لإدارة مخاطر الأمن السيبراني تشمل تحديد المخاطر وتقييمها ومعالجتها وفق مستوى مقبول للمخاطر.",
    concepts: [["إدارة المخاطر", "risk management", "المخاطر"], ["تقييم المخاطر", "risk assessment", "معالجة المخاطر"]] },
  { authority: "NCA", reference_id: "NCA-ECC-2-13", section: "الاستجابة للحوادث",
    title_ar: "إدارة حوادث الأمن السيبراني والاستجابة لها",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    requirement_ar: "يجب أن تمتلك الجهة خطة موثقة لإدارة حوادث الأمن السيبراني والاستجابة لها، مع آليات للاكتشاف والتصعيد والمراقبة المستمرة.",
    concepts: [["الاستجابة للحوادث", "incident response", "الحوادث", "incident"], ["مركز العمليات", "soc", "المراقبة", "monitoring"]] },
  { authority: "NCA", reference_id: "NCA-ECC-2-2", section: "إدارة الهويات والصلاحيات",
    title_ar: "إدارة هويات الدخول والصلاحيات والتحكم بالوصول",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    requirement_ar: "يجب أن تطبق الجهة ضوابط لإدارة هويات الدخول والصلاحيات مبنية على مبدأ الحد الأدنى من الصلاحيات والمصادقة متعددة العوامل للحسابات الحساسة.",
    concepts: [["الهوية", "identity", "الصلاحيات", "access control", "الوصول"], ["المصادقة", "authentication", "صلاحية", "privileges"]] },
  { authority: "NCA", reference_id: "NCA-ECC-2-5", section: "استمرارية الأعمال",
    title_ar: "استمرارية الأعمال والتعافي من الكوارث",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    requirement_ar: "يجب أن تعدّ الجهة خطة لاستمرارية الأعمال والتعافي من الكوارث تحدد أهداف زمن التعافي ونقطة التعافي، وتُختبر دورياً.",
    concepts: [["استمرارية الأعمال", "business continuity", "bcm", "bcp"], ["التعافي", "disaster recovery", " dr ", "rto", "rpo"]] },

  // ---- NDMO — National Data Management Office ----
  { authority: "NDMO", reference_id: "NDMO-DG-01", section: "حوكمة البيانات",
    title_ar: "حوكمة البيانات وإدارتها كأصل مؤسسي",
    source_document: "ضوابط إدارة وحوكمة البيانات الوطنية", source_url: "https://sdaia.gov.sa/ndmo",
    requirement_ar: "يجب أن تعتمد الجهة إطاراً لحوكمة البيانات يعامل البيانات كأصل مؤسسي، ويحدد مالكي البيانات وأدوار الإشراف وجودة البيانات.",
    concepts: [["حوكمة البيانات", "data governance", "إدارة البيانات", "data management"], ["جودة البيانات", "data quality"]] },
  { authority: "NDMO", reference_id: "NDMO-DC-02", section: "تصنيف البيانات",
    title_ar: "تصنيف البيانات حسب مستويات السرية والحساسية",
    source_document: "سياسة تصنيف البيانات", source_url: "https://sdaia.gov.sa/ndmo",
    requirement_ar: "يجب أن تصنّف الجهة بياناتها وفق مستويات السرية المعتمدة (سري للغاية، سري، مقيّد، عام) وتطبق ضوابط الحماية المناسبة لكل مستوى.",
    concepts: [["تصنيف البيانات", "data classification", "تصنيف"], ["السرية", "confidentiality", "حساسية", "sensitivity"]] },
  { authority: "NDMO", reference_id: "NDMO-MD-03", section: "البيانات الوصفية",
    title_ar: "إدارة البيانات الوصفية وقاموس البيانات",
    source_document: "معيار البيانات الوصفية", source_url: "https://sdaia.gov.sa/ndmo",
    requirement_ar: "يجب أن توثّق الجهة البيانات الوصفية وتبني قاموساً للبيانات ونماذج بيانات معتمدة لضمان فهم موحّد للبيانات.",
    concepts: [["البيانات الوصفية", "metadata", "القاموس", "data catalog"], ["النمذجة", "data model", "نموذج البيانات"]] },
  { authority: "NDMO", reference_id: "NDMO-OD-04", section: "البيانات المفتوحة",
    title_ar: "نشر ومشاركة البيانات المفتوحة",
    source_document: "سياسة البيانات المفتوحة", source_url: "https://sdaia.gov.sa/ndmo",
    requirement_ar: "يجب أن تحدد الجهة البيانات القابلة للنشر كبيانات مفتوحة وتنشرها وفق المعايير الوطنية مع مراعاة الخصوصية والأمن.",
    concepts: [["البيانات المفتوحة", "open data", "مشاركة البيانات", "data sharing"]] },

  // ---- PDPL — Personal Data Protection Law ----
  { authority: "PDPL", reference_id: "PDPL-ART-05", section: "حماية البيانات الشخصية",
    title_ar: "حماية البيانات الشخصية وخصوصية الأفراد",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    requirement_ar: "يجب أن تحمي الجهة البيانات الشخصية وتعالجها لأغراض مشروعة ومحددة، مع تطبيق ضوابط الخصوصية وتقليل جمع البيانات لأدنى حد لازم.",
    concepts: [["البيانات الشخصية", "personal data", "الخصوصية", "privacy"], ["حماية", "protection", "معالجة البيانات"]] },
  { authority: "PDPL", reference_id: "PDPL-ART-11", section: "موافقة صاحب البيانات",
    title_ar: "الحصول على موافقة صاحب البيانات وحقوقه",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    requirement_ar: "يجب أن تحصل الجهة على موافقة صاحب البيانات الشخصية قبل معالجتها، وتمكّنه من ممارسة حقوقه في الوصول والتصحيح والحذف.",
    concepts: [["الموافقة", "consent", "صاحب البيانات", "data subject"], ["حقوق", "rights", "حق الوصول"]] },
  { authority: "PDPL", reference_id: "PDPL-ART-18", section: "الاحتفاظ والإتلاف",
    title_ar: "سياسة الاحتفاظ بالبيانات وإتلافها",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    requirement_ar: "يجب أن تحدد الجهة مدد الاحتفاظ بالبيانات الشخصية وتتلفها بطريقة آمنة عند انتهاء الغرض من معالجتها.",
    concepts: [["الاحتفاظ", "retention", "الإتلاف", "disposal", "الحذف", "deletion"]] },
  { authority: "PDPL", reference_id: "PDPL-ART-20", section: "الإبلاغ عن الانتهاكات",
    title_ar: "الإبلاغ عن انتهاكات البيانات الشخصية",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    requirement_ar: "يجب أن تمتلك الجهة إجراءات للإبلاغ عن انتهاكات البيانات الشخصية للجهة المختصة وإخطار أصحاب البيانات عند الاقتضاء ضمن المدد النظامية.",
    concepts: [["انتهاك البيانات", "data breach", "تسريب"], ["التبليغ", "notification", "الإخطار", "الإبلاغ"]] },

  // ---- CST — Communications, Space & Technology Commission ----
  { authority: "CST", reference_id: "CST-REG-01", section: "تنظيم الاتصالات",
    title_ar: "الالتزام بأنظمة الاتصالات وتقنية المعلومات",
    source_document: "اللوائح التنظيمية للاتصالات", source_url: "https://cst.gov.sa",
    requirement_ar: "يجب أن تلتزم الجهة بأنظمة ولوائح الاتصالات وتقنية المعلومات والتراخيص المعتمدة عند تقديم أو استخدام خدمات الاتصالات.",
    concepts: [["الاتصالات", "communications", "telecom"], ["الطيف الترددي", "spectrum", "التراخيص", "licensing"]] },
  { authority: "CST", reference_id: "CST-CLD-02", section: "الحوسبة السحابية",
    title_ar: "ضوابط الحوسبة السحابية واستضافة البيانات",
    source_document: "إطار تنظيم الحوسبة السحابية", source_url: "https://cst.gov.sa",
    requirement_ar: "يجب أن تلتزم الجهة بضوابط الحوسبة السحابية بما في ذلك تصنيف مستوى الخدمة ومتطلبات استضافة البيانات داخل المملكة وفق حساسيتها.",
    concepts: [["الحوسبة السحابية", "cloud", "السحابة"], ["استضافة", "hosting", "مراكز البيانات", "data center"]] },
  { authority: "CST", reference_id: "CST-ET-03", section: "التقنيات الناشئة",
    title_ar: "الاستخدام المسؤول للتقنيات الناشئة والذكاء الاصطناعي",
    source_document: "مبادئ التقنيات الناشئة", source_url: "https://cst.gov.sa",
    requirement_ar: "يجب أن تتبنى الجهة مبادئ الاستخدام المسؤول والأخلاقي للتقنيات الناشئة والذكاء الاصطناعي مع إدارة المخاطر المرتبطة بها.",
    concepts: [["الذكاء الاصطناعي", "artificial intelligence", " ai ", "التقنيات الناشئة", "emerging"]] },
];

/** Distinct authority codes present in the catalog, in first-seen order. */
export const AUTHORITIES: string[] = [...new Set(CATALOG.map((c) => c.authority))];
