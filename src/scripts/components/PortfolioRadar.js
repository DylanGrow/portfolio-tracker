import * as d3 from 'd3';

export class PortfolioRadar {
  constructor(container) {
    this.container = container;
    this.width = 380;
    this.height = 380;
    this.radius = Math.min(this.width, this.height) / 2 - 60;
  }

  render(portfolioMetrics) {
    // portfolioMetrics: { diversification, volatility, value, growth, quality, momentum }
    this.container.innerHTML = '';

    const svg = d3.select(this.container)
      .append('svg')
      .attr('viewBox', `-100 -100 ${this.width + 200} ${this.height + 200}`)
      .attr('width', '100%')
      .attr('height', '100%')
      .style('overflow', 'visible')
      .attr('role', 'img')
      .attr('aria-label', 'Portfolio Health Radar chart mapping out Diversification, Volatility, Value, Growth, Quality, and Momentum');
    
    // Add glowing filter definitions for visual excellence
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    
    glowFilter.append('feMerge')
      .append('feMergeNode')
      .attr('in', 'blur');
    glowFilter.select('feMerge')
      .append('feMergeNode')
      .attr('in', 'SourceGraphic');

    const g = svg.append('g')
      .attr('transform', `translate(${this.width / 2}, ${this.height / 2})`);
    
    const metrics = Object.keys(portfolioMetrics);
    const values = Object.values(portfolioMetrics);
    const angleSlice = (Math.PI * 2) / metrics.length;
    
    // Draw 5 levels of background grid concentric hexagons/circles
    const levels = 5;
    const isHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
    const gridColor = isHighContrast ? '#ffffff' : 'rgba(255, 255, 255, 0.08)';

    for (let level = 1; level <= levels; level++) {
      const r = (this.radius / levels) * level;
      
      // Draw grid outline polygon
      const points = [];
      for (let i = 0; i < metrics.length; i++) {
        const angle = angleSlice * i - Math.PI / 2;
        points.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
      }
      
      g.append('polygon')
        .attr('points', points.join(' '))
        .attr('fill', 'none')
        .attr('stroke', gridColor)
        .attr('stroke-width', 0.75);
    }
    
    // Draw axis lines and text labels
    metrics.forEach((metric, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const axisX = this.radius * Math.cos(angle);
      const axisY = this.radius * Math.sin(angle);
      
      // Axis Line
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', axisX)
        .attr('y2', axisY)
        .attr('stroke', gridColor)
        .attr('stroke-width', 1);
      
      // Text Label
      const labelRadius = this.radius + 28;
      const labelX = labelRadius * Math.cos(angle);
      const labelY = labelRadius * Math.sin(angle);
      
      let anchor = 'middle';
      if (Math.cos(angle) > 0.1) anchor = 'start';
      else if (Math.cos(angle) < -0.1) anchor = 'end';

      g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', 'middle')
        .attr('fill', isHighContrast ? '#ffffff' : 'var(--color-text-secondary)')
        .attr('font-size', '9.5px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '0.02em')
        .text(metric.toUpperCase());
    });
    
    // Draw metrics data path polygon
    const radarLine = d3.lineRadial()
      .radius(d => (Math.max(d, 5) / 100) * this.radius)
      .angle((d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);
    
    const polyG = g.append('g');
    
    const polyStroke = isHighContrast ? '#ffffff' : '#3b82f6';
    const polyFill = isHighContrast ? 'rgba(255, 255, 255, 0.25)' : 'rgba(59, 130, 246, 0.3)';

    // Actual path outline
    polyG.append('path')
      .datum(values)
      .attr('d', radarLine)
      .attr('fill', polyFill)
      .attr('stroke', polyStroke)
      .attr('stroke-width', 2.5)
      .style('filter', isHighContrast ? 'none' : 'url(#glow)');
    
    // Draw metrics node circles at path corners
    values.forEach((value, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = (Math.max(value, 5) / 100) * this.radius;
      const nodeX = r * Math.cos(angle);
      const nodeY = r * Math.sin(angle);
      
      // Outer indicator circle
      g.append('circle')
        .attr('cx', nodeX)
        .attr('cy', nodeY)
        .attr('r', 4.5)
        .attr('fill', isHighContrast ? '#000000' : 'var(--color-primary)')
        .attr('stroke', isHighContrast ? '#ffffff' : '#ffffff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .append('title')
        .text(`${metrics[i]}: ${value}`);
    });
  }
}
