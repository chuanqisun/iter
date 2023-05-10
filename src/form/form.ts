import styled from "styled-components";

export const BasicActionGroup = styled.div`
  display: flex;
  gap: 8px;
`;

export const BasicForm = styled.form`
  display: grid;
  gap: 8px;
`;

export const BasicFormField = styled.div`
  display: grid;
  gap: 4px;
`;

export const BasicFormButton = styled.button`
  padding: var(--input-padding-block) var(--input-padding-inline);
`;

export const BasicFormInput = styled.input`
  padding: var(--input-padding-block) var(--input-padding-inline);
`;

export const BasicFormTextarea = styled.textarea`
  padding: var(--input-padding-block) var(--input-padding-inline);
`;

export const BasicSelect = styled.select`
  padding: var(--input-padding-block) var(--input-padding-inline);
`;
