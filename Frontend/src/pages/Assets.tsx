import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Coins, TrendingUp, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubstrate } from "@/lib/substrate";
import { useToast } from "@/components/ui/use-toast";

interface CoinMetadata {
  id: number;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  totalSupply: string;
  transferFee: string;
  minimumBalance: string;
  feePaymentEligible: boolean;
  owner: string;
}

const Assets = () => {
  const { api, selectedAccount, isConnected, isLoading: isWalletLoading } = useSubstrate();
  const { toast } = useToast();
  
  const [coins, setCoins] = useState<CoinMetadata[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (api && selectedAccount) {
      fetchCoins();
    }
  }, [api, selectedAccount]);

  const fetchCoins = async () => {
    if (!api || !selectedAccount) return;

    try {
      setIsLoading(true);
      // Get all registered coins using the multiCoin pallet's storage
      const registeredCoins = await api.query.multiCoin.coinMetadata.entries();
      
      const coinPromises = registeredCoins.map(async ([key, coinData]: any) => {
        const coinId = key.args[0].toNumber();
        const coin = coinData.unwrap();
        
        // Get balance for this address from multiCoin pallet's storage
        const balance = await api.query.multiCoin.balances(coinId, selectedAccount.address);
        // Get total supply from multiCoin pallet's storage
        const totalSupply = await api.query.multiCoin.totalSupply(coinId);
        
        return {
          id: coinId,
          symbol: api.createType('Text', coin.symbol).toString(),
          name: api.createType('Text', coin.name).toString(),
          balance: (parseFloat(balance.toString()) / Math.pow(10, 12)).toString(),
          decimals: coin.decimals.toNumber(),
          totalSupply: (parseFloat(totalSupply.toString()) / Math.pow(10, 12)).toString(),
          transferFee: (parseFloat(coin.feeConfig.transferFee.toString()) / Math.pow(10, 12)).toString(),
          minimumBalance: (parseFloat(coin.feeConfig.minimumBalance.toString()) / Math.pow(10, 12)).toString(),
          feePaymentEligible: coin.feeConfig.canPayTxFees.isTrue,
          owner: coin.owner.toString()
        };
      });

      const fetchedCoins = await Promise.all(coinPromises);
      setCoins(fetchedCoins);
    } catch (error) {
      console.error('Error fetching coins:', error);
      toast({
        title: "Error",
        description: "Failed to fetch coins. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show connection status
  const renderConnectionStatus = () => {
    if (isWalletLoading) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Loading wallet...</AlertTitle>
          <AlertDescription>
            Please wait while we connect to your wallet.
          </AlertDescription>
        </Alert>
      );
    }

    if (!isConnected || !selectedAccount) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not connected</AlertTitle>
          <AlertDescription>
            Please install and connect your Polkadot.js extension to view your assets.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl gradient-primary glow-primary">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="mb-3 text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse">
            Asset Overview
          </h1>
          <p className="text-muted-foreground text-lg">
            View your coin holdings and metadata
          </p>
        </header>

        {renderConnectionStatus()}

        {/* Wallet Info */}
        {selectedAccount && (
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Connected Wallet
              </CardTitle>
              <CardDescription>
                Your active Polkadot wallet address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-mono text-sm bg-muted p-2 rounded">
                  {selectedAccount.address}
                </div>
                <p className="text-sm text-muted-foreground">
                  Account: {selectedAccount.meta.name}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coins List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Your Assets</CardTitle>
            <CardDescription>Click on a coin name to view detailed metadata</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : coins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No coins found
                    </TableCell>
                  </TableRow>
                ) : (
                  coins.map((coin) => (
                    <TableRow key={coin.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <TableCell className="font-bold gradient-text">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4" />
                          {coin.symbol}
                        </div>
                      </TableCell>
                      <TableCell 
                        className="font-medium text-primary hover:underline cursor-pointer"
                        onClick={() => setSelectedCoin(coin)}
                      >
                        {coin.name}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {parseFloat(coin.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Coin Details Dialog */}
        <Dialog open={selectedCoin !== null} onOpenChange={(open) => !open && setSelectedCoin(null)}>
          <DialogContent className="glass-card border-primary/20">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl gradient-text">
                <Coins className="w-6 h-6" />
                {selectedCoin?.name} ({selectedCoin?.symbol})
              </DialogTitle>
              <DialogDescription>
                Detailed metadata for this coin
              </DialogDescription>
            </DialogHeader>
            
            {selectedCoin && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Coin ID</p>
                    <p className="text-lg font-semibold">{selectedCoin.id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Decimals</p>
                    <p className="text-lg font-semibold">{selectedCoin.decimals}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Your Balance</p>
                    <p className="text-lg font-semibold gradient-text">
                      {parseFloat(selectedCoin.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Supply</p>
                    <p className="text-lg font-semibold">
                      {parseFloat(selectedCoin.totalSupply).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Transfer Fee</p>
                    <p className="text-lg font-semibold">
                      {parseFloat(selectedCoin.transferFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Minimum Balance</p>
                    <p className="text-lg font-semibold">
                      {parseFloat(selectedCoin.minimumBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1 pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">Fee Payment Eligible</p>
                  <Badge variant={selectedCoin.feePaymentEligible ? "default" : "secondary"}>
                    {selectedCoin.feePaymentEligible ? "Eligible" : "Not Eligible"}
                  </Badge>
                </div>
                
                <div className="space-y-1 pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <div className="font-mono text-sm bg-muted p-2 rounded">
                    {selectedCoin.owner}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Assets;