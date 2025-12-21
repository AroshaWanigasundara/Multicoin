import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';

interface SubstrateContextType {
  api: ApiPromise | null;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  selectAccount: (account: InjectedAccountWithMeta) => void;
  connectToNode: (wsUrl?: string) => Promise<void>;
}

const SubstrateContext = createContext<SubstrateContextType | undefined>(undefined);

const DEFAULT_WS_URL = 'ws://62.169.26.99:9944';

export const SubstrateProvider = ({ children }: { children: ReactNode }) => {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InjectedAccountWithMeta | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectToNode = async (wsUrl: string = DEFAULT_WS_URL) => {
    setIsLoading(true);
    setError(null);

    try {
      // Connect to Substrate node
      const provider = new WsProvider(wsUrl);
      const apiInstance = await ApiPromise.create({ provider });

      setApi(apiInstance);
      setIsConnected(true);

      // Enable Polkadot extension
      const extensions = await web3Enable('Token Forge Deck');

      if (extensions.length === 0) {
        setError('No Polkadot.js extension found. Please install it.');
        setIsLoading(false);
        return;
      }

      // Get accounts from extension
      const allAccounts = await web3Accounts();
      setAccounts(allAccounts);

      // Auto-select first account if available
      if (allAccounts.length > 0 && !selectedAccount) {
        setSelectedAccount(allAccounts[0]);
      }

      console.log('Connected to chain:', (await apiInstance.rpc.system.chain()).toString());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Substrate node';
      setError(errorMessage);
      console.error('Connection error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectAccount = (account: InjectedAccountWithMeta) => {
    setSelectedAccount(account);
  };

  // Auto-connect on mount
  useEffect(() => {
    connectToNode();
  }, []);

  return (
    <SubstrateContext.Provider
      value={{
        api,
        accounts,
        selectedAccount,
        isConnected,
        isLoading,
        error,
        selectAccount,
        connectToNode,
      }}
    >
      {children}
    </SubstrateContext.Provider>
  );
};

export const useSubstrate = () => {
  const context = useContext(SubstrateContext);
  if (context === undefined) {
    throw new Error('useSubstrate must be used within a SubstrateProvider');
  }
  return context;
};

// Helper function to get injector for signing
export const getInjector = async (address: string) => {
  return await web3FromAddress(address);
};
