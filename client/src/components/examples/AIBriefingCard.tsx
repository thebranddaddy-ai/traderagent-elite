import AIBriefingCard from '../AIBriefingCard'

const mockInsights = [
  { type: 'bullish' as const, title: 'BTC momentum building', description: 'Bitcoin showing strong support at $44K with increasing volume' },
  { type: 'warning' as const, title: 'High volatility expected', description: 'Fed announcement scheduled for 2 PM EST may impact markets' },
  { type: 'neutral' as const, title: 'ETH consolidating', description: 'Ethereum range-bound between $2.6K-$2.8K for 3 days' }
];

const mockRecommendations = [
  { action: 'BUY', symbol: 'BTC', reasoning: 'Technical indicators suggest breakout above $45K resistance', confidence: 78 },
  { action: 'HOLD', symbol: 'ETH', reasoning: 'Wait for clear direction after consolidation phase', confidence: 65 }
];

export default function AIBriefingCardExample() {
  return (
    <AIBriefingCard 
      timestamp={new Date()}
      insights={mockInsights}
      recommendations={mockRecommendations}
      summary="Markets showing mixed signals today. Bitcoin maintains bullish structure while altcoins consolidate. Fed announcement at 2 PM could trigger volatility across all crypto assets. Recommended approach: reduce position sizes ahead of the event."
    />
  )
}
