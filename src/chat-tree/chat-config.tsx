import { memo } from "react";
import type { BaseConnection } from "../providers/base";
import type { ModelParameterRouteParams } from "../settings/use-model-parameter-sync";
import { useOptions } from "../settings/use-options";
import "./chat-config.css";

export type ChatConfigProps = {
  onConnectionsButtonClick: () => void;
  groupedConnections: [string, BaseConnection[] | undefined][];
} & ModelParameterRouteParams;

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
        {options?.costTier ? (
          <label>
            Cost
            <select
              className="select"
              value={props.costTier.value ?? options.costTier.at(0)}
              onChange={(e) => props.costTier.replace(e.target.value)}
            >
              {options.costTier.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {options?.sort ? (
          <label>
            Sort
            <select
              className="select"
              value={props.sort.value ?? options.sort.at(0)}
              onChange={(e) => props.sort.replace(e.target.value)}
            >
              {options.sort.map((sortOption) => (
                <option key={sortOption} value={sortOption}>
                  {sortOption}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {options?.minCodingScore ? (
          <label>
            Score
            <input
              className="input auto-width-input"
              type="number"
              min={options.minCodingScore.min ?? 0}
              max={options.minCodingScore.max ?? 1}
              step={options.minCodingScore.step ?? 0.05}
              value={props.minCodingScore.value ?? ""}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).valueAsNumber;
                props.minCodingScore.replace(isNaN(val) ? undefined : val);
              }}
            />
          </label>
        ) : null}
        {options?.temperature ? (
          <label>
            Temp
            <input
              className="input auto-width-input"
              type="number"
              min={options.temperature.min ?? 0}
              max={options.temperature.max}
              value={props.temperature.value ?? ""}
              step={0.05}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).valueAsNumber;
                props.temperature.replace(isNaN(val) ? undefined : val);
              }}
            />
          </label>
        ) : null}
        {options?.reasoningEffort ? (
          <label>
            Reason
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
              value={props.thinkingBudget.value ?? ""}
              step={100}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).valueAsNumber;
                props.thinkingBudget.replace(isNaN(val) ? undefined : val);
              }}
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
            value={props.maxTokens.value ?? ""}
            onChange={(e) => {
              const val = (e.target as HTMLInputElement).valueAsNumber;
              props.maxTokens.replace(isNaN(val) ? undefined : val);
            }}
          />
        </label>
        {options?.serviceTier ? (
          <label>
            Fast
            <input
              type="checkbox"
              checked={props.serviceTier.value === "fast"}
              onChange={(e) => props.serviceTier.replace(e.target.checked ? "fast" : "auto")}
            />
          </label>
        ) : null}
      </menu>
    </div>
  );
}
