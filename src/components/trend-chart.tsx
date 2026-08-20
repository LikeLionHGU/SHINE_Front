import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { TrendIndicator, TrendPoint } from "@/lib/report";
import { colors, font } from "@/lib/theme";

/**
 * 기본 평균 수치를 정한다.
 *
 * 서버가 항목별 평균(average)을 주면 그걸 쓰고, 아직 없으면 y축 기준 범위의
 * 중앙값으로 대신한다. range는 "낮음~높음"을 가르는 구간이라 그 한가운데가
 * 곧 이 항목의 표준 위치다.
 */
export function baselineOf(
  indicator: Pick<TrendIndicator, "average" | "range">,
): number {
  if (typeof indicator.average === "number") return indicator.average;
  const [min, max] = indicator.range;
  return (min + max) / 2;
}

// Figma(node 837:4354 분석 리스트): 각 지표 행의 작은 추이 미리보기.
//
// 시안에서 꺾은선 아래에 깔린 점선은 장식이 아니라 **기본 평균 수치**다.
// 선만 그리면 "오르내렸다"는 것만 보이고 그게 높은 건지 낮은 건지 알 수 없어서,
// 값과 평균을 같은 눈금 위에 함께 그린다.
const MINI_STROKE = 1.5;

export function MiniTrendLine({
  values,
  baseline,
  width = 46,
  height = 22,
  color = "#FA0C56",
}: {
  values: number[];
  /** 기본 평균 수치. 없으면 점선을 그리지 않는다. */
  baseline?: number;
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length === 0) return <View style={{ width, height }} />;

  // 값과 평균을 같은 눈금에 올려야 위아래 관계가 의미를 갖는다.
  const pool = typeof baseline === "number" ? [...values, baseline] : values;
  const min = Math.min(...pool);
  const max = Math.max(...pool);
  const span = max - min || 1;

  // 선 굵기의 절반만큼 안쪽으로 들여야 위아래 끝이 잘리지 않는다.
  const inset = MINI_STROKE / 2;
  const usable = Math.max(1, height - MINI_STROKE);
  const yOf = (v: number) => inset + (1 - (v - min) / span) * usable;

  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const d =
    values.length === 1
      ? // 측정이 한 번뿐이면 꺾일 곳이 없다 — 시안의 '요단백' 행처럼 평평한 선을 긋는다.
        `M 0 ${yOf(values[0]).toFixed(1)} L ${width} ${yOf(values[0]).toFixed(1)}`
      : values
          .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${yOf(v).toFixed(1)}`)
          .join(" ");

  return (
    <Svg width={width} height={height}>
      {typeof baseline === "number" && (
        <Path
          d={`M 0 ${yOf(baseline).toFixed(1)} L ${width} ${yOf(baseline).toFixed(1)}`}
          stroke={colors.line}
          strokeWidth={1}
          strokeDasharray="3 3"
          fill="none"
        />
      )}
      <Path
        d={d}
        stroke={color}
        strokeWidth={MINI_STROKE}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 분석 상세의 큰 차트 (Figma node 849:9340 / 837:5500)
//
// 시안 좌표(카드 361×211 기준):
//   격자선 y = 48(높음) · 110(안정) · 172(낮음),  x = 49~326 (폭 277)
//   구간 라벨 = left 9, 폭 24, 각 격자선에 세로 중앙 정렬
//   데이터 점 = 지름 10,  x축 라벨 = 중앙 y 190.5
// SVG 좌표로 옮기면 격자 간격은 62px, 위아래 PAD만큼 원이 삐져나올 자리를 둔다.
// ─────────────────────────────────────────────────────────────────────────────

/** 격자선 사이 간격 (시안 48 → 110 → 172) */
const ZONE_GAP = 62;
/** 격자 맨 위에서 맨 아래까지 */
const PLOT_BAND = ZONE_GAP * 2;
/**
 * 점을 그릴 영역을 SVG 안쪽으로 들여놓는 여백.
 * 점을 격자선 위에 정확히 올리면 반지름(5)과 테두리만큼 원이 SVG 밖으로 나가
 * 최고·최저값 점이 잘려 보인다.
 */
const PAD = 7;
const CHART_HEIGHT = PLOT_BAND + PAD * 2;
/** 구간 라벨 칸 + 격자까지의 간격 (시안: 라벨 9~33, 격자 49) */
export const ZONE_LABEL_WIDTH = 24;
export const ZONE_LABEL_GAP = 16;
/**
 * 차트 오른쪽에 비워두는 폭.
 * 마지막 점 위의 말풍선이 카드 밖으로 나가지 않으려면 이만큼 필요하다
 * (시안: 점 x=326, 말풍선 오른쪽 끝 352, 카드 폭 361).
 */
export const CHART_RIGHT_GUTTER = 35;

/** 카드 폭에서 실제 그래프가 차지할 폭을 구한다. */
export function chartWidthFor(cardWidth: number): number {
  return Math.max(
    1,
    cardWidth - 9 - ZONE_LABEL_WIDTH - ZONE_LABEL_GAP - CHART_RIGHT_GUTTER,
  );
}

/**
 * x축 날짜를 "8월 1일"로 맞춘다.
 *
 * 서버는 검사일을 "26.08.10"이나 "2026-08-10"처럼 연도까지 붙여 내려주는데,
 * 그대로 쓰면 폭 277 안에 라벨이 겹쳐 글자가 서로 파고든다(연도는 x축에서
 * 아무 정보도 주지 않는다). 이미 "4월 20일" 꼴이면 손대지 않는다.
 */
export function formatAxisDate(raw: string): string {
  const text = (raw ?? "").trim();
  if (!text || text.includes("월")) return text;
  const parts = text.match(/\d+/g);
  if (!parts || parts.length < 2) return text;
  // 연도가 앞에 붙든 안 붙든 마지막 두 조각이 월·일이다.
  const [month, day] = parts.slice(-2);
  return `${Number(month)}월 ${Number(day)}일`;
}

/**
 * x축에 실제로 글자를 찍을 점을 고른다.
 *
 * 검사가 쌓일수록 점 간격이 좁아져 라벨을 전부 찍으면 겹친다. 최신 검사일은
 * 반드시 보여야 하므로 마지막 점에서 거꾸로 세어 내려오고, 첫 검사일도
 * 앞 라벨과 충분히 떨어져 있을 때만 함께 보여준다.
 */
function visibleLabelIndices(count: number, width: number): Set<number> {
  const shown = new Set<number>();
  if (count === 0) return shown;
  const maxLabels = Math.max(2, Math.floor(width / (AXIS_LABEL_WIDTH + 4)));
  const step = Math.max(1, Math.ceil(count / maxLabels));
  for (let i = count - 1; i >= 0; i -= step) shown.add(i);
  const smallest = Math.min(...shown);
  if (smallest > 0 && smallest >= step * 0.6) shown.add(0);
  return shown;
}

export function TrendChart({
  indicator,
  width,
}: {
  indicator: Pick<TrendIndicator, "history" | "range" | "zoneLabels" | "unit">;
  width: number;
}) {
  const { history, range, zoneLabels, unit } = indicator;
  const [min, max] = range;
  const span = max - min || 1;

  // 말풍선을 띄울 점.
  //
  // 시안은 마지막 점 위에 말풍선이 떠 있는 상태라 기본값을 마지막 점으로 둔다.
  // 그 위에 마우스를 올리거나(웹) 점을 누르면(모바일) 그 점으로 옮겨가고,
  // 마우스가 빠져나가면 다시 마지막 점으로 돌아온다.
  const lastIndex = history.length - 1;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activeIndex = hoverIndex ?? lastIndex;

  const plotWidth = Math.max(1, width - PAD * 2);
  const stepX = history.length > 1 ? plotWidth / (history.length - 1) : 0;

  // 측정 기록이 하나도 없으면 그릴 선도 점도 없다. 아래 areaPath가 points[0]을
  // 건드리므로 여기서 먼저 막는다.
  if (history.length === 0) return <View style={{ height: CHART_HEIGHT }} />;

  const points = history.map((point: TrendPoint, i: number) => {
    const ratio = Math.min(1, Math.max(0, (point.value - min) / span));
    return {
      ...point,
      // 점이 하나뿐이면 가운데에 둔다.
      x: history.length > 1 ? PAD + i * stepX : PAD + plotWidth / 2,
      y: PAD + (1 - ratio) * PLOT_BAND,
    };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const chartBottom = PAD + PLOT_BAND;
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${chartBottom} L ${points[0].x.toFixed(1)} ${chartBottom} Z`;
  const active = points[activeIndex];
  const labelIndices = visibleLabelIndices(points.length, width);

  // 말풍선은 점 위에 가운데 정렬하되 카드 밖으로 넘치지 않게 가둔다.
  // 가둬서 밀린 만큼 꼬리는 반대로 움직여야 여전히 점을 가리킨다.
  const tooltipLeft = active
    ? Math.min(Math.max(active.x - TOOLTIP_WIDTH / 2, 0), Math.max(0, width - TOOLTIP_WIDTH))
    : 0;
  const tailLeft = active
    ? Math.min(Math.max(active.x - tooltipLeft - TAIL / 2, 8), TOOLTIP_WIDTH - TAIL - 8)
    : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.zoneLabels}>
          {zoneLabels.map((label, i) => (
            <Text
              key={label}
              style={[styles.zoneLabel, { top: PAD + i * ZONE_GAP - LABEL_HALF }]}
            >
              {label}
            </Text>
          ))}
        </View>

        <View style={{ width }}>
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FA0C56" stopOpacity={0.18} />
                <Stop offset="1" stopColor="#FA0C56" stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {zoneLabels.map((label, i) => (
              <Path
                key={label}
                d={`M 0 ${PAD + i * ZONE_GAP} L ${width} ${PAD + i * ZONE_GAP}`}
                stroke={colors.line}
                strokeWidth={1}
              />
            ))}

            <Path d={areaPath} fill="url(#trendFill)" />
            <Path
              d={linePath}
              stroke="#FA0C56"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((p, i) => (
              <Circle
                key={p.date}
                cx={p.x}
                cy={p.y}
                r={5}
                fill="#FFFFFF"
                stroke="#FA0C56"
                strokeWidth={i === activeIndex ? 2.4 : 1.8}
              />
            ))}
          </Svg>

          {/*
            점 위의 투명한 손잡이.
            SVG 안의 <Circle>에는 hover를 붙일 수 없어서, 같은 자리에 겹쳐 둔다.
            지름 10짜리 점은 손가락으로 정확히 누르기 어려우니 히트 영역은 28로 넓힌다.
          */}
          {points.map((p, i) => (
            <Pressable
              key={`hit-${p.date}`}
              style={[styles.hit, { left: p.x - HIT / 2, top: p.y - HIT / 2 }]}
              onPointerEnter={() => setHoverIndex(i)}
              onPointerLeave={() => setHoverIndex(null)}
              onPress={() => setHoverIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={`${p.date} ${p.value}${unit}`}
            />
          ))}

          {active && (
            <View
              pointerEvents="none"
              style={[
                styles.tooltipWrap,
                { left: tooltipLeft, top: active.y - TOOLTIP_HEIGHT - 12 },
              ]}
            >
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>
                  {active.value}
                  {unit}
                </Text>
              </View>
              <View style={[styles.tooltipTail, { left: tailLeft }]} />
            </View>
          )}
        </View>
      </View>

      {/* 라벨은 각 점의 x좌표 아래에 직접 놓는다. space-between으로 흩뿌리면
          점과 글자가 어긋나서 어느 날짜가 어느 점인지 읽기 어렵다. */}
      <View style={[styles.axisLabels, { marginLeft: ZONE_LABEL_WIDTH + ZONE_LABEL_GAP, width }]}>
        {points.map((p, i) =>
          labelIndices.has(i) ? (
            <Text
              key={p.date}
              numberOfLines={1}
              style={[styles.axisLabel, { left: p.x - AXIS_LABEL_WIDTH / 2 }]}
            >
              {formatAxisDate(p.date)}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}

/** 구간 라벨(높음/안정/낮음) 한 줄 높이의 절반 — 격자선에 세로 중앙을 맞춘다. */
const LABEL_HALF = 11;
/** 점을 누르기 위한 투명 손잡이 크기 */
const HIT = 28;
/** x축 날짜 한 칸 폭 ("12월 20일"이 들어가는 크기) */
const AXIS_LABEL_WIDTH = 56;
const TOOLTIP_WIDTH = 53;
const TOOLTIP_HEIGHT = 26;
const TAIL = 10;

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: "row" },
  zoneLabels: { width: ZONE_LABEL_WIDTH, height: CHART_HEIGHT, marginRight: ZONE_LABEL_GAP },
  zoneLabel: {
    position: "absolute",
    width: ZONE_LABEL_WIDTH,
    color: colors.textHint,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 22,
  },

  hit: { position: "absolute", width: HIT, height: HIT, zIndex: 2 },

  tooltipWrap: { position: "absolute", alignItems: "flex-start", zIndex: 3 },
  tooltip: {
    minWidth: TOOLTIP_WIDTH,
    height: TOOLTIP_HEIGHT,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  // 말풍선 꼬리 — RN에는 삼각형 도형이 없어서 한쪽만 색을 준 테두리로 만든다.
  tooltipTail: {
    position: "absolute",
    top: TOOLTIP_HEIGHT - 1,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL / 2,
    borderRightWidth: TAIL / 2,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
  },
  tooltipText: {
    color: "#000000",
    fontFamily: font.regular,
    fontSize: 12,
    letterSpacing: -1,
  },

  axisLabels: { height: 22 },
  axisLabel: {
    position: "absolute",
    width: AXIS_LABEL_WIDTH,
    color: colors.textHint,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 22,
    textAlign: "center",
  },
});
