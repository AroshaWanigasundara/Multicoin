import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Flame, Loader2 } from "lucide-react";
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

const BurnCoin = () => {
  const { api, selectedAccount, isConnected } = useSubstrate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    coinId: "",
    amount: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!api || !selectedAccount) {
      toast.error("Not connected", {
        description: "Please connect your wallet and ensure node is running",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const injector = await getInjector(selectedAccount.address);

      // Create the extrinsic
      const extrinsic = api.tx.multiCoin.burn(
        parseInt(formData.coinId),    // coin_id: CoinId
        (parseFloat(formData.amount) * Math.pow(10, 12)).toString(),  // amount: u128
        null                          // tx_fee_coin: Option<CoinId>
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
              if (api.events.multiCoin.Burned.is(event)) {
                const [coinId, from, amount] = event.data;
                toast.success("Coins burned successfully!", {
                  description: `${amount.toString()} coins permanently removed from circulation`,
                });

                // Reset form
                setFormData({
                  coinId: "",
                  amount: "",
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
      console.error("Error burning coins:", error);
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
    <Card className="glass-card border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Flame className="w-6 h-6 text-destructive" />
          Burn Coin
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Remove coins from circulation permanently
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="burnCoinId" className="text-foreground font-medium">
              Coin ID
            </Label>
            <Input
              id="burnCoinId"
              type="number"
              placeholder="e.g., 1"
              value={formData.coinId}
              onChange={(e) => setFormData({ ...formData, coinId: e.target.value })}
              className="bg-background/50 border-destructive/20 focus:border-destructive transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="burnAmount" className="text-foreground font-medium">
              Amount
            </Label>
            <Input
              id="burnAmount"
              type="number"
              step="0.01"
              placeholder="e.g., 500"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="bg-background/50 border-destructive/20 focus:border-destructive transition-colors"
              required
            />
          </div>

          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive/90 font-medium">
              ⚠️ Warning: This action is irreversible. Burned coins cannot be recovered.
            </p>
          </div>

          <Button
            type="submit"
            disabled={!isConnected || isSubmitting}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all duration-300 h-12 text-base font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Burning...
              </>
            ) : (
              <>
                <Flame className="w-5 h-5 mr-2" />
                Burn Coins
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BurnCoin;
