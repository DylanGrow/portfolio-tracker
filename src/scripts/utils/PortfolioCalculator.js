export class PortfolioCalculator {
  constructor(transactions = [], currentPrices = {}) {
    this.transactions = transactions;
    this.currentPrices = currentPrices;
    this.positions = new Map();
    this.calculatePositions();
  }

  calculatePositions() {
    this.positions.clear();
    
    // Sort transactions by date to ensure proper ledger order
    const sorted = [...this.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const tx of sorted) {
      if (!this.positions.has(tx.ticker)) {
        this.positions.set(tx.ticker, {
          ticker: tx.ticker,
          shares: 0,
          totalCost: 0,
          transactions: []
        });
      }
      
      const pos = this.positions.get(tx.ticker);
      pos.transactions.push(tx);
      
      if (tx.type === 'BUY') {
        pos.shares += tx.shares;
        pos.totalCost += tx.shares * tx.price;
      } else if (tx.type === 'SELL') {
        // Average cost remains the same, shares decrease
        const avgPrice = pos.shares > 0 ? pos.totalCost / pos.shares : 0;
        pos.shares = Math.max(0, pos.shares - tx.shares);
        pos.totalCost = pos.shares * avgPrice;
      }
    }
  }

  getHoldings() {
    const holdings = [];
    let totalPortfolioValue = 0;
    
    // First calculate raw holdings
    for (const [ticker, pos] of this.positions.entries()) {
      if (pos.shares <= 0) continue;
      
      const currentPrice = this.currentPrices[ticker]?.price || pos.totalCost / pos.shares; // Fallback to cost
      const currentValue = pos.shares * currentPrice;
      const avgCost = pos.totalCost / pos.shares;
      const totalGain = currentValue - pos.totalCost;
      const totalGainPercent = pos.totalCost > 0 ? (totalGain / pos.totalCost) * 100 : 0;
      
      totalPortfolioValue += currentValue;
      
      holdings.push({
        ticker,
        shares: pos.shares,
        avgCost,
        totalCost: pos.totalCost,
        currentPrice,
        currentValue,
        totalGain,
        totalGainPercent,
        sector: this.getSectorForTicker(ticker)
      });
    }

    // Assign allocations based on total value
    return holdings.map(h => ({
      ...h,
      allocation: totalPortfolioValue > 0 ? (h.currentValue / totalPortfolioValue) * 100 : 0
    }));
  }

  getTotalValue() {
    let total = 0;
    for (const [ticker, pos] of this.positions.entries()) {
      if (pos.shares <= 0) continue;
      const currentPrice = this.currentPrices[ticker]?.price || pos.totalCost / pos.shares;
      total += pos.shares * currentPrice;
    }
    return total;
  }

  getTotalCost() {
    let total = 0;
    for (const [_, pos] of this.positions.entries()) {
      if (pos.shares <= 0) continue;
      total += pos.totalCost;
    }
    return total;
  }

  getUnrealizedGain() {
    const totalVal = this.getTotalValue();
    const totalCost = this.getTotalCost();
    const gain = totalVal - totalCost;
    const percent = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    
    return { gain, percent };
  }

  getSectorAllocations() {
    const holdings = this.getHoldings();
    const sectors = new Map();
    let totalValue = 0;

    for (const h of holdings) {
      totalValue += h.currentValue;
      const current = sectors.get(h.sector) || 0;
      sectors.set(h.sector, current + h.currentValue);
    }

    const allocations = [];
    for (const [sector, value] of sectors.entries()) {
      allocations.push({
        sector,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0
      });
    }

    return allocations.sort((a, b) => b.value - a.value);
  }

  getSectorForTicker(ticker) {
    const sectors = {
      AAPL: 'Technology',
      MSFT: 'Technology',
      GOOGL: 'Technology',
      AMZN: 'Consumer Cyclical',
      TSLA: 'Consumer Cyclical',
      META: 'Technology',
      NVDA: 'Technology',
      JPM: 'Financials',
      BAC: 'Financials',
      V: 'Financials',
      JNJ: 'Healthcare',
      PFE: 'Healthcare',
      LLY: 'Healthcare',
      XOM: 'Energy',
      CVX: 'Energy',
      WMT: 'Consumer Defensive',
      KO: 'Consumer Defensive',
      PG: 'Consumer Defensive'
    };
    return sectors[ticker] || 'Other';
  }

  getSimplyWallStMetrics() {
    const holdings = this.getHoldings();
    if (holdings.length === 0) {
      return { diversification: 20, volatility: 20, value: 20, growth: 20, quality: 20, momentum: 20 };
    }

    // 1. Diversification: score based on number of stocks and spread (HHI)
    const stockCount = holdings.length;
    let hhi = 0;
    for (const h of holdings) {
      const weight = h.allocation / 100;
      hhi += weight * weight;
    }
    const divScore = Math.min(100, Math.max(10, (1 - hhi) * 100 + Math.min(20, stockCount * 4)));

    // 2. Volatility: based on sector mix and holdings spread
    const sectors = this.getSectorAllocations();
    const sectorHHI = sectors.reduce((sum, s) => sum + (s.percent / 100) ** 2, 0);
    const volScore = Math.min(100, Math.max(15, (1 - sectorHHI) * 80 + 20));

    // 3. Value: based on portfolio unrealized gains (positive = undervalued entry)
    const { percent: gainPercent } = this.getUnrealizedGain();
    const valScore = Math.min(100, Math.max(10, 50 + gainPercent * 0.5));

    // 4. Growth: mock metric derived from momentum changes
    let growthScore = 60; // baseline
    if (gainPercent > 0) growthScore += 10;
    if (holdings.some(h => ['TSLA', 'NVDA', 'AAPL', 'AMZN'].includes(h.ticker))) growthScore += 15;
    growthScore = Math.min(100, growthScore);

    // 5. Quality: calculated based on the ratio of positive return holdings
    const positiveHoldings = holdings.filter(h => h.totalGain > 0).length;
    const qualScore = Math.min(100, Math.max(10, (positiveHoldings / stockCount) * 80 + 20));

    // 6. Momentum: average daily performance indicators
    let momScore = 55;
    holdings.forEach(h => {
      const change = this.currentPrices[h.ticker]?.changePercent || 0;
      momScore += change * 2;
    });
    momScore = Math.min(100, Math.max(10, momScore));

    return {
      diversification: Math.round(divScore),
      volatility: Math.round(volScore),
      value: Math.round(valScore),
      growth: Math.round(growthScore),
      quality: Math.round(qualScore),
      momentum: Math.round(momScore)
    };
  }
}
