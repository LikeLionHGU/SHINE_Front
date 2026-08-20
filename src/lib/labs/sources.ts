// lib/labs/sources.ts
// 출처 레지스트리 접근 + 인용 객체 생성.
// 규칙: 판정 결과에 citations가 비어 있으면 그 판정은 사용자에게 노출하지 않는다.

import type { Citation, RuleSource, Source, SourceRegistry, TrustTier } from './types';
import registryJson from './data/sources.json';

export const registry = registryJson as unknown as SourceRegistry;

export function getSource(id: string): Source | undefined {
  return registry.sources[id];
}

/** 판정 근거로 쓸 수 있는 출처인가 (tier A/B만 허용, D는 차단) */
export function isJudgmentGrade(id: string, allowed: TrustTier[] = ['A', 'B']): boolean {
  const s = getSource(id);
  return !!s && allowed.includes(s.trust_tier) && s.verification !== 'unverified';
}

export function toCitation(rs: RuleSource): Citation | null {
  const s = getSource(rs.id);
  if (!s) return null;
  return {
    sourceId: rs.id,
    label: s.citation_ko,
    url: s.url,
    quote: rs.quote,
    trustTier: s.trust_tier,
    verification: s.verification,
    published: s.published,
  };
}

export function toCitations(list: RuleSource[] | undefined): Citation[] {
  if (!list) return [];
  return list.map(toCitation).filter((c): c is Citation => c !== null);
}

export function citationById(id: string, quote?: string): Citation | null {
  return toCitation({ id, quote });
}

/** UI 하단에 항상 노출할 출처 요약 한 줄 */
export function formatCitationLine(citations: Citation[], dataUpdatedAt: string): string {
  const uniq = Array.from(new Map(citations.map((c) => [c.sourceId, c])).values());
  const labels = uniq.map((c) => (c.published ? `${c.label}` : c.label)).join(' · ');
  return `출처: ${labels} / 데이터 기준일 ${dataUpdatedAt}`;
}

/** 검증 상태를 사용자에게 보여줄 문구로 */
export function verificationBadge(c: Citation): string {
  switch (c.verification) {
    case 'primary_verified': return '원문 확인';
    case 'mirror_verified': return '원문(미러) 확인';
    case 'secondary_only': return '2차 자료 확인';
    default: return '미검증';
  }
}
