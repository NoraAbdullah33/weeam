export type ComplianceStatus =
  | "Compliant"
  | "Partially Compliant"
  | "Non-Compliant"
  | "Not Applicable";

export interface Finding {
  requirement_title: string;
  authority: string;
  source_document: string;
  section: string;
  status: ComplianceStatus;
  why: string;
  evidence_uploaded: string;
  evidence_regulation: string;
  gap: string;
  recommendation: string;
  suggested_improvement: string;
  reference_id: string;
  source_url: string;
  severity: "critical" | "high" | "medium" | "low";
  match_score: number;
}

export interface AuthorityScore {
  authority: string;
  score: number;
  matched: number;
  total: number;
}

export interface ComplianceTotals {
  matched_requirements: number;
  missing_requirements: number;
  partial_matches: number;
  high_risk_findings: number;
  critical_findings: number;
}

export interface ComplianceReport {
  overall_compliance: number;
  breakdown: AuthorityScore[];
  executive_summary: string;
  findings: Finding[];
  missing_controls: string[];
  recommendations: string[];
  totals: ComplianceTotals;
  engine: string;
  knowledge_base: { chunks: number; authorities: Record<string, { chunks: number; documents: number }> };
  documents?: number;
  document_names?: string[];
}

export interface KBStatus {
  chunks: number;
  authorities: Record<string, { chunks: number; documents: number }>;
  authority_names: Record<string, { name_en: string; name_ar: string }>;
  registered_sources: number;
  indexed_documents: {
    source_id: string; authority: string; title_en: string; title_ar: string;
    version: string; published_date: string; language: string; source_url: string;
    file_hash: string; pages: number; chunks: number;
  }[];
  failures: { source_id: string; authority: string; title_en: string; source_url: string; reason: string }[];
}
