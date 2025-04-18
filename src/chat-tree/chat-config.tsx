import { memo } from "react";
import styled from "styled-components";
import { BasicFormButton, BasicFormInput, BasicSelect } from "../form/form";
import type { BaseConnection } from "../providers/base";
import type { RouteParameter } from "../router/use-route-parameter";

export interface ChatConfigProps {
  onConnectionsButtonClick: () => void;
  groupedConnections: [string, BaseConnection[] | undefined][];
  connectionKey: RouteParameter<string | null>;
  temperature: RouteParameter<number>;
  maxTokens: RouteParameter<number>;
}

export const ChatConfigMemo = memo(ChatConfig);

function ChatConfig(props: ChatConfigProps) {
  return (
    <div>
      <ConfigMenu>
        <BasicFormButton onClick={props.onConnectionsButtonClick}>Menu</BasicFormButton>
        {props.groupedConnections?.length ? (
          <label>
            Model
            <BasicSelect
              value={props.connectionKey.value ?? ""}
              onChange={(e) => props.connectionKey.replace(e.target.value)}
            >
              {props.groupedConnections.map(([key, group]) => (
                <optgroup key={key} label={key}>
                  {group?.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </BasicSelect>
          </label>
        ) : null}
        <label>
          Temperature
          <FixedWidthInput
            type="number"
            min={0}
            max={2}
            value={props.temperature.value}
            step={0.05}
            onChange={(e) => props.temperature.replace((e.target as HTMLInputElement).valueAsNumber)}
          />
        </label>
        <label>
          Max tokens
          <FixedWidthInput
            type="number"
            min={0}
            max={32000}
            step={100}
            value={props.maxTokens.value}
            onChange={(e) => props.maxTokens.replace((e.target as HTMLInputElement).valueAsNumber)}
          />
        </label>
        <a href="https://github.com/chuanqisun/iter" target="_blank">
          GitHub
        </a>
      </ConfigMenu>
    </div>
  );
}

const ConfigMenu = styled.menu`
  padding: 0;
  display: flex;
  gap: 12px;
  padding-left: 32px;
  flex-wrap: wrap;
  align-items: center;

  label {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;
const FixedWidthInput = styled(BasicFormInput)`
  width: 72px;
`;
