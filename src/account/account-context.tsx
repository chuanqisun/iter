import { createContext, useCallback, useContext, useState } from "react";

export interface Connection {
  type: "azure-openai";
  endpoint: string;
  apiKey: string;
}

export interface AccountContextType {
  azureOpenAIConnection?: Connection | null;
  setAzureOpenAIConnection?: (connection: Connection | null) => void;
}

export const AccountContext = createContext<AccountContextType>({});

const initialValue = JSON.parse(localStorage.getItem("accountContext") ?? "{}") as AccountContextType;

export const AccountContextProvider = (props: { children?: JSX.Element | JSX.Element[] }) => {
  const [contextValue, setContextValue] = useState<AccountContextType>(initialValue);

  const setAzureOpenAIConnection = useCallback((connection: Connection | null) => {
    localStorage.setItem("accountContext", JSON.stringify({ azureOpenAIConnection: connection }));
    setContextValue((prev) => ({ ...prev, azureOpenAIConnection: connection }));
  }, []);

  return <AccountContext.Provider value={{ ...contextValue, setAzureOpenAIConnection }}>{props.children}</AccountContext.Provider>;
};

export const useAccountContext = () => useContext(AccountContext);
