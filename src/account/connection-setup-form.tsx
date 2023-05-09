import React, { useEffect, useState, type FormEventHandler } from "react";
import { styled } from "styled-components";
import { preventDefault } from "../form/event";
import { BasicForm, BasicFormField } from "../form/form";
import { deduplicateByModelName, isNeeded, isSucceeded, listDeployments, newerFirst, type ModelDeployment } from "../openai/management";
import { DialogActionGroup, DialogLayout, DialogTitle } from "../shell/dialog";
import { useAccountContext } from "./account-context";

export interface ValidModel {
  id: string;
  displayName: string;
}

function toDisplayModel(deployment: ModelDeployment): ValidModel {
  return { id: deployment.id, displayName: deployment.model };
}

export const ConnectionSetupDialog: React.FC<{ onClose: () => any }> = (props) => {
  const accountContext = useAccountContext();

  const [formData, setFormData] = useState({
    endpoint: accountContext.azureOpenAIConnection?.endpoint ?? "",
    key: accountContext.azureOpenAIConnection?.apiKey ?? "",
  });

  const [availableModels, setAvailableModels] = useState<ValidModel[]>();
  const [message, setMessage] = useState<string | null>("");

  useEffect(() => {
    setAvailableModels(undefined);

    setMessage(`⏳ Loading models...`);
    if (!accountContext.azureOpenAIConnection) {
      setAvailableModels([]);
      setMessage("");
    } else {
      listDeployments(accountContext.azureOpenAIConnection.apiKey, accountContext.azureOpenAIConnection.endpoint)
        .then((deployments) => {
          setMessage("");
          const validModels = deployments.filter(isSucceeded).filter(isNeeded).sort(newerFirst).filter(deduplicateByModelName).map(toDisplayModel);
          setAvailableModels(validModels);
          if (!validModels.length) {
            setMessage(`⚠️ No models available`);
          }
        })
        .catch((e) => {
          setAvailableModels([]);
          console.error(e);
          setMessage(`⚠️ Error loading models: ${e.message}`);
        });
    }
  }, [accountContext.azureOpenAIConnection]);

  const handleConnect: FormEventHandler = (e) => {
    const valid = (e.target as HTMLElement).closest("form")?.checkValidity();
    if (!valid) return;

    accountContext.setAzureOpenAIConnection?.({
      type: "azure-openai",
      endpoint: formData.endpoint,
      apiKey: formData.key,
    });
  };

  const handleDisconnect: FormEventHandler = () => {
    setFormData({ endpoint: "", key: "" });
    accountContext.setAzureOpenAIConnection?.(null);
  };

  return (
    <DialogLayout>
      <DialogTitle>Connections</DialogTitle>
      <BasicForm onSubmit={preventDefault}>
        <BasicFormField>
          <label htmlFor="aoai-endpoint">Endpoint</label>
          <input
            id="aoai-endpoint"
            type="url"
            required={true}
            placeholder="https://service-name.openai.azure.com/"
            value={formData.endpoint}
            onChange={(e) => setFormData((prev) => ({ ...prev, endpoint: e.target.value }))}
          />
        </BasicFormField>
        <BasicFormField>
          <label htmlFor="aoai-api-key">Key</label>
          <input
            id="aoai-api-key"
            type="password"
            required={true}
            value={formData.key}
            onChange={(e) => setFormData((prev) => ({ ...prev, key: e.target.value }))}
          />
        </BasicFormField>
        {availableModels?.length ? (
          <UnstyledList>
            {availableModels.map((model) => (
              <li key={model.id}>
                ✅ {model.id} ({model.displayName})
              </li>
            ))}
          </UnstyledList>
        ) : null}
        {message ? <div>{message}</div> : null}
        <DialogActionGroup>
          <button type="submit" onClick={handleConnect}>
            {accountContext.azureOpenAIConnection ? "Update" : "Connect"}
          </button>
          {accountContext.azureOpenAIConnection && <button onClick={handleDisconnect}>Disconnect</button>}
          <button onClick={props.onClose}>Close</button>
        </DialogActionGroup>
      </BasicForm>
    </DialogLayout>
  );
};

const UnstyledList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;
