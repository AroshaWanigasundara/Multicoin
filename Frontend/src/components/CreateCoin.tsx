import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSubstrate, getInjector } from "@/lib/substrate";

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

const CreateCoin = () => {
  const { api, selectedAccount, isConnected } = useSubstrate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    symbol: "",
    name: "",
    decimals: "",
    initialSupply: "",
    canPayTxFees: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!api || !selectedAccount) {
      toast.error("Not connected", {
        description: "Please connect your wallet and ensure node is running",
      });
      return;
    }

    // Validation
    if (formData.symbol.length > 32) {
      toast.error("Symbol too long", {
        description: "Symbol must be 32 characters or less",
      });
      return;
    }

    if (formData.name.length > 64) {
      toast.error("Name too long", {
        description: "Name must be 64 characters or less",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const injector = await getInjector(selectedAccount.address);

      // Create the extrinsic
      const extrinsic = api.tx.multiCoin.createCoin(
        formData.symbol,                    // symbol: Vec<u8>
        formData.name,                      // name: Vec<u8>
        parseInt(formData.decimals),        // decimals: u8
        (parseFloat(formData.initialSupply) * Math.pow(10, 12)).toString(),  // initial_supply: u128
        null,                               // initial_minters: Option<Vec<AccountId>>
        null,                               // initial_burners: Option<Vec<AccountId>>
        formData.canPayTxFees,              // can_pay_tx_fees: bool
        null                                // tx_fee_coin: Option<CoinId>
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
              if (api.events.multiCoin.CoinCreated.is(event)) {
                const [coinId, symbol, name] = event.data;
                toast.success("Coin created successfully!", {
                  description: `${name.toHuman()} (${symbol.toHuman()}) - Coin ID: ${coinId.toString()}`,
                });

                // Reset form
                setFormData({
                  symbol: "",
                  name: "",
                  decimals: "",
                  initialSupply: "",
                  canPayTxFees: false,
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
                  errorMessage = (dispatchError as any).asToken.toString();
                } else if ((dispatchError as any).isArithmetic) {
                  errorMessage = (dispatchError as any).asArithmetic.toString();
                } else if ((dispatchError as any).isTransactionPayment) {
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
      console.error("Error creating coin:", error);
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
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Plus className="w-6 h-6 text-primary" />
          Create New Coin
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Deploy a new coin on the Substrate network
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-foreground font-medium">
                Symbol
              </Label>
              <Input
                id="symbol"
                placeholder="e.g., BTC"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className="bg-background/50 border-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-medium">
                Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Bitcoin"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-background/50 border-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="decimals" className="text-foreground font-medium">
                Decimals
              </Label>
              <Input
                id="decimals"
                type="number"
                placeholder="e.g., 8"
                value={formData.decimals}
                onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
                className="bg-background/50 border-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialSupply" className="text-foreground font-medium">
                Initial Supply
              </Label>
              <Input
                id="initialSupply"
                type="number"
                step="0.01"
                placeholder="e.g., 1000000"
                value={formData.initialSupply}
                onChange={(e) => setFormData({ ...formData, initialSupply: e.target.value })}
                className="bg-background/50 border-primary/20 focus:border-primary transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="canPayTxFees"
                checked={formData.canPayTxFees}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, canPayTxFees: checked as boolean })
                }
                className="border-primary/40"
              />
              <Label 
                htmlFor="canPayTxFees" 
                className="text-foreground font-medium cursor-pointer"
              >
                Allow this coin to pay transaction fees
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Enable this if you want to use this coin as payment for network transaction fees
            </p>
          </div>

          <Button
            type="submit"
            disabled={!isConnected || isSubmitting}
            className="w-full gradient-primary hover:opacity-90 glow-primary transition-all duration-300 h-12 text-base font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Create Coin
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateCoin;
