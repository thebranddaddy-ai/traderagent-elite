import PaperWalletCard from '../PaperWalletCard'

const mockAssets = [
  { symbol: 'BTC', name: 'Bitcoin', quantity: 0.5, avgPrice: 42000, currentPrice: 45000, pnl: 1500, pnlPercent: 7.14 },
  { symbol: 'ETH', name: 'Ethereum', quantity: 3, avgPrice: 2800, currentPrice: 2650, pnl: -450, pnlPercent: -5.36 },
  { symbol: 'SOL', name: 'Solana', quantity: 25, avgPrice: 95, currentPrice: 110, pnlPercent: 15.79, pnl: 375 }
];

export default function PaperWalletCardExample() {
  return <PaperWalletCard balance={10000} assets={mockAssets} />
}
