import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Coins, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreateCoin from "@/components/CreateCoin";
import TransferCoin from "@/components/TransferCoin";
import MintCoin from "@/components/MintCoin";
import BurnCoin from "@/components/BurnCoin";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl gradient-primary glow-primary">
            <Coins className="w-8 h-8 text-white" />
          </div>
          <h1 className="mb-3 text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse">
            Substrate Multicoin
          </h1>
          <p className="text-muted-foreground text-lg">
            Create, transfer, mint and burn coins with ease
          </p>
          <Button 
            onClick={() => navigate('/assets')}
            className="mt-6 gradient-primary glow-primary hover:opacity-90 transition-opacity"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            View Assets
          </Button>
        </header>

        {/* Main Interface */}
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="glass-card grid w-full grid-cols-2 md:grid-cols-4 h-auto p-2 mb-8">
            <TabsTrigger 
              value="create" 
              className="data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:glow-primary transition-all duration-300"
            >
              Create
            </TabsTrigger>
            <TabsTrigger 
              value="transfer"
              className="data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:glow-primary transition-all duration-300"
            >
              Transfer
            </TabsTrigger>
            <TabsTrigger 
              value="mint"
              className="data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:glow-primary transition-all duration-300"
            >
              Mint
            </TabsTrigger>
            <TabsTrigger 
              value="burn"
              className="data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:glow-primary transition-all duration-300"
            >
              Burn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-0">
            <CreateCoin />
          </TabsContent>

          <TabsContent value="transfer" className="mt-0">
            <TransferCoin />
          </TabsContent>

          <TabsContent value="mint" className="mt-0">
            <MintCoin />
          </TabsContent>

          <TabsContent value="burn" className="mt-0">
            <BurnCoin />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;