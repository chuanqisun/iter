import { createContext, useCallback, useContext, useState } from "react";

export interface Connection {
  id: string;
  endpoint: string;
  apiKey: string;
}

export interface AccountContextType {
  connections?: Connection[];
  setConnections?: (update: (previousConnections: Connection[]) => Connection[]) => void;
}

export const AccountContext = createContext<AccountContextType>({});

const initialValue = JSON.parse(localStorage.getItem("accountContext") ?? "{}");
const validatedInitialValue: AccountContextType = validateInitialValue(initialValue) ? initialValue : { connections: [] };

export const AccountContextProvider = (props: { children?: JSX.Element | JSX.Element[] }) => {
  const [contextValue, setContextValue] = useState<AccountContextType>(validatedInitialValue);

  const setConnections = useCallback((update: (previousConnections: Connection[]) => Connection[]) => {
    setContextValue((prev) => {
      const newContextValue: AccountContextType = { ...prev, connections: update(prev.connections ?? []) };
      localStorage.setItem("accountContext", JSON.stringify(newContextValue));

      return newContextValue;
    });
  }, []);

  return <AccountContext.Provider value={{ ...contextValue, setConnections }}>{props.children}</AccountContext.Provider>;
};

function validateInitialValue(maybeValid: any): maybeValid is AccountContextType {
  return Array.isArray(maybeValid.connections);
}

export const useAccountContext = () => useContext(AccountContext);
