import { css } from "styled-components";

export const tableStyles = css`
  /* General table styling */
  table {
    width: 100%;
    border: 1px solid var(--table-border-color);
    border-collapse: collapse;
    text-align: left;

    th,
    td {
      padding: 2px 8px;
    }

    thead th {
      font-weight: bold;
      border-bottom: 1px solid var(--table-border-color);
    }

    tr:hover {
      background-color: var(--table-hover-color);
    }
  }
`;
