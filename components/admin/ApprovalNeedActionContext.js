"use client";

import { createContext, useContext } from "react";

const ApprovalNeedActionContext = createContext(null);

export function ApprovalNeedActionProvider({ value, children }) {
  return (
    <ApprovalNeedActionContext.Provider value={value}>
      {children}
    </ApprovalNeedActionContext.Provider>
  );
}

export function useApprovalNeedActionCount() {
  return useContext(ApprovalNeedActionContext);
}
