import { memo } from "react";
import type { BaseConnection } from "../providers/base";
import type { RouteParameter } from "../router/use-route-parameter";
import { useOptions } from "../settings/use-options";
import "./chat-config.css";

export interface ChatConfigProps {
  onConnectionsButtonClick: () => void;
  groupedConnections: [string, BaseConnection[] | undefined][];
  connectionKey: RouteParameter<string | null>;
  temperature: RouteParameter<number>;
  reasoningEffort: RouteParameter<string | undefined>;
  verbosity: RouteParameter<string | undefined>;
  thinkingBudget: RouteParameter<number>;
  maxTokens: RouteParameter<number>;
}

export const ChatConfigMemo = memo(ChatConfig);

function ChatConfig(props: ChatConfigProps) {
  const options = useOptions(props.connectionKey.value);

  return (
    <div>
      <menu className="c-chat-config">
        <button className="button" onClick={props.onConnectionsButtonClick}>
          Menu
        </button>
        {props.groupedConnections?.length ? (
          <label>
            Model
            <select
              className="select"
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
            </select>
          </label>
        ) : null}
        {options?.temperature ? (
          <label>
            Temperature
            <input
              className="input auto-width-input"
              type="number"
              min={options.temperature.min ?? 0}
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
            <select
              className="select"
              value={props.reasoningEffort.value ?? options.reasoningEffort.at(0)}
              onChange={(e) => props.reasoningEffort.replace(e.target.value)}
            >
              {options.reasoningEffort.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options?.verbosity ? (
          <label>
            Verbosity
            <select
              className="select"
              value={props.verbosity.value ?? options.verbosity.at(0)}
              onChange={(e) => props.verbosity.replace(e.target.value)}
            >
              {options.verbosity.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options?.thinkingBudget ? (
          <label>
            Thinking
            <input
              className="input auto-width-input"
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
          <input
            className="input auto-width-input"
            type="number"
            min={options?.maxTokens?.min ?? 0}
            max={options?.maxTokens?.max ?? 128000}
            step={100}
            value={props.maxTokens.value}
            onChange={(e) => props.maxTokens.replace((e.target as HTMLInputElement).valueAsNumber)}
          />
        </label>
        <a href="https://github.com/chuanqisun/iter" target="_blank">
          GitHub
        </a>
      </menu>
    </div>
  );
}
