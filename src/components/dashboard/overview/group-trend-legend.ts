import { Chart, type ChartEvent, type LegendElement, type LegendItem } from 'chart.js';

export function groupTrendLegendLabels(chart: Chart): LegendItem[] {
  return Chart.defaults.plugins.legend.labels.generateLabels(chart).map(item => {
    const color = item.strokeStyle ?? item.fillStyle ?? '#6b7280';
    return {
      ...item,
      hidden: false,
      pointStyle: 'circle',
      fillStyle: chart.isDatasetVisible(item.datasetIndex!) ? color : 'transparent',
      strokeStyle: color,
      lineWidth: 1.5,
      lineDash: [],
    };
  });
}

export function toggleGroupTrendLegend(_event: ChartEvent, item: LegendItem, legend: LegendElement<'line'>): void {
  if (item.datasetIndex === undefined) return;
  const chart = legend.chart;
  chart.setDatasetVisibility(item.datasetIndex, !chart.isDatasetVisible(item.datasetIndex));
  chart.update();
}
