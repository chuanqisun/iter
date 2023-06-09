import React, { useCallback, useState, type FormEventHandler } from "react";
import { styled } from "styled-components";
import { preventDefault } from "../form/event";
import { BasicActionGroup, BasicFieldset, BasicForm, BasicFormField, ContentWithAction } from "../form/form";
import { removeTrailingSlash } from "../openai/management";
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

      accountContext.addConnection?.({
        id: crypto.randomUUID(),
        endpoint: removeTrailingSlash(formData.endpoint),
        apiKey: formData.key,
      });

      setFormData({ endpoint: "", key: "" });
    },
    [accountContext.addConnection, formData]
  );

  const handleRefresh = useCallback(
    async (id: string) => {
      accountContext.refreshConnection?.(id);
    },
    [accountContext.refreshConnection]
  );

  const handleDisconnect = useCallback(
    (id: string) => {
      accountContext.deleteConnection?.(id);
    },
    [accountContext.deleteConnection]
  );

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
                  <EndpointName>{connection.endpoint}</EndpointName>{" "}
                  <ContentWithAction>
                    {connection.models === undefined ? <span>⌛ Loading...</span> : null}
                    {connection.models?.length ? (
                      <UnstyledList>
                        {connection.models?.map((model) => (
                          <li key={model.displayId}>✅ {model.displayName}</li>
                        ))}
                      </UnstyledList>
                    ) : null}
                    {connection.errorMessage ? <ErrorMessage>❌ {connection.errorMessage}</ErrorMessage> : null}
                    <BasicActionGroup>
                      <button type="button" onClick={() => handleRefresh(connection.id)}>
                        Refresh
                      </button>
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
