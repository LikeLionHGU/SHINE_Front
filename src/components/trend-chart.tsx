import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { TrendIndicator, TrendPoint } from "@/lib/report";

// Figma(node 671:3093 분석 리스트): 각 지표 행의 작은 추이 미리보기.
export function MiniTrendLine({
  values,
  width = 46,
  height = 13,
  color = "#FA0C56",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * height,
  }));
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const CHART_HEIGHT = 128;

// Figma(node 671:4538 분석_개별 상세 페이지): 지표 추이 큰 차트.
// 3개 구간 기준선(높음/안정/낮음) + 데이터 포인트 4개 + 마지막 값 강조 툴팁.
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
  const stepX = history.length > 1 ? width / (history.length - 1) : 0;

  const points = history.map((point: TrendPoint, i: number) => {
    const ratio = Math.min(1, Math.max(0, (point.value - min) / span));
    return { ...point, x: i * stepX, y: CHART_HEIGHT - ratio * CHART_HEIGHT };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${CHART_HEIGHT} L ${points[0].x.toFixed(1)} ${CHART_HEIGHT} Z`;
  const lastPoint = points[points.length - 1];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.zoneLabels}>
          <Text style={styles.zoneLabel}>{zoneLabels[0]}</Text>
          <Text style={styles.zoneLabel}>{zoneLabels[1]}</Text>
          <Text style={styles.zoneLabel}>{zoneLabels[2]}</Text>
        </View>

        <View style={{ width }}>
          {lastPoint && (
            <View style={[styles.tooltip, { left: Math.min(Math.max(lastPoint.x - 26, 0), width - 52) }]}>
              <Text style={styles.tooltipText}>
                {lastPoint.value}
                {unit}
              </Text>
            </View>
          )}

          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FA0C56" stopOpacity={0.18} />
                <Stop offset="1" stopColor="#FA0C56" stopOpacity={0} />
              </LinearGradient>
            </Defs>

            <Path d={`M 0 0 L ${width} 0`} stroke="#EFEFEF" strokeWidth={1} />
            <Path d={`M 0 ${CHART_HEIGHT / 2} L ${width} ${CHART_HEIGHT / 2}`} stroke="#EFEFEF" strokeWidth={1} />
            <Path d={`M 0 ${CHART_HEIGHT} L ${width} ${CHART_HEIGHT}`} stroke="#EFEFEF" strokeWidth={1} />

            <Path d={areaPath} fill="url(#trendFill)" />
            <Path d={linePath} stroke="#FA0C56" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              return (
                <Circle
                  key={p.date}
                  cx={p.x}
                  cy={p.y}
                  r={isLast ? 5 : 4}
                  fill="#FFFFFF"
                  stroke="#FA0C56"
                  strokeWidth={isLast ? 2.4 : 1.8}
                />
              );
            })}
          </Svg>
        </View>
      </View>

      <View style={[styles.axisLabels, { paddingLeft: 34, width: width + 34 }]}>
        {history.map((point: TrendPoint) => (
          <Text key={point.date} style={styles.axisLabel}>
            {point.date}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: "row", gap: 10 },
  zoneLabels: {
    width: 24,
    height: CHART_HEIGHT,
    justifyContent: "space-between",
  },
  zoneLabel: { color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 16 },
  tooltip: {
    position: "absolute",
    top: -30,
    width: 52,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 2,
  },
  tooltipText: { color: "#111111", fontFamily: "Pretendard-Regular", fontSize: 11, letterSpacing: -0.3 },
  axisLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisLabel: { color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 11, width: 48, textAlign: "center" },
});
