import React, { useCallback, useState, type FormEventHandler } from "react";
import { styled } from "styled-components";
import { preventDefault } from "../form/event";
import { BasicActionGroup, BasicFieldset, BasicForm, BasicFormField, ContentWithAction } from "../form/form";
import { DialogLayout, DialogTitle, DialogTitleButton } from "../shell/dialog";
import { useAccountContext, type Connection } from "./account-context";

export interface ValidModel {
  id: string;
  displayName: string;
}

export interface ConnectionDiscovery {
  connection: Connection;
  validModels: ValidModel[] | undefined;
  errorMessage?: string;
}

export const ConnectionSetupDialog: React.FC<{ onClose: () => any }> = (props) => {
  const accountContext = useAccountContext();

  const [formData, setFormData] = useState({ endpoint: "", key: "" });

  const handleConnect: FormEventHandler = useCallback(
    (e) => {
      const valid = (e.target as HTMLElement).closest("form")?.reportValidity();
      if (!valid) return;

      accountContext.setConnections?.((prevConnections) => [
        {
          id: crypto.randomUUID(),
          endpoint: formData.endpoint,
          apiKey: formData.key,
        },
        ...prevConnections,
      ]);

      setFormData({ endpoint: "", key: "" });
    },
    [formData]
  );

  const handleDisconnect = useCallback((id: string) => {
    accountContext.setConnections?.((connections) => connections.filter((connection) => connection.id !== id));
  }, []);

  return (
    <DialogLayout>
      <DialogTitle>
        Connections
        <DialogTitleButton type="button" onClick={props.onClose}>
          Close
        </DialogTitleButton>
      </DialogTitle>
      <BasicForm onSubmit={preventDefault} noValidate={true}>
        <BasicFieldset>
          <legend>New</legend>
          <ContentWithAction>
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
            <BasicActionGroup>
              <button type="submit" onClick={handleConnect}>
                Add
              </button>
            </BasicActionGroup>
          </ContentWithAction>
        </BasicFieldset>

        {accountContext.connections?.length ? (
          <ConnectionList>
            {accountContext.connections.map((connection) => (
              <li key={connection.id}>
                <BasicFieldset>
                  <EndpointName>{connection.displayName}</EndpointName>{" "}
                  <ContentWithAction>
                    {connection.models?.length ? (
                      <UnstyledList>
                        {connection.models?.map((model) => (
                          <li key={model.id}>✅ {model.displayName}</li>
                        ))}
                      </UnstyledList>
                    ) : null}
                    {connection.errorMessage ? <ErrorMessage>❌ {connection.errorMessage}</ErrorMessage> : null}
                    <BasicActionGroup>
                      <button type="button" onClick={() => handleDisconnect(connection.id)}>
                        Delete
                      </button>
                    </BasicActionGroup>
                  </ContentWithAction>
                </BasicFieldset>
              </li>
            ))}
          </ConnectionList>
        ) : null}
      </BasicForm>
    </DialogLayout>
  );
};

const UnstyledList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const EndpointName = styled.legend`
  /* font-weight: 600; */
`;

const ConnectionList = styled(UnstyledList)`
  display: grid;
  gap: 8px;
`;

const ErrorMessage = styled.div`
  color: red;
`;
