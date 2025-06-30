import { memo } from "react";
import styled from "styled-components";
import { BasicFormButton, BasicFormInput, BasicSelect } from "../dom/form";
import type { BaseConnection } from "../providers/base";
import type { RouteParameter } from "../router/use-route-parameter";
import { useOptions } from "../settings/use-options";

export interface ChatConfigProps {
  onConnectionsButtonClick: () => void;
  groupedConnections: [string, BaseConnection[] | undefined][];
  connectionKey: RouteParameter<string | null>;
  temperature: RouteParameter<number>;
  reasoningEffort: RouteParameter<string>;
  thinkingBudget: RouteParameter<number>;
  maxTokens: RouteParameter<number>;
}

export const ChatConfigMemo = memo(ChatConfig);

function ChatConfig(props: ChatConfigProps) {
  const options = useOptions(props.connectionKey.value);

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
        {options?.temperature ? (
          <label>
            Temperature
            <AutoWidthInput
              type="number"
              min={0}
              max={options.temperature.max}
              value={props.temperature.value}
              step={0.05}
              onChange={(e) => props.temperature.replace((e.target as HTMLInputElement).valueAsNumber)}
            />
          </label>
        ) : null}
        {options?.reasoningEffort ? (
          <label>
            Reasoning
            <BasicSelect
              value={props.reasoningEffort.value ?? "medium"}
              onChange={(e) => props.reasoningEffort.replace(e.target.value)}
            >
              {options.reasoningEffort.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </BasicSelect>
          </label>
        ) : null}

        {options?.thinkingBudget ? (
          <label>
            Thinking
            <AutoWidthInput
              type="number"
              min={options.thinkingBudget.min ?? 0}
              max={options.thinkingBudget.max}
              value={props.thinkingBudget.value}
              step={100}
              onChange={(e) => props.thinkingBudget.replace((e.target as HTMLInputElement).valueAsNumber)}
            />
          </label>
        ) : null}
        <label>
          Max
          <AutoWidthInput
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
const AutoWidthInput = styled(BasicFormInput)`
  min-width: 72px;
  field-sizing: content;
`;
