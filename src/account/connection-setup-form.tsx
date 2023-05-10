import React, { useEffect, useState, type FormEventHandler } from "react";
import { styled } from "styled-components";
import { preventDefault } from "../form/event";
import { BasicForm, BasicFormField } from "../form/form";
import { deduplicateByModelName, isNeeded, isSucceeded, listDeployments, newerFirst, type ModelDeployment } from "../openai/management";
import { DialogActionGroup, DialogLayout, DialogTitle } from "../shell/dialog";
import { useAccountContext, type Connection } from "./account-context";

export interface ValidModel {
  id: string;
  displayName: string;
}

function toDisplayModel(deployment: ModelDeployment): ValidModel {
  return { id: deployment.id, displayName: deployment.model };
}

export interface ConnectionDiscovery {
  connection: Connection;
  validModels: ValidModel[] | undefined;
  errorMessage?: string;
}

export const ConnectionSetupDialog: React.FC<{ onClose: () => any }> = (props) => {
  const accountContext = useAccountContext();

  const [formData, setFormData] = useState({ endpoint: "", key: "" });

  const [discoveries, setDiscoveries] = useState<Record<string, ConnectionDiscovery>>({});
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!accountContext.connections?.length) return;
    setDiscoveries(accountContext.connections.reduce((prev, connection) => ({ ...prev, [connection.id]: { connection, validModels: undefined } }), {}));

    Promise.all(
      accountContext.connections.map((connection) =>
        listDeployments(connection.apiKey, connection.endpoint)
          .then((deployments) => {
            const validModels = deployments.filter(isSucceeded).filter(isNeeded).sort(newerFirst).filter(deduplicateByModelName).map(toDisplayModel);
            setDiscoveries((prev) => ({ ...prev, [connection.id]: { connection, validModels } }));

            if (!validModels.length) {
              setDiscoveries((prev) => ({ ...prev, [connection.id]: { connection, validModels, errorMessage: `⚠️ No models found` } }));
            }
          })
          .catch((e) => {
            setDiscoveries((prev) => ({ ...prev, [connection.id]: { connection, validModels: [], errorMessage: `⚠️ Error loading models` } }));
            console.error(e);
          })
      )
    );
  }, [accountContext.connections]);

  const handleConnect: FormEventHandler = (e) => {
    const valid = (e.target as HTMLElement).closest("form")?.checkValidity();
    if (!valid) return;

    // TODO handle deduplication
    accountContext.setConnections?.((prevConnections) => [
      ...prevConnections,
      {
        id: crypto.randomUUID(),
        endpoint: formData.endpoint,
        apiKey: formData.key,
      },
    ]);
  };

  const handleDisconnect: FormEventHandler = () => {
    setFormData({ endpoint: "", key: "" });
    accountContext.setConnections?.([]);
  };

  console.log(Object.values(discoveries));

  return (
    <DialogLayout>
      <DialogTitle>Connections</DialogTitle>
      <BasicForm onSubmit={preventDefault}>
        <BasicFormField>
          <UnstyledList>
            {Object.values(discoveries).map((discovery) => (
              <li key={discovery.connection.id}>
                <div>{discovery.connection.endpoint}</div>
                <button>Delete</button>
                <UnstyledList>
                  {discovery.validModels?.map((model) => (
                    <li key={model.id}>✅ {model.displayName}</li>
                  ))}
                </UnstyledList>
              </li>
            ))}
          </UnstyledList>
        </BasicFormField>
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

        {messages ? <div>{messages}</div> : null}
        <DialogActionGroup>
          <button type="submit" onClick={handleConnect}>
            Add
          </button>
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
