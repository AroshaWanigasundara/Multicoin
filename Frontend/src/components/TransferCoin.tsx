import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSubstrate, getInjector } from "@/lib/substrate";

interface CoinOption {
  id: number;
  symbol: string;
  name: string;
  feePaymentEligible: boolean;
}

// Helper function to decode custom error codes
const getErrorMessage = (errorCode: number): string => {
  const errorMessages: { [key: number]: string } = {
    1: "Insufficient Balance",
    2: "Invalid Coin",
    3: "Coin Cannot Pay Fees",
    4: "Arithmetic Overflow",
  };
  return errorMessages[errorCode] || `Unknown Error (Code: ${errorCode})`;
};

const TransferCoin = () => {
  const { api, selectedAccount, isConnected } = useSubstrate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [availableCoins, setAvailableCoins] = useState<CoinOption[]>([]);
  const [formData, setFormData] = useState({
    coinId: "",
    to: "",
    amount: "",
    feeCoins: "",
  });

  // Fetch available coins on component mount or when API changes
  useEffect(() => {
    if (api) {
      fetchAvailableCoins();
    }
  }, [api]);

  const fetchAvailableCoins = async () => {
    if (!api) return;

    try {
      setIsLoadingCoins(true);
      // Get all registered coins using the multiCoin pallet's storage
      const registeredCoins = await api.query.multiCoin.coinMetadata.entries();
      
      const coins: CoinOption[] = registeredCoins.map(([key, coinData]: any) => {
        const coinId = key.args[0].toNumber();
        const coin = coinData.unwrap();
        
        return {
          id: coinId,
          symbol: api.createType('Text', coin.symbol).toString(),
          name: api.createType('Text', coin.name).toString(),
          feePaymentEligible: coin.feeConfig.canPayTxFees.isTrue,
        };
      });

      setAvailableCoins(coins);
    } catch (error) {
      console.error('Error fetching coins:', error);
      toast.error("Failed to fetch coins", {
        description: "Could not load available coins for fees",
      });
    } finally {
      setIsLoadingCoins(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!api || !selectedAccount) {
      toast.error("Not connected", {
        description: "Please connect your wallet and ensure node is running",
      });
      return;
    }

    // Validation
    if (formData.to === selectedAccount.address) {
      toast.error("Invalid transfer", {
        description: "Cannot transfer to yourself",
      });
      return;
    }

    // Validate a coin is selected for transfer
    if (!formData.coinId) {
      toast.error("Select a coin to transfer", {
        description: "Please choose a coin from the dropdown",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const injector = await getInjector(selectedAccount.address);

      // Convert amount to blockchain format (multiply by 10^12)
      const amount = (parseFloat(formData.amount) * Math.pow(10, 12)).toString();

      // Determine tx_fee_coin - use selected coin ID or null for default fee
      const txFeeCoin = formData.feeCoins && formData.feeCoins !== "none" 
        ? parseInt(formData.feeCoins)
        : null;

      // Create the extrinsic
      const extrinsic = api.tx.multiCoin.transfer(
        parseInt(formData.coinId),    // coin_id: CoinId
        formData.to,                  // to: AccountId
        amount,                       // amount: u128 (multiplied by 10^12)
        txFeeCoin                     // tx_fee_coin: Option<CoinId>
      );

      // Sign and send
      await extrinsic.signAndSend(
        selectedAccount.address,
        { signer: injector.signer },
        ({ status, events }) => {
          if (status.isInBlock) {
            toast.info("Transaction in block", {
              description: `Block hash: ${status.asInBlock.toHex().slice(0, 10)}...`,
            });
          }

          if (status.isFinalized) {
            // Check for success events
            events.forEach(({ event }) => {
              if (api.events.multiCoin.Transfer.is(event)) {
                const [coinId, from, to, amount] = event.data;
                toast.success("Transfer successful!", {
                  description: `${(parseFloat(amount.toString()) / Math.pow(10, 12)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} coins transferred to ${to.toString().slice(0, 8)}...`,
                });

                // Reset form
                setFormData({
                  coinId: "",
                  to: "",
                  amount: "",
                  feeCoins: "",
                });
              }

              // Check for errors
              if (api.events.system.ExtrinsicFailed.is(event)) {
                const [dispatchError] = event.data;
                let errorMessage = "Transaction failed";

                // dispatchError is a Codec and may not have accurate TS typings here, cast to any to access helpers
                if ((dispatchError as any).isModule) {
                  const decoded = api.registry.findMetaError((dispatchError as any).asModule);
                  errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
                } else if ((dispatchError as any).isToken) {
                  // Handle token errors
                  errorMessage = (dispatchError as any).asToken.toString();
                } else if ((dispatchError as any).isArithmetic) {
                  // Handle arithmetic errors
                  errorMessage = (dispatchError as any).asArithmetic.toString();
                } else if ((dispatchError as any).isTransactionPayment) {
                  // Handle transaction payment errors - this includes our custom error codes
                  const paymentError = (dispatchError as any).asTransactionPayment;
                  if (paymentError.isCustom) {
                    const errorCode = paymentError.asCustom.toNumber?.() ?? paymentError.asCustom;
                    errorMessage = getErrorMessage(errorCode);
                  } else {
                    errorMessage = paymentError.toString();
                  }
                }

                toast.error("Transaction failed", {
                  description: errorMessage,
                });
              }
            });

            setIsSubmitting(false);
          }
        }
      );
    } catch (error) {
      console.error("Error transferring coins:", error);
      let errorDescription = "Unknown error occurred";

      if (error instanceof Error) {
        const errorMessage = error.message;
        // Check if error message contains custom error code
        // Format: "1010: Invalid Transaction: Custom error: 3"
        const customErrorMatch = errorMessage.match(/Custom error: (\d+)/);
        if (customErrorMatch) {
          const errorCode = parseInt(customErrorMatch[1]);
          errorDescription = getErrorMessage(errorCode);
        } else {
          errorDescription = errorMessage;
        }
      }

      toast.error("Transaction error", {
        description: errorDescription,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass-card border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ArrowRightLeft className="w-6 h-6 text-accent" />
          Transfer Coin
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Send coins to another address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="coinId" className="text-foreground font-medium">
              Coin
            </Label>
            <Select
              value={formData.coinId}
              onValueChange={(value) => setFormData({ ...formData, coinId: value })}
            >
              <SelectTrigger className="bg-background/50 border-accent/20 focus:border-accent transition-colors">
                <SelectValue placeholder="Select coin to transfer" />
              </SelectTrigger>
              <SelectContent className="bg-background border-accent/20">
                {isLoadingCoins ? (
                  <SelectItem 
                    value="loading"
                    disabled
                    className="hover:bg-accent/10 focus:bg-accent/10 text-muted-foreground"
                  >
                    Loading coins...
                  </SelectItem>
                ) : availableCoins.length === 0 ? (
                  <SelectItem 
                    value="none"
                    disabled
                    className="hover:bg-accent/10 focus:bg-accent/10 text-muted-foreground"
                  >
                    No coins available
                  </SelectItem>
                ) : (
                  availableCoins.map((coin) => (
                    <SelectItem 
                      key={coin.id} 
                      value={coin.id.toString()}
                      className="hover:bg-accent/10 focus:bg-accent/10"
                    >
                      {coin.symbol} - {coin.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to" className="text-foreground font-medium">
              Recipient Address
            </Label>
            <Input
              id="to"
              placeholder="e.g., 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              className="bg-background/50 border-accent/20 focus:border-accent transition-colors font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground font-medium">
              Amount
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="e.g., 100.50"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="bg-background/50 border-accent/20 focus:border-accent transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeCoins" className="text-foreground font-medium">
              Transfer Fee Coin <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <Select
              value={formData.feeCoins}
              onValueChange={(value) => setFormData({ ...formData, feeCoins: value })}
            >
              <SelectTrigger className="bg-background/50 border-accent/20 focus:border-accent transition-colors">
                <SelectValue placeholder="Select fee payment coin" />
              </SelectTrigger>
              <SelectContent className="bg-background border-accent/20">
                <SelectItem 
                  value="none"
                  className="hover:bg-accent/10 focus:bg-accent/10 text-muted-foreground"
                >
                  None (Use default fee)
                </SelectItem>
                {isLoadingCoins ? (
                  <SelectItem 
                    value="loading"
                    disabled
                    className="hover:bg-accent/10 focus:bg-accent/10 text-muted-foreground"
                  >
                    Loading coins...
                  </SelectItem>
                ) : (
                  availableCoins.map((coin) => (
                    <SelectItem 
                      key={coin.id} 
                      value={coin.id.toString()}
                      className="hover:bg-accent/10 focus:bg-accent/10"
                    >
                      {coin.symbol} - {coin.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit" 
            className="w-full gradient-accent hover:opacity-90 transition-all duration-300 h-12 text-base font-semibold"
          >
            <ArrowRightLeft className="w-5 h-5 mr-2" />
            Transfer Coins
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransferCoin;
